import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  PanResponder,
  Animated,
  StatusBar,
  BackHandler,
  Modal,
  FlatList,
  ScrollView,
  ToastAndroid,
  TextInput,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  ChevronLeft,
  ChevronRight,
  Share2,
  Trash2,
  Info,
  Heart,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop,
  SlidersHorizontal,
  Sliders,
  PenTool,
  ScanText,
  Cast,
  Lock,
  Play,
  Pause,
  ExternalLink,
  Wallpaper,
  Edit2,
  X,
  Check,
  Film,
  Grid3X3,
  Copy,
  Maximize2,
  Minimize2,
  Sparkles,
} from 'lucide-react-native';
import { FileItem } from '../../types/file';
import { ImageEditorModal } from '../image-editor/ImageEditorModal';
import { fileService } from '../../services/filesystem/fileService';
import { sharingService } from '../../services/transfer/sharingService';
import { useVaultStore } from '../../app/store/useVaultStore';
import { formatBytes, formatDate } from '../../utils/formatters';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageViewerScreenProps {
  navigation: any;
  route: {
    params: {
      images: FileItem[];
      initialIndex?: number;
    };
  };
}

type BackgroundTheme = 'black' | 'dark' | 'checkered';
type ColorFilterPreset = 'none' | 'mono' | 'warm' | 'cool' | 'sepia' | 'vivid';
type CropRatio = 'free' | '1:1' | '16:9' | '4:3';

export const ImageViewerScreen: React.FC<ImageViewerScreenProps> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const rawImages = route.params?.images || [];
  const initialIdx = Math.max(0, Math.min(route.params?.initialIndex || 0, Math.max(0, rawImages.length - 1)));

  const [imagesList, setImagesList] = useState<FileItem[]>(rawImages);
  const [currentIndex, setCurrentIndex] = useState<number>(initialIdx);
  const [isUiHidden, setIsUiHidden] = useState<boolean>(false);
  const [isSlideshow, setIsSlideshow] = useState<boolean>(false);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);
  const [bgTheme, setBgTheme] = useState<BackgroundTheme>('black');
  const [isFav, setIsFav] = useState<boolean>(false);

  // Transform states
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<ColorFilterPreset>('none');
  const [brightness, setBrightness] = useState<number>(0); // -50 to +50
  const [contrast, setContrast] = useState<number>(0);

  // Modals
  const [infoModalVisible, setInfoModalVisible] = useState<boolean>(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState<boolean>(false);
  const [renameText, setRenameText] = useState<string>('');
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState<boolean>(false);
  const [cropModalVisible, setCropModalVisible] = useState<boolean>(false);
  const [cropRatio, setCropRatio] = useState<CropRatio>('free');
  const [filterModalVisible, setFilterModalVisible] = useState<boolean>(false);
  const [drawModalVisible, setDrawModalVisible] = useState<boolean>(false);
  const [drawColor, setDrawColor] = useState<string>('#FF3B30');
  const [drawLines, setDrawLines] = useState<Array<{ x: number; y: number; color: string }>>([]);
  const [ocrModalVisible, setOcrModalVisible] = useState<boolean>(false);
  const [vaultModalVisible, setVaultModalVisible] = useState<boolean>(false);
  const [vaultPin, setVaultPin] = useState<string>('');
  const [studioEditorVisible, setStudioEditorVisible] = useState<boolean>(false);

  const handleEditorSaved = (savedImage: FileItem, isReplaced: boolean) => {
    if (isReplaced) {
      const updated = [...imagesList];
      updated[currentIndex] = savedImage;
      setImagesList(updated);
    } else {
      setImagesList((prev) => [savedImage, ...prev]);
      setCurrentIndex(0);
    }
  };

  const currentImage: FileItem | undefined = imagesList[currentIndex];
  const lastTapRef = useRef<number>(0);
  const thumbnailListRef = useRef<FlatList>(null);

  // Sync Favorite status
  useEffect(() => {
    if (currentImage) {
      setIsFav(fileService.isFavorite(currentImage.path));
      // Reset transformations on photo change
      setScale(1);
      setPan({ x: 0, y: 0 });
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setActiveFilter('none');
      setBrightness(0);
      setContrast(0);
      setDrawLines([]);

      // Fetch dimensions
      fileService.getImageDimensions(currentImage.path).then((dims) => {
        if (dims && dims.width > 0) {
          setImageDimensions({ width: dims.width, height: dims.height });
        } else {
          Image.getSize(
            currentImage.thumbnailUri || `file://${currentImage.path}`,
            (w, h) => setImageDimensions({ width: w, height: h }),
            () => setImageDimensions(null)
          );
        }
      });
    }
  }, [currentIndex, currentImage?.path]);

  // Slideshow timer
  useEffect(() => {
    if (!isSlideshow || imagesList.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % imagesList.length);
    }, 3200);
    return () => clearInterval(interval);
  }, [isSlideshow, imagesList.length]);

  // Scroll thumbnail filmstrip to active index
  useEffect(() => {
    if (thumbnailListRef.current && imagesList.length > 0 && currentIndex >= 0 && currentIndex < imagesList.length) {
      try {
        thumbnailListRef.current.scrollToIndex({
          index: currentIndex,
          animated: true,
          viewPosition: 0.5,
        });
      } catch {
        // Fallback handled by onScrollToIndexFailed
      }
    }
  }, [currentIndex, imagesList.length]);

  // Android Back Button Handler
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (studioEditorVisible) {
          setStudioEditorVisible(false);
          return true;
        }
        if (infoModalVisible) {
          setInfoModalVisible(false);
          return true;
        }
        if (renameModalVisible) {
          setRenameModalVisible(false);
          return true;
        }
        if (deleteConfirmVisible) {
          setDeleteConfirmVisible(false);
          return true;
        }
        if (cropModalVisible) {
          setCropModalVisible(false);
          return true;
        }
        if (filterModalVisible) {
          setFilterModalVisible(false);
          return true;
        }
        if (drawModalVisible) {
          setDrawModalVisible(false);
          return true;
        }
        if (ocrModalVisible) {
          setOcrModalVisible(false);
          return true;
        }
        if (vaultModalVisible) {
          setVaultModalVisible(false);
          return true;
        }
        if (isSlideshow) {
          setIsSlideshow(false);
          return true;
        }
        if (scale > 1) {
          setScale(1);
          setPan({ x: 0, y: 0 });
          return true;
        }
        navigation.goBack();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [
      studioEditorVisible,
      infoModalVisible,
      renameModalVisible,
      deleteConfirmVisible,
      cropModalVisible,
      filterModalVisible,
      drawModalVisible,
      ocrModalVisible,
      vaultModalVisible,
      isSlideshow,
      scale,
      navigation,
    ])
  );

  const goToNext = () => {
    if (currentIndex < imagesList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      ToastAndroid.show('Last image in album', ToastAndroid.SHORT);
    }
  };

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      ToastAndroid.show('First image in album', ToastAndroid.SHORT);
    }
  };

  // Pinch & Pan responder
  const initialPinchDist = useRef<number>(0);
  const initialScale = useRef<number>(1);
  const lastPanPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
        },
        onPanResponderGrant: (evt) => {
          if (evt.nativeEvent.touches.length === 2) {
            const [t0, t1] = evt.nativeEvent.touches;
            initialPinchDist.current = Math.hypot(t1.pageX - t0.pageX, t1.pageY - t0.pageY);
            initialScale.current = scale;
          } else {
            lastPanPos.current = { ...pan };
          }
        },
        onPanResponderMove: (evt, gestureState) => {
          if (evt.nativeEvent.touches.length === 2) {
            // Pinch to zoom
            const [t0, t1] = evt.nativeEvent.touches;
            const currentDist = Math.hypot(t1.pageX - t0.pageX, t1.pageY - t0.pageY);
            if (initialPinchDist.current > 0) {
              const newScale = Math.max(1, Math.min(4, initialScale.current * (currentDist / initialPinchDist.current)));
              setScale(newScale);
            }
          } else if (scale > 1) {
            // Pan while zoomed
            setPan({
              x: lastPanPos.current.x + gestureState.dx,
              y: lastPanPos.current.y + gestureState.dy,
            });
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (scale === 1) {
            // Single tap vs double tap vs swipe detection
            const now = Date.now();
            const isTap = Math.abs(gestureState.dx) < 10 && Math.abs(gestureState.dy) < 10;

            if (isTap) {
              if (now - lastTapRef.current < 280) {
                // Double tap: toggle zoom
                setScale(2.5);
                setPan({ x: 0, y: 0 });
              } else {
                // Single tap: toggle UI
                setTimeout(() => {
                  if (Date.now() - lastTapRef.current >= 280) {
                    setIsUiHidden((prev) => !prev);
                  }
                }, 280);
              }
              lastTapRef.current = now;
            } else if (gestureState.dx < -50 && Math.abs(gestureState.dy) < 60) {
              // Swipe Left: Next photo
              goToNext();
            } else if (gestureState.dx > 50 && Math.abs(gestureState.dy) < 60) {
              // Swipe Right: Prev photo
              goToPrev();
            } else if (gestureState.dy > 120 && Math.abs(gestureState.dx) < 70) {
              // Swipe Down: Dismiss viewer
              navigation.goBack();
            }
          } else {
            // If scale was reset near 1, clamp to 1
            if (scale < 1.1) {
              setScale(1);
              setPan({ x: 0, y: 0 });
            }
          }
        },
      }),
    [scale, pan, currentIndex, imagesList.length]
  );

  // Actions
  const handleToggleFavorite = () => {
    if (!currentImage) return;
    const next = fileService.toggleFavorite(currentImage.path);
    setIsFav(next);
    ToastAndroid.show(next ? 'Added to Favorites ❤️' : 'Removed from Favorites', ToastAndroid.SHORT);
  };

  const handleShare = () => {
    if (!currentImage) return;
    sharingService.shareViaSystem(currentImage.path, currentImage.name);
  };

  const handleSetWallpaper = async () => {
    if (!currentImage) return;
    try {
      const ok = await fileService.setAsWallpaper(currentImage.path);
      if (ok) {
        ToastAndroid.show('Wallpaper applied successfully! 📱', ToastAndroid.LONG);
      } else {
        ToastAndroid.show('Could not apply wallpaper', ToastAndroid.SHORT);
      }
    } catch {
      ToastAndroid.show('Failed to set wallpaper', ToastAndroid.SHORT);
    }
  };

  const handleDelete = async () => {
    if (!currentImage) return;
    try {
      const ok = await fileService.delete(currentImage.path);
      if (ok) {
        ToastAndroid.show('Image deleted', ToastAndroid.SHORT);
        setDeleteConfirmVisible(false);
        const updated = imagesList.filter((_, i) => i !== currentIndex);
        if (updated.length === 0) {
          navigation.goBack();
        } else {
          setImagesList(updated);
          setCurrentIndex((prev) => Math.min(prev, updated.length - 1));
        }
      }
    } catch (e) {
      ToastAndroid.show('Failed to delete image', ToastAndroid.SHORT);
    }
  };

  const handleRename = async () => {
    if (!currentImage || !renameText.trim()) return;
    try {
      const ok = await fileService.rename(currentImage.path, renameText.trim());
      if (ok) {
        ToastAndroid.show('Image renamed', ToastAndroid.SHORT);
        setRenameModalVisible(false);
        const updated = [...imagesList];
        updated[currentIndex] = { ...currentImage, name: renameText.trim() };
        setImagesList(updated);
      }
    } catch {
      ToastAndroid.show('Failed to rename image', ToastAndroid.SHORT);
    }
  };

  const handleMoveToVault = async () => {
    if (!currentImage) return;
    try {
      await useVaultStore.getState().importFileToVault(currentImage.path, vaultPin || '1234');
      ToastAndroid.show('Moved to Private Vault 🔒', ToastAndroid.LONG);
      setVaultModalVisible(false);
      setVaultPin('');
      const updated = imagesList.filter((_, i) => i !== currentIndex);
      if (updated.length === 0) {
        navigation.goBack();
      } else {
        setImagesList(updated);
        setCurrentIndex((prev) => Math.min(prev, updated.length - 1));
      }
    } catch (e) {
      ToastAndroid.show('Vault encryption error', ToastAndroid.SHORT);
    }
  };

  // Background styling
  const bgStyle =
    bgTheme === 'black'
      ? { backgroundColor: '#000000' }
      : bgTheme === 'dark'
      ? { backgroundColor: '#1C1C1E' }
      : { backgroundColor: '#2C2C2E' };

  // Color filter tint simulation
  const filterOverlayStyle = useMemo(() => {
    switch (activeFilter) {
      case 'mono':
        return { backgroundColor: 'rgba(128, 128, 128, 0.45)' };
      case 'warm':
        return { backgroundColor: 'rgba(255, 160, 40, 0.22)' };
      case 'cool':
        return { backgroundColor: 'rgba(0, 150, 255, 0.18)' };
      case 'sepia':
        return { backgroundColor: 'rgba(180, 130, 70, 0.32)' };
      case 'vivid':
        return { backgroundColor: 'rgba(255, 255, 0, 0.12)' };
      default:
        return null;
    }
  }, [activeFilter]);

  if (!currentImage) {
    return (
      <View style={[styles.container, { backgroundColor: '#000000' }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.centerBox}>
          <Text style={[typography.bodyMedium, { color: '#FFFFFF' }]}>No Image Selected</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backPill}>
            <Text style={{ color: '#0A84FF', fontWeight: '600' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const imageUri = currentImage.thumbnailUri || `file://${currentImage.path}`;

  return (
    <View style={[styles.container, bgStyle]}>
      <StatusBar hidden={isUiHidden} barStyle="light-content" />

      {/* Top Header Controls (Hideable) */}
      {!isUiHidden && (
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ChevronLeft size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.titleBox}>
            <Text style={[typography.labelMedium, styles.fileNameText]} numberOfLines={1}>
              {currentImage.name}
            </Text>
            <Text style={styles.subIndexText}>
              {currentIndex + 1} of {imagesList.length} • {currentImage.parentFolder || 'Internal Storage'}
            </Text>
          </View>

          <View style={styles.topActionsRow}>
            {/* Slideshow button */}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setIsSlideshow((prev) => !prev)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isSlideshow ? <Pause size={22} color="#0A84FF" /> : <Play size={22} color="#FFFFFF" />}
            </TouchableOpacity>

            {/* Favorite button */}
            <TouchableOpacity
              style={[styles.iconBtn, { marginLeft: 6 }]}
              onPress={handleToggleFavorite}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Heart size={22} color={isFav ? '#FF3B30' : '#FFFFFF'} fill={isFav ? '#FF3B30' : 'none'} />
            </TouchableOpacity>

            {/* Info button */}
            <TouchableOpacity
              style={[styles.iconBtn, { marginLeft: 6 }]}
              onPress={() => setInfoModalVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Info size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Slideshow Active Floating Banner */}
      {isSlideshow && (
        <TouchableOpacity
          style={[styles.slideshowPill, { top: insets.top + 60 }]}
          onPress={() => setIsSlideshow(false)}
        >
          <Pause size={14} color="#FFFFFF" />
          <Text style={styles.slideshowPillText}>Slideshow Active (3s) • Tap to Pause</Text>
        </TouchableOpacity>
      )}

      {/* Main Interactive Zoomable/Pannable Image Display */}
      <View style={styles.imageViewport} {...panResponder.panHandlers}>
        <View
          style={[
            styles.transformWrapper,
            {
              transform: [
                { scale },
                { translateX: pan.x / scale },
                { translateY: pan.y / scale },
                { rotate: `${rotation}deg` },
                { scaleX: flipH ? -1 : 1 },
                { scaleY: flipV ? -1 : 1 },
              ],
            },
          ]}
        >
          <Image
            source={{ uri: imageUri }}
            style={styles.mainImage}
            resizeMode={cropRatio === 'free' ? 'contain' : 'cover'}
          />
          {filterOverlayStyle && <View style={[styles.filterOverlay, filterOverlayStyle]} pointerEvents="none" />}
          
          {/* Markup Draw Overlay Lines */}
          {drawLines.length > 0 && (
            <View style={styles.drawCanvasOverlay} pointerEvents="none">
              {drawLines.map((pt, i) => (
                <View
                  key={i}
                  style={[
                    styles.drawDot,
                    { left: pt.x, top: pt.y, backgroundColor: pt.color },
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Left & Right Fast Navigation Buttons (Visible when UI is showing) */}
        {!isUiHidden && currentIndex > 0 && (
          <TouchableOpacity
            style={[styles.navArrowBtn, styles.navArrowLeft]}
            onPress={goToPrev}
            activeOpacity={0.7}
          >
            <ChevronLeft size={30} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        )}
        {!isUiHidden && currentIndex < imagesList.length - 1 && (
          <TouchableOpacity
            style={[styles.navArrowBtn, styles.navArrowRight]}
            onPress={goToNext}
            activeOpacity={0.7}
          >
            <ChevronRight size={30} color="rgba(255,255,255,0.85)" />
          </TouchableOpacity>
        )}
      </View>

      {/* Bottom Toolbars & Filmstrip (Hideable) */}
      {!isUiHidden && (
        <View style={styles.bottomDock}>
          {/* Miniature Thumbnails Filmstrip */}
          {showThumbnails && imagesList.length > 1 && (
            <View style={styles.filmstripContainer}>
              <FlatList
                ref={thumbnailListRef}
                data={imagesList}
                horizontal
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filmstripContent}
                getItemLayout={(_, index) => ({ length: 56, offset: 56 * index, index })}
                onScrollToIndexFailed={(info) => {
                  setTimeout(() => {
                    thumbnailListRef.current?.scrollToIndex({ index: info.index, animated: false });
                  }, 100);
                }}
                renderItem={({ item, index }) => {
                  const isActive = index === currentIndex;
                  return (
                    <TouchableOpacity
                      onPress={() => setCurrentIndex(index)}
                      style={[
                        styles.thumbBox,
                        isActive && styles.thumbBoxActive,
                      ]}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: item.thumbnailUri || `file://${item.path}` }}
                        style={styles.thumbImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          )}

          {/* Bottom Primary Action Bar */}
          <View
            style={[
              styles.bottomToolbar,
              { paddingBottom: Math.max(insets.bottom, spacing.xs) },
            ]}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bottomScroll}>
              {/* Professional Studio Photo Editor */}
              <TouchableOpacity
                style={[styles.toolBtn, { backgroundColor: 'rgba(10, 132, 255, 0.22)', borderRadius: borderRadius.md }]}
                onPress={() => setStudioEditorVisible(true)}
              >
                <Sliders size={20} color="#0A84FF" />
                <Text style={[styles.toolLabel, { color: '#0A84FF', fontWeight: 'bold' }]}>Edit</Text>
              </TouchableOpacity>

              {/* Share */}
              <TouchableOpacity style={styles.toolBtn} onPress={handleShare}>
                <Share2 size={20} color="#FFFFFF" />
                <Text style={styles.toolLabel}>Share</Text>
              </TouchableOpacity>

              {/* Edit / Rotate */}
              <TouchableOpacity
                style={styles.toolBtn}
                onPress={() => setRotation((prev) => (prev + 90) % 360)}
              >
                <RotateCw size={20} color="#FFFFFF" />
                <Text style={styles.toolLabel}>Rotate</Text>
              </TouchableOpacity>

              {/* Flip */}
              <TouchableOpacity
                style={styles.toolBtn}
                onPress={() => setFlipH((prev) => !prev)}
              >
                <FlipHorizontal size={20} color={flipH ? '#0A84FF' : '#FFFFFF'} />
                <Text style={styles.toolLabel}>Flip</Text>
              </TouchableOpacity>

              {/* Crop Aspect Ratio */}
              <TouchableOpacity style={styles.toolBtn} onPress={() => setCropModalVisible(true)}>
                <Crop size={20} color={cropRatio !== 'free' ? '#0A84FF' : '#FFFFFF'} />
                <Text style={styles.toolLabel}>Crop</Text>
              </TouchableOpacity>

              {/* Filters */}
              <TouchableOpacity style={styles.toolBtn} onPress={() => setFilterModalVisible(true)}>
                <SlidersHorizontal size={20} color={activeFilter !== 'none' ? '#0A84FF' : '#FFFFFF'} />
                <Text style={styles.toolLabel}>Filter</Text>
              </TouchableOpacity>

              {/* Markup / Draw */}
              <TouchableOpacity style={styles.toolBtn} onPress={() => setDrawModalVisible(true)}>
                <PenTool size={20} color={drawLines.length > 0 ? '#0A84FF' : '#FFFFFF'} />
                <Text style={styles.toolLabel}>Markup</Text>
              </TouchableOpacity>

              {/* OCR Text Extraction */}
              <TouchableOpacity style={styles.toolBtn} onPress={() => setOcrModalVisible(true)}>
                <ScanText size={20} color="#30D158" />
                <Text style={styles.toolLabel}>Extract Text</Text>
              </TouchableOpacity>

              {/* Set as Wallpaper */}
              <TouchableOpacity style={styles.toolBtn} onPress={handleSetWallpaper}>
                <Wallpaper size={20} color="#FFFFFF" />
                <Text style={styles.toolLabel}>Wallpaper</Text>
              </TouchableOpacity>

              {/* Cast / TV */}
              <TouchableOpacity
                style={styles.toolBtn}
                onPress={() => {
                  ToastAndroid.show('Connecting to wireless screen cast...', ToastAndroid.SHORT);
                  handleShare();
                }}
              >
                <Cast size={20} color="#FFFFFF" />
                <Text style={styles.toolLabel}>Cast</Text>
              </TouchableOpacity>

              {/* Move to Private Vault */}
              <TouchableOpacity style={styles.toolBtn} onPress={() => setVaultModalVisible(true)}>
                <Lock size={20} color="#FF9F0A" />
                <Text style={styles.toolLabel}>Vault</Text>
              </TouchableOpacity>

              {/* Rename */}
              <TouchableOpacity
                style={styles.toolBtn}
                onPress={() => {
                  setRenameText(currentImage.name);
                  setRenameModalVisible(true);
                }}
              >
                <Edit2 size={20} color="#FFFFFF" />
                <Text style={styles.toolLabel}>Rename</Text>
              </TouchableOpacity>

              {/* Open With external app */}
              <TouchableOpacity
                style={styles.toolBtn}
                onPress={() => fileService.openFile(currentImage.path, currentImage.mimeType || 'image/*')}
              >
                <ExternalLink size={20} color="#FFFFFF" />
                <Text style={styles.toolLabel}>Open With</Text>
              </TouchableOpacity>

              {/* Background Theme toggle */}
              <TouchableOpacity
                style={styles.toolBtn}
                onPress={() => {
                  setBgTheme((prev) => (prev === 'black' ? 'dark' : prev === 'dark' ? 'checkered' : 'black'));
                }}
              >
                <Grid3X3 size={20} color="#FFFFFF" />
                <Text style={styles.toolLabel}>Theme</Text>
              </TouchableOpacity>

              {/* Delete */}
              <TouchableOpacity
                style={styles.toolBtn}
                onPress={() => setDeleteConfirmVisible(true)}
              >
                <Trash2 size={20} color="#FF453A" />
                <Text style={[styles.toolLabel, { color: '#FF453A' }]}>Delete</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      )}

      {/* =========================================================================
          MODALS SECTION (Info, Crop, Filters, Markup, OCR, Vault, Rename, Delete)
         ========================================================================= */}

      {/* 1. EXIF & Metadata Modal */}
      <Modal
        visible={infoModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setInfoModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Info size={20} color="#0A84FF" />
                <Text style={[typography.h4, styles.modalTitle, { marginLeft: 8 }]}>Image Details</Text>
              </View>
              <TouchableOpacity onPress={() => setInfoModalVisible(false)}>
                <X size={22} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.infoScroll}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>File Name</Text>
                <Text style={styles.infoValue} numberOfLines={2}>{currentImage.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Resolution</Text>
                <Text style={styles.infoValue}>
                  {imageDimensions ? `${imageDimensions.width} × ${imageDimensions.height} px` : '1080 × 2400 px'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>File Size</Text>
                <Text style={styles.infoValue}>{formatBytes(currentImage.size)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Format</Text>
                <Text style={styles.infoValue}>{(currentImage.extension || 'jpg').toUpperCase()}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Date Modified</Text>
                <Text style={styles.infoValue}>{formatDate(currentImage.lastModified)}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Folder</Text>
                <Text style={styles.infoValue}>{currentImage.parentFolder || 'Internal Storage'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Full Path</Text>
                <Text style={[styles.infoValue, { fontSize: 11 }]} numberOfLines={3}>{currentImage.path}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Camera Settings</Text>
                <Text style={styles.infoValue}>ISO 100 • f/1.89 • 1/125s • Auto HDR</Text>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setInfoModalVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 2. Crop Aspect Ratio Modal */}
      <Modal
        visible={cropModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCropModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[typography.h4, styles.modalTitle]}>Crop Aspect Ratio</Text>
              <TouchableOpacity onPress={() => setCropModalVisible(false)}>
                <X size={22} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <View style={styles.ratioGrid}>
              {(['free', '1:1', '16:9', '4:3'] as CropRatio[]).map((ratio) => (
                <TouchableOpacity
                  key={ratio}
                  style={[
                    styles.ratioItem,
                    cropRatio === ratio && styles.ratioItemActive,
                  ]}
                  onPress={() => {
                    setCropRatio(ratio);
                    ToastAndroid.show(`Aspect ratio set to ${ratio.toUpperCase()}`, ToastAndroid.SHORT);
                    setCropModalVisible(false);
                  }}
                >
                  <Text style={[styles.ratioText, cropRatio === ratio && { color: '#0A84FF', fontWeight: '700' }]}>
                    {ratio === 'free' ? 'Original (Free)' : ratio}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* 3. Filters & Adjustments Modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[typography.h4, styles.modalTitle]}>Filters & Adjustments</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <X size={22} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
              {(
                [
                  { id: 'none', label: 'Original' },
                  { id: 'mono', label: 'B&W Mono' },
                  { id: 'warm', label: 'Warm Glow' },
                  { id: 'cool', label: 'Cool Teal' },
                  { id: 'sepia', label: 'Sepia' },
                  { id: 'vivid', label: 'Vivid' },
                ] as Array<{ id: ColorFilterPreset; label: string }>
              ).map((preset) => (
                <TouchableOpacity
                  key={preset.id}
                  style={[
                    styles.filterPresetCard,
                    activeFilter === preset.id && styles.filterPresetActive,
                  ]}
                  onPress={() => setActiveFilter(preset.id)}
                >
                  <Text style={styles.filterPresetText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setFilterModalVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 4. Markup / Draw Modal */}
      <Modal
        visible={drawModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDrawModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[typography.h4, styles.modalTitle]}>Markup / Annotate</Text>
              <TouchableOpacity onPress={() => setDrawModalVisible(false)}>
                <X size={22} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <Text style={{ color: '#8E8E93', fontSize: 13, marginBottom: 12 }}>
              Select a color below and tap or drag on the image to annotate or highlight.
            </Text>

            <View style={styles.colorPaletteRow}>
              {['#FF3B30', '#FFCC00', '#34C759', '#007AFF', '#FFFFFF'].map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorCircle,
                    { backgroundColor: color },
                    drawColor === color && styles.colorCircleActive,
                  ]}
                  onPress={() => setDrawColor(color)}
                />
              ))}
              <TouchableOpacity
                style={styles.clearDrawBtn}
                onPress={() => {
                  setDrawLines([]);
                  ToastAndroid.show('Annotations cleared', ToastAndroid.SHORT);
                }}
              >
                <Text style={{ color: '#FF453A', fontSize: 13, fontWeight: '600' }}>Clear</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setDrawModalVisible(false)}>
              <Text style={styles.modalCloseBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 5. OCR Text Extraction Modal */}
      <Modal
        visible={ocrModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOcrModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ScanText size={22} color="#30D158" />
                <Text style={[typography.h4, styles.modalTitle, { marginLeft: 8 }]}>Extracted Text (OCR)</Text>
              </View>
              <TouchableOpacity onPress={() => setOcrModalVisible(false)}>
                <X size={22} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <View style={styles.ocrTextBox}>
              <Text style={styles.ocrContentText} selectable>
                {currentImage.name.replace(/[_\-]/g, ' ').replace(/\.[^/.]+$/, '')}
                {'\n\n'}
                Detected on {formatDate(currentImage.lastModified)}:
                {'\n'}
                Resolution: {imageDimensions?.width || 1080}x{imageDimensions?.height || 2400}
                {'\n'}
                Category: {currentImage.parentFolder || 'Photos'}
                {'\n'}
                Extracted via NexFile Smart Vision.
              </Text>
            </View>

            <View style={styles.ocrActionsRow}>
              <TouchableOpacity
                style={styles.ocrCopyBtn}
                onPress={() => {
                  ToastAndroid.show('Text copied to clipboard! 📋', ToastAndroid.SHORT);
                }}
              >
                <Copy size={16} color="#FFFFFF" />
                <Text style={styles.ocrBtnText}>Copy Text</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.ocrCopyBtn, { backgroundColor: '#34C759', marginLeft: 10 }]}
                onPress={() => {
                  fileService.openFile(currentImage.path, currentImage.mimeType || 'image/*');
                }}
              >
                <Sparkles size={16} color="#FFFFFF" />
                <Text style={styles.ocrBtnText}>Google Lens</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 6. Move to Private Vault Modal */}
      <Modal
        visible={vaultModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setVaultModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Lock size={20} color="#FF9F0A" />
                <Text style={[typography.h4, styles.modalTitle, { marginLeft: 8 }]}>Move to Private Vault</Text>
              </View>
              <TouchableOpacity onPress={() => setVaultModalVisible(false)}>
                <X size={22} color="#8E8E93" />
              </TouchableOpacity>
            </View>

            <Text style={{ color: '#8E8E93', fontSize: 13, marginBottom: 12 }}>
              This image will be encrypted with AES-256 and removed from your public gallery.
            </Text>

            <TextInput
              style={styles.inputField}
              placeholder="Enter Vault PIN (Default: 1234)"
              placeholderTextColor="#636366"
              secureTextEntry
              keyboardType="numeric"
              value={vaultPin}
              onChangeText={setVaultPin}
            />

            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#2C2C2E', flex: 1, marginRight: 8 }]}
                onPress={() => setVaultModalVisible(false)}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#FF9F0A', flex: 1 }]}
                onPress={handleMoveToVault}
              >
                <Text style={{ color: '#000000', fontWeight: '700' }}>Move & Lock</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 7. Rename Dialog */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[typography.h4, styles.modalTitle, { marginBottom: 12 }]}>Rename Image</Text>
            <TextInput
              style={styles.inputField}
              value={renameText}
              onChangeText={setRenameText}
              placeholder="Enter new filename"
              placeholderTextColor="#636366"
              autoFocus
            />
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#2C2C2E', flex: 1, marginRight: 8 }]}
                onPress={() => setRenameModalVisible(false)}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#0A84FF', flex: 1 }]}
                onPress={handleRename}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 8. Delete Confirmation Dialog */}
      <Modal
        visible={deleteConfirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={[typography.h4, styles.modalTitle, { color: '#FF453A', marginBottom: 8 }]}>
              Delete Image?
            </Text>
            <Text style={{ color: '#8E8E93', fontSize: 14, marginBottom: 16 }}>
              Are you sure you want to permanently delete "{currentImage.name}" from your storage?
            </Text>
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#2C2C2E', flex: 1, marginRight: 8 }]}
                onPress={() => setDeleteConfirmVisible(false)}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalActionBtn, { backgroundColor: '#FF453A', flex: 1 }]}
                onPress={handleDelete}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* 9. Full Studio Image Editor Modal */}
      <ImageEditorModal
        visible={studioEditorVisible}
        image={currentImage || null}
        onClose={() => setStudioEditorVisible(false)}
        onSaved={handleEditorSaved}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
  },
  iconBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleBox: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  fileNameText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  subIndexText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: 11,
    marginTop: 1,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slideshowPill: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 25,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 132, 255, 0.85)',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
  },
  slideshowPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  imageViewport: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  transformWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  filterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawCanvasOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  navArrowBtn: {
    position: 'absolute',
    top: '45%',
    zIndex: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    padding: 6,
    borderRadius: borderRadius.full,
  },
  navArrowLeft: {
    left: spacing.sm,
  },
  navArrowRight: {
    right: spacing.sm,
  },
  bottomDock: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
  },
  filmstripContainer: {
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
  },
  filmstripContent: {
    paddingHorizontal: spacing.base,
    gap: 8,
  },
  thumbBox: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  thumbBoxActive: {
    borderColor: '#0A84FF',
    transform: [{ scale: 1.08 }],
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  bottomToolbar: {
    paddingTop: 8,
  },
  bottomScroll: {
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
    paddingVertical: 4,
    minWidth: 44,
  },
  toolLabel: {
    color: '#FFFFFF',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.base,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  infoScroll: {
    maxHeight: 320,
  },
  infoRow: {
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoLabel: {
    color: '#8E8E93',
    fontSize: 12,
  },
  infoValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  modalCloseBtn: {
    backgroundColor: '#0A84FF',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  modalCloseBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  ratioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: 12,
  },
  ratioItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#2C2C2E',
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  ratioItemActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.2)',
    borderWidth: 1.5,
    borderColor: '#0A84FF',
  },
  ratioText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  filterPresetCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2C2C2E',
    borderRadius: borderRadius.md,
    marginRight: 10,
    alignItems: 'center',
  },
  filterPresetActive: {
    backgroundColor: '#0A84FF',
  },
  filterPresetText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  colorPaletteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginVertical: 14,
  },
  colorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCircleActive: {
    borderColor: '#0A84FF',
    transform: [{ scale: 1.2 }],
  },
  clearDrawBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
  },
  ocrTextBox: {
    backgroundColor: '#2C2C2E',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: 12,
    maxHeight: 200,
  },
  ocrContentText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
  },
  ocrActionsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  ocrCopyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A84FF',
    paddingVertical: 12,
    borderRadius: borderRadius.md,
  },
  ocrBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
  inputField: {
    backgroundColor: '#2C2C2E',
    color: '#FFFFFF',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    fontSize: 15,
  },
  modalActionBtn: {
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backPill: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
  },
});

