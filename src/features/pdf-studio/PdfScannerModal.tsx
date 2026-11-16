import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import {
  Camera,
  X,
  RotateCw,
  Palette,
  Check,
  Plus,
  Trash2,
  FileCheck,
  Sliders,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { usePdfStore } from '../../app/store/usePdfStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Button } from '../../components/common/Button';
import { DocumentFilterType } from '../../types/pdf';

interface PdfScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onSaveSuccess: (savedPath: string) => void;
}

export const PdfScannerModal: React.FC<PdfScannerModalProps> = ({
  visible,
  onClose,
  onSaveSuccess,
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

  const activePage = scannedPages[activePageIndex] || scannedPages[0];

  const handleCapturePage = () => {
    // Generate realistic captured document image
    const samplePageUris = [
      '/storage/emulated/0/DCIM/Camera/IMG_20261115_102045.jpg',
      '/storage/emulated/0/DCIM/Camera/IMG_20261115_091530.jpg',
    ];
    const pickedUri = samplePageUris[scannedPages.length % samplePageUris.length];
    addScannedPage(pickedUri);
  };

  const handleSave = async () => {
    if (scannedPages.length === 0) return;
    setIsSaving(true);
    try {
      const q = selectedQuality === 'high' ? 95 : selectedQuality === 'medium' ? 75 : 50;
      const path = await saveScannedPdf(documentTitle, q);
      setIsSaving(false);
      onSaveSuccess(path);
      onClose();
    } catch (e) {
      console.warn('Error saving PDF:', e);
      setIsSaving(false);
    }
  };

  const filters: { id: DocumentFilterType; label: string }[] = [
    { id: 'original', label: 'Original' },
    { id: 'grayscale', label: 'Grayscale' },
    { id: 'bw', label: 'B & W' },
    { id: 'color', label: 'Vivid' },
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
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
              {scannedPages.length} Page(s) Scanned
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

        {/* Viewfinder / Page Preview */}
        <View style={styles.previewArea}>
          {activePage ? (
            <View style={[styles.pageCanvas, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
              {/* Document Corner Crop Overlays */}
              <View style={[styles.cropCorner, styles.cornerTL, { borderColor: colors.primary }]} />
              <View style={[styles.cropCorner, styles.cornerTR, { borderColor: colors.primary }]} />
              <View style={[styles.cropCorner, styles.cornerBL, { borderColor: colors.primary }]} />
              <View style={[styles.cropCorner, styles.cornerBR, { borderColor: colors.primary }]} />

              <View
                style={[
                  styles.pageMockGraphic,
                  {
                    backgroundColor:
                      activePage.filter === 'grayscale'
                        ? '#CCCCCC'
                        : activePage.filter === 'bw'
                        ? '#EEEEEE'
                        : '#FFFFFF',
                    transform: [{ rotate: `${activePage.rotation}deg` }],
                  },
                ]}
              >
                {/* Mock scanned lines representing text */}
                <View style={styles.mockHeaderBar} />
                <View style={styles.mockTextLine} />
                <View style={[styles.mockTextLine, { width: '80%' }]} />
                <View style={[styles.mockTextLine, { width: '90%' }]} />
                <View style={[styles.mockTextLine, { width: '60%' }]} />
                <View style={[styles.mockSignatureBox, { borderColor: colors.textMuted }]}>
                  <Text style={[typography.labelSmall, { color: colors.textMuted }]}>Verified Document</Text>
                </View>
              </View>

              <View style={[styles.filterBadge, { backgroundColor: colors.overlay }]}>
                <Text style={[typography.labelSmall, { color: '#FFFFFF', textTransform: 'capitalize' }]}>
                  {activePage.filter} • {activePage.rotation}°
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyPrompt}>
              <Camera size={64} color={colors.textMuted} />
              <Text style={[typography.h3, { color: colors.text, marginTop: spacing.md }]}>
                No Pages Captured
              </Text>
              <Text style={[typography.bodyMedium, { color: colors.textMuted, marginTop: 4, textAlign: 'center' }]}>
                Tap the shutter button below to scan document pages.
              </Text>
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
                    <Text style={[typography.labelSmall, { color: colors.text }]}>{idx + 1}</Text>
                    <TouchableOpacity
                      style={styles.thumbDelete}
                      onPress={() => removeScannedPage(page.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={12} color={colors.error} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[styles.addPageThumb, { borderColor: colors.primary, backgroundColor: colors.primaryLight }]}
                onPress={handleCapturePage}
              >
                <Plus size={20} color={colors.primary} />
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {/* Toolbar & Filter Bar */}
        <View style={[styles.bottomControls, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          {activePage && (
            <View style={styles.filterRow}>
              {filters.map((f) => {
                const isActive = activePage.filter === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[
                      styles.filterBtn,
                      {
                        backgroundColor: isActive ? colors.primaryLight : colors.surfaceVariant,
                        borderColor: isActive ? colors.primary : 'transparent',
                      },
                    ]}
                    onPress={() => setPageFilter(activePage.id, f.id)}
                  >
                    <Text
                      style={[
                        typography.labelSmall,
                        { color: isActive ? colors.primary : colors.text },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={[styles.actionSquare, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => rotateScannedPage(activePage.id)}
              >
                <RotateCw size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
          )}

          {/* Shutter Button */}
          <View style={styles.shutterRow}>
            <TouchableOpacity
              style={[styles.shutterOuter, { borderColor: colors.primary }]}
              onPress={handleCapturePage}
              activeOpacity={0.8}
            >
              <View style={[styles.shutterInner, { backgroundColor: colors.primary }]}>
                <Camera size={26} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </View>
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
    height: 60,
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
  },
  previewArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.base,
  },
  pageCanvas: {
    width: '85%',
    aspectRatio: 1 / 1.414, // A4 ratio
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...elevation.md,
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
  pageMockGraphic: {
    width: '90%',
    height: '92%',
    padding: spacing.md,
    borderRadius: borderRadius.xs,
  },
  mockHeaderBar: {
    height: 14,
    width: '40%',
    backgroundColor: '#1A73E8',
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  mockTextLine: {
    height: 8,
    width: '100%',
    backgroundColor: '#9E9E9E',
    borderRadius: 2,
    marginBottom: spacing.sm,
  },
  mockSignatureBox: {
    marginTop: spacing.xl,
    padding: spacing.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignSelf: 'flex-end',
    borderRadius: 4,
  },
  filterBadge: {
    position: 'absolute',
    bottom: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  emptyPrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  thumbnailsStrip: {
    height: 80,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  thumbsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  thumbItem: {
    width: 50,
    height: 65,
    borderRadius: borderRadius.xs,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 4,
  },
  thumbDelete: {
    padding: 2,
  },
  addPageThumb: {
    width: 50,
    height: 65,
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
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  filterBtn: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSquare: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
  },
  shutterInner: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

