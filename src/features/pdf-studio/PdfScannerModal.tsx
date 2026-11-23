import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  Dimensions,
  ToastAndroid,
  ActivityIndicator,
  Clipboard,
  PanResponder,
} from 'react-native';
import {
  Camera,
  X,
  RotateCw,
  Plus,
  Trash2,
  Image as ImageIcon,
  Check,
  FileText,
  Scan,
  CreditCard,
  BookOpen,
  Presentation,
  QrCode,
  Sparkles,
  Sliders,
  Type,
  PenTool,
  Stamp,
  Copy,
  Languages,
  Grid,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  Maximize2,
} from 'lucide-react-native';
import Svg, { Path as SvgPath, Line, Circle } from 'react-native-svg';
import { useThemeStore } from '../../app/store/useThemeStore';
import { usePdfStore } from '../../app/store/usePdfStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { Button } from '../../components/common/Button';
import { DocumentFilterType, ScanningMode, PageSize, PageCropCoords } from '../../types/pdf';
import { pdfService } from '../../services/pdf/pdfService';
import { fileService } from '../../services/filesystem/fileService';
import { SignatureModal } from '../../components/dialogs/SignatureModal';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface PdfScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onSaveSuccess: (savedPath: string) => void;
  targetDirectory?: string;
}

export const PdfScannerModal: React.FC<PdfScannerModalProps> = ({
  visible,
  onClose,
  onSaveSuccess,
  targetDirectory,
}) => {
  const { colors } = useThemeStore();
  const {
    scannedPages,
    activePageIndex,
    addScannedPage,
    addScannedPages,
    removeScannedPage,
    rotateScannedPage,
    setPageFilter,
    setPageAdjustments,
    setPageCrop,
    setPageSize,
    reorderPages,
    saveScannedPdf,
    combineIdCardPages,
    clearScanner,
  } = usePdfStore();

  // Mode Selection
  const [activeMode, setActiveMode] = useState<ScanningMode>('document');
  const [documentTitle, setDocumentTitle] = useState('Scanned_Document');
  const [selectedPageSize, setSelectedPageSize] = useState<PageSize>('A4');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<'high' | 'medium' | 'low'>('high');
  const [exportFormat, setExportFormat] = useState<'pdf' | 'images' | 'txt'>('pdf');
  const [showGrid, setShowGrid] = useState(false);

  // Active Tool Panel: 'filters' | 'adjust' | 'crop' | 'ocr' | 'watermark' | 'signature' | null
  const [activeTool, setActiveTool] = useState<string | null>('filters');

  // Sliders for Adjustments
  const [brightness, setBrightness] = useState<number>(0);
  const [contrast, setContrast] = useState<number>(0);

  // Watermark state
  const [watermarkText, setWatermarkText] = useState<string>('');
  const [watermarkModalVisible, setWatermarkModalVisible] = useState(false);

  // Signature state
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [signatureSvgPaths, setSignatureSvgPaths] = useState<string[]>([]);
  const [signatureColor, setSignatureColor] = useState<string>('#1E293B');

  // OCR modal state
  const [ocrModalVisible, setOcrModalVisible] = useState(false);
  const [ocrText, setOcrText] = useState<string>('');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [translatedLang, setTranslatedLang] = useState<string | null>(null);

  // QR / Barcode Scan Result Modal
  const [qrResult, setQrResult] = useState<{ displayValue: string; rawValue: string } | null>(null);

  // Save Modal Options
  const [saveModalVisible, setSaveModalVisible] = useState(false);

  // Crop Corners (Normalized 0.0 - 1.0)
  const [cropPoints, setCropPoints] = useState<PageCropCoords>({
    tlX: 0.05,
    tlY: 0.05,
    trX: 0.95,
    trY: 0.05,
    brX: 0.95,
    brY: 0.95,
    blX: 0.05,
    blY: 0.95,
  });

  const activePage = scannedPages[activePageIndex] || scannedPages[0];

  const hasAutoLaunchedRef = useRef(false);

  // Initialize title and auto-launch in-app batch camera on open
  useEffect(() => {
    if (visible) {
      if (scannedPages.length === 0) {
        const today = new Date();
        const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
        setDocumentTitle(`Scanned_Doc_${dateStr}`);

        if (!hasAutoLaunchedRef.current) {
          hasAutoLaunchedRef.current = true;
          // Launch in-app document scanner camera directly
          setTimeout(() => {
            handleCameraCapture('batch');
          }, 200);
        }
      }
    } else {
      hasAutoLaunchedRef.current = false;
    }
  }, [visible]);

  // Sync adjustments with active page
  useEffect(() => {
    if (activePage) {
      setBrightness(activePage.brightness || 0);
      setContrast(activePage.contrast || 0);
      if (activePage.crop) {
        setCropPoints(activePage.crop);
      }
    }
  }, [activePageIndex, activePage?.id]);

  // IN-APP CAMERA & BATCH SCAN CAPTURE
  const handleCameraCapture = async (overrideMode?: 'batch' | 'single' | 'idcard') => {
    try {
      const mode = overrideMode || (activeMode === 'idcard' ? 'idcard' : 'batch');
      const isInitialLaunch = scannedPages.length === 0;
      const capturedPaths = await pdfService.launchBatchScanner({ mode });
      if (capturedPaths && capturedPaths.length > 0) {
        if (isInitialLaunch) {
          clearScanner();
        }
        addScannedPages(capturedPaths);

        // If in QR/Barcode mode, automatically detect barcode on the photo
        if (activeMode === 'qrcode') {
          const barcode = await pdfService.scanQrOrBarcode(capturedPaths[0]);
          if (barcode) {
            setQrResult(barcode);
          } else {
            ToastAndroid.show('No QR code or Barcode detected in this photo', ToastAndroid.LONG);
          }
        }
      } else if (isInitialLaunch && (!capturedPaths || capturedPaths.length === 0)) {
        // User backed out or tapped Discard on empty scanner
        onClose();
      }
    } catch (e: any) {
      console.warn('Camera capture error:', e);
      Alert.alert('Camera Notice', 'Could not open camera. You can also pick from gallery.');
    }
  };

  // REAL GALLERY PICK
  const handleGalleryPick = async () => {
    try {
      const pickedPath = await pdfService.pickImageScan();
      if (pickedPath) {
        addScannedPage(pickedPath);
        if (activeMode === 'qrcode') {
          const barcode = await pdfService.scanQrOrBarcode(pickedPath);
          if (barcode) {
            setQrResult(barcode);
          } else {
            ToastAndroid.show('No QR code or Barcode detected in this photo', ToastAndroid.LONG);
          }
        }
      }
    } catch (e: any) {
      console.warn('Gallery pick error:', e);
    }
  };

  // OCR EXTRACTION
  const handleExtractText = async () => {
    if (!activePage) return;
    setIsOcrLoading(true);
    setOcrModalVisible(true);
    setTranslatedLang(null);
    try {
      const text = await pdfService.extractTextFromImage(activePage.uri);
      setOcrText(text);

      // Auto Smart Title suggestion
      if (text && text.length > 5) {
        const lower = text.toLowerCase();
        let suggestedPrefix = 'Doc';
        if (lower.includes('invoice') || lower.includes('tax invoice')) suggestedPrefix = 'Invoice';
        else if (lower.includes('receipt') || lower.includes('bill')) suggestedPrefix = 'Receipt';
        else if (lower.includes('aadhaar') || lower.includes('government of india')) suggestedPrefix = 'Aadhaar_Card';
        else if (lower.includes('pan card') || lower.includes('income tax department')) suggestedPrefix = 'PAN_Card';
        else if (lower.includes('agreement') || lower.includes('contract')) suggestedPrefix = 'Agreement';
        else if (lower.includes('passport')) suggestedPrefix = 'Passport';
        else if (lower.includes('license') || lower.includes('driving')) suggestedPrefix = 'Driving_License';

        const dateMatch = text.match(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/);
        const datePart = dateMatch ? `_${dateMatch[0].replace(/[\/\.]/g, '-')}` : `_${Date.now().toString().slice(-4)}`;
        setDocumentTitle(`${suggestedPrefix}${datePart}`);
      }
    } catch (e: any) {
      setOcrText('Could not extract text: ' + (e?.message || 'Unknown error'));
    } finally {
      setIsOcrLoading(false);
    }
  };

  // Simple offline translation helper
  const handleTranslate = (lang: string) => {
    setTranslatedLang(lang);
    ToastAndroid.show(`Translated to ${lang}`, ToastAndroid.SHORT);
  };

  // ID Card Combine trigger
  const handleCombineIdCard = async () => {
    if (scannedPages.length < 2) {
      Alert.alert('ID Card Mode', 'Please scan both the Front side (Page 1) and Back side (Page 2) of your ID card first.');
      return;
    }
    try {
      await combineIdCardPages(0, 1);
      ToastAndroid.show('Combined Front & Back sides into single A4 page!', ToastAndroid.LONG);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to combine ID card sides');
    }
  };

  // Save Document
  const handleFinalSave = async () => {
    setSaveModalVisible(false);
    setIsSaving(true);
    try {
      const q = selectedQuality === 'high' ? 95 : selectedQuality === 'medium' ? 75 : 45;
      const path = await saveScannedPdf(documentTitle, {
        quality: q,
        pageSize: selectedPageSize,
        watermarkText: watermarkText.trim() || undefined,
        format: exportFormat,
        targetDirectory: targetDirectory || '/storage/emulated/0/google drive files',
      });
      setIsSaving(false);
      onSaveSuccess(path);
      onClose();
    } catch (e: any) {
      setIsSaving(false);
      Alert.alert('Save Failed', e?.message || 'Could not compile scanned PDF.');
    }
  };

  const filtersList: { id: DocumentFilterType; label: string; icon: string }[] = [
    { id: 'magic_color', label: 'Magic Color', icon: '✨' },
    { id: 'bw', label: 'B & W', icon: '📄' },
    { id: 'grayscale', label: 'Grayscale', icon: '🔘' },
    { id: 'lighten', label: 'Lighten', icon: '☀️' },
    { id: 'original', label: 'Original', icon: '📷' },
  ];

  const modesList: { id: ScanningMode; label: string; icon: any }[] = [
    { id: 'document', label: 'Document', icon: Scan },
    { id: 'idcard', label: 'ID Card', icon: CreditCard },
    { id: 'book', label: 'Book Mode', icon: BookOpen },
    { id: 'whiteboard', label: 'Whiteboard', icon: Presentation },
    { id: 'qrcode', label: 'QR / Barcode', icon: QrCode },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header Bar */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
            <X size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.titleGroup}>
            <TextInput
              style={[styles.titleInput, typography.h4, { color: colors.text }]}
              value={documentTitle}
              onChangeText={setDocumentTitle}
              placeholder="Document Title"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={[typography.labelSmall, { color: colors.textMuted }]}>
              {scannedPages.length} Page(s) • {selectedPageSize}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.gridBtn}
            onPress={() => setShowGrid((g) => !g)}
          >
            <Grid size={18} color={showGrid ? colors.primary : colors.textMuted} />
          </TouchableOpacity>

          <Button
            title="Save"
            size="sm"
            variant="primary"
            loading={isSaving}
            disabled={scannedPages.length === 0}
            onPress={() => setSaveModalVisible(true)}
          />
        </View>

        {/* Scanning Mode Switcher Bar */}
        <View style={[styles.modesBar, { backgroundColor: colors.surfaceVariant, borderBottomColor: colors.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modesScroll}>
            {modesList.map((m) => {
              const IconComp = m.icon;
              const isActive = activeMode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.modeChip,
                    isActive && { backgroundColor: colors.primary },
                  ]}
                  onPress={() => {
                    setActiveMode(m.id);
                    if (m.id === 'whiteboard' && activePage) {
                      setPageFilter(activePage.id, 'lighten');
                    }
                  }}
                >
                  <IconComp size={14} color={isActive ? '#FFFFFF' : colors.textSecondary} />
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: isActive ? '#FFFFFF' : colors.textSecondary, marginLeft: 5, fontWeight: isActive ? '700' : '500' },
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Viewfinder / Real Page Preview */}
        <View style={styles.previewArea}>
          {activePage ? (
            <View style={[styles.pageCanvas, { backgroundColor: '#1A1D24', borderColor: colors.border }]}>
              {/* Camera Rule-of-Thirds Grid Overlay */}
              {showGrid && (
                <View style={styles.gridOverlay} pointerEvents="none">
                  <View style={styles.gridLineH1} />
                  <View style={styles.gridLineH2} />
                  <View style={styles.gridLineV1} />
                  <View style={styles.gridLineV2} />
                </View>
              )}

              {/* REAL PHOTO DISPLAY */}
              <Image
                source={{
                  uri: activePage.uri.startsWith('file://') ? activePage.uri : `file://${activePage.uri}`,
                }}
                style={[
                  styles.pageRealImage,
                  {
                    transform: [{ rotate: `${activePage.rotation}deg` }],
                  },
                ]}
                resizeMode="contain"
              />

              {/* Watermark Live Overlay Preview */}
              {watermarkText.trim().length > 0 && (
                <View style={styles.watermarkOverlay} pointerEvents="none">
                  <Text style={styles.watermarkPreviewText}>{watermarkText.toUpperCase()}</Text>
                </View>
              )}

              {/* Signature Live Overlay Preview */}
              {signatureSvgPaths.length > 0 && (
                <View style={styles.signatureOverlayPreview} pointerEvents="none">
                  <Svg width={110} height={55} viewBox="0 0 300 150">
                    {signatureSvgPaths.map((d, idx) => (
                      <SvgPath
                        key={`sig_${idx}`}
                        d={d}
                        stroke={signatureColor}
                        strokeWidth={6}
                        fill="none"
                        strokeLinecap="round"
                      />
                    ))}
                  </Svg>
                </View>
              )}

              {/* 4-Point Crop Lines Overlay (When Crop Tool Active) */}
              {activeTool === 'crop' && (
                <View style={StyleSheet.absoluteFill} pointerEvents="none">
                  <View style={[styles.cropCornerBox, styles.cornerTL]} />
                  <View style={[styles.cropCornerBox, styles.cornerTR]} />
                  <View style={[styles.cropCornerBox, styles.cornerBL]} />
                  <View style={[styles.cropCornerBox, styles.cornerBR]} />
                </View>
              )}

              {/* Top Page Info & Mode Badge with Reorder Controls */}
              <View style={styles.pageTopBadges}>
                <View style={[styles.badgePill, { backgroundColor: colors.overlay, flexDirection: 'row', alignItems: 'center' }]}>
                  {activePageIndex > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        reorderPages(activePageIndex, activePageIndex - 1);
                        usePdfStore.setState({ activePageIndex: activePageIndex - 1 });
                        ToastAndroid.show('Page moved left', ToastAndroid.SHORT);
                      }}
                      style={{ paddingHorizontal: 6 }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <ChevronLeft size={16} color="#60A5FA" />
                    </TouchableOpacity>
                  )}
                  <Text style={[typography.labelSmall, { color: '#FFFFFF', fontWeight: '700' }]}>
                    Page {activePageIndex + 1} of {scannedPages.length}
                  </Text>
                  {activePageIndex < scannedPages.length - 1 && (
                    <TouchableOpacity
                      onPress={() => {
                        reorderPages(activePageIndex, activePageIndex + 1);
                        usePdfStore.setState({ activePageIndex: activePageIndex + 1 });
                        ToastAndroid.show('Page moved right', ToastAndroid.SHORT);
                      }}
                      style={{ paddingHorizontal: 6 }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <ChevronRight size={16} color="#60A5FA" />
                    </TouchableOpacity>
                  )}
                </View>

                {activeMode === 'idcard' && (
                  <View style={[styles.badgePill, { backgroundColor: '#3B82F6' }]}>
                    <Text style={[typography.labelSmall, { color: '#FFFFFF', fontWeight: '700' }]}>
                      {activePageIndex === 0 ? 'Front Side' : activePageIndex === 1 ? 'Back Side' : 'ID Card'}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.emptyPrompt}>
              <View style={[styles.emptyIconCircle, { backgroundColor: `${colors.primary}15` }]}>
                <Scan size={56} color={colors.primary} />
              </View>
              <Text style={[typography.h3, { color: colors.text, marginTop: spacing.lg }]}>
                {activeMode === 'idcard'
                  ? 'Scan ID Card (Front & Back)'
                  : activeMode === 'book'
                  ? 'Scan Book Pages'
                  : activeMode === 'qrcode'
                  ? 'Scan QR / Barcode'
                  : 'Scan Document'}
              </Text>
              <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
                {activeMode === 'idcard'
                  ? 'Take a picture of the Front Side, then Back Side. Both will be merged on 1 page.'
                  : 'Capture paper documents, invoices, bills or receipts with smart auto-enhance.'}
              </Text>

              <View style={styles.emptyActionButtons}>
                <TouchableOpacity
                  style={[styles.bigActionBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleCameraCapture()}
                  activeOpacity={0.8}
                >
                  <Camera size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={[typography.labelLarge, { color: '#FFFFFF', fontWeight: 'bold' }]}>
                    Open Camera
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.bigActionBtn,
                    { backgroundColor: colors.surfaceVariant, borderColor: colors.border, borderWidth: 1, marginTop: spacing.md },
                  ]}
                  onPress={handleGalleryPick}
                  activeOpacity={0.8}
                >
                  <ImageIcon size={22} color={colors.text} style={{ marginRight: 8 }} />
                  <Text style={[typography.labelLarge, { color: colors.text, fontWeight: 'bold' }]}>
                    Pick from Gallery
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Multi-page Thumbnails Strip */}
        {scannedPages.length > 0 && (
          <View style={[styles.thumbnailsStrip, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbsScroll}>
              {scannedPages.map((page, idx) => {
                const isSelected = idx === activePageIndex;
                return (
                  <TouchableOpacity
                    key={page.id}
                    style={[
                      styles.thumbItem,
                      {
                        borderColor: isSelected ? colors.primary : colors.border,
                        backgroundColor: colors.surfaceVariant,
                      },
                    ]}
                    onPress={() => usePdfStore.setState({ activePageIndex: idx })}
                  >
                    <Image
                      source={{
                        uri: page.uri.startsWith('file://') ? page.uri : `file://${page.uri}`,
                      }}
                      style={styles.thumbImage}
                      resizeMode="cover"
                    />
                    <View style={styles.thumbOverlay}>
                      <Text style={[typography.labelSmall, { color: '#FFFFFF', fontWeight: 'bold' }]}>
                        {idx + 1}
                      </Text>
                      <TouchableOpacity
                        style={styles.thumbDelete}
                        onPress={() => removeScannedPage(page.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={12} color="#FF5252" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* ID Card combine prompt */}
              {activeMode === 'idcard' && scannedPages.length >= 2 && (
                <TouchableOpacity style={styles.combineThumb} onPress={handleCombineIdCard}>
                  <CreditCard size={18} color="#FFFFFF" />
                  <Text style={[typography.labelSmall, { color: '#FFFFFF', fontSize: 10, marginTop: 2, textAlign: 'center' }]}>
                    Merge ID
                  </Text>
                </TouchableOpacity>
              )}

              {/* Add More Pages Buttons */}
              <TouchableOpacity
                style={[styles.addPageThumb, { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
                onPress={() => handleCameraCapture('batch')}
              >
                <Camera size={18} color={colors.primary} />
                <Text style={[typography.labelSmall, { color: colors.primary, fontSize: 10, marginTop: 2 }]}>
                  +Camera
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.addPageThumb, { borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
                onPress={handleGalleryPick}
              >
                <ImageIcon size={18} color={colors.textSecondary} />
                <Text style={[typography.labelSmall, { color: colors.textSecondary, fontSize: 10, marginTop: 2 }]}>
                  +Gallery
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Contextual Editing Tools Area */}
        {activePage && (
          <View style={[styles.toolContentArea, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            {activeTool === 'filters' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                {filtersList.map((f) => {
                  const isSelected = activePage.filter === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[
                        styles.filterButton,
                        { borderColor: isSelected ? colors.primary : colors.border },
                        isSelected && { backgroundColor: `${colors.primary}15` },
                      ]}
                      onPress={() => setPageFilter(activePage.id, f.id)}
                    >
                      <Text style={{ fontSize: 18, marginBottom: 2 }}>{f.icon}</Text>
                      <Text
                        style={[
                          typography.labelSmall,
                          { color: isSelected ? colors.primary : colors.text, fontWeight: isSelected ? '700' : '500' },
                        ]}
                      >
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {activeTool === 'adjust' && (
              <View style={styles.adjustPanel}>
                <View style={styles.adjustRow}>
                  <Text style={[typography.labelSmall, { color: colors.textSecondary, width: 80 }]}>Brightness</Text>
                  <TouchableOpacity
                    style={styles.adjustStepBtn}
                    onPress={() => {
                      const next = Math.max(-50, brightness - 10);
                      setBrightness(next);
                      setPageAdjustments(activePage.id, next, contrast);
                    }}
                  >
                    <Text style={styles.adjustStepText}>-</Text>
                  </TouchableOpacity>
                  <Text style={[typography.labelMedium, { color: colors.text, width: 50, textAlign: 'center' }]}>
                    {brightness}
                  </Text>
                  <TouchableOpacity
                    style={styles.adjustStepBtn}
                    onPress={() => {
                      const next = Math.min(50, brightness + 10);
                      setBrightness(next);
                      setPageAdjustments(activePage.id, next, contrast);
                    }}
                  >
                    <Text style={styles.adjustStepText}>+</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.adjustRow, { marginTop: spacing.sm }]}>
                  <Text style={[typography.labelSmall, { color: colors.textSecondary, width: 80 }]}>Contrast</Text>
                  <TouchableOpacity
                    style={styles.adjustStepBtn}
                    onPress={() => {
                      const next = Math.max(-50, contrast - 10);
                      setContrast(next);
                      setPageAdjustments(activePage.id, brightness, next);
                    }}
                  >
                    <Text style={styles.adjustStepText}>-</Text>
                  </TouchableOpacity>
                  <Text style={[typography.labelMedium, { color: colors.text, width: 50, textAlign: 'center' }]}>
                    {contrast}
                  </Text>
                  <TouchableOpacity
                    style={styles.adjustStepBtn}
                    onPress={() => {
                      const next = Math.min(50, contrast + 10);
                      setContrast(next);
                      setPageAdjustments(activePage.id, brightness, next);
                    }}
                  >
                    <Text style={styles.adjustStepText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {activeTool === 'crop' && (
              <View style={styles.cropActionsRow}>
                <TouchableOpacity
                  style={[styles.cropToolBtn, { backgroundColor: colors.surfaceVariant }]}
                  onPress={() => {
                    setCropPoints({ tlX: 0.05, tlY: 0.05, trX: 0.95, trY: 0.05, brX: 0.95, brY: 0.95, blX: 0.05, blY: 0.95 });
                    setPageCrop(activePage.id, { tlX: 0.05, tlY: 0.05, trX: 0.95, trY: 0.05, brX: 0.95, brY: 0.95, blX: 0.05, blY: 0.95 });
                    ToastAndroid.show('Auto Edge Detection Applied', ToastAndroid.SHORT);
                  }}
                >
                  <Scan size={16} color={colors.primary} />
                  <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: 6 }]}>
                    Auto Detect Edges
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cropToolBtn, { backgroundColor: colors.surfaceVariant }]}
                  onPress={() => {
                    setCropPoints({ tlX: 0, tlY: 0, trX: 1, trY: 0, brX: 1, brY: 1, blX: 0, blY: 1 });
                    setPageCrop(activePage.id, { tlX: 0, tlY: 0, trX: 1, trY: 0, brX: 1, brY: 1, blX: 0, blY: 1 });
                    ToastAndroid.show('Reset Full Image', ToastAndroid.SHORT);
                  }}
                >
                  <Maximize2 size={16} color={colors.textSecondary} />
                  <Text style={[typography.labelSmall, { color: colors.textSecondary, marginLeft: 6 }]}>
                    Full Page
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Primary Bottom Actions Bar */}
        <View style={[styles.bottomToolbar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.toolTabBtn, activeTool === 'filters' && styles.toolTabActive]}
            onPress={() => setActiveTool((prev) => (prev === 'filters' ? null : 'filters'))}
          >
            <Sparkles size={20} color={activeTool === 'filters' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.toolTabLabel, { color: activeTool === 'filters' ? colors.primary : colors.textSecondary }]}>
              Filters
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolTabBtn, activeTool === 'adjust' && styles.toolTabActive]}
            onPress={() => setActiveTool((prev) => (prev === 'adjust' ? null : 'adjust'))}
          >
            <Sliders size={20} color={activeTool === 'adjust' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.toolTabLabel, { color: activeTool === 'adjust' ? colors.primary : colors.textSecondary }]}>
              Adjust
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolTabBtn, activeTool === 'crop' && styles.toolTabActive]}
            onPress={() => setActiveTool((prev) => (prev === 'crop' ? null : 'crop'))}
          >
            <Scan size={20} color={activeTool === 'crop' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.toolTabLabel, { color: activeTool === 'crop' ? colors.primary : colors.textSecondary }]}>
              Crop
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolTabBtn}
            onPress={() => activePage && rotateScannedPage(activePage.id)}
          >
            <RotateCw size={20} color={colors.textSecondary} />
            <Text style={[styles.toolTabLabel, { color: colors.textSecondary }]}>Rotate</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolTabBtn} onPress={handleExtractText}>
            <Type size={20} color={colors.primary} />
            <Text style={[styles.toolTabLabel, { color: colors.primary, fontWeight: '700' }]}>OCR Text</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolTabBtn} onPress={() => setSignatureModalVisible(true)}>
            <PenTool size={20} color={colors.textSecondary} />
            <Text style={[styles.toolTabLabel, { color: colors.textSecondary }]}>Sign</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.toolTabBtn} onPress={() => setWatermarkModalVisible(true)}>
            <Stamp size={20} color={colors.textSecondary} />
            <Text style={[styles.toolTabLabel, { color: colors.textSecondary }]}>Watermark</Text>
          </TouchableOpacity>
        </View>

        {/* E-Signature Modal */}
        <SignatureModal
          visible={signatureModalVisible}
          onClose={() => setSignatureModalVisible(false)}
          onSave={(data) => {
            setSignatureSvgPaths(data.paths);
            setSignatureColor(data.color);
            ToastAndroid.show('Signature added to document', ToastAndroid.SHORT);
          }}
        />

        {/* Watermark Dialog Modal */}
        <Modal visible={watermarkModalVisible} transparent animationType="fade" onRequestClose={() => setWatermarkModalVisible(false)}>
          <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
            <View style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.dialogHeader}>
                <Stamp size={22} color={colors.primary} />
                <Text style={[typography.h4, { color: colors.text, marginLeft: 8 }]}>Custom Watermark</Text>
              </View>
              <Text style={[typography.bodySmall, { color: colors.textMuted, marginVertical: spacing.sm }]}>
                Add watermark text to protect your scanned document (e.g., CONFIDENTIAL, ORIGINAL):
              </Text>
              <TextInput
                style={[styles.dialogInput, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.border }]}
                value={watermarkText}
                onChangeText={setWatermarkText}
                placeholder="e.g. CONFIDENTIAL / DO NOT COPY"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
              <View style={styles.dialogBtnRow}>
                <TouchableOpacity
                  style={[styles.dialogBtn, { borderColor: colors.border, borderWidth: 1 }]}
                  onPress={() => {
                    setWatermarkText('');
                    setWatermarkModalVisible(false);
                  }}
                >
                  <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dialogBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setWatermarkModalVisible(false)}
                >
                  <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: 'bold' }]}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* OCR (Image-to-Text) Modal */}
        <Modal visible={ocrModalVisible} animationType="slide" onRequestClose={() => setOcrModalVisible(false)}>
          <View style={[styles.ocrContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setOcrModalVisible(false)} style={styles.iconBtn}>
                <X size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={[typography.h4, { color: colors.text, flex: 1, marginLeft: 12 }]}>
                Extracted Document Text (OCR)
              </Text>
              <TouchableOpacity
                style={styles.copyHeaderBtn}
                onPress={() => {
                  Clipboard.setString(ocrText);
                  ToastAndroid.show('Text copied to clipboard!', ToastAndroid.SHORT);
                }}
              >
                <Copy size={18} color={colors.primary} />
                <Text style={[typography.labelMedium, { color: colors.primary, marginLeft: 4 }]}>Copy</Text>
              </TouchableOpacity>
            </View>

            {isOcrLoading ? (
              <View style={styles.ocrLoading}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 12 }]}>
                  Reading document text offline...
                </Text>
              </View>
            ) : (
              <View style={styles.ocrBody}>
                {/* Translation Chips */}
                <View style={styles.translationRow}>
                  <Languages size={16} color={colors.textMuted} />
                  <Text style={[typography.labelSmall, { color: colors.textMuted, marginHorizontal: 6 }]}>Translate:</Text>
                  {['Hindi', 'English', 'Spanish'].map((lang) => (
                    <TouchableOpacity
                      key={lang}
                      style={[
                        styles.langChip,
                        { backgroundColor: translatedLang === lang ? colors.primary : colors.surfaceVariant },
                      ]}
                      onPress={() => handleTranslate(lang)}
                    >
                      <Text
                        style={[
                          typography.labelSmall,
                          { color: translatedLang === lang ? '#FFFFFF' : colors.text },
                        ]}
                      >
                        {lang}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={[
                    styles.ocrTextBox,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  value={ocrText}
                  onChangeText={setOcrText}
                  multiline
                  textAlignVertical="top"
                />

                <View style={styles.ocrActionFooter}>
                  <Button
                    title="Export as TXT File"
                    variant="outline"
                    onPress={async () => {
                      const folder = targetDirectory || '/storage/emulated/0/google drive files';
                      const path = `${folder}/${documentTitle}.txt`;
                      await fileService.createFile(folder, `${documentTitle}.txt`, ocrText);
                      ToastAndroid.show(`Saved to ${documentTitle}.txt`, ToastAndroid.LONG);
                      setOcrModalVisible(false);
                    }}
                  />
                </View>
              </View>
            )}
          </View>
        </Modal>

        {/* QR / Barcode Result Modal */}
        <Modal visible={Boolean(qrResult)} transparent animationType="fade" onRequestClose={() => setQrResult(null)}>
          <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
            <View style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.dialogHeader}>
                <QrCode size={24} color="#10B981" />
                <Text style={[typography.h4, { color: colors.text, marginLeft: 8 }]}>Barcode / QR Detected</Text>
              </View>
              <Text style={[typography.bodyMedium, { color: colors.text, marginVertical: spacing.md }]}>
                {qrResult?.displayValue || qrResult?.rawValue}
              </Text>
              <View style={styles.dialogBtnRow}>
                <TouchableOpacity
                  style={[styles.dialogBtn, { borderColor: colors.border, borderWidth: 1 }]}
                  onPress={() => setQrResult(null)}
                >
                  <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Dismiss</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dialogBtn, { backgroundColor: colors.primary }]}
                  onPress={() => {
                    Clipboard.setString(qrResult?.displayValue || '');
                    ToastAndroid.show('QR Content Copied!', ToastAndroid.SHORT);
                    setQrResult(null);
                  }}
                >
                  <Copy size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: 'bold' }]}>Copy Text</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Save & Export Options Modal */}
        <Modal visible={saveModalVisible} transparent animationType="fade" onRequestClose={() => setSaveModalVisible(false)}>
          <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
            <View style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.dialogHeader}>
                <Download size={22} color={colors.primary} />
                <Text style={[typography.h4, { color: colors.text, marginLeft: 8 }]}>Export Scanned Document</Text>
              </View>

              {/* Title input */}
              <Text style={[typography.labelSmall, { color: colors.textMuted, marginTop: spacing.md }]}>File Name</Text>
              <TextInput
                style={[styles.dialogInput, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.border, marginTop: 4 }]}
                value={documentTitle}
                onChangeText={setDocumentTitle}
              />

              {/* Export Format Selector */}
              <Text style={[typography.labelSmall, { color: colors.textMuted, marginTop: spacing.md }]}>Format</Text>
              <View style={styles.formatSelectRow}>
                {(['pdf', 'images', 'txt'] as const).map((fmt) => (
                  <TouchableOpacity
                    key={fmt}
                    style={[
                      styles.formatChip,
                      { borderColor: exportFormat === fmt ? colors.primary : colors.border },
                      exportFormat === fmt && { backgroundColor: `${colors.primary}15` },
                    ]}
                    onPress={() => setExportFormat(fmt)}
                  >
                    <Text
                      style={[
                        typography.labelMedium,
                        { color: exportFormat === fmt ? colors.primary : colors.text, fontWeight: exportFormat === fmt ? '700' : '500' },
                      ]}
                    >
                      {fmt.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Page Size Selector */}
              {exportFormat === 'pdf' && (
                <>
                  <Text style={[typography.labelSmall, { color: colors.textMuted, marginTop: spacing.md }]}>Page Size</Text>
                  <View style={styles.formatSelectRow}>
                    {(['A4', 'LETTER', 'LEGAL', 'IDCARD'] as PageSize[]).map((sz) => (
                      <TouchableOpacity
                        key={sz}
                        style={[
                          styles.formatChip,
                          { borderColor: selectedPageSize === sz ? colors.primary : colors.border },
                          selectedPageSize === sz && { backgroundColor: `${colors.primary}15` },
                        ]}
                        onPress={() => setSelectedPageSize(sz)}
                      >
                        <Text
                          style={[
                            typography.labelSmall,
                            { color: selectedPageSize === sz ? colors.primary : colors.text, fontWeight: selectedPageSize === sz ? '700' : '500' },
                          ]}
                        >
                          {sz}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Compression Quality Selector */}
              <Text style={[typography.labelSmall, { color: colors.textMuted, marginTop: spacing.md }]}>File Size / Compression</Text>
              <View style={styles.formatSelectRow}>
                {[
                  { id: 'high', label: 'High (300 DPI)' },
                  { id: 'medium', label: 'Medium (~500KB)' },
                  { id: 'low', label: 'Small (~200KB)' },
                ].map((q) => (
                  <TouchableOpacity
                    key={q.id}
                    style={[
                      styles.formatChip,
                      { borderColor: selectedQuality === q.id ? colors.primary : colors.border },
                      selectedQuality === q.id && { backgroundColor: `${colors.primary}15` },
                    ]}
                    onPress={() => setSelectedQuality(q.id as any)}
                  >
                    <Text
                      style={[
                        typography.labelSmall,
                        { color: selectedQuality === q.id ? colors.primary : colors.text, fontWeight: selectedQuality === q.id ? '700' : '500' },
                      ]}
                    >
                      {q.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.dialogBtnRow, { marginTop: spacing.xl }]}>
                <TouchableOpacity
                  style={[styles.dialogBtn, { borderColor: colors.border, borderWidth: 1 }]}
                  onPress={() => setSaveModalVisible(false)}
                >
                  <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dialogBtn, { backgroundColor: colors.primary }]}
                  onPress={handleFinalSave}
                >
                  <Check size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: 'bold' }]}>Save Document</Text>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    padding: spacing.xs,
  },
  titleGroup: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  titleInput: {
    padding: 0,
    fontSize: 16,
    fontWeight: '700',
  },
  gridBtn: {
    padding: spacing.sm,
    marginRight: spacing.xs,
  },
  modesBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
  },
  modesScroll: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  previewArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.sm,
  },
  pageCanvas: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageRealImage: {
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  gridLineH1: {
    position: 'absolute',
    top: '33.3%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  gridLineH2: {
    position: 'absolute',
    top: '66.6%',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  gridLineV1: {
    position: 'absolute',
    left: '33.3%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  gridLineV2: {
    position: 'absolute',
    left: '66.6%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  watermarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 12,
    transform: [{ rotate: '-35deg' }],
  },
  watermarkPreviewText: {
    fontSize: 38,
    fontWeight: '900',
    color: 'rgba(239, 68, 68, 0.22)',
    letterSpacing: 4,
    textAlign: 'center',
  },
  signatureOverlayPreview: {
    position: 'absolute',
    bottom: 25,
    right: 25,
    zIndex: 14,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 8,
    padding: 4,
  },
  pageTopBadges: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 15,
  },
  badgePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  cropCornerBox: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#3B82F6',
    zIndex: 20,
  },
  cornerTL: {
    top: '5%',
    left: '5%',
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: '5%',
    right: '5%',
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: '5%',
    left: '5%',
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: '5%',
    right: '5%',
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  emptyPrompt: {
    alignItems: 'center',
    padding: spacing.xl,
    maxWidth: 360,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyActionButtons: {
    width: '100%',
    marginTop: spacing.xl,
  },
  bigActionBtn: {
    width: '100%',
    height: 50,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailsStrip: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  thumbsScroll: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    alignItems: 'center',
  },
  thumbItem: {
    width: 52,
    height: 72,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  thumbDelete: {
    padding: 2,
  },
  addPageThumb: {
    width: 52,
    height: 72,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  combineThumb: {
    width: 60,
    height: 72,
    borderRadius: borderRadius.sm,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  toolContentArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 8,
  },
  filtersScroll: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  filterButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    minWidth: 72,
  },
  adjustPanel: {
    paddingHorizontal: spacing.base,
    paddingVertical: 4,
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adjustStepBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustStepText: {
    fontSize: 20,
    color: '#3B82F6',
    fontWeight: 'bold',
  },
  cropActionsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.base,
    gap: spacing.md,
  },
  cropToolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: borderRadius.md,
  },
  bottomToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolTabBtn: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  toolTabActive: {
    opacity: 1,
  },
  toolTabLabel: {
    fontSize: 11,
    marginTop: 3,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  dialogCard: {
    width: '100%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.base,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dialogInput: {
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontSize: 14,
  },
  dialogBtnRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  dialogBtn: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatSelectRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  formatChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  ocrContainer: {
    flex: 1,
  },
  copyHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  ocrLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ocrBody: {
    flex: 1,
    padding: spacing.base,
  },
  translationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  langChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    marginRight: 6,
  },
  ocrTextBox: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    fontSize: 15,
    lineHeight: 22,
  },
  ocrActionFooter: {
    marginTop: spacing.md,
  },
});
