import React, { useState, useEffect } from 'react';
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
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { usePdfStore } from '../../app/store/usePdfStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Button } from '../../components/common/Button';
import { DocumentFilterType } from '../../types/pdf';
import { pdfService } from '../../services/pdf/pdfService';
import { fileService } from '../../services/filesystem/fileService';

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
    removeScannedPage,
    rotateScannedPage,
    setPageFilter,
    saveScannedPdf,
    clearScanner,
  } = usePdfStore();

  const [documentTitle, setDocumentTitle] = useState('Scanned_Document');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState<'high' | 'medium' | 'low'>('high');

  // Auto-launch camera when opened if no pages exist
  useEffect(() => {
    if (visible && scannedPages.length === 0) {
      setDocumentTitle(`Scanned_Doc_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`);
    }
  }, [visible]);

  const activePage = scannedPages[activePageIndex] || scannedPages[0];

  // REAL CAMERA CAPTURE
  const handleCameraCapture = async () => {
    try {
      const capturedPath = await pdfService.launchCameraScan();
      if (capturedPath) {
        addScannedPage(capturedPath);
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
      }
    } catch (e: any) {
      console.warn('Gallery pick error:', e);
    }
  };

  const handleSave = async () => {
    if (scannedPages.length === 0) {
      Alert.alert('No Pages', 'Please capture or pick at least one document page first.');
      return;
    }

    setIsSaving(true);
    try {
      const q = selectedQuality === 'high' ? 95 : selectedQuality === 'medium' ? 75 : 50;
      const path = await saveScannedPdf(documentTitle, q, targetDirectory);
      setIsSaving(false);
      onSaveSuccess(path);
      onClose();
    } catch (e: any) {
      console.warn('Error saving PDF:', e);
      setIsSaving(false);
      Alert.alert('Save Failed', e?.message || 'Could not compile scanned PDF.');
    }
  };

  const filters: { id: DocumentFilterType; label: string }[] = [
    { id: 'original', label: 'Color' },
    { id: 'bw', label: 'B & W' },
    { id: 'grayscale', label: 'Grayscale' },
    { id: 'color', label: 'Vivid' },
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
              {scannedPages.length} Page(s) Captured
            </Text>
          </View>
          <Button
            title="Save PDF"
            size="sm"
            variant="primary"
            loading={isSaving}
            disabled={scannedPages.length === 0}
            onPress={handleSave}
          />
        </View>

        {/* Viewfinder / Real Page Preview */}
        <View style={styles.previewArea}>
          {activePage ? (
            <View style={[styles.pageCanvas, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
              {/* Document Corner Accents */}
              <View style={[styles.cropCorner, styles.cornerTL, { borderColor: colors.primary }]} />
              <View style={[styles.cropCorner, styles.cornerTR, { borderColor: colors.primary }]} />
              <View style={[styles.cropCorner, styles.cornerBL, { borderColor: colors.primary }]} />
              <View style={[styles.cropCorner, styles.cornerBR, { borderColor: colors.primary }]} />

              {/* REAL PHOTO DISPLAY */}
              <Image
                source={{
                  uri: activePage.uri.startsWith('file://')
                    ? activePage.uri
                    : `file://${activePage.uri}`,
                }}
                style={[
                  styles.pageRealImage,
                  {
                    transform: [{ rotate: `${activePage.rotation}deg` }],
                  },
                ]}
                resizeMode="contain"
              />

              <View style={[styles.pageInfoBadge, { backgroundColor: colors.overlay }]}>
                <Text style={[typography.labelSmall, { color: '#FFFFFF', fontWeight: '700' }]}>
                  Page {activePageIndex + 1} of {scannedPages.length} • {activePage.rotation}°
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyPrompt}>
              <View style={[styles.emptyIconCircle, { backgroundColor: `${colors.primary}15` }]}>
                <Camera size={56} color={colors.primary} />
              </View>
              <Text style={[typography.h3, { color: colors.text, marginTop: spacing.lg }]}>
                Scan Real Document
              </Text>
              <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
                Take a real picture of your paper document, bill, or receipt with your phone camera.
              </Text>

              <View style={styles.emptyActionButtons}>
                <TouchableOpacity
                  style={[styles.bigActionBtn, { backgroundColor: colors.primary }]}
                  onPress={handleCameraCapture}
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

              {/* Add More Pages Buttons */}
              <TouchableOpacity
                style={[styles.addPageThumb, { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
                onPress={handleCameraCapture}
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

        {/* Bottom Shutter & Controls */}
        <View style={[styles.bottomControls, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          {activePage && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.controlIconBtn, { backgroundColor: colors.surfaceVariant }]}
                onPress={handleGalleryPick}
              >
                <ImageIcon size={22} color={colors.text} />
              </TouchableOpacity>

              {/* Shutter Button (Camera) */}
              <TouchableOpacity
                style={[styles.shutterOuter, { borderColor: colors.primary }]}
                onPress={handleCameraCapture}
                activeOpacity={0.8}
              >
                <View style={[styles.shutterInner, { backgroundColor: colors.primary }]}>
                  <Camera size={28} color="#FFFFFF" />
                </View>
              </TouchableOpacity>

              {/* Rotate Button */}
              <TouchableOpacity
                style={[styles.controlIconBtn, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => rotateScannedPage(activePage.id)}
              >
                <RotateCw size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    padding: spacing.xs,
  },
  titleGroup: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  titleInput: {
    padding: 0,
    margin: 0,
    fontWeight: '700',
  },
  previewArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
  },
  pageCanvas: {
    width: '90%',
    aspectRatio: 1 / 1.414,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    ...elevation.md,
  },
  pageRealImage: {
    width: '100%',
    height: '100%',
  },
  cropCorner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderWidth: 3,
    zIndex: 10,
  },
  cornerTL: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0 },
  pageInfoBadge: {
    position: 'absolute',
    bottom: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
  },
  emptyPrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    maxWidth: 340,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionButtons: {
    width: '100%',
    marginTop: spacing.xl,
  },
  bigActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: borderRadius.lg,
  },
  thumbnailsStrip: {
    height: 90,
    borderTopWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
  },
  thumbsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  thumbItem: {
    width: 54,
    height: 72,
    borderRadius: borderRadius.xs,
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
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 3,
    backgroundColor: '#00000030',
  },
  thumbDelete: {
    alignSelf: 'flex-end',
    backgroundColor: '#00000080',
    borderRadius: 8,
    padding: 2,
  },
  addPageThumb: {
    width: 54,
    height: 72,
    borderRadius: borderRadius.xs,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomControls: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xl,
  },
  controlIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  shutterInner: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
