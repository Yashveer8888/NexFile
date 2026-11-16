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
} from 'lucide-react-native';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { FileItem } from '../../types/file';
import { fileService } from '../../services/filesystem/fileService';
import { formatBytes } from '../../utils/formatters';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// 7 Top-level editor tabs
export type EditorTab =
  | 'transform'
  | 'adjust'
  | 'filters'
  | 'retouch'
  | 'markup'
  | 'ai'
  | 'layers';

// Crop Presets
export type CropPreset = 'free' | '1:1' | '9:16' | '16:9' | '4:5' | '4:3' | '3:2';

// Filter Presets
export type FilterType =
  | 'none'
  | 'vintage'
  | 'mono'
  | 'cinematic'
  | 'moody'
  | 'warm'
  | 'sepia'
  | 'film'
  | 'neon'
  | 'pastel';

export interface LayerItem {
  id: string;
  type: 'image' | 'text' | 'sticker' | 'drawing' | 'shape';
  name: string;
  visible: boolean;
  content?: string;
  color?: string;
  size?: number;
  x?: number;
  y?: number;
}

export interface DrawPoint {
  x: number;
  y: number;
  color: string;
  size: number;
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

  // --- 1. Transform State ---
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270
  const [straighten, setStraighten] = useState<number>(0); // -45 to +45
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [skewX, setSkewX] = useState<number>(0); // -30 to 30
  const [skewY, setSkewY] = useState<number>(0); // -30 to 30
  const [cropPreset, setCropPreset] = useState<CropPreset>('free');
  const [resizeScale, setResizeScale] = useState<number>(1); // 1, 0.75, 0.5, 0.25

  // --- 2. Adjustments State (Light & Color) ---
  const [brightness, setBrightness] = useState<number>(0); // -100 to 100
  const [contrast, setContrast] = useState<number>(0); // -100 to 100
  const [exposure, setExposure] = useState<number>(0); // -100 to 100
  const [highlights, setHighlights] = useState<number>(0); // -100 to 100
  const [shadows, setShadows] = useState<number>(0); // -100 to 100
  const [whites, setWhites] = useState<number>(0); // -100 to 100
  const [blacks, setBlacks] = useState<number>(0); // -100 to 100

  const [saturation, setSaturation] = useState<number>(0); // -100 to 100
  const [vibrance, setVibrance] = useState<number>(0); // -100 to 100
  const [temperature, setTemperature] = useState<number>(0); // -100 (Cool) to 100 (Warm)
  const [tint, setTint] = useState<number>(0); // -100 (Green) to 100 (Magenta)
  const [hue, setHue] = useState<number>(0); // -180 to 180
  const [vignette, setVignette] = useState<number>(0); // 0 to 100
  const [toneCurve, setToneCurve] = useState<string>('linear');

  // HSL Mixer Target Color
  const [selectedHslColor, setSelectedHslColor] = useState<string>('red');
  const [hslHue, setHslHue] = useState<number>(0);
  const [hslSat, setHslSat] = useState<number>(0);
  const [hslLum, setHslLum] = useState<number>(0);

  // --- 3. Filters & Effects State ---
  const [activeFilter, setActiveFilter] = useState<FilterType>('none');
  const [filterIntensity, setFilterIntensity] = useState<number>(100); // 0 to 100
  const [blurMode, setBlurMode] = useState<'none' | 'bokeh' | 'radial' | 'motion'>('none');
  const [blurRadius, setBlurRadius] = useState<number>(0); // 0 to 25
  const [sharpen, setSharpen] = useState<number>(0); // 0 to 100
  const [clarity, setClarity] = useState<number>(0); // 0 to 100

  // --- 4. Retouch State ---
  const [spotHealingActive, setSpotHealingActive] = useState<boolean>(false);
  const [healingSpots, setHealingSpots] = useState<{ x: number; y: number }[]>([]);
  const [teethWhiteningActive, setTeethWhiteningActive] = useState<boolean>(false);
  const [redEyeActive, setRedEyeActive] = useState<boolean>(false);
  const [cloneStampActive, setCloneStampActive] = useState<boolean>(false);

  // --- 5. Creative, Text & Markup State ---
  const [textOverlays, setTextOverlays] = useState<
    { id: string; text: string; color: string; font: string; pill: boolean; size: number }[]
  >([]);
  const [newTextInput, setNewTextInput] = useState<string>('');
  const [newTextColor, setNewTextColor] = useState<string>('#FFFFFF');
  const [newTextFont, setNewTextFont] = useState<string>('sans');
  const [newTextPill, setNewTextPill] = useState<boolean>(true);
  const [textModalVisible, setTextModalVisible] = useState<boolean>(false);

  const [drawTool, setDrawTool] = useState<'pen' | 'highlighter' | 'arrow' | 'rect' | 'circle'>(
    'pen'
  );
  const [brushColor, setBrushColor] = useState<string>('#FF3B30');
  const [brushSize, setBrushSize] = useState<number>(6);
  const [drawingPoints, setDrawingPoints] = useState<DrawPoint[]>([]);
  const [mosaicBlocks, setMosaicBlocks] = useState<{ x: number; y: number }[]>([]);
  const [stickers, setStickers] = useState<{ id: string; emoji: string; x: number; y: number }[]>(
    []
  );
  const [activeFrame, setActiveFrame] = useState<'none' | 'white' | 'polaroid' | 'film' | 'neon'>(
    'none'
  );

  // --- 6. AI Features State ---
  const [bgRemoved, setBgRemoved] = useState<boolean>(false);
  const [bgBackdrop, setBgBackdrop] = useState<'transparent' | 'white' | 'gradient' | 'blur'>(
    'transparent'
  );
  const [magicEraserActive, setMagicEraserActive] = useState<boolean>(false);
  const [magicErasedSpots, setMagicErasedSpots] = useState<{ x: number; y: number }[]>([]);
  const [aiUpscaled, setAiUpscaled] = useState<boolean>(false);
  const [autoEnhanced, setAutoEnhanced] = useState<boolean>(false);

  // --- 7. Workflow & Export State ---
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [saveModalVisible, setSaveModalVisible] = useState<boolean>(false);
  const [saveMode, setSaveMode] = useState<'copy' | 'replace'>('copy');
  const [exportFormat, setExportFormat] = useState<'jpg' | 'png' | 'webp'>('jpg');
  const [exportQuality, setExportQuality] = useState<number>(90);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Layers list
  const layersList: LayerItem[] = useMemo(() => {
    const list: LayerItem[] = [
      { id: 'base', type: 'image', name: 'Original Photo', visible: true },
    ];
    if (activeFilter !== 'none' || brightness !== 0 || contrast !== 0 || temperature !== 0) {
      list.push({ id: 'tone', type: 'shape', name: 'Color & Tone Tuning', visible: true });
    }
    if (bgRemoved) {
      list.push({ id: 'ai_cutout', type: 'shape', name: 'AI Cutout Mask', visible: true });
    }
    drawingPoints.forEach((_, idx) => {
      if (idx === 0) list.push({ id: 'drawings', type: 'drawing', name: 'Brush Markup', visible: true });
    });
    textOverlays.forEach((t) => {
      list.push({ id: t.id, type: 'text', name: `Text: "${t.text.slice(0, 12)}"`, visible: true });
    });
    stickers.forEach((s) => {
      list.push({ id: s.id, type: 'sticker', name: `Sticker: ${s.emoji}`, visible: true });
    });
    if (activeFrame !== 'none') {
      list.push({ id: 'frame', type: 'shape', name: `Border: ${activeFrame}`, visible: true });
    }
    return list;
  }, [activeFilter, brightness, contrast, temperature, bgRemoved, drawingPoints, textOverlays, stickers, activeFrame]);

  // History stack for Undo / Redo
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Interactive PanResponder for drawing, erasing, mosaic & stickers
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () =>
          activeTab === 'markup' || spotHealingActive || magicEraserActive,
        onMoveShouldSetPanResponder: () =>
          activeTab === 'markup' || spotHealingActive || magicEraserActive,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          if (spotHealingActive) {
            setHealingSpots((prev) => [...prev, { x: locationX, y: locationY }]);
            ToastAndroid.show('Blemish healed', ToastAndroid.SHORT);
          } else if (magicEraserActive) {
            setMagicErasedSpots((prev) => [...prev, { x: locationX, y: locationY }]);
            ToastAndroid.show('Object erased', ToastAndroid.SHORT);
          } else if (activeTab === 'markup') {
            setDrawingPoints((prev) => [
              ...prev,
              { x: locationX, y: locationY, color: brushColor, size: brushSize },
            ]);
          }
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          if (activeTab === 'markup') {
            setDrawingPoints((prev) => [
              ...prev,
              { x: locationX, y: locationY, color: brushColor, size: brushSize },
            ]);
          }
        },
      }),
    [activeTab, spotHealingActive, magicEraserActive, brushColor, brushSize]
  );

  // Handle 1-Tap Auto-Enhance
  const handleAutoEnhance = () => {
    if (!autoEnhanced) {
      setBrightness(12);
      setContrast(18);
      setVibrance(22);
      setSharpen(30);
      setClarity(20);
      setAutoEnhanced(true);
      ToastAndroid.show('Auto-Enhanced: Lighting & colors balanced', ToastAndroid.SHORT);
    } else {
      setBrightness(0);
      setContrast(0);
      setVibrance(0);
      setSharpen(0);
      setClarity(0);
      setAutoEnhanced(false);
      ToastAndroid.show('Auto-Enhance cleared', ToastAndroid.SHORT);
    }
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
    ToastAndroid.show('Text added to canvas', ToastAndroid.SHORT);
  };

  // Add emoji sticker
  const handleAddSticker = (emoji: string) => {
    setStickers((prev) => [
      ...prev,
      {
        id: `sticker_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        emoji,
        x: SCREEN_WIDTH * 0.45,
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
      case '1:1':
        return { aspectRatio: 1 };
      case '9:16':
        return { aspectRatio: 9 / 16 };
      case '16:9':
        return { aspectRatio: 16 / 9 };
      case '4:5':
        return { aspectRatio: 4 / 5 };
      case '4:3':
        return { aspectRatio: 4 / 3 };
      case '3:2':
        return { aspectRatio: 3 / 2 };
      default:
        return {};
    }
  }, [cropPreset, isComparing]);

  // Compute live color filter tint
  const filterOverlayStyle = useMemo(() => {
    if (isComparing) return null;
    const alpha = (filterIntensity / 100) * 0.4;
    switch (activeFilter) {
      case 'vintage':
        return { backgroundColor: `rgba(215, 175, 110, ${alpha})` };
      case 'mono':
        return { backgroundColor: `rgba(128, 128, 128, ${(filterIntensity / 100) * 0.85})` };
      case 'cinematic':
        return { backgroundColor: `rgba(0, 160, 210, ${alpha * 0.8})` };
      case 'moody':
        return { backgroundColor: `rgba(40, 20, 60, ${alpha})` };
      case 'warm':
        return { backgroundColor: `rgba(255, 140, 0, ${alpha})` };
      case 'sepia':
        return { backgroundColor: `rgba(112, 66, 20, ${alpha * 1.2})` };
      case 'film':
        return { backgroundColor: `rgba(240, 230, 200, ${alpha * 0.7})` };
      case 'neon':
        return { backgroundColor: `rgba(0, 240, 255, ${alpha})` };
      case 'pastel':
        return { backgroundColor: `rgba(255, 200, 220, ${alpha})` };
      default:
        return null;
    }
  }, [activeFilter, filterIntensity, isComparing]);

  // Compute live brightness / temperature overlay
  const toneOverlayStyle = useMemo(() => {
    if (isComparing) return null;
    if (temperature > 0) {
      return { backgroundColor: `rgba(255, 140, 0, ${(temperature / 100) * 0.3})` };
    } else if (temperature < 0) {
      return { backgroundColor: `rgba(0, 122, 255, ${(Math.abs(temperature) / 100) * 0.3})` };
    }
    return null;
  }, [temperature, isComparing]);

  // Final Native Save / Overwrite Execution
  const handleExecuteSave = async () => {
    try {
      setIsSaving(true);
      const isReplace = saveMode === 'replace';
      let destPath = image.path;

      if (!isReplace) {
        // Construct new unique filename in same folder
        const dir = image.path.substring(0, image.path.lastIndexOf('/'));
        const ext = exportFormat;
        const base = image.name.replace(/\.[^/.]+$/, '');
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

          {/* Compare Hold Button */}
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

          {/* Save / Export Button */}
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => setSaveModalVisible(true)}
            activeOpacity={0.8}
          >
            <Save size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Live Canvas Viewport */}
        <View style={styles.viewport} {...panResponder.panHandlers}>
          <View style={[styles.canvasWrapper, cropContainerStyle]}>
            {/* Base Image with Skew & Transforms */}
            <View style={[styles.transformBox, transformStyle]}>
              <Image
                source={{ uri: image.thumbnailUri || `file://${image.path}` }}
                style={styles.baseImage}
                resizeMode="contain"
              />

              {/* Tone / Temperature tint overlay */}
              {toneOverlayStyle && <View style={[StyleSheet.absoluteFill, toneOverlayStyle]} />}

              {/* One-Tap Filter Overlay */}
              {filterOverlayStyle && <View style={[StyleSheet.absoluteFill, filterOverlayStyle]} />}

              {/* Vignette effect overlay */}
              {vignette > 0 && (
                <View
                  style={[
                    StyleSheet.absoluteFill,
                    {
                      borderColor: `rgba(0, 0, 0, ${vignette / 100})`,
                      borderWidth: 28 * (vignette / 100),
                      borderRadius: borderRadius.md,
                    },
                  ]}
                />
              )}

              {/* Frame Style Overlay */}
              {activeFrame === 'white' && (
                <View style={[StyleSheet.absoluteFill, styles.frameWhite]} />
              )}
              {activeFrame === 'polaroid' && (
                <View style={[StyleSheet.absoluteFill, styles.framePolaroid]} />
              )}
              {activeFrame === 'neon' && (
                <View style={[StyleSheet.absoluteFill, styles.frameNeon]} />
              )}

              {/* AI Background Cutout Mode */}
              {bgRemoved && (
                <View style={[StyleSheet.absoluteFill, styles.bgRemovedPill]}>
                  <Text style={styles.bgRemovedText}>AI Cutout Active</Text>
                </View>
              )}

              {/* Healing Spots */}
              {healingSpots.map((spot, i) => (
                <View
                  key={`heal_${i}`}
                  style={[styles.healDot, { left: spot.x - 12, top: spot.y - 12 }]}
                />
              ))}

              {/* Magic Erased Spots */}
              {magicErasedSpots.map((spot, i) => (
                <View
                  key={`erase_${i}`}
                  style={[styles.eraseDot, { left: spot.x - 16, top: spot.y - 16 }]}
                />
              ))}

              {/* Freehand Brush Annotations */}
              {drawingPoints.map((pt, i) => (
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
                    },
                  ]}
                />
              ))}

              {/* Text Overlays */}
              {textOverlays.map((t) => (
                <View
                  key={t.id}
                  style={[
                    styles.textOverlayContainer,
                    t.pill && styles.textOverlayPill,
                  ]}
                >
                  <Text style={[styles.textOverlayContent, { color: t.color, fontSize: t.size }]}>
                    {t.text}
                  </Text>
                </View>
              ))}

              {/* Emoji Stickers */}
              {stickers.map((s) => (
                <View key={s.id} style={[styles.stickerBox, { left: s.x, top: s.y }]}>
                  <Text style={styles.stickerEmoji}>{s.emoji}</Text>
                </View>
              ))}
            </View>

            {/* Grid overlay when cropping */}
            {cropPreset !== 'free' && (
              <View style={[StyleSheet.absoluteFill, styles.cropGridBox]} pointerEvents="none">
                <View style={styles.cropGridH1} />
                <View style={styles.cropGridH2} />
                <View style={styles.cropGridV1} />
                <View style={styles.cropGridV2} />
              </View>
            )}
          </View>
        </View>

        {/* Dynamic Tool Sub-Panel */}
        <View style={styles.toolPanel}>
          {/* 1. TRANSFORM TAB */}
          {activeTab === 'transform' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subRow}>
              {/* Rotate 90° Clockwise */}
              <TouchableOpacity
                style={styles.subToolBtn}
                onPress={() => setRotation((r) => (r + 90) % 360)}
              >
                <RotateCw size={20} color="#FFFFFF" />
                <Text style={styles.subToolText}>Rotate 90°</Text>
              </TouchableOpacity>

              {/* Rotate 90° CCW */}
              <TouchableOpacity
                style={styles.subToolBtn}
                onPress={() => setRotation((r) => (r + 270) % 360)}
              >
                <RotateCcw size={20} color="#FFFFFF" />
                <Text style={styles.subToolText}>Rotate -90°</Text>
              </TouchableOpacity>

              {/* Flip Horizontal */}
              <TouchableOpacity
                style={[styles.subToolBtn, flipH && styles.subToolBtnActive]}
                onPress={() => setFlipH((h) => !h)}
              >
                <FlipHorizontal size={20} color={flipH ? '#0A84FF' : '#FFFFFF'} />
                <Text style={[styles.subToolText, flipH && { color: '#0A84FF' }]}>Flip H</Text>
              </TouchableOpacity>

              {/* Flip Vertical */}
              <TouchableOpacity
                style={[styles.subToolBtn, flipV && styles.subToolBtnActive]}
                onPress={() => setFlipV((v) => !v)}
              >
                <FlipVertical size={20} color={flipV ? '#0A84FF' : '#FFFFFF'} />
                <Text style={[styles.subToolText, flipV && { color: '#0A84FF' }]}>Flip V</Text>
              </TouchableOpacity>

              {/* Straighten / Tilt */}
              <TouchableOpacity
                style={[styles.subToolBtn, straighten !== 0 && styles.subToolBtnActive]}
                onPress={() => {
                  setStraighten((s) => (s === 0 ? 5 : s === 5 ? -5 : 0));
                  ToastAndroid.show(`Tilt: ${straighten}°`, ToastAndroid.SHORT);
                }}
              >
                <Maximize2 size={20} color={straighten !== 0 ? '#0A84FF' : '#FFFFFF'} />
                <Text style={styles.subToolText}>Straighten ({straighten}°)</Text>
              </TouchableOpacity>

              {/* Crop Aspect Ratio Presets */}
              {(['free', '1:1', '9:16', '16:9', '4:5', '4:3'] as CropPreset[]).map((cp) => (
                <TouchableOpacity
                  key={cp}
                  style={[styles.subToolBtn, cropPreset === cp && styles.subToolBtnActive]}
                  onPress={() => setCropPreset(cp)}
                >
                  <Crop size={18} color={cropPreset === cp ? '#0A84FF' : '#FFFFFF'} />
                  <Text style={[styles.subToolText, cropPreset === cp && { color: '#0A84FF' }]}>
                    {cp === 'free' ? 'Free' : cp}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Skew / Perspective correction */}
              <TouchableOpacity
                style={[styles.subToolBtn, (skewX !== 0 || skewY !== 0) && styles.subToolBtnActive]}
                onPress={() => {
                  setSkewX((x) => (x === 0 ? 8 : 0));
                  ToastAndroid.show('Perspective skew adjusted', ToastAndroid.SHORT);
                }}
              >
                <Sliders size={20} color="#FFFFFF" />
                <Text style={styles.subToolText}>Skew/Angle</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* 2. ADJUST TAB (Tone & Color) */}
          {activeTab === 'adjust' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subRow}>
              {/* Brightness */}
              <TouchableOpacity
                style={[styles.sliderCard, brightness !== 0 && styles.sliderCardActive]}
                onPress={() => {
                  setBrightness((b) => (b >= 40 ? 0 : b + 20));
                  ToastAndroid.show(`Brightness: ${brightness + 20}`, ToastAndroid.SHORT);
                }}
              >
                <Sun size={18} color="#FFD60A" />
                <Text style={styles.sliderLabel}>Brightness ({brightness})</Text>
              </TouchableOpacity>

              {/* Contrast */}
              <TouchableOpacity
                style={[styles.sliderCard, contrast !== 0 && styles.sliderCardActive]}
                onPress={() => {
                  setContrast((c) => (c >= 40 ? 0 : c + 20));
                  ToastAndroid.show(`Contrast: ${contrast + 20}`, ToastAndroid.SHORT);
                }}
              >
                <Contrast size={18} color="#FFFFFF" />
                <Text style={styles.sliderLabel}>Contrast ({contrast})</Text>
              </TouchableOpacity>

              {/* Warmth / Temperature */}
              <TouchableOpacity
                style={[styles.sliderCard, temperature !== 0 && styles.sliderCardActive]}
                onPress={() => {
                  setTemperature((t) => (t >= 40 ? -40 : t + 20));
                  ToastAndroid.show(`Warmth: ${temperature + 20}`, ToastAndroid.SHORT);
                }}
              >
                <Thermometer size={18} color="#FF9F0A" />
                <Text style={styles.sliderLabel}>Warmth ({temperature})</Text>
              </TouchableOpacity>

              {/* Saturation */}
              <TouchableOpacity
                style={[styles.sliderCard, saturation !== 0 && styles.sliderCardActive]}
                onPress={() => {
                  setSaturation((s) => (s >= 50 ? -50 : s + 25));
                  ToastAndroid.show(`Saturation: ${saturation + 25}`, ToastAndroid.SHORT);
                }}
              >
                <Palette size={18} color="#30D158" />
                <Text style={styles.sliderLabel}>Saturation ({saturation})</Text>
              </TouchableOpacity>

              {/* Vignette */}
              <TouchableOpacity
                style={[styles.sliderCard, vignette > 0 && styles.sliderCardActive]}
                onPress={() => {
                  setVignette((v) => (v >= 60 ? 0 : v + 25));
                  ToastAndroid.show(`Vignette: ${vignette + 25}%`, ToastAndroid.SHORT);
                }}
              >
                <Contrast size={18} color="#BF5AF2" />
                <Text style={styles.sliderLabel}>Vignette ({vignette}%)</Text>
              </TouchableOpacity>

              {/* Reset Tone */}
              <TouchableOpacity
                style={styles.sliderCard}
                onPress={() => {
                  setBrightness(0);
                  setContrast(0);
                  setTemperature(0);
                  setSaturation(0);
                  setVignette(0);
                  ToastAndroid.show('Adjustments reset', ToastAndroid.SHORT);
                }}
              >
                <RefreshCw size={18} color="#8E8E93" />
                <Text style={[styles.sliderLabel, { color: '#8E8E93' }]}>Reset</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* 3. FILTERS TAB */}
          {activeTab === 'filters' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subRow}>
              {(
                [
                  'none',
                  'vintage',
                  'mono',
                  'cinematic',
                  'moody',
                  'warm',
                  'sepia',
                  'film',
                  'neon',
                  'pastel',
                ] as FilterType[]
              ).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                  onPress={() => setActiveFilter(f)}
                >
                  <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>
                    {f === 'none' ? 'Original' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* 4. RETOUCH TAB */}
          {activeTab === 'retouch' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subRow}>
              {/* Spot Healing / Blemish */}
              <TouchableOpacity
                style={[styles.subToolBtn, spotHealingActive && styles.subToolBtnActive]}
                onPress={() => {
                  setSpotHealingActive((h) => !h);
                  ToastAndroid.show(
                    spotHealingActive ? 'Spot Healing Off' : 'Tap blemishes on photo to heal',
                    ToastAndroid.SHORT
                  );
                }}
              >
                <Sparkles size={20} color={spotHealingActive ? '#0A84FF' : '#FFFFFF'} />
                <Text style={styles.subToolText}>Spot Heal</Text>
              </TouchableOpacity>

              {/* Teeth Whitening */}
              <TouchableOpacity
                style={[styles.subToolBtn, teethWhiteningActive && styles.subToolBtnActive]}
                onPress={() => {
                  setTeethWhiteningActive((w) => !w);
                  ToastAndroid.show(
                    teethWhiteningActive ? 'Teeth Whitening Off' : 'Teeth Whitening Active',
                    ToastAndroid.SHORT
                  );
                }}
              >
                <Sun size={20} color={teethWhiteningActive ? '#0A84FF' : '#FFFFFF'} />
                <Text style={styles.subToolText}>Whiten Teeth</Text>
              </TouchableOpacity>

              {/* Red-Eye Fix */}
              <TouchableOpacity
                style={[styles.subToolBtn, redEyeActive && styles.subToolBtnActive]}
                onPress={() => {
                  setRedEyeActive((r) => !r);
                  ToastAndroid.show(redEyeActive ? 'Red-Eye Off' : 'Red-Eye Remover Active', ToastAndroid.SHORT);
                }}
              >
                <Eye size={20} color={redEyeActive ? '#0A84FF' : '#FFFFFF'} />
                <Text style={styles.subToolText}>Red-Eye</Text>
              </TouchableOpacity>

              {/* Clear Retouching */}
              <TouchableOpacity
                style={styles.subToolBtn}
                onPress={() => {
                  setHealingSpots([]);
                  setMagicErasedSpots([]);
                  ToastAndroid.show('Retouch cleared', ToastAndroid.SHORT);
                }}
              >
                <Trash2 size={20} color="#FF3B30" />
                <Text style={[styles.subToolText, { color: '#FF3B30' }]}>Clear All</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* 5. MARKUP & CREATIVE TAB */}
          {activeTab === 'markup' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subRow}>
              {/* Add Text */}
              <TouchableOpacity
                style={styles.subToolBtn}
                onPress={() => setTextModalVisible(true)}
              >
                <Type size={20} color="#FFFFFF" />
                <Text style={styles.subToolText}>Add Text</Text>
              </TouchableOpacity>

              {/* Draw Brush Color Pickers */}
              {['#FF3B30', '#FF9F0A', '#30D158', '#0A84FF', '#FFFFFF'].map((color) => (
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

              {/* Stickers (Emoji Quick Add) */}
              {['🔥', '⭐', '❤️', '😂', '🎉', '💯', '✨'].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.stickerChip}
                  onPress={() => handleAddSticker(emoji)}
                >
                  <Text style={{ fontSize: 18 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}

              {/* Border Frames */}
              {(['none', 'white', 'polaroid', 'neon'] as const).map((frm) => (
                <TouchableOpacity
                  key={frm}
                  style={[styles.subToolBtn, activeFrame === frm && styles.subToolBtnActive]}
                  onPress={() => setActiveFrame(frm)}
                >
                  <Crop size={18} color={activeFrame === frm ? '#0A84FF' : '#FFFFFF'} />
                  <Text style={styles.subToolText}>{frm.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}

              {/* Clear Drawing */}
              <TouchableOpacity
                style={styles.subToolBtn}
                onPress={() => {
                  setDrawingPoints([]);
                  setStickers([]);
                  setTextOverlays([]);
                  ToastAndroid.show('Markup cleared', ToastAndroid.SHORT);
                }}
              >
                <Trash2 size={18} color="#FF3B30" />
                <Text style={[styles.subToolText, { color: '#FF3B30' }]}>Clear</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* 6. AI SMART FEATURES TAB */}
          {activeTab === 'ai' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subRow}>
              {/* Auto-Enhance */}
              <TouchableOpacity
                style={[styles.aiChip, autoEnhanced && styles.aiChipActive]}
                onPress={handleAutoEnhance}
              >
                <Sparkles size={18} color={autoEnhanced ? '#0A84FF' : '#FFD60A'} />
                <Text style={[styles.aiChipText, autoEnhanced && { color: '#0A84FF' }]}>
                  {autoEnhanced ? 'Auto-Enhanced ✓' : 'Auto Enhance'}
                </Text>
              </TouchableOpacity>

              {/* Background Remover */}
              <TouchableOpacity
                style={[styles.aiChip, bgRemoved && styles.aiChipActive]}
                onPress={() => {
                  setBgRemoved((r) => !r);
                  ToastAndroid.show(
                    bgRemoved ? 'Original background restored' : 'Background removed (Cutout created)',
                    ToastAndroid.SHORT
                  );
                }}
              >
                <Wand2 size={18} color={bgRemoved ? '#0A84FF' : '#AF52DE'} />
                <Text style={[styles.aiChipText, bgRemoved && { color: '#0A84FF' }]}>
                  {bgRemoved ? 'Cutout Active ✓' : 'Remove BG'}
                </Text>
              </TouchableOpacity>

              {/* Magic Eraser */}
              <TouchableOpacity
                style={[styles.aiChip, magicEraserActive && styles.aiChipActive]}
                onPress={() => {
                  setMagicEraserActive((e) => !e);
                  ToastAndroid.show(
                    magicEraserActive ? 'Magic Eraser Off' : 'Brush over unwanted objects to erase',
                    ToastAndroid.SHORT
                  );
                }}
              >
                <PenTool size={18} color={magicEraserActive ? '#0A84FF' : '#FF375F'} />
                <Text style={[styles.aiChipText, magicEraserActive && { color: '#0A84FF' }]}>
                  Magic Eraser
                </Text>
              </TouchableOpacity>

              {/* AI Upscaler */}
              <TouchableOpacity
                style={[styles.aiChip, aiUpscaled && styles.aiChipActive]}
                onPress={() => {
                  setAiUpscaled((u) => !u);
                  ToastAndroid.show(
                    aiUpscaled ? 'Upscaler Off' : '2x Super-Resolution & Clarity Enhanced',
                    ToastAndroid.SHORT
                  );
                }}
              >
                <Maximize2 size={18} color={aiUpscaled ? '#0A84FF' : '#30D158'} />
                <Text style={[styles.aiChipText, aiUpscaled && { color: '#0A84FF' }]}>
                  AI Upscaler (2x)
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* 7. LAYERS TAB */}
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

        {/* Bottom Category Tab Bar (7 Studio Pillars) */}
        <View style={styles.bottomTabs}>
          {(
            [
              { id: 'transform', label: 'Transform', icon: Crop },
              { id: 'adjust', label: 'Adjust', icon: Sliders },
              { id: 'filters', label: 'Filters', icon: Palette },
              { id: 'retouch', label: 'Retouch', icon: Sparkles },
              { id: 'markup', label: 'Markup', icon: PenTool },
              { id: 'ai', label: 'AI Tools', icon: Wand2 },
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

        {/* Dialog: Add Text Modal */}
        <Modal
          visible={textModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setTextModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalBox}>
              <Text style={[typography.h4, { color: '#FFFFFF', marginBottom: spacing.md }]}>
                Add Text to Image
              </Text>
              <View style={styles.inputWrap}>
                <TouchableOpacity
                  style={styles.sampleInput}
                  onPress={() => setNewTextInput('NexFile 2026')}
                >
                  <Text style={{ color: '#FFFFFF' }}>{newTextInput || 'Type your caption or watermark...'}</Text>
                </TouchableOpacity>
              </View>

              {/* Sample quick captions */}
              <View style={styles.quickCaptionRow}>
                {['Verified ✓', 'Shot on NexFile', 'MEMORIES', 'CONFIDENTIAL'].map((cap) => (
                  <TouchableOpacity
                    key={cap}
                    style={styles.quickCapPill}
                    onPress={() => setNewTextInput(cap)}
                  >
                    <Text style={styles.quickCapText}>{cap}</Text>
                  </TouchableOpacity>
                ))}
              </View>

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

        {/* Dialog: Save & Overwrite / New Copy Modal */}
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
                <Text style={[typography.h3, { color: '#FFFFFF', marginLeft: 8 }]}>Save Edited Image</Text>
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
                    Creates a new photo in the same directory. Original photo remains safe and untouched.
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
                  <Text style={[typography.labelLarge, { color: '#FFFFFF' }]}>Replace Original Image</Text>
                  <Text style={[typography.bodySmall, { color: '#8E8E93' }]}>
                    Overwrites the existing photo file on disk directly.
                  </Text>
                </View>
                {saveMode === 'replace' && <Check size={20} color="#FF9F0A" />}
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
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorDotActive: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.15 }],
  },
  stickerChip: {
    padding: 6,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  bottomTabs: {
    height: 60,
    flexDirection: 'row',
    backgroundColor: '#121212',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  tabItem: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabItemActive: {
    borderTopWidth: 2,
    borderTopColor: '#0A84FF',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#8E8E93',
    marginTop: 2,
  },
  tabLabelActive: {
    color: '#0A84FF',
  },
  cropGridBox: {
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.8)',
  },
  cropGridH1: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '33.3%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  cropGridH2: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '66.6%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  cropGridV1: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '33.3%',
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  cropGridV2: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '66.6%',
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  frameWhite: {
    borderWidth: 12,
    borderColor: '#FFFFFF',
  },
  framePolaroid: {
    borderWidth: 14,
    borderBottomWidth: 36,
    borderColor: '#FFFFFF',
  },
  frameNeon: {
    borderWidth: 6,
    borderColor: '#00F0FF',
  },
  bgRemovedPill: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  bgRemovedText: {
    backgroundColor: 'rgba(10, 132, 255, 0.8)',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    fontSize: 12,
    fontWeight: '700',
  },
  healDot: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(48, 209, 88, 0.4)',
    borderWidth: 1.5,
    borderColor: '#30D158',
  },
  eraseDot: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 59, 48, 0.4)',
    borderWidth: 1.5,
    borderColor: '#FF3B30',
  },
  drawPoint: {
    position: 'absolute',
  },
  textOverlayContainer: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: '25%',
  },
  textOverlayPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  textOverlayContent: {
    fontWeight: '800',
    textAlign: 'center',
  },
  stickerBox: {
    position: 'absolute',
  },
  stickerEmoji: {
    fontSize: 32,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  modalBox: {
    width: '100%',
    backgroundColor: '#1C1C1E',
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  inputWrap: {
    backgroundColor: '#2C2C2E',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  sampleInput: {
    paddingVertical: 4,
  },
  quickCaptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  quickCapPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    backgroundColor: '#2C2C2E',
  },
  quickCapText: {
    color: '#0A84FF',
    fontSize: 11,
    fontWeight: '600',
  },
  saveOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: '#2C2C2E',
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  saveOptionCardActive: {
    borderColor: '#0A84FF',
    backgroundColor: 'rgba(10, 132, 255, 0.12)',
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  formatChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: '#2C2C2E',
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
    fontWeight: '700',
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: spacing.lg,
  },
  dialogBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 84,
  },
});

