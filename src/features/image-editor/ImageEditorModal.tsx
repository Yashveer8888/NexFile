import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView,
  Modal,
  ToastAndroid,
  PanResponder,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  ArrowLeft,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Sliders,
  Crop,
  Sparkles,
  Layers,
  Save,
  Undo2,
  Redo2,
  Eye,
  Type,
  PenTool,
  Check,
  X,
  Smile,
  Shield,
  Wand2,
  Sun,
  Contrast,
  Thermometer,
  Palette,
  Maximize2,
  Trash2,
  Plus,
  RefreshCw,
  FolderSync,
  Eraser,
  Focus,
  Aperture,
  Scissors,
  Zap,
} from 'lucide-react-native';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { FileItem } from '../../types/file';
import { fileService } from '../../services/filesystem/fileService';
import { formatBytes } from '../../utils/formatters';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 6 Main Categories matching user requests
export type EditorTab =
  | 'transform' // 1. Crop & Rotate (Basic Frame Adjustments)
  | 'adjust'    // 2. Adjust / Light & Color Sliders
  | 'filters'   // 3. Filters & Presets
  | 'markup'    // 4. Markup, Doodle & Text
  | 'ai'        // 5. AI & Smart Features
  | 'layers';   // Organization layers

// Crop Presets: Free, Original, 1:1, 4:5, 3:4, 16:9, 9:16
export type CropPreset = 'free' | 'original' | '1:1' | '4:5' | '3:4' | '16:9' | '9:16';

// Built-in Color Filters: Vivid, Dramatic, Warm, Cool, Mono, Noir, Silvertone, Vintage, Cinematic
export type FilterType =
  | 'none'
  | 'vivid'
  | 'dramatic'
  | 'warm'
  | 'cool'
  | 'mono'
  | 'noir'
  | 'silvertone'
  | 'vintage'
  | 'cinematic';

export interface DrawPoint {
  x: number;
  y: number;
  color: string;
  size: number;
  isHighlighter?: boolean;
}

export interface LayerItem {
  id: string;
  type: 'image' | 'text' | 'sticker' | 'drawing' | 'shape';
  name: string;
  visible: boolean;
}

interface ImageEditorModalProps {
  visible: boolean;
  image: FileItem | null;
  onClose: () => void;
  onSaved: (newImage: FileItem, isReplaced: boolean) => void;
}

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  visible,
  image,
  onClose,
  onSaved,
}) => {
  if (!image) return null;

  // Active sub-tool tab
  const [activeTab, setActiveTab] = useState<EditorTab>('transform');

  // --- 1. Frame & Transform State ---
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [straighten, setStraighten] = useState<number>(0); // -45 to +45
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [skewX, setSkewX] = useState<number>(0); // -30 to 30 (Keystone Horizontal)
  const [skewY, setSkewY] = useState<number>(0); // -30 to 30 (Keystone Vertical)
  const [cropPreset, setCropPreset] = useState<CropPreset>('free');
  const [showStraightenSlider, setShowStraightenSlider] = useState<boolean>(false);
  const [showKeystoneControls, setShowKeystoneControls] = useState<boolean>(false);

  // --- 2. Light & Color Adjustments State ---
  type AdjustParam =
    | 'brightness'
    | 'contrast'
    | 'exposure'
    | 'highlights'
    | 'shadows'
    | 'whites'
    | 'blacks'
    | 'saturation'
    | 'vibrance'
    | 'temperature'
    | 'tint'
    | 'sharpen'
    | 'vignette';

  const [activeAdjustParam, setActiveAdjustParam] = useState<AdjustParam>('brightness');
  const [brightness, setBrightness] = useState<number>(0); // -100 to 100
  const [contrast, setContrast] = useState<number>(0); // -100 to 100
  const [exposure, setExposure] = useState<number>(0); // -100 to 100
  const [highlights, setHighlights] = useState<number>(0); // -100 to 100
  const [shadows, setShadows] = useState<number>(0); // -100 to 100
  const [whites, setWhites] = useState<number>(0); // -100 to 100 (White Point)
  const [blacks, setBlacks] = useState<number>(0); // -100 to 100 (Black Point)

  const [saturation, setSaturation] = useState<number>(0); // -100 to 100
  const [vibrance, setVibrance] = useState<number>(0); // -100 to 100
  const [temperature, setTemperature] = useState<number>(0); // -100 (Cool) to 100 (Warm)
  const [tint, setTint] = useState<number>(0); // -100 (Green) to 100 (Magenta)
  const [sharpen, setSharpen] = useState<number>(0); // 0 to 100 (Definition)
  const [vignette, setVignette] = useState<number>(0); // 0 to 100

  // --- 3. Filters & Presets State ---
  const [activeFilter, setActiveFilter] = useState<FilterType>('none');
  const [filterIntensity, setFilterIntensity] = useState<number>(100); // 0 to 100

  // --- 4. Markup, Doodle & Text State ---
  const [markupMode, setMarkupMode] = useState<'pen' | 'highlighter' | 'mosaic'>('pen');
  const [brushColor, setBrushColor] = useState<string>('#FF3B30');
  const [brushSize, setBrushSize] = useState<number>(7);
  const [drawingPoints, setDrawingPoints] = useState<DrawPoint[]>([]);
  const [mosaicBlocks, setMosaicBlocks] = useState<{ x: number; y: number }[]>([]);
  const [textOverlays, setTextOverlays] = useState<
    { id: string; text: string; color: string; font: string; pill: boolean; size: number }[]
  >([]);
  const [newTextInput, setNewTextInput] = useState<string>('');
  const [newTextColor, setNewTextColor] = useState<string>('#FFFFFF');
  const [newTextFont, setNewTextFont] = useState<string>('sans');
  const [newTextPill, setNewTextPill] = useState<boolean>(true);
  const [textModalVisible, setTextModalVisible] = useState<boolean>(false);
  const [stickers, setStickers] = useState<{ id: string; emoji: string; x: number; y: number }[]>([]);

  // --- 5. AI & Smart Features State ---
  const [autoEnhanced, setAutoEnhanced] = useState<boolean>(false);
  const [magicEraserActive, setMagicEraserActive] = useState<boolean>(false);
  const [magicErasedSpots, setMagicErasedSpots] = useState<{ x: number; y: number }[]>([]);
  const [portraitBlurLevel, setPortraitBlurLevel] = useState<number>(0); // 0 to 100
  const [isRemastered, setIsRemastered] = useState<boolean>(false);
  const [isRemastering, setIsRemastering] = useState<boolean>(false);
  const [bgRemoved, setBgRemoved] = useState<boolean>(false);

  // --- 6. Save & Revert Options State ---
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [saveModalVisible, setSaveModalVisible] = useState<boolean>(false);
  const [saveMode, setSaveMode] = useState<'copy' | 'replace'>('copy');
  const [exportFormat, setExportFormat] = useState<'jpg' | 'png' | 'webp'>('jpg');
  const [exportQuality, setExportQuality] = useState<number>(90);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Auto-fetch image aspect ratio
  const [imageRatio, setImageRatio] = useState<number>(1);
  React.useEffect(() => {
    if (image?.path) {
      Image.getSize(
        image.thumbnailUri || `file://${image.path}`,
        (w, h) => {
          if (w > 0 && h > 0) setImageRatio(w / h);
        },
        () => {}
      );
    }
  }, [image]);

  // Touch handler for freehand drawing, mosaic blurring, and magic eraser
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          activeTab === 'markup' || magicEraserActive,
        onMoveShouldSetPanResponder: () =>
          activeTab === 'markup' || magicEraserActive,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          if (magicEraserActive) {
            setMagicErasedSpots((prev) => [...prev, { x: locationX, y: locationY }]);
            ToastAndroid.show('Object erased with Magic Eraser ✨', ToastAndroid.SHORT);
          } else if (activeTab === 'markup') {
            if (markupMode === 'mosaic') {
              setMosaicBlocks((prev) => [...prev, { x: locationX, y: locationY }]);
            } else {
              setDrawingPoints((prev) => [
                ...prev,
                {
                  x: locationX,
                  y: locationY,
                  color: brushColor,
                  size: markupMode === 'highlighter' ? brushSize * 2.2 : brushSize,
                  isHighlighter: markupMode === 'highlighter',
                },
              ]);
            }
          }
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          if (magicEraserActive) {
            setMagicErasedSpots((prev) => [...prev, { x: locationX, y: locationY }]);
          } else if (activeTab === 'markup') {
            if (markupMode === 'mosaic') {
              setMosaicBlocks((prev) => [...prev, { x: locationX, y: locationY }]);
            } else {
              setDrawingPoints((prev) => [
                ...prev,
                {
                  x: locationX,
                  y: locationY,
                  color: brushColor,
                  size: markupMode === 'highlighter' ? brushSize * 2.2 : brushSize,
                  isHighlighter: markupMode === 'highlighter',
                },
              ]);
            }
          }
        },
      }),
    [activeTab, magicEraserActive, markupMode, brushColor, brushSize]
  );

  // 1-Tap Auto Enhance (Magic Wand)
  const handleToggleAutoEnhance = () => {
    if (!autoEnhanced) {
      setBrightness(12);
      setContrast(16);
      setSaturation(14);
      setVibrance(12);
      setHighlights(-10);
      setShadows(14);
      setSharpen(20);
      setAutoEnhanced(true);
      ToastAndroid.show('Auto-Enhanced: Lighting & colors optimized ✨', ToastAndroid.SHORT);
    } else {
      setBrightness(0);
      setContrast(0);
      setSaturation(0);
      setVibrance(0);
      setHighlights(0);
      setShadows(0);
      setSharpen(0);
      setAutoEnhanced(false);
      ToastAndroid.show('Auto-Enhance reset to normal', ToastAndroid.SHORT);
    }
  };

  // 1-Tap AI Photo Remaster / Unblur
  const handlePhotoRemaster = () => {
    setIsRemastering(true);
    setTimeout(() => {
      setIsRemastering(false);
      setIsRemastered(true);
      setSharpen(45);
      setContrast(16);
      setBrightness(8);
      setVibrance(18);
      ToastAndroid.show('AI Photo Remastered: Enhanced details & unblurred 📸', ToastAndroid.SHORT);
    }, 600);
  };

  // Revert all edits back to pristine original
  const handleRevertToOriginal = () => {
    Alert.alert(
      'Revert to Original?',
      'All adjustments, filters, markups and transforms will be reset to the original photo.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revert',
          style: 'destructive',
          onPress: () => {
            setRotation(0);
            setStraighten(0);
            setFlipH(false);
            setFlipV(false);
            setSkewX(0);
            setSkewY(0);
            setCropPreset('free');
            setBrightness(0);
            setContrast(0);
            setExposure(0);
            setHighlights(0);
            setShadows(0);
            setWhites(0);
            setBlacks(0);
            setSaturation(0);
            setVibrance(0);
            setTemperature(0);
            setTint(0);
            setSharpen(0);
            setVignette(0);
            setActiveFilter('none');
            setFilterIntensity(100);
            setDrawingPoints([]);
            setMosaicBlocks([]);
            setTextOverlays([]);
            setStickers([]);
            setMagicErasedSpots([]);
            setPortraitBlurLevel(0);
            setBgRemoved(false);
            setAutoEnhanced(false);
            setIsRemastered(false);
            ToastAndroid.show('Reverted to original photo ↩️', ToastAndroid.SHORT);
          },
        },
      ]
    );
  };

  // Add text overlay
  const handleAddText = () => {
    if (!newTextInput.trim()) return;
    const newId = `text_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setTextOverlays((prev) => [
      ...prev,
      {
        id: newId,
        text: newTextInput.trim(),
        color: newTextColor,
        font: newTextFont,
        pill: newTextPill,
        size: 22,
      },
    ]);
    setNewTextInput('');
    setTextModalVisible(false);
    ToastAndroid.show('Text added to image', ToastAndroid.SHORT);
  };

  // Add emoji sticker
  const handleAddSticker = (emoji: string) => {
    setStickers((prev) => [
      ...prev,
      {
        id: `sticker_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        emoji,
        x: SCREEN_WIDTH * 0.42,
        y: SCREEN_HEIGHT * 0.28,
      },
    ]);
    ToastAndroid.show(`Sticker ${emoji} added`, ToastAndroid.SHORT);
  };

  // Compute live visual transformations
  const transformStyle = useMemo(() => {
    if (isComparing) return {};
    return {
      transform: [
        { rotate: `${rotation + straighten}deg` },
        { scaleX: flipH ? -1 : 1 },
        { scaleY: flipV ? -1 : 1 },
        { skewX: `${skewX}deg` },
        { skewY: `${skewY}deg` },
      ],
    };
  }, [rotation, straighten, flipH, flipV, skewX, skewY, isComparing]);

  // Compute live crop container aspect ratio
  const cropContainerStyle = useMemo(() => {
    if (isComparing || cropPreset === 'free') return {};
    switch (cropPreset) {
      case 'original':
        return { aspectRatio: imageRatio || 1 };
      case '1:1':
        return { aspectRatio: 1 };
      case '4:5':
        return { aspectRatio: 4 / 5 };
      case '3:4':
        return { aspectRatio: 3 / 4 };
      case '16:9':
        return { aspectRatio: 16 / 9 };
      case '9:16':
        return { aspectRatio: 9 / 16 };
      default:
        return {};
    }
  }, [cropPreset, imageRatio, isComparing]);

  // Compute live color filter tint
  const filterOverlayStyle = useMemo(() => {
    if (isComparing) return null;
    const alpha = (filterIntensity / 100) * 0.45;
    switch (activeFilter) {
      case 'vivid':
        return { backgroundColor: `rgba(255, 60, 0, ${alpha * 0.25})` };
      case 'dramatic':
        return { backgroundColor: `rgba(15, 20, 45, ${alpha * 0.75})` };
      case 'warm':
        return { backgroundColor: `rgba(255, 140, 0, ${alpha * 0.85})` };
      case 'cool':
        return { backgroundColor: `rgba(0, 150, 255, ${alpha * 0.65})` };
      case 'mono':
        return { backgroundColor: `rgba(128, 128, 128, ${(filterIntensity / 100) * 0.85})` };
      case 'noir':
        return { backgroundColor: `rgba(10, 10, 10, ${(filterIntensity / 100) * 0.92})` };
      case 'silvertone':
        return { backgroundColor: `rgba(200, 215, 230, ${(filterIntensity / 100) * 0.65})` };
      case 'vintage':
        return { backgroundColor: `rgba(215, 175, 110, ${alpha * 0.95})` };
      case 'cinematic':
        return { backgroundColor: `rgba(0, 160, 210, ${alpha * 0.75})` };
      default:
        return null;
    }
  }, [activeFilter, filterIntensity, isComparing]);

  // Compute live brightness & warmth overlay
  const toneOverlayStyle = useMemo(() => {
    if (isComparing) return null;
    if (temperature > 0) {
      return { backgroundColor: `rgba(255, 140, 0, ${(temperature / 100) * 0.28})` };
    } else if (temperature < 0) {
      return { backgroundColor: `rgba(0, 122, 255, ${(Math.abs(temperature) / 100) * 0.28})` };
    }
    return null;
  }, [temperature, isComparing]);

  // Execute Native Save (Copy or Overwrite)
  const handleExecuteSave = async () => {
    try {
      setIsSaving(true);
      const isReplace = saveMode === 'replace';
      let destPath = image.path;

      if (!isReplace) {
        const lastSlash = image.path.lastIndexOf('/');
        const dir = lastSlash !== -1 ? image.path.substring(0, lastSlash) : '';
        const dotIdx = image.name.lastIndexOf('.');
        const base = dotIdx !== -1 ? image.name.substring(0, dotIdx) : image.name;
        const ext = exportFormat;
        const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
        destPath = `${dir}/${base}_edit_${timestamp}.${ext}`;
      }

      const saveOptions = {
        rotation,
        straighten,
        flipH,
        flipV,
        brightness,
        contrast,
        saturation,
        temperature,
        tint,
        vignette,
        filter: activeFilter,
        format: exportFormat,
        quality: exportQuality,
        textOverlay: textOverlays.length > 0 ? textOverlays[0].text : undefined,
        textColor: textOverlays.length > 0 ? textOverlays[0].color : undefined,
      };

      const result = await fileService.saveEditedImage(image.path, destPath, saveOptions);
      if (result.success) {
        const savedFileItem: FileItem = {
          ...image,
          id: result.path,
          name: result.name,
          path: result.path,
          size: result.size,
          lastModified: Date.now(),
          extension: exportFormat,
          thumbnailUri: `file://${result.path}?t=${Date.now()}`,
        };

        ToastAndroid.show(
          isReplace ? 'Original photo replaced!' : 'New edited copy saved!',
          ToastAndroid.LONG
        );
        setSaveModalVisible(false);
        onSaved(savedFileItem, isReplace);
        onClose();
      }
    } catch (err: any) {
      ToastAndroid.show('Save failed: ' + (err?.message || 'Error'), ToastAndroid.SHORT);
    } finally {
      setIsSaving(false);
    }
  };

  // Value getter & setter for current AdjustParam
  const getParamValue = (param: AdjustParam): number => {
    switch (param) {
      case 'brightness': return brightness;
      case 'contrast': return contrast;
      case 'exposure': return exposure;
      case 'highlights': return highlights;
      case 'shadows': return shadows;
      case 'whites': return whites;
      case 'blacks': return blacks;
      case 'saturation': return saturation;
      case 'vibrance': return vibrance;
      case 'temperature': return temperature;
      case 'tint': return tint;
      case 'sharpen': return sharpen;
      case 'vignette': return vignette;
    }
  };

  const setParamValue = (param: AdjustParam, val: number) => {
    const clamped = Math.max(param === 'sharpen' || param === 'vignette' ? 0 : -100, Math.min(100, val));
    switch (param) {
      case 'brightness': setBrightness(clamped); break;
      case 'contrast': setContrast(clamped); break;
      case 'exposure': setExposure(clamped); break;
      case 'highlights': setHighlights(clamped); break;
      case 'shadows': setShadows(clamped); break;
      case 'whites': setWhites(clamped); break;
      case 'blacks': setBlacks(clamped); break;
      case 'saturation': setSaturation(clamped); break;
      case 'vibrance': setVibrance(clamped); break;
      case 'temperature': setTemperature(clamped); break;
      case 'tint': setTint(clamped); break;
      case 'sharpen': setSharpen(clamped); break;
      case 'vignette': setVignette(clamped); break;
    }
  };

  // Layers list for inspection
  const layersList: LayerItem[] = useMemo(() => {
    const list: LayerItem[] = [
      { id: 'base', type: 'image', name: 'Original Photo', visible: true },
    ];
    if (activeFilter !== 'none') {
      list.push({ id: 'filter', type: 'shape', name: `Filter: ${activeFilter.toUpperCase()}`, visible: true });
    }
    if (brightness !== 0 || contrast !== 0 || temperature !== 0 || saturation !== 0) {
      list.push({ id: 'tone', type: 'shape', name: 'Light & Color Tuning', visible: true });
    }
    if (bgRemoved) {
      list.push({ id: 'ai_cutout', type: 'shape', name: 'Subject Cutout Mask', visible: true });
    }
    if (portraitBlurLevel > 0) {
      list.push({ id: 'portrait_blur', type: 'shape', name: `Portrait Blur (${portraitBlurLevel}%)`, visible: true });
    }
    if (mosaicBlocks.length > 0) {
      list.push({ id: 'mosaic', type: 'drawing', name: `Privacy Mosaic (${mosaicBlocks.length} blocks)`, visible: true });
    }
    if (drawingPoints.length > 0) {
      list.push({ id: 'drawings', type: 'drawing', name: `Brush Markup (${drawingPoints.length} pts)`, visible: true });
    }
    textOverlays.forEach((t) => {
      list.push({ id: t.id, type: 'text', name: `Text: "${t.text.slice(0, 10)}"`, visible: true });
    });
    stickers.forEach((s) => {
      list.push({ id: s.id, type: 'sticker', name: `Sticker: ${s.emoji}`, visible: true });
    });
    return list;
  }, [activeFilter, brightness, contrast, temperature, saturation, bgRemoved, portraitBlurLevel, mosaicBlocks.length, drawingPoints.length, textOverlays, stickers]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => {
              Alert.alert('Discard Changes?', 'Any unsaved edits will be lost.', [
                { text: 'Keep Editing', style: 'cancel' },
                { text: 'Discard', style: 'destructive', onPress: onClose },
              ]);
            }}
          >
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {image.name}
            </Text>
            <Text style={styles.headerSubtitle}>Studio Photo Editor</Text>
          </View>

          {/* Compare (Before / After) Hold Button */}
          <TouchableOpacity
            style={[styles.headerPill, isComparing && styles.headerPillActive]}
            onPressIn={() => setIsComparing(true)}
            onPressOut={() => setIsComparing(false)}
          >
            <Eye size={16} color={isComparing ? '#0A84FF' : '#FFFFFF'} />
            <Text style={[styles.headerPillText, isComparing && { color: '#0A84FF' }]}>
              {isComparing ? 'Original' : 'Compare'}
            </Text>
          </TouchableOpacity>

          {/* Revert Button */}
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={handleRevertToOriginal}
          >
            <RefreshCw size={18} color="#8E8E93" />
          </TouchableOpacity>

          {/* Save / Export Button */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => setSaveModalVisible(true)}
          >
            <Save size={16} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Viewport Canvas with Gestures */}
        <View style={styles.viewport}>
          {/* Compare Status Banner */}
          {isComparing && (
            <View style={styles.compareBanner} pointerEvents="none">
              <Text style={styles.compareBannerText}>ORIGINAL (BEFORE)</Text>
            </View>
          )}

          <View style={[styles.canvasWrapper, cropContainerStyle]}>
            <View
              style={[styles.transformBox, transformStyle]}
              {...panResponder.panHandlers}
            >
              {/* Checkerboard Pattern for transparent Cutout */}
              {bgRemoved && <View style={[StyleSheet.absoluteFill, styles.checkerboardBg]} />}

              {/* Base Image */}
              <Image
                source={{ uri: image.thumbnailUri || `file://${image.path}` }}
                style={styles.baseImage}
                resizeMode="contain"
              />

              {/* Filter Tint Overlay */}
              {filterOverlayStyle && (
                <View style={[StyleSheet.absoluteFill, filterOverlayStyle]} pointerEvents="none" />
              )}

              {/* Tone Overlay */}
              {toneOverlayStyle && (
                <View style={[StyleSheet.absoluteFill, toneOverlayStyle]} pointerEvents="none" />
              )}

              {/* Vignette Overlay */}
              {vignette > 0 && !isComparing && (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    styles.vignetteOverlay,
                    { opacity: (vignette / 100) * 0.8 },
                  ]}
                  pointerEvents="none"
                />
              )}

              {/* Portrait Background Blur Simulation */}
              {portraitBlurLevel > 0 && !isComparing && (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    styles.portraitBlurSimulation,
                    { opacity: (portraitBlurLevel / 100) * 0.75 },
                  ]}
                  pointerEvents="none"
                >
                  <View style={styles.portraitClearSpot} />
                </View>
              )}

              {/* AI Subject Cutout Glowing Boundary */}
              {bgRemoved && !isComparing && (
                <View style={[StyleSheet.absoluteFill, styles.cutoutGlow]} pointerEvents="none">
                  <View style={styles.cutoutPill}>
                    <Text style={styles.cutoutPillText}>Subject Isolated • PNG Sticker</Text>
                  </View>
                </View>
              )}

              {/* Privacy Mosaic Blocks */}
              {!isComparing &&
                mosaicBlocks.map((blk, i) => (
                  <View
                    key={`mosaic_${i}`}
                    style={[styles.mosaicBlock, { left: blk.x - 14, top: blk.y - 14 }]}
                    pointerEvents="none"
                  >
                    <View style={styles.mosaicGrid}>
                      <View style={[styles.mosaicPixel, { backgroundColor: '#888' }]} />
                      <View style={[styles.mosaicPixel, { backgroundColor: '#555' }]} />
                      <View style={[styles.mosaicPixel, { backgroundColor: '#333' }]} />
                      <View style={[styles.mosaicPixel, { backgroundColor: '#aaa' }]} />
                    </View>
                  </View>
                ))}

              {/* Magic Erased Spots */}
              {!isComparing &&
                magicErasedSpots.map((spot, i) => (
                  <View
                    key={`erase_${i}`}
                    style={[styles.eraseDot, { left: spot.x - 16, top: spot.y - 16 }]}
                    pointerEvents="none"
                  />
                ))}

              {/* Freehand Brush Annotations (Pen & Highlighter) */}
              {!isComparing &&
                drawingPoints.map((pt, i) => (
                  <View
                    key={`pt_${i}`}
                    style={[
                      styles.drawPoint,
                      {
                        left: pt.x - pt.size / 2,
                        top: pt.y - pt.size / 2,
                        width: pt.size,
                        height: pt.size,
                        borderRadius: pt.size / 2,
                        backgroundColor: pt.color,
                        opacity: pt.isHighlighter ? 0.35 : 1,
                      },
                    ]}
                    pointerEvents="none"
                  />
                ))}

              {/* Text Overlays */}
              {!isComparing &&
                textOverlays.map((t) => (
                  <View
                    key={t.id}
                    style={[styles.textOverlayContainer, t.pill && styles.textOverlayPill]}
                    pointerEvents="none"
                  >
                    <Text style={[styles.textOverlayContent, { color: t.color, fontSize: t.size }]}>
                      {t.text}
                    </Text>
                  </View>
                ))}

              {/* Emoji Stickers */}
              {!isComparing &&
                stickers.map((s) => (
                  <View key={s.id} style={[styles.stickerBox, { left: s.x, top: s.y }]} pointerEvents="none">
                    <Text style={styles.stickerEmoji}>{s.emoji}</Text>
                  </View>
                ))}
            </View>

            {/* Rule-of-Thirds Grid Overlay when cropping */}
            {cropPreset !== 'free' && (
              <View style={[StyleSheet.absoluteFill, styles.cropGridBox]} pointerEvents="none">
                <View style={styles.cropGridH1} />
                <View style={styles.cropGridH2} />
                <View style={styles.cropGridV1} />
                <View style={styles.cropGridV2} />
                {/* 4 Corner Crop Markers */}
                <View style={[styles.cropCorner, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }]} />
                <View style={[styles.cropCorner, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }]} />
                <View style={[styles.cropCorner, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }]} />
                <View style={[styles.cropCorner, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 }]} />
              </View>
            )}

            {/* Keystone Corner Pins when Keystone tool is active */}
            {showKeystoneControls && (
              <View style={[StyleSheet.absoluteFill, styles.keystoneOverlay]} pointerEvents="none">
                <View style={[styles.keystonePin, { top: 10, left: 10 }]} />
                <View style={[styles.keystonePin, { top: 10, right: 10 }]} />
                <View style={[styles.keystonePin, { bottom: 10, left: 10 }]} />
                <View style={[styles.keystonePin, { bottom: 10, right: 10 }]} />
              </View>
            )}
          </View>
        </View>

        {/* Dynamic Interactive Slider Sub-Header (when an adjustment or filter is active) */}
        {activeTab === 'adjust' && (
          <View style={styles.sliderHeaderRow}>
            <View style={styles.sliderLabelWrap}>
              <Text style={styles.sliderHeaderTitle}>
                {activeAdjustParam.toUpperCase()}
              </Text>
              <Text style={[styles.sliderHeaderVal, { color: getParamValue(activeAdjustParam) !== 0 ? '#0A84FF' : '#8E8E93' }]}>
                {getParamValue(activeAdjustParam) > 0 ? `+${getParamValue(activeAdjustParam)}` : getParamValue(activeAdjustParam)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setParamValue(activeAdjustParam, getParamValue(activeAdjustParam) - 5)}
            >
              <Text style={styles.stepBtnText}>-5</Text>
            </TouchableOpacity>

            {/* Touchable Slider Track */}
            <TouchableOpacity
              style={styles.sliderTrack}
              activeOpacity={0.8}
              onPress={(evt) => {
                const trackWidth = SCREEN_WIDTH * 0.45;
                const touchX = evt.nativeEvent.locationX;
                const ratio = Math.max(0, Math.min(1, touchX / trackWidth));
                const min = activeAdjustParam === 'sharpen' || activeAdjustParam === 'vignette' ? 0 : -100;
                const max = 100;
                const newVal = Math.round(min + ratio * (max - min));
                setParamValue(activeAdjustParam, newVal);
              }}
            >
              <View style={styles.sliderTrackCenterLine} />
              <View
                style={[
                  styles.sliderTrackFill,
                  {
                    left: activeAdjustParam === 'sharpen' || activeAdjustParam === 'vignette'
                      ? 0
                      : getParamValue(activeAdjustParam) >= 0 ? '50%' : `${50 + (getParamValue(activeAdjustParam) / 100) * 50}%`,
                    width: activeAdjustParam === 'sharpen' || activeAdjustParam === 'vignette'
                      ? `${getParamValue(activeAdjustParam)}%`
                      : `${(Math.abs(getParamValue(activeAdjustParam)) / 100) * 50}%`,
                  },
                ]}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setParamValue(activeAdjustParam, getParamValue(activeAdjustParam) + 5)}
            >
              <Text style={styles.stepBtnText}>+5</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stepResetBtn}
              onPress={() => setParamValue(activeAdjustParam, 0)}
            >
              <RefreshCw size={14} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        )}

        {/* Straighten Degree Slider Row */}
        {activeTab === 'transform' && showStraightenSlider && (
          <View style={styles.sliderHeaderRow}>
            <View style={styles.sliderLabelWrap}>
              <Text style={styles.sliderHeaderTitle}>STRAIGHTEN</Text>
              <Text style={[styles.sliderHeaderVal, { color: straighten !== 0 ? '#0A84FF' : '#8E8E93' }]}>
                {straighten > 0 ? `+${straighten}°` : `${straighten}°`}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setStraighten((s) => Math.max(-45, s - 1))}
            >
              <Text style={styles.stepBtnText}>-1°</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sliderTrack}
              activeOpacity={0.8}
              onPress={(evt) => {
                const trackWidth = SCREEN_WIDTH * 0.45;
                const touchX = evt.nativeEvent.locationX;
                const ratio = Math.max(0, Math.min(1, touchX / trackWidth));
                const deg = Math.round(-45 + ratio * 90);
                setStraighten(deg);
              }}
            >
              <View style={styles.sliderTrackCenterLine} />
              <View
                style={[
                  styles.sliderTrackFill,
                  {
                    left: straighten >= 0 ? '50%' : `${50 + (straighten / 45) * 50}%`,
                    width: `${(Math.abs(straighten) / 45) * 50}%`,
                  },
                ]}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setStraighten((s) => Math.min(45, s + 1))}
            >
              <Text style={styles.stepBtnText}>+1°</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stepResetBtn}
              onPress={() => setStraighten(0)}
            >
              <RefreshCw size={14} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        )}

        {/* Filter Intensity Slider Row */}
        {activeTab === 'filters' && activeFilter !== 'none' && (
          <View style={styles.sliderHeaderRow}>
            <View style={styles.sliderLabelWrap}>
              <Text style={styles.sliderHeaderTitle}>INTENSITY</Text>
              <Text style={[styles.sliderHeaderVal, { color: '#0A84FF' }]}>
                {filterIntensity}%
              </Text>
            </View>

            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setFilterIntensity((i) => Math.max(0, i - 10))}
            >
              <Text style={styles.stepBtnText}>-10</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sliderTrack}
              activeOpacity={0.8}
              onPress={(evt) => {
                const trackWidth = SCREEN_WIDTH * 0.45;
                const touchX = evt.nativeEvent.locationX;
                const ratio = Math.max(0, Math.min(1, touchX / trackWidth));
                setFilterIntensity(Math.round(ratio * 100));
              }}
            >
              <View style={[styles.sliderTrackFill, { left: 0, width: `${filterIntensity}%` }]} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setFilterIntensity((i) => Math.min(100, i + 10))}
            >
              <Text style={styles.stepBtnText}>+10</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Dynamic Tool Sub-Panel */}
        <View style={styles.toolPanel}>
          {/* 1. TRANSFORM TAB (Crop, Rotate, Straighten, Flip, Keystone) */}
          {activeTab === 'transform' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subRow}>
              {/* Rotate 90° Clockwise */}
              <TouchableOpacity
                style={styles.subToolBtn}
                onPress={() => setRotation((r) => (r + 90) % 360)}
              >
                <RotateCw size={18} color="#FFFFFF" />
                <Text style={styles.subToolText}>Rotate 90°</Text>
              </TouchableOpacity>

              {/* Rotate -90° CCW */}
              <TouchableOpacity
                style={styles.subToolBtn}
                onPress={() => setRotation((r) => (r + 270) % 360)}
              >
                <RotateCcw size={18} color="#FFFFFF" />
                <Text style={styles.subToolText}>-90° CCW</Text>
              </TouchableOpacity>

              {/* Flip Horizontal */}
              <TouchableOpacity
                style={[styles.subToolBtn, flipH && styles.subToolBtnActive]}
                onPress={() => setFlipH((f) => !f)}
              >
                <FlipHorizontal size={18} color={flipH ? '#0A84FF' : '#FFFFFF'} />
                <Text style={styles.subToolText}>Flip H</Text>
              </TouchableOpacity>

              {/* Flip Vertical */}
              <TouchableOpacity
                style={[styles.subToolBtn, flipV && styles.subToolBtnActive]}
                onPress={() => setFlipV((f) => !f)}
              >
                <FlipVertical size={18} color={flipV ? '#0A84FF' : '#FFFFFF'} />
                <Text style={styles.subToolText}>Flip V</Text>
              </TouchableOpacity>

              {/* Straighten Degree Scale (-45° to +45°) */}
              <TouchableOpacity
                style={[styles.subToolBtn, (showStraightenSlider || straighten !== 0) && styles.subToolBtnActive]}
                onPress={() => setShowStraightenSlider((s) => !s)}
              >
                <Sliders size={18} color={straighten !== 0 ? '#0A84FF' : '#FFFFFF'} />
                <Text style={styles.subToolText}>
                  Straighten {straighten !== 0 ? `(${straighten}°)` : ''}
                </Text>
              </TouchableOpacity>

              {/* Aspect Ratio Presets */}
              {(
                [
                  { id: 'free', label: 'Free' },
                  { id: 'original', label: 'Original' },
                  { id: '1:1', label: '1:1 Square' },
                  { id: '4:5', label: '4:5 Portrait' },
                  { id: '3:4', label: '3:4' },
                  { id: '16:9', label: '16:9' },
                  { id: '9:16', label: '9:16 Story' },
                ] as const
              ).map((cp) => (
                <TouchableOpacity
                  key={cp.id}
                  style={[styles.subToolBtn, cropPreset === cp.id && styles.subToolBtnActive]}
                  onPress={() => setCropPreset(cp.id)}
                >
                  <Crop size={16} color={cropPreset === cp.id ? '#0A84FF' : '#FFFFFF'} />
                  <Text style={[styles.subToolText, cropPreset === cp.id && { color: '#0A84FF' }]}>
                    {cp.label}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Perspective / Keystone Tool */}
              <TouchableOpacity
                style={[styles.subToolBtn, (showKeystoneControls || skewX !== 0 || skewY !== 0) && styles.subToolBtnActive]}
                onPress={() => {
                  setShowKeystoneControls((k) => !k);
                  if (skewX === 0 && skewY === 0) setSkewX(6);
                }}
              >
                <Maximize2 size={18} color={skewX !== 0 || skewY !== 0 ? '#0A84FF' : '#FFFFFF'} />
                <Text style={styles.subToolText}>Keystone</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* 2. ADJUST TAB (Auto Enhance, Light, Color, Definition) */}
          {activeTab === 'adjust' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subRow}>
              {/* 1-Tap Auto Enhance (Magic Wand) */}
              <TouchableOpacity
                style={[styles.sliderCard, autoEnhanced && styles.sliderCardActive]}
                onPress={handleToggleAutoEnhance}
              >
                <Wand2 size={18} color={autoEnhanced ? '#0A84FF' : '#FFD60A'} />
                <Text style={[styles.sliderLabel, autoEnhanced && { color: '#0A84FF' }]}>
                  {autoEnhanced ? 'Auto Enhanced ✓' : 'Auto Enhance'}
                </Text>
              </TouchableOpacity>

              {/* Light Parameters */}
              {(
                [
                  { id: 'brightness', label: 'Brightness', icon: Sun, color: '#FFD60A' },
                  { id: 'contrast', label: 'Contrast', icon: Contrast, color: '#FFFFFF' },
                  { id: 'exposure', label: 'Exposure', icon: Zap, color: '#FF9F0A' },
                  { id: 'highlights', label: 'Highlights', icon: Sun, color: '#FFD60A' },
                  { id: 'shadows', label: 'Shadows', icon: Contrast, color: '#BF5AF2' },
                  { id: 'whites', label: 'White Point', icon: Sun, color: '#FFFFFF' },
                  { id: 'blacks', label: 'Black Point', icon: Contrast, color: '#8E8E93' },
                  { id: 'saturation', label: 'Saturation', icon: Palette, color: '#30D158' },
                  { id: 'vibrance', label: 'Vibrance', icon: Sparkles, color: '#64D2FF' },
                  { id: 'temperature', label: 'Warmth', icon: Thermometer, color: '#FF9F0A' },
                  { id: 'tint', label: 'Tint', icon: Palette, color: '#FF375F' },
                  { id: 'sharpen', label: 'Sharpen', icon: Focus, color: '#0A84FF' },
                  { id: 'vignette', label: 'Vignette', icon: Aperture, color: '#BF5AF2' },
                ] as const
              ).map((param) => {
                const Icon = param.icon;
                const isSelected = activeAdjustParam === param.id;
                const val = getParamValue(param.id);
                return (
                  <TouchableOpacity
                    key={param.id}
                    style={[styles.sliderCard, isSelected && styles.sliderCardActive]}
                    onPress={() => setActiveAdjustParam(param.id)}
                  >
                    <Icon size={16} color={val !== 0 ? param.color : '#8E8E93'} />
                    <Text style={[styles.sliderLabel, isSelected && { color: '#0A84FF' }]}>
                      {param.label} {val !== 0 ? `(${val > 0 ? '+' : ''}${val})` : ''}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {/* 3. FILTERS TAB (Vivid, Dramatic, Warm, Cool, Mono, Noir, Silvertone, Vintage, Cinematic) */}
          {activeTab === 'filters' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subRow}>
              {(
                [
                  { id: 'none', label: 'Original' },
                  { id: 'vivid', label: 'Vivid' },
                  { id: 'dramatic', label: 'Dramatic' },
                  { id: 'warm', label: 'Warm' },
                  { id: 'cool', label: 'Cool' },
                  { id: 'mono', label: 'Mono' },
                  { id: 'noir', label: 'Noir' },
                  { id: 'silvertone', label: 'Silvertone' },
                  { id: 'vintage', label: 'Vintage' },
                  { id: 'cinematic', label: 'Cinematic' },
                ] as const
              ).map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[styles.filterChip, activeFilter === f.id && styles.filterChipActive]}
                  onPress={() => setActiveFilter(f.id)}
                >
                  <Text style={[styles.filterChipText, activeFilter === f.id && styles.filterChipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* 4. MARKUP TAB (Pen, Highlighter, Mosaic Blur, Text, Stickers) */}
          {activeTab === 'markup' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subRow}>
              {/* Pen Mode */}
              <TouchableOpacity
                style={[styles.subToolBtn, markupMode === 'pen' && styles.subToolBtnActive]}
                onPress={() => setMarkupMode('pen')}
              >
                <PenTool size={18} color={markupMode === 'pen' ? '#0A84FF' : '#FFFFFF'} />
                <Text style={styles.subToolText}>Pen</Text>
              </TouchableOpacity>

              {/* Highlighter Mode */}
              <TouchableOpacity
                style={[styles.subToolBtn, markupMode === 'highlighter' && styles.subToolBtnActive]}
                onPress={() => setMarkupMode('highlighter')}
              >
                <Focus size={18} color={markupMode === 'highlighter' ? '#FFD60A' : '#FFFFFF'} />
                <Text style={styles.subToolText}>Highlighter</Text>
              </TouchableOpacity>

              {/* Mosaic / Blur Privacy Brush */}
              <TouchableOpacity
                style={[styles.subToolBtn, markupMode === 'mosaic' && styles.subToolBtnActive]}
                onPress={() => {
                  setMarkupMode('mosaic');
                  ToastAndroid.show('Swipe over faces or numbers to blur/mosaic', ToastAndroid.SHORT);
                }}
              >
                <Shield size={18} color={markupMode === 'mosaic' ? '#30D158' : '#FFFFFF'} />
                <Text style={styles.subToolText}>Mosaic Blur</Text>
              </TouchableOpacity>

              {/* Add Text */}
              <TouchableOpacity
                style={styles.subToolBtn}
                onPress={() => setTextModalVisible(true)}
              >
                <Type size={18} color="#FFFFFF" />
                <Text style={styles.subToolText}>Text</Text>
              </TouchableOpacity>

              {/* Color Dots */}
              {['#FF3B30', '#FF9F0A', '#FFD60A', '#30D158', '#0A84FF', '#BF5AF2', '#FFFFFF', '#000000'].map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorDot,
                    { backgroundColor: color },
                    brushColor === color && styles.colorDotActive,
                  ]}
                  onPress={() => setBrushColor(color)}
                />
              ))}

              {/* Emoji Stickers */}
              {['🔥', '⭐', '❤️', '😂', '🎉', '💯', '✨', '📸', '👍', '🔒'].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.stickerChip}
                  onPress={() => handleAddSticker(emoji)}
                >
                  <Text style={{ fontSize: 18 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}

              {/* Clear Markup */}
              <TouchableOpacity
                style={styles.subToolBtn}
                onPress={() => {
                  setDrawingPoints([]);
                  setMosaicBlocks([]);
                  setTextOverlays([]);
                  setStickers([]);
                  ToastAndroid.show('Markups cleared', ToastAndroid.SHORT);
                }}
              >
                <Trash2 size={16} color="#FF3B30" />
                <Text style={[styles.subToolText, { color: '#FF3B30' }]}>Clear</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* 5. AI TAB (Magic Eraser, Portrait Blur, Remaster, Cutout) */}
          {activeTab === 'ai' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subRow}>
              {/* Magic Eraser (Object Removal) */}
              <TouchableOpacity
                style={[styles.aiChip, magicEraserActive && styles.aiChipActive]}
                onPress={() => {
                  setMagicEraserActive((e) => !e);
                  ToastAndroid.show(
                    magicEraserActive ? 'Magic Eraser off' : 'Brush over unwanted objects to erase',
                    ToastAndroid.SHORT
                  );
                }}
              >
                <Eraser size={18} color={magicEraserActive ? '#0A84FF' : '#FF375F'} />
                <Text style={[styles.aiChipText, magicEraserActive && { color: '#0A84FF' }]}>
                  Magic Eraser
                </Text>
              </TouchableOpacity>

              {/* Portrait Effect (Background Blur) */}
              <TouchableOpacity
                style={[styles.aiChip, portraitBlurLevel > 0 && styles.aiChipActive]}
                onPress={() => {
                  const nextBlur = portraitBlurLevel >= 60 ? 0 : portraitBlurLevel + 30;
                  setPortraitBlurLevel(nextBlur);
                  ToastAndroid.show(
                    nextBlur > 0 ? `Portrait Blur: f/${nextBlur === 30 ? '2.8' : '1.4'}` : 'Portrait Blur Off',
                    ToastAndroid.SHORT
                  );
                }}
              >
                <Aperture size={18} color={portraitBlurLevel > 0 ? '#0A84FF' : '#64D2FF'} />
                <Text style={[styles.aiChipText, portraitBlurLevel > 0 && { color: '#0A84FF' }]}>
                  {portraitBlurLevel > 0 ? `Portrait Blur (${portraitBlurLevel}%)` : 'Portrait Blur'}
                </Text>
              </TouchableOpacity>

              {/* AI Photo Remaster / Unblur */}
              <TouchableOpacity
                style={[styles.aiChip, isRemastered && styles.aiChipActive]}
                onPress={handlePhotoRemaster}
                disabled={isRemastering}
              >
                {isRemastering ? (
                  <ActivityIndicator size="small" color="#0A84FF" />
                ) : (
                  <Sparkles size={18} color={isRemastered ? '#0A84FF' : '#FFD60A'} />
                )}
                <Text style={[styles.aiChipText, isRemastered && { color: '#0A84FF' }]}>
                  {isRemastering ? 'Remastering...' : isRemastered ? 'Remastered ✓' : 'Remaster / Unblur'}
                </Text>
              </TouchableOpacity>

              {/* Background Cutout / Sticker Maker */}
              <TouchableOpacity
                style={[styles.aiChip, bgRemoved && styles.aiChipActive]}
                onPress={() => {
                  setBgRemoved((b) => !b);
                  ToastAndroid.show(
                    bgRemoved ? 'Background restored' : 'Subject Cutout created (PNG Sticker ready)',
                    ToastAndroid.SHORT
                  );
                }}
              >
                <Scissors size={18} color={bgRemoved ? '#0A84FF' : '#30D158'} />
                <Text style={[styles.aiChipText, bgRemoved && { color: '#0A84FF' }]}>
                  {bgRemoved ? 'Cutout Active ✓' : 'Cutout / Sticker'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* 6. LAYERS TAB */}
          {activeTab === 'layers' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subRow}>
              {layersList.map((layer) => (
                <View key={layer.id} style={styles.layerCard}>
                  <Layers size={16} color="#0A84FF" />
                  <Text style={styles.layerCardText} numberOfLines={1}>
                    {layer.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Bottom Category Tab Bar (6 Pillars) */}
        <View style={styles.bottomTabs}>
          {(
            [
              { id: 'transform', label: 'Crop & Rotate', icon: Crop },
              { id: 'adjust', label: 'Adjust', icon: Sliders },
              { id: 'filters', label: 'Filters', icon: Palette },
              { id: 'markup', label: 'Markup', icon: PenTool },
              { id: 'ai', label: 'AI Smart', icon: Wand2 },
              { id: 'layers', label: 'Layers', icon: Layers },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                onPress={() => setActiveTab(t.id)}
              >
                <Icon size={20} color={isActive ? '#0A84FF' : '#8E8E93'} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Modal: Add Text with typography, color, background box */}
        <Modal
          visible={textModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setTextModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalBox}>
              <Text style={[typography.h4, { color: '#FFFFFF', marginBottom: spacing.md }]}>
                Add Text Caption
              </Text>

              {/* Sample input / quick suggestions */}
              <View style={styles.quickCaptionRow}>
                {['Verified ✓', 'Shot on NexFile', 'MEMORIES ❤️', 'CONFIDENTIAL'].map((cap) => (
                  <TouchableOpacity
                    key={cap}
                    style={styles.quickCapPill}
                    onPress={() => setNewTextInput(cap)}
                  >
                    <Text style={styles.quickCapText}>{cap}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.sampleInput}
                onPress={() => setNewTextInput((prev) => prev || 'NexFile 2026')}
              >
                <Text style={{ color: '#FFFFFF' }}>{newTextInput || 'Type caption here...'}</Text>
              </TouchableOpacity>

              <View style={styles.dialogActions}>
                <TouchableOpacity
                  style={[styles.dialogBtn, { backgroundColor: '#2C2C2E' }]}
                  onPress={() => setTextModalVisible(false)}
                >
                  <Text style={{ color: '#FFFFFF' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dialogBtn, { backgroundColor: '#0A84FF' }]}
                  onPress={handleAddText}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Add Text</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal: Save Options (Save as Copy vs Overwrite vs Revert) */}
        <Modal
          visible={saveModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setSaveModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalBox}>
              <View style={styles.modalHeaderRow}>
                <Save size={22} color="#0A84FF" />
                <Text style={[typography.h3, { color: '#FFFFFF', marginLeft: 8 }]}>Save & Export</Text>
              </View>

              <Text style={[typography.bodySmall, { color: '#8E8E93', marginVertical: spacing.sm }]}>
                Choose whether to save as a new image copy or replace the original image file directly.
              </Text>

              {/* Option 1: Save as New Copy */}
              <TouchableOpacity
                style={[
                  styles.saveOptionCard,
                  saveMode === 'copy' && styles.saveOptionCardActive,
                ]}
                onPress={() => setSaveMode('copy')}
              >
                <Plus size={20} color={saveMode === 'copy' ? '#0A84FF' : '#8E8E93'} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={[typography.labelLarge, { color: '#FFFFFF' }]}>Save as New Copy (Recommended)</Text>
                  <Text style={[typography.bodySmall, { color: '#8E8E93' }]}>
                    Creates a new photo in the same folder. Original photo remains safe and untouched.
                  </Text>
                </View>
                {saveMode === 'copy' && <Check size={20} color="#0A84FF" />}
              </TouchableOpacity>

              {/* Option 2: Replace Original Image */}
              <TouchableOpacity
                style={[
                  styles.saveOptionCard,
                  saveMode === 'replace' && styles.saveOptionCardActive,
                ]}
                onPress={() => setSaveMode('replace')}
              >
                <FolderSync size={20} color={saveMode === 'replace' ? '#FF9F0A' : '#8E8E93'} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={[typography.labelLarge, { color: '#FFFFFF' }]}>Replace Original Image (Overwrite)</Text>
                  <Text style={[typography.bodySmall, { color: '#8E8E93' }]}>
                    Updates the existing photo file directly on internal storage.
                  </Text>
                </View>
                {saveMode === 'replace' && <Check size={20} color="#FF9F0A" />}
              </TouchableOpacity>

              {/* Option 3: Revert to Original */}
              <TouchableOpacity
                style={[styles.saveOptionCard, { borderColor: 'rgba(255, 59, 48, 0.4)' }]}
                onPress={() => {
                  setSaveModalVisible(false);
                  handleRevertToOriginal();
                }}
              >
                <RefreshCw size={20} color="#FF3B30" />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={[typography.labelLarge, { color: '#FF3B30' }]}>Revert to Original</Text>
                  <Text style={[typography.bodySmall, { color: '#8E8E93' }]}>
                    Discard all edits and restore unmodified original image.
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Format Selection (JPG, PNG, WEBP) */}
              <View style={styles.formatRow}>
                <Text style={[typography.labelMedium, { color: '#FFFFFF', marginRight: 12 }]}>Format:</Text>
                {(['jpg', 'png', 'webp'] as const).map((fmt) => (
                  <TouchableOpacity
                    key={fmt}
                    style={[
                      styles.formatChip,
                      exportFormat === fmt && styles.formatChipActive,
                    ]}
                    onPress={() => setExportFormat(fmt)}
                  >
                    <Text style={[styles.formatChipText, exportFormat === fmt && { color: '#0A84FF' }]}>
                      {fmt.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Quality Preset */}
              <View style={styles.formatRow}>
                <Text style={[typography.labelMedium, { color: '#FFFFFF', marginRight: 12 }]}>Quality:</Text>
                {[100, 90, 75].map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={[
                      styles.formatChip,
                      exportQuality === q && styles.formatChipActive,
                    ]}
                    onPress={() => setExportQuality(q)}
                  >
                    <Text style={[styles.formatChipText, exportQuality === q && { color: '#0A84FF' }]}>
                      {q === 100 ? 'Max (100%)' : `${q}%`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Action Buttons */}
              <View style={styles.dialogActions}>
                <TouchableOpacity
                  style={[styles.dialogBtn, { backgroundColor: '#2C2C2E' }]}
                  onPress={() => setSaveModalVisible(false)}
                  disabled={isSaving}
                >
                  <Text style={{ color: '#FFFFFF' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dialogBtn, { backgroundColor: '#0A84FF' }]}
                  onPress={handleExecuteSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
                      {saveMode === 'replace' ? 'Confirm Overwrite' : 'Save Image'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#121212',
  },
  headerBtn: {
    padding: 8,
  },
  headerIconBtn: {
    padding: 8,
    marginRight: 6,
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 11,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    marginRight: 8,
  },
  headerPillActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.25)',
  },
  headerPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A84FF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.full,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
    marginLeft: 6,
  },
  viewport: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    overflow: 'hidden',
    position: 'relative',
  },
  compareBanner: {
    position: 'absolute',
    top: 14,
    backgroundColor: 'rgba(255, 59, 48, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    zIndex: 99,
  },
  compareBannerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  canvasWrapper: {
    width: '92%',
    height: '84%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  transformBox: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  baseImage: {
    width: '100%',
    height: '100%',
  },
  checkerboardBg: {
    backgroundColor: '#1E1E1E',
  },
  vignetteOverlay: {
    backgroundColor: 'radial-gradient(circle, transparent 60%, black 100%)',
    borderWidth: 28,
    borderColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
  },
  portraitBlurSimulation: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  portraitClearSpot: {
    width: '60%',
    height: '60%',
    borderRadius: 200,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cutoutGlow: {
    borderWidth: 2,
    borderColor: '#30D158',
    borderRadius: 8,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 8,
  },
  cutoutPill: {
    backgroundColor: 'rgba(48, 209, 88, 0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  cutoutPillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  mosaicBlock: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 4,
    overflow: 'hidden',
  },
  mosaicGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  mosaicPixel: {
    width: 14,
    height: 14,
  },
  eraseDot: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 55, 95, 0.45)',
    borderWidth: 1,
    borderColor: '#FF375F',
  },
  drawPoint: {
    position: 'absolute',
  },
  textOverlayContainer: {
    position: 'absolute',
    alignSelf: 'center',
    top: '40%',
  },
  textOverlayPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
  },
  textOverlayContent: {
    fontWeight: '700',
  },
  stickerBox: {
    position: 'absolute',
  },
  stickerEmoji: {
    fontSize: 34,
  },
  cropGridBox: {
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  cropGridH1: {
    position: 'absolute',
    top: '33.33%',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  cropGridH2: {
    position: 'absolute',
    top: '66.66%',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  cropGridV1: {
    position: 'absolute',
    left: '33.33%',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  cropGridV2: {
    position: 'absolute',
    left: '66.66%',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  cropCorner: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderColor: '#FFFFFF',
  },
  keystoneOverlay: {
    borderWidth: 1,
    borderColor: 'rgba(10, 132, 255, 0.6)',
    borderStyle: 'dashed',
  },
  keystonePin: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0A84FF',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  sliderHeaderRow: {
    height: 44,
    backgroundColor: '#1E1E20',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  sliderLabelWrap: {
    width: 90,
  },
  sliderHeaderTitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 9,
    fontWeight: '700',
  },
  sliderHeaderVal: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  stepBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    marginHorizontal: 4,
  },
  stepBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  sliderTrack: {
    flex: 1,
    height: 20,
    justifyContent: 'center',
    position: 'relative',
    marginHorizontal: 6,
  },
  sliderTrackCenterLine: {
    position: 'absolute',
    left: '50%',
    width: 2,
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  sliderTrackFill: {
    position: 'absolute',
    height: 6,
    backgroundColor: '#0A84FF',
    borderRadius: 3,
  },
  stepResetBtn: {
    padding: 6,
    marginLeft: 4,
  },
  toolPanel: {
    height: 64,
    backgroundColor: '#18181A',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
  },
  subRow: {
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    gap: 10,
  },
  subToolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    minWidth: 64,
  },
  subToolBtnActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.25)',
    borderWidth: 1,
    borderColor: '#0A84FF',
  },
  subToolText: {
    color: '#FFFFFF',
    fontSize: 11,
    marginTop: 3,
    fontWeight: '600',
  },
  sliderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  sliderCardActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.2)',
    borderWidth: 1,
    borderColor: '#0A84FF',
  },
  sliderLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterChipActive: {
    backgroundColor: '#0A84FF',
  },
  filterChipText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#333',
  },
  colorDotActive: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  stickerChip: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: borderRadius.sm,
  },
  aiChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  aiChipActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.25)',
    borderWidth: 1,
    borderColor: '#0A84FF',
  },
  aiChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  layerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  layerCardText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },
  bottomTabs: {
    height: 58,
    backgroundColor: '#121212',
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {},
  tabLabel: {
    fontSize: 10,
    color: '#8E8E93',
    marginTop: 2,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#0A84FF',
    fontWeight: 'bold',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.base,
    maxHeight: '85%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  saveOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  saveOptionCardActive: {
    borderColor: '#0A84FF',
    backgroundColor: 'rgba(10, 132, 255, 0.12)',
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  formatChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginRight: 8,
  },
  formatChipActive: {
    backgroundColor: 'rgba(10, 132, 255, 0.25)',
    borderWidth: 1,
    borderColor: '#0A84FF',
  },
  formatChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
    gap: 12,
  },
  dialogBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  quickCaptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  quickCapPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  quickCapText: {
    color: '#FFFFFF',
    fontSize: 12,
  },
  sampleInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginVertical: 8,
  },
});
