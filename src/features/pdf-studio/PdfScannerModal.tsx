import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
import {
  Camera,
  RotateCcw,
  PlusSquare,
  Crop as CropIcon,
  Trash2,
  Image as ImageIcon,
  Check,
  Scan,
  CreditCard,
  QrCode,
  Copy,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Edit2,
  Maximize2,
} from 'lucide-react-native';
import { usePdfStore } from '../../app/store/usePdfStore';
import { DocumentFilterType, ScanningMode, PageSize, PageCropCoords } from '../../types/pdf';
import { pdfService } from '../../services/pdf/pdfService';
import { fileService } from '../../services/filesystem/fileService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PdfScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onSaveSuccess: (savedPath: string) => void;
  targetDirectory?: string;
  initialMode?: ScanningMode;
  initialAction?: 'camera' | 'gallery';
}

const getDefaultDocTitle = () => {
  const d = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const yyyy = d.getFullYear();
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `New Doc ${mm}-${dd}-${yyyy} ${hh}.${min}`;
};

export const PdfScannerModal: React.FC<PdfScannerModalProps> = ({
  visible,
  onClose,
  onSaveSuccess,
  targetDirectory,
  initialMode,
  initialAction,
}) => {
  const {
    scannedPages,
    activePageIndex,
    addScannedPage,
    addScannedPages,
    removeScannedPage,
    rotateScannedPage,
    setPageFilter,
    setPageCrop,
    clearScanner,
    saveScannedPdf,
  } = usePdfStore();

  const [activeMode, setActiveMode] = useState<ScanningMode>('document');
  const [documentTitle, setDocumentTitle] = useState(getDefaultDocTitle());
  const [isTitleModalVisible, setIsTitleModalVisible] = useState(false);
  const [tempTitle, setTempTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Apply to all pages toggle
  const [applyToAllPages, setApplyToAllPages] = useState(false);

  // Crop mode overlay toggle
  const [isCropMode, setIsCropMode] = useState(false);

  // QR / Barcode Scan Result Modal
  const [qrResult, setQrResult] = useState<{ displayValue: string; rawValue: string } | null>(null);

  const activePage = scannedPages[activePageIndex] || scannedPages[0];
  const hasAutoLaunchedRef = useRef(false);

  // Auto-launch camera or gallery on opening
  useEffect(() => {
    if (visible) {
      if (initialMode) {
        setActiveMode(initialMode);
      }
      if (scannedPages.length === 0) {
        setDocumentTitle(getDefaultDocTitle());

        if (!hasAutoLaunchedRef.current) {
          hasAutoLaunchedRef.current = true;
          setTimeout(() => {
            if (initialAction === 'gallery') {
              handleGalleryPick();
            } else {
              const targetScanMode =
                initialMode === 'idcard' ||
                initialMode === 'book' ||
                initialMode === 'qrcode' ||
                initialMode === 'whiteboard'
                  ? initialMode
                  : 'batch';
              handleCameraCapture(targetScanMode as any);
            }
          }, 200);
        }
      }
    } else {
      hasAutoLaunchedRef.current = false;
      setIsCropMode(false);
    }
  }, [visible, initialMode, initialAction]);

  // IN-APP CAMERA & BATCH SCAN CAPTURE
  const handleCameraCapture = async (overrideMode?: 'batch' | 'single' | 'idcard') => {
    try {
      const mode = overrideMode || (activeMode === 'idcard' ? 'idcard' : 'batch');
      const isInitialLaunch = scannedPages.length === 0;
      const capturedPaths = await pdfService.launchBatchScanner({ mode });

      if (capturedPaths && capturedPaths.length > 0) {
        if (overrideMode === 'single' && activePage) {
          // Replace current page with newly captured photo
          removeScannedPage(activePage.id);
          addScannedPage(capturedPaths[0]);
          ToastAndroid.show('Page retaken successfully', ToastAndroid.SHORT);
        } else {
          if (isInitialLaunch) {
            clearScanner();
          }
          addScannedPages(capturedPaths);
        }

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
        onClose();
      }
    } catch (e: any) {
      console.warn('Camera capture error:', e);
      Alert.alert('Camera Notice', 'Could not open camera. You can also pick from gallery.');
    }
  };

  // GALLERY PICK
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

  // DELETE CURRENT ACTIVE PAGE
  const handleDeleteActivePage = () => {
    if (!activePage) return;
    Alert.alert(
      'Delete Page',
      `Delete page ${activePageIndex + 1} of ${scannedPages.length}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (scannedPages.length <= 1) {
              clearScanner();
              onClose();
            } else {
              removeScannedPage(activePage.id);
              ToastAndroid.show('Page deleted', ToastAndroid.SHORT);
            }
          },
        },
      ]
    );
  };

  // APPLY FILTER (SINGLE OR ALL PAGES)
  const handleApplyFilter = (filterId: DocumentFilterType) => {
    if (!activePage) return;

    if (applyToAllPages) {
      scannedPages.forEach((p) => {
        setPageFilter(p.id, filterId);
      });
      ToastAndroid.show(`Applied "${filterLabels[filterId]}" to all pages`, ToastAndroid.SHORT);
    } else {
      setPageFilter(activePage.id, filterId);
    }
  };

  // QUICK DONE / SAVE ACTION
  const handleQuickDone = async () => {
    if (scannedPages.length === 0) return;
    setIsSaving(true);
    try {
      const path = await saveScannedPdf(documentTitle, {
        quality: 95,
        pageSize: 'A4',
        targetDirectory: targetDirectory || '/storage/emulated/0/google drive files',
      });
      setIsSaving(false);
      ToastAndroid.show('PDF Saved Successfully!', ToastAndroid.LONG);
      onSaveSuccess(path);
      onClose();
    } catch (e: any) {
      setIsSaving(false);
      Alert.alert('Save Failed', e?.message || 'Could not compile scanned PDF.');
    }
  };

  // FILTER DEFINITIONS MATCHING IMAGE 6
  const filterLabels: Record<DocumentFilterType, string> = {
    no_shadow: 'No shadow',
    original: 'Original',
    lighten: 'Lighten',
    magic_color: 'Magic Color',
    grayscale: 'Grayscale',
    bw: 'B&W',
    color: 'Color',
  };

  const okenFilters: { id: DocumentFilterType; label: string; isBeta?: boolean }[] = [
    { id: 'no_shadow', label: 'No shadow', isBeta: true },
    { id: 'original', label: 'Original' },
    { id: 'lighten', label: 'Lighten' },
    { id: 'magic_color', label: 'Magic Color' },
    { id: 'grayscale', label: 'Grayscale' },
    { id: 'bw', label: 'B&W' },
  ];

  const currentFilter = activePage?.filter || 'original';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Header Bar matching Image 6 */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (scannedPages.length > 0) {
                Alert.alert(
                  'Exit Scan',
                  'Discard scanned pages or save document?',
                  [
                    { text: 'Keep Editing', style: 'cancel' },
                    {
                      text: 'Discard',
                      style: 'destructive',
                      onPress: () => {
                        clearScanner();
                        onClose();
                      },
                    },
                    {
                      text: 'Save',
                      onPress: handleQuickDone,
                    },
                  ]
                );
              } else {
                onClose();
              }
            }}
            style={styles.backBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Editable Document Title with Dotted Underline */}
          <TouchableOpacity
            style={styles.titleContainer}
            onPress={() => {
              setTempTitle(documentTitle);
              setIsTitleModalVisible(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.titleText} numberOfLines={1}>
              {documentTitle}
            </Text>
            <View style={styles.dottedLine} />
          </TouchableOpacity>

          {/* Green Done Pill Button */}
          <TouchableOpacity
            style={[styles.doneBtn, isSaving && { opacity: 0.7 }]}
            onPress={handleQuickDone}
            disabled={isSaving || scannedPages.length === 0}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.doneBtnText}>Done</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Center Canvas / Preview matching Image 6 */}
        <View style={styles.canvasArea}>
          {activePage ? (
            <View style={styles.imageWrapper}>
              {/* Circular Delete Button on Top-Left of Image */}
              <TouchableOpacity
                style={styles.floatingDeleteBtn}
                onPress={handleDeleteActivePage}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <Trash2 size={16} color="#CCCCCC" />
              </TouchableOpacity>

              {/* Real Scanned Page Image */}
              <Image
                source={{
                  uri: activePage.uri.startsWith('file://') ? activePage.uri : `file://${activePage.uri}`,
                }}
                style={[
                  styles.previewImage,
                  {
                    transform: [{ rotate: `${activePage.rotation}deg` }],
                  },
                ]}
                resizeMode="contain"
              />

              {/* 4-Corner Crop Overlay when crop active */}
              {isCropMode && (
                <View style={styles.cropOverlay} pointerEvents="none">
                  <View style={[styles.cropCorner, styles.cornerTL]} />
                  <View style={[styles.cropCorner, styles.cornerTR]} />
                  <View style={[styles.cropCorner, styles.cornerBL]} />
                  <View style={[styles.cropCorner, styles.cornerBR]} />
                  <View style={styles.cropGuideBorder} />
                </View>
              )}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Scan size={56} color="#00C853" />
              <Text style={styles.emptyTitle}>No Scanned Pages</Text>
              <Text style={styles.emptySubtitle}>Tap below to start capturing documents</Text>
              <TouchableOpacity
                style={styles.openCameraBtn}
                onPress={() => handleCameraCapture('batch')}
              >
                <Camera size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.openCameraBtnText}>Open Camera</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Pagination Section: < 1/3 > matching Image 6 */}
        {scannedPages.length > 0 && (
          <View style={styles.paginationRow}>
            <TouchableOpacity
              onPress={() => {
                if (activePageIndex > 0) {
                  usePdfStore.setState({ activePageIndex: activePageIndex - 1 });
                }
              }}
              disabled={activePageIndex === 0}
              style={[styles.pageNavBtn, activePageIndex === 0 && styles.pageNavDisabled]}
              hitSlop={{ top: 10, bottom: 10, left: 14, right: 14 }}
            >
              <ChevronLeft size={24} color={activePageIndex === 0 ? '#444444' : '#FFFFFF'} />
            </TouchableOpacity>

            <Text style={styles.paginationText}>
              {activePageIndex + 1}/{scannedPages.length}
            </Text>

            <TouchableOpacity
              onPress={() => {
                if (activePageIndex < scannedPages.length - 1) {
                  usePdfStore.setState({ activePageIndex: activePageIndex + 1 });
                }
              }}
              disabled={activePageIndex === scannedPages.length - 1}
              style={[styles.pageNavBtn, activePageIndex === scannedPages.length - 1 && styles.pageNavDisabled]}
              hitSlop={{ top: 10, bottom: 10, left: 14, right: 14 }}
            >
              <ChevronRight size={24} color={activePageIndex === scannedPages.length - 1 ? '#444444' : '#FFFFFF'} />
            </TouchableOpacity>
          </View>
        )}

        {/* "Apply to all pages ○" Toggle Row matching Image 6 */}
        {scannedPages.length > 0 && (
          <View style={styles.applyAllContainer}>
            <TouchableOpacity
              style={styles.applyAllBtn}
              onPress={() => setApplyToAllPages((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={styles.applyAllLabel}>Apply to all pages</Text>
              <View style={[styles.radioCircle, applyToAllPages && styles.radioCircleActive]}>
                {applyToAllPages && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Filter Carousel Strip matching Image 6 */}
        {scannedPages.length > 0 && (
          <View style={styles.filtersSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filtersScrollContent}
            >
              {okenFilters.map((f) => {
                const isSelected = currentFilter === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={styles.filterCardItem}
                    onPress={() => handleApplyFilter(f.id)}
                    activeOpacity={0.8}
                  >
                    {/* Thumbnail Box */}
                    <View
                      style={[
                        styles.filterThumbnailBox,
                        isSelected && styles.filterThumbnailSelected,
                      ]}
                    >
                      {activePage && (
                        <Image
                          source={{
                            uri: activePage.uri.startsWith('file://')
                              ? activePage.uri
                              : `file://${activePage.uri}`,
                          }}
                          style={[
                            styles.filterThumbnailImage,
                            f.id === 'grayscale' && styles.filterGrayStyle,
                            f.id === 'bw' && styles.filterBwStyle,
                            f.id === 'lighten' && styles.filterLightenStyle,
                          ]}
                          resizeMode="cover"
                        />
                      )}

                      {/* Red "Beta" Badge for No shadow */}
                      {f.isBeta && (
                        <View style={styles.betaBadge}>
                          <Text style={styles.betaBadgeText}>Beta</Text>
                        </View>
                      )}
                    </View>

                    {/* Filter Label */}
                    <Text
                      style={[
                        styles.filterLabelText,
                        isSelected && styles.filterLabelTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Bottom Toolbar: Retake | Add | Left | Crop matching Image 6 */}
        <View style={styles.bottomToolbar}>
          {/* 1. Retake */}
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => handleCameraCapture('single')}
            activeOpacity={0.7}
          >
            <Camera size={22} color="#FFFFFF" />
            <Text style={styles.toolBtnLabel}>Retake</Text>
          </TouchableOpacity>

          {/* 2. Add */}
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => handleCameraCapture('batch')}
            activeOpacity={0.7}
          >
            <PlusSquare size={22} color="#FFFFFF" />
            <Text style={styles.toolBtnLabel}>Add</Text>
          </TouchableOpacity>

          {/* 3. Left (Rotate 90 CCW) */}
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => {
              if (activePage) {
                rotateScannedPage(activePage.id, -90);
              }
            }}
            activeOpacity={0.7}
          >
            <RotateCcw size={22} color="#FFFFFF" />
            <Text style={styles.toolBtnLabel}>Left</Text>
          </TouchableOpacity>

          {/* 4. Crop */}
          <TouchableOpacity
            style={[styles.toolBtn, isCropMode && styles.toolBtnActive]}
            onPress={() => {
              setIsCropMode((c) => !c);
              if (!isCropMode) {
                ToastAndroid.show('Crop boundary guides active', ToastAndroid.SHORT);
              }
            }}
            activeOpacity={0.7}
          >
            <CropIcon size={22} color={isCropMode ? '#00C853' : '#FFFFFF'} />
            <Text style={[styles.toolBtnLabel, isCropMode && { color: '#00C853' }]}>Crop</Text>
          </TouchableOpacity>
        </View>

        {/* Rename Document Title Modal */}
        <Modal
          visible={isTitleModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsTitleModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.titleModalCard}>
              <View style={styles.titleModalHeader}>
                <Edit2 size={20} color="#00C853" />
                <Text style={styles.titleModalHeading}>Rename Document</Text>
              </View>

              <TextInput
                style={styles.titleModalInput}
                value={tempTitle}
                onChangeText={setTempTitle}
                placeholder="Enter document title"
                placeholderTextColor="#777777"
                autoFocus
                selectTextOnFocus
              />

              <View style={styles.titleModalActions}>
                <TouchableOpacity
                  style={styles.titleModalCancelBtn}
                  onPress={() => setIsTitleModalVisible(false)}
                >
                  <Text style={styles.titleModalCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.titleModalSaveBtn}
                  onPress={() => {
                    if (tempTitle.trim().length > 0) {
                      setDocumentTitle(tempTitle.trim());
                    }
                    setIsTitleModalVisible(false);
                  }}
                >
                  <Text style={styles.titleModalSaveText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* QR / Barcode Result Modal */}
        <Modal
          visible={Boolean(qrResult)}
          transparent
          animationType="fade"
          onRequestClose={() => setQrResult(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.titleModalCard}>
              <View style={styles.titleModalHeader}>
                <QrCode size={22} color="#00C853" />
                <Text style={styles.titleModalHeading}>Barcode / QR Content</Text>
              </View>
              <Text style={styles.qrResultText}>{qrResult?.displayValue || qrResult?.rawValue}</Text>
              <View style={styles.titleModalActions}>
                <TouchableOpacity
                  style={styles.titleModalCancelBtn}
                  onPress={() => setQrResult(null)}
                >
                  <Text style={styles.titleModalCancelText}>Dismiss</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.titleModalSaveBtn}
                  onPress={() => {
                    Clipboard.setString(qrResult?.displayValue || '');
                    ToastAndroid.show('Copied to clipboard!', ToastAndroid.SHORT);
                    setQrResult(null);
                  }}
                >
                  <Copy size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={styles.titleModalSaveText}>Copy</Text>
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
    backgroundColor: '#0D0E11',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#0D0E11',
  },
  backBtn: {
    padding: 6,
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  dottedLine: {
    width: '100%',
    height: 1,
    marginTop: 4,
    borderBottomWidth: 1,
    borderStyle: 'dotted',
    borderColor: 'rgba(255, 255, 255, 0.65)',
  },
  doneBtn: {
    backgroundColor: '#00C853', // OKEN Green
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  canvasArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  imageWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  floatingDeleteBtn: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(25, 27, 31, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cropOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    margin: 16,
  },
  cropGuideBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1.5,
    borderColor: '#00C853',
    borderStyle: 'dashed',
  },
  cropCorner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#00C853',
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 14,
  },
  emptySubtitle: {
    color: '#8E8E93',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  openCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00C853',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 20,
  },
  openCameraBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  pageNavBtn: {
    padding: 6,
  },
  pageNavDisabled: {
    opacity: 0.3,
  },
  paginationText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginHorizontal: 18,
    letterSpacing: 0.5,
  },
  applyAllContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  applyAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  applyAllLabel: {
    color: '#E0E0E0',
    fontSize: 13,
    marginRight: 8,
  },
  radioCircle: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    borderWidth: 1.5,
    borderColor: '#777777',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#00C853',
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#00C853',
  },
  filtersSection: {
    height: 104,
    backgroundColor: '#0D0E11',
    justifyContent: 'center',
  },
  filtersScrollContent: {
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  filterCardItem: {
    alignItems: 'center',
    marginHorizontal: 6,
    width: 66,
  },
  filterThumbnailBox: {
    width: 64,
    height: 64,
    borderRadius: 4,
    backgroundColor: '#1E2024',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
    position: 'relative',
  },
  filterThumbnailSelected: {
    borderColor: '#00C853', // OKEN Green border
    borderWidth: 2,
  },
  filterThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  filterGrayStyle: {
    opacity: 0.75,
  },
  filterBwStyle: {
    opacity: 0.9,
  },
  filterLightenStyle: {
    opacity: 0.85,
  },
  betaBadge: {
    position: 'absolute',
    top: 2,
    left: 2,
    backgroundColor: '#FF3B30',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  betaBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  filterLabelText: {
    color: '#CCCCCC',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  filterLabelTextSelected: {
    color: '#00C853',
    fontWeight: '700',
  },
  bottomToolbar: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#08080A',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1A1C20',
    paddingBottom: 4,
  },
  toolBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  toolBtnActive: {
    opacity: 1,
  },
  toolBtnLabel: {
    color: '#FFFFFF',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  titleModalCard: {
    width: '100%',
    backgroundColor: '#1C1E24',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2D34',
  },
  titleModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleModalHeading: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    marginLeft: 10,
  },
  titleModalInput: {
    backgroundColor: '#121418',
    color: '#FFFFFF',
    fontSize: 15,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#333742',
  },
  titleModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  titleModalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
  },
  titleModalCancelText: {
    color: '#A0A0A0',
    fontSize: 14,
    fontWeight: '600',
  },
  titleModalSaveBtn: {
    backgroundColor: '#00C853',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  titleModalSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  qrResultText: {
    color: '#FFFFFF',
    fontSize: 15,
    marginVertical: 12,
    lineHeight: 22,
  },
});
