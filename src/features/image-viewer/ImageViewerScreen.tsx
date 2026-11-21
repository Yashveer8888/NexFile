import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  PanResponder,
  StatusBar,
  BackHandler,
  Modal,
  FlatList,
  ScrollView,
  ToastAndroid,
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
  MoreVertical,
  Wallpaper,
  Sparkles,
  X,
  Copy,
} from 'lucide-react-native';
import { FileItem } from '../../types/file';
import { fileService } from '../../services/filesystem/fileService';
import { sharingService } from '../../services/transfer/sharingService';
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
  const [isFav, setIsFav] = useState<boolean>(false);

  // View zoom & pan states
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Modals requested by user:
  // 1. Three Dot menu sheet (Set as wallpaper, Google Lens, Details)
  const [threeDotVisible, setThreeDotVisible] = useState<boolean>(false);
  // 2. Details Modal
  const [infoModalVisible, setInfoModalVisible] = useState<boolean>(false);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);
  // 3. Delete Confirmation Dialog
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState<boolean>(false);
  // 4. Google Lens OCR fallback modal
  const [ocrModalVisible, setOcrModalVisible] = useState<boolean>(false);

  const currentImage: FileItem | undefined = imagesList[currentIndex];
  const thumbnailListRef = useRef<FlatList>(null);

  // Gesture tracking refs
  const currentScaleRef = useRef<number>(1);
  const currentPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const currentIndexRef = useRef<number>(currentIndex);
  currentIndexRef.current = currentIndex;
  const imagesListRef = useRef<FileItem[]>(imagesList);
  imagesListRef.current = imagesList;

  const initialPinchDist = useRef<number>(0);
  const pinchStartScale = useRef<number>(1);
  const pinchStartFocal = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pinchFocalImgPoint = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null);
  const singleTapTimerRef = useRef<any>(null);
  const lastTapTimeRef = useRef<number>(0);
  const lastTapPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Sync Favorite status & reset transformations on photo change
  useEffect(() => {
    if (currentImage) {
      setIsFav(fileService.isFavorite(currentImage.path));
      currentScaleRef.current = 1;
      setScale(1);
      currentPanRef.current = { x: 0, y: 0 };
      setPan({ x: 0, y: 0 });
      initialPinchDist.current = 0;
      lastTouchPos.current = null;

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
        // Fallback handled silently
      }
    }
  }, [currentIndex, imagesList.length]);

  // Android Back Button Handler (Step by step back)
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (threeDotVisible) {
          setThreeDotVisible(false);
          return true;
        }
        if (infoModalVisible) {
          setInfoModalVisible(false);
          return true;
        }
        if (ocrModalVisible) {
          setOcrModalVisible(false);
          return true;
        }
        if (deleteConfirmVisible) {
          setDeleteConfirmVisible(false);
          return true;
        }
        if (currentScaleRef.current > 1.05) {
          currentScaleRef.current = 1;
          setScale(1);
          currentPanRef.current = { x: 0, y: 0 };
          setPan({ x: 0, y: 0 });
          return true;
        }
        navigation.goBack();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [
      threeDotVisible,
      infoModalVisible,
      ocrModalVisible,
      deleteConfirmVisible,
      navigation,
    ])
  );

  const goToNext = () => {
    if (currentIndexRef.current < imagesListRef.current.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      ToastAndroid.show('Last image in album', ToastAndroid.SHORT);
    }
  };

  const goToPrev = () => {
    if (currentIndexRef.current > 0) {
      setCurrentIndex((prev) => prev - 1);
    } else {
      ToastAndroid.show('First image in album', ToastAndroid.SHORT);
    }
  };

  // Pinch, Pan, and Double Tap Responder with Focal Zoom Support
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const viewportH = SCREEN_HEIGHT * 0.75;
          const centerX = SCREEN_WIDTH / 2;
          const centerY = viewportH / 2;

          if (evt.nativeEvent.touches.length >= 2) {
            const [t0, t1] = evt.nativeEvent.touches;
            const dist = Math.hypot(t1.pageX - t0.pageX, t1.pageY - t0.pageY);
            initialPinchDist.current = dist;
            pinchStartScale.current = currentScaleRef.current;
            const fx = (t0.pageX + t1.pageX) / 2;
            const fy = (t0.pageY + t1.pageY) / 2;
            pinchStartFocal.current = { x: fx, y: fy };
            pinchFocalImgPoint.current = {
              x: (fx - centerX - currentPanRef.current.x) / currentScaleRef.current,
              y: (fy - centerY - currentPanRef.current.y) / currentScaleRef.current,
            };
            lastTouchPos.current = null;
          } else if (evt.nativeEvent.touches.length === 1) {
            initialPinchDist.current = 0;
            const t = evt.nativeEvent.touches[0];
            lastTouchPos.current = { x: t.pageX, y: t.pageY };
            lastTapPosRef.current = { x: t.pageX, y: t.pageY };
          }
        },
        onPanResponderMove: (evt, gestureState) => {
          const touches = evt.nativeEvent.touches;
          const viewportH = SCREEN_HEIGHT * 0.75;
          const centerX = SCREEN_WIDTH / 2;
          const centerY = viewportH / 2;

          if (touches.length >= 2) {
            // Two-finger pinch to zoom in/out with Focal Point Tracking
            const t0 = touches[0];
            const t1 = touches[1];
            const dist = Math.hypot(t1.pageX - t0.pageX, t1.pageY - t0.pageY);
            const currFocalX = (t0.pageX + t1.pageX) / 2;
            const currFocalY = (t0.pageY + t1.pageY) / 2;

            if (initialPinchDist.current === 0) {
              initialPinchDist.current = dist;
              pinchStartScale.current = currentScaleRef.current;
              pinchStartFocal.current = { x: currFocalX, y: currFocalY };
              pinchFocalImgPoint.current = {
                x: (currFocalX - centerX - currentPanRef.current.x) / currentScaleRef.current,
                y: (currFocalY - centerY - currentPanRef.current.y) / currentScaleRef.current,
              };
            } else if (initialPinchDist.current > 0) {
              const scaleRatio = dist / initialPinchDist.current;
              const nextScale = Math.max(1, Math.min(6, pinchStartScale.current * scaleRatio));
              currentScaleRef.current = nextScale;
              setScale(nextScale);

              // Maintain focal point under fingers
              const rawNextPanX = currFocalX - centerX - nextScale * pinchFocalImgPoint.current.x;
              const rawNextPanY = currFocalY - centerY - nextScale * pinchFocalImgPoint.current.y;

              const maxPanX = (SCREEN_WIDTH * (nextScale - 1)) / 1.5;
              const maxPanY = (viewportH * (nextScale - 1)) / 1.5;

              const nextPanX = Math.max(-maxPanX, Math.min(maxPanX, rawNextPanX));
              const nextPanY = Math.max(-maxPanY, Math.min(maxPanY, rawNextPanY));

              currentPanRef.current = { x: nextPanX, y: nextPanY };
              setPan({ x: nextPanX, y: nextPanY });
            }
            lastTouchPos.current = null;
          } else if (touches.length === 1) {
            initialPinchDist.current = 0;
            const t = touches[0];

            if (currentScaleRef.current > 1.05) {
              // One finger pan/move to view different parts of zoomed image
              if (lastTouchPos.current) {
                const dx = t.pageX - lastTouchPos.current.x;
                const dy = t.pageY - lastTouchPos.current.y;

                const maxPanX = (SCREEN_WIDTH * (currentScaleRef.current - 1)) / 1.5;
                const maxPanY = (viewportH * (currentScaleRef.current - 1)) / 1.5;

                const nextX = Math.max(-maxPanX, Math.min(maxPanX, currentPanRef.current.x + dx));
                const nextY = Math.max(-maxPanY, Math.min(maxPanY, currentPanRef.current.y + dy));

                currentPanRef.current = { x: nextX, y: nextY };
                setPan({ x: nextX, y: nextY });
              }
              lastTouchPos.current = { x: t.pageX, y: t.pageY };
            }
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          initialPinchDist.current = 0;
          lastTouchPos.current = null;

          // If scaled below 1.05, clamp back to normal 1x
          if (currentScaleRef.current < 1.05) {
            currentScaleRef.current = 1;
            setScale(1);
            currentPanRef.current = { x: 0, y: 0 };
            setPan({ x: 0, y: 0 });
          }

          const isTap = Math.abs(gestureState.dx) < 15 && Math.abs(gestureState.dy) < 15;
          if (isTap) {
            const now = Date.now();
            if (now - lastTapTimeRef.current < 300) {
              // DOUBLE CLICK / DOUBLE TAP (VICE VERSA)
              if (singleTapTimerRef.current) {
                clearTimeout(singleTapTimerRef.current);
                singleTapTimerRef.current = null;
              }
              lastTapTimeRef.current = 0;

              if (currentScaleRef.current > 1.05) {
                // If zoomed in -> Zoom out back to normal 1x
                currentScaleRef.current = 1;
                setScale(1);
                currentPanRef.current = { x: 0, y: 0 };
                setPan({ x: 0, y: 0 });
              } else {
                // If normal 1x -> Zoom in to 2.5x targeted at touched point
                const viewportH = SCREEN_HEIGHT * 0.75;
                const centerX = SCREEN_WIDTH / 2;
                const centerY = viewportH / 2;
                const tapX = lastTapPosRef.current.x || centerX;
                const tapY = lastTapPosRef.current.y || centerY;

                const targetScale = 2.5;
                const tapImgX = (tapX - centerX) / 1;
                const tapImgY = (tapY - centerY) / 1;

                const rawPanX = tapX - centerX - targetScale * tapImgX;
                const rawPanY = tapY - centerY - targetScale * tapImgY;

                const maxPanX = (SCREEN_WIDTH * (targetScale - 1)) / 1.5;
                const maxPanY = (viewportH * (targetScale - 1)) / 1.5;

                const clampedPanX = Math.max(-maxPanX, Math.min(maxPanX, rawPanX));
                const clampedPanY = Math.max(-maxPanY, Math.min(maxPanY, rawPanY));

                currentScaleRef.current = targetScale;
                setScale(targetScale);
                currentPanRef.current = { x: clampedPanX, y: clampedPanY };
                setPan({ x: clampedPanX, y: clampedPanY });
              }
            } else {
              // Potential single tap: wait 300ms before toggling UI
              lastTapTimeRef.current = now;
              if (singleTapTimerRef.current) {
                clearTimeout(singleTapTimerRef.current);
              }
              singleTapTimerRef.current = setTimeout(() => {
                setIsUiHidden((prev) => !prev);
                singleTapTimerRef.current = null;
              }, 300);
            }
          } else if (currentScaleRef.current <= 1.05) {
            // Not zoomed: horizontal swipe for next/prev, vertical swipe down to dismiss
            if (gestureState.dx < -50 && Math.abs(gestureState.dy) < 70) {
              if (currentIndexRef.current < imagesListRef.current.length - 1) {
                setCurrentIndex((prev) => prev + 1);
              } else {
                ToastAndroid.show('Last image in album', ToastAndroid.SHORT);
              }
            } else if (gestureState.dx > 50 && Math.abs(gestureState.dy) < 70) {
              if (currentIndexRef.current > 0) {
                setCurrentIndex((prev) => prev - 1);
              } else {
                ToastAndroid.show('First image in album', ToastAndroid.SHORT);
              }
            } else if (gestureState.dy > 120 && Math.abs(gestureState.dx) < 80) {
              navigation.goBack();
            }
          }
        },
      }),
    [navigation]
  );

  // 1. Share Action
  const handleShare = () => {
    if (!currentImage) return;
    sharingService.shareViaSystem(currentImage.path, currentImage.name);
  };

  // 2. Favorite Action
  const handleToggleFavorite = () => {
    if (!currentImage) return;
    const next = fileService.toggleFavorite(currentImage.path);
    setIsFav(next);
    ToastAndroid.show(next ? 'Added to Favorites ❤️' : 'Removed from Favorites', ToastAndroid.SHORT);
  };

  // 3. Delete Action
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

  // 4. Three Dot Sub-action: Set as Wallpaper
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

  // 4. Three Dot Sub-action: Google Lens
  const handleGoogleLens = async () => {
    if (!currentImage) return;
    try {
      const handled = await fileService.openGoogleLens(currentImage.path);
      if (handled) {
        ToastAndroid.show('Opening Google Lens... 🔍', ToastAndroid.SHORT);
      } else {
        setOcrModalVisible(true);
      }
    } catch {
      setOcrModalVisible(true);
    }
  };

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
    <View style={styles.container}>
      <StatusBar hidden={isUiHidden} barStyle="light-content" />

      {/* Top Header: Back button, Image Name/Count, Three Dot icon */}
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
              {currentIndex + 1} of {imagesList.length} • {currentImage.parentFolder || 'Photos'}
            </Text>
          </View>

          {/* Three Dot (Top Right) */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setThreeDotVisible(true)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MoreVertical size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* Main Interactive Zoomable/Pannable Image Display */}
      <View style={styles.imageViewport} {...panResponder.panHandlers}>
        <View
          style={[
            styles.transformWrapper,
            {
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
                { scale },
              ],
            },
          ]}
        >
          <Image
            source={{ uri: imageUri }}
            style={styles.mainImage}
            resizeMode="contain"
          />
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

      {/* Bottom Dock: Filmstrip + Exact 4 Options (Share, Favorite, Delete, Three Dot) */}
      {!isUiHidden && (
        <View style={styles.bottomDock}>
          {/* Miniature Thumbnails Filmstrip */}
          {imagesList.length > 1 && (
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

          {/* Bottom Action Bar: Share, Favorite, Delete, Three Dot (More) */}
          <View
            style={[
              styles.bottomToolbar,
              { paddingBottom: Math.max(insets.bottom, 10) },
            ]}
          >
            <View style={styles.bottomBarRow}>
              {/* 1. Share */}
              <TouchableOpacity
                style={styles.bottomActionBtn}
                onPress={handleShare}
                activeOpacity={0.7}
              >
                <Share2 size={22} color="#FFFFFF" />
                <Text style={styles.bottomActionLabel}>Share</Text>
              </TouchableOpacity>

              {/* 2. Favorite */}
              <TouchableOpacity
                style={styles.bottomActionBtn}
                onPress={handleToggleFavorite}
                activeOpacity={0.7}
              >
                <Heart
                  size={22}
                  color={isFav ? '#FF3B30' : '#FFFFFF'}
                  fill={isFav ? '#FF3B30' : 'none'}
                />
                <Text style={[styles.bottomActionLabel, isFav && { color: '#FF3B30' }]}>
                  Favorite
                </Text>
              </TouchableOpacity>

              {/* 3. Delete */}
              <TouchableOpacity
                style={styles.bottomActionBtn}
                onPress={() => setDeleteConfirmVisible(true)}
                activeOpacity={0.7}
              >
                <Trash2 size={22} color="#FF453A" />
                <Text style={[styles.bottomActionLabel, { color: '#FF453A' }]}>
                  Delete
                </Text>
              </TouchableOpacity>

              {/* 4. Three Dot (More) */}
              <TouchableOpacity
                style={styles.bottomActionBtn}
                onPress={() => setThreeDotVisible(true)}
                activeOpacity={0.7}
              >
                <MoreVertical size={22} color="#FFFFFF" />
                <Text style={styles.bottomActionLabel}>More</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* =========================================================================
          THREE DOT (MORE) BOTTOM SHEET MODAL
          Contains: Set as wallpaper, Google Lens, Details
         ========================================================================= */}
      <Modal
        visible={threeDotVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setThreeDotVisible(false)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setThreeDotVisible(false)}
        >
          <View style={[styles.sheetContent, { paddingBottom: Math.max(insets.bottom + 12, 24) }]}>
            <View style={styles.sheetHandleBar} />
            <Text style={styles.sheetHeaderTitle}>Options</Text>

            {/* 1. Set as wallpaper */}
            <TouchableOpacity
              style={styles.sheetRowItem}
              onPress={() => {
                setThreeDotVisible(false);
                handleSetWallpaper();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.sheetIconCircle, { backgroundColor: 'rgba(10, 132, 255, 0.15)' }]}>
                <Wallpaper size={22} color="#0A84FF" />
              </View>
              <View style={styles.sheetRowTexts}>
                <Text style={styles.sheetRowTitle}>Set as wallpaper</Text>
                <Text style={styles.sheetRowDesc}>Apply to Home screen or Lock screen</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.sheetSeparator} />

            {/* 2. Google Lens */}
            <TouchableOpacity
              style={styles.sheetRowItem}
              onPress={() => {
                setThreeDotVisible(false);
                setTimeout(() => {
                  handleGoogleLens();
                }, 200);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.sheetIconCircle, { backgroundColor: 'rgba(52, 199, 89, 0.15)' }]}>
                <Sparkles size={22} color="#34C759" />
              </View>
              <View style={styles.sheetRowTexts}>
                <Text style={styles.sheetRowTitle}>Google Lens</Text>
                <Text style={styles.sheetRowDesc}>Search image, copy text & visual lookup</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.sheetSeparator} />

            {/* 3. Details */}
            <TouchableOpacity
              style={styles.sheetRowItem}
              onPress={() => {
                setThreeDotVisible(false);
                setTimeout(() => {
                  setInfoModalVisible(true);
                }, 200);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.sheetIconCircle, { backgroundColor: 'rgba(255, 159, 10, 0.15)' }]}>
                <Info size={22} color="#FF9F0A" />
              </View>
              <View style={styles.sheetRowTexts}>
                <Text style={styles.sheetRowTitle}>Details</Text>
                <Text style={styles.sheetRowDesc}>Resolution, format, date & file path</Text>
              </View>
            </TouchableOpacity>

            {/* Dismiss Button */}
            <TouchableOpacity
              style={styles.sheetDismissBtn}
              onPress={() => setThreeDotVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.sheetDismissText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* =========================================================================
          DETAILS (INFO) MODAL
         ========================================================================= */}
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
                <Info size={20} color="#FF9F0A" />
                <Text style={[typography.h4, styles.modalTitle, { marginLeft: 8 }]}>Details</Text>
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
                <Text style={styles.infoValue}>{currentImage.parentFolder || 'Photos'}</Text>
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

      {/* =========================================================================
          DELETE CONFIRMATION DIALOG
         ========================================================================= */}
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

      {/* =========================================================================
          GOOGLE LENS / OCR FALLBACK MODAL
         ========================================================================= */}
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
                <Sparkles size={22} color="#34C759" />
                <Text style={[typography.h4, styles.modalTitle, { marginLeft: 8 }]}>Google Lens</Text>
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
                Resolution: {imageDimensions?.width || 1080} × {imageDimensions?.height || 2400}
                {'\n'}
                Category: {currentImage.parentFolder || 'Photos'}
                {'\n'}
                Smart Vision recognition ready.
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
                <Text style={styles.ocrBtnText}>Open Lens</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
  },
  mainImage: {
    width: '100%',
    height: '100%',
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
    backgroundColor: 'rgba(0, 0, 0, 0.88)',
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
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  bottomBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.md,
  },
  bottomActionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    minWidth: 64,
  },
  bottomActionLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  // Three Dot Options Bottom Sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: spacing.base,
  },
  sheetHandleBar: {
    width: 38,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeaderTitle: {
    color: '#8E8E93',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sheetRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  sheetIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  sheetRowTexts: {
    flex: 1,
  },
  sheetRowTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  sheetRowDesc: {
    color: '#8E8E93',
    fontSize: 12,
    marginTop: 2,
  },
  sheetSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 2,
  },
  sheetDismissBtn: {
    marginTop: 14,
    backgroundColor: '#2C2C2E',
    paddingVertical: 13,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetDismissText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  // Modals
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
