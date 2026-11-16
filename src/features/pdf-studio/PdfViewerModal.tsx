import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Highlighter,
  PenTool,
  Stamp,
  FileSearch,
  Check,
  Share2,
  Trash2,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { usePdfStore } from '../../app/store/usePdfStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Button } from '../../components/common/Button';
import { pdfService } from '../../services/pdf/pdfService';

interface PdfViewerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({ visible, onClose }) => {
  const { colors } = useThemeStore();
  const {
    currentDoc,
    currentPage,
    totalPages,
    setCurrentPage,
    zoomLevel,
    setZoomLevel,
    annotations,
    addAnnotation,
    watermarkText,
    setWatermarkText,
  } = usePdfStore();

  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [isExtractingOcr, setIsExtractingOcr] = useState(false);
  const [watermarkModalVisible, setWatermarkModalVisible] = useState(false);
  const [watermarkInput, setWatermarkInput] = useState(watermarkText || 'CONFIDENTIAL');

  if (!currentDoc) return null;

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const handleApplyWatermark = () => {
    setWatermarkText(watermarkInput);
    setWatermarkModalVisible(false);
  };

  const handleRunOcr = async () => {
    setIsExtractingOcr(true);
    try {
      const text = await pdfService.extractTextOcr(currentDoc.path, currentPage - 1);
      setOcrText(text);
    } catch (e) {
      console.warn('OCR extraction error:', e);
    } finally {
      setIsExtractingOcr(false);
    }
  };

  const handleAddHighlight = () => {
    addAnnotation({
      pageIndex: currentPage - 1,
      type: 'highlight',
      color: '#FFEB3B',
      x: 40,
      y: 120 + annotations.length * 30,
      width: 200,
      height: 18,
    });
  };

  const handleAddSignature = () => {
    addAnnotation({
      pageIndex: currentPage - 1,
      type: 'signature',
      color: '#1A73E8',
      text: 'Verified Digital Sign (NexFile)',
      x: 180,
      y: 360,
      width: 140,
      height: 40,
    });
  };

  const pageAnnotations = annotations.filter((a) => a.pageIndex === currentPage - 1);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
            <X size={22} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.headerTitleGroup}>
            <Text style={[typography.h4, { color: colors.text }]} numberOfLines={1}>
              {currentDoc.name}
            </Text>
            <Text style={[typography.labelSmall, { color: colors.textMuted }]}>
              Page {currentPage} of {totalPages}
            </Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleRunOcr} style={styles.iconBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FileSearch size={20} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setWatermarkModalVisible(true)} style={styles.iconBtn}>
              <Stamp size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Zoom & Page Control Bar */}
        <View style={[styles.subBar, { backgroundColor: colors.surfaceVariant }]}>
          <View style={styles.pageNav}>
            <TouchableOpacity
              onPress={handlePrevPage}
              disabled={currentPage <= 1}
              style={[styles.navBtn, { opacity: currentPage <= 1 ? 0.4 : 1 }]}
            >
              <ChevronLeft size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={[typography.labelMedium, { color: colors.text, marginHorizontal: 8 }]}>
              {currentPage} / {totalPages}
            </Text>
            <TouchableOpacity
              onPress={handleNextPage}
              disabled={currentPage >= totalPages}
              style={[styles.navBtn, { opacity: currentPage >= totalPages ? 0.4 : 1 }]}
            >
              <ChevronRight size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.zoomControls}>
            <TouchableOpacity
              onPress={() => setZoomLevel(zoomLevel - 0.2)}
              disabled={zoomLevel <= 0.6}
              style={styles.zoomBtn}
            >
              <ZoomOut size={18} color={colors.text} />
            </TouchableOpacity>
            <Text style={[typography.labelSmall, { color: colors.text, marginHorizontal: 6 }]}>
              {Math.round(zoomLevel * 100)}%
            </Text>
            <TouchableOpacity
              onPress={() => setZoomLevel(zoomLevel + 0.2)}
              disabled={zoomLevel >= 2.5}
              style={styles.zoomBtn}
            >
              <ZoomIn size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Document Canvas Area */}
        <ScrollView
          contentContainerStyle={styles.canvasScroll}
          maximumZoomScale={3.0}
          minimumZoomScale={0.5}
        >
          <View
            style={[
              styles.documentPage,
              {
                backgroundColor: '#FFFFFF',
                transform: [{ scale: zoomLevel }],
              },
            ]}
          >
            {/* Watermark overlay */}
            {watermarkText ? (
              <View style={styles.watermarkContainer} pointerEvents="none">
                <Text style={styles.watermarkLabel}>{watermarkText}</Text>
              </View>
            ) : null}

            {/* Document Header & Sample Content */}
            <View style={styles.docHeader}>
              <Text style={styles.docTitle}>{currentDoc.title || 'Official Specification'}</Text>
              <Text style={styles.docSubtitle}>Section {currentPage}: Technical Review & Architecture</Text>
              <View style={styles.docDivider} />
            </View>

            {/* Document Lines */}
            <View style={styles.docBody}>
              <Text style={styles.docParagraph}>
                1.1 Overview: NexFile Smart Document Architecture provides native Android high-speed
                document viewing, vector rendering, and full offline verification without external cloud services.
              </Text>
              <Text style={styles.docParagraph}>
                1.2 Cryptographic Standards: Authentication utilizes AES-256-GCM hardware keys with zero plain-text
                leakage, safeguarding all sensitive documentation.
              </Text>
              <Text style={styles.docParagraph}>
                1.3 Signature Validation: Document hash conforms to SHA-256 integrity benchmarks.
              </Text>
            </View>

            {/* Render Annotations on the page */}
            {pageAnnotations.map((annot) => {
              if (annot.type === 'highlight') {
                return (
                  <View
                    key={annot.id}
                    style={[
                      styles.highlightBlock,
                      {
                        left: annot.x,
                        top: annot.y,
                        width: annot.width || 180,
                        height: annot.height || 18,
                        backgroundColor: annot.color,
                      },
                    ]}
                  />
                );
              }
              if (annot.type === 'signature') {
                return (
                  <View
                    key={annot.id}
                    style={[
                      styles.signatureStamp,
                      {
                        left: annot.x,
                        top: annot.y,
                        borderColor: annot.color,
                      },
                    ]}
                  >
                    <Check size={14} color={annot.color} />
                    <Text style={[typography.labelSmall, { color: annot.color, marginLeft: 4 }]}>
                      {annot.text}
                    </Text>
                  </View>
                );
              }
              return null;
            })}
          </View>
        </ScrollView>

        {/* Annotation & Editing Bottom Toolbar */}
        <View style={[styles.annotationBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.toolItem, { backgroundColor: activeTool === 'highlight' ? colors.primaryLight : 'transparent' }]}
            onPress={() => {
              setActiveTool('highlight');
              handleAddHighlight();
            }}
          >
            <Highlighter size={20} color={activeTool === 'highlight' ? colors.primary : colors.text} />
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: 2 }]}>Highlight</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolItem, { backgroundColor: activeTool === 'signature' ? colors.primaryLight : 'transparent' }]}
            onPress={() => {
              setActiveTool('signature');
              handleAddSignature();
            }}
          >
            <Stamp size={20} color={activeTool === 'signature' ? colors.primary : colors.text} />
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: 2 }]}>Signature</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolItem}
            onPress={() => setWatermarkModalVisible(true)}
          >
            <PenTool size={20} color={colors.text} />
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: 2 }]}>Watermark</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.toolItem}
            onPress={handleRunOcr}
          >
            <FileSearch size={20} color={colors.primary} />
            <Text style={[typography.labelSmall, { color: colors.primary, marginTop: 2 }]}>OCR</Text>
          </TouchableOpacity>
        </View>

        {/* OCR Result Drawer Modal */}
        {ocrText && (
          <Modal visible={Boolean(ocrText)} transparent animationType="fade">
            <View style={[styles.ocrBackdrop, { backgroundColor: colors.overlay }]}>
              <View style={[styles.ocrModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.ocrHeader}>
                  <Text style={[typography.h3, { color: colors.text }]}>Extracted Text (OCR)</Text>
                  <TouchableOpacity onPress={() => setOcrText(null)}>
                    <X size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.ocrTextScroll}>
                  <Text style={[typography.bodyMedium, { color: colors.text }]} selectable>
                    {ocrText}
                  </Text>
                </ScrollView>
                <Button
                  title="Close"
                  variant="primary"
                  onPress={() => setOcrText(null)}
                  style={{ marginTop: spacing.md }}
                />
              </View>
            </View>
          </Modal>
        )}

        {/* Watermark Dialog */}
        {watermarkModalVisible && (
          <Modal visible={watermarkModalVisible} transparent animationType="fade">
            <View style={[styles.ocrBackdrop, { backgroundColor: colors.overlay }]}>
              <View style={[styles.ocrModal, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[typography.h3, { color: colors.text }]}>Add Watermark</Text>
                <TextInput
                  style={[
                    styles.watermarkInput,
                    typography.bodyLarge,
                    {
                      color: colors.text,
                      backgroundColor: colors.surfaceVariant,
                      borderColor: colors.border,
                    },
                  ]}
                  value={watermarkInput}
                  onChangeText={setWatermarkInput}
                  placeholder="Watermark text (e.g. CONFIDENTIAL)"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
                <View style={styles.dialogButtons}>
                  <Button
                    title="Clear"
                    variant="ghost"
                    onPress={() => {
                      setWatermarkText('');
                      setWatermarkModalVisible(false);
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Apply"
                    variant="primary"
                    onPress={handleApplyWatermark}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            </View>
          </Modal>
        )}
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
  headerTitleGroup: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconBtn: {
    padding: spacing.xs,
  },
  subBar: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
  },
  pageNav: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navBtn: {
    padding: 4,
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  zoomBtn: {
    padding: 4,
  },
  canvasScroll: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  documentPage: {
    width: 320,
    minHeight: 450,
    borderRadius: borderRadius.sm,
    padding: spacing.lg,
    position: 'relative',
    ...elevation.md,
  },
  watermarkContainer: {
    position: 'absolute',
    top: '40%',
    left: '10%',
    right: '10%',
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-35deg' }],
    zIndex: 1,
    opacity: 0.15,
  },
  watermarkLabel: {
    fontSize: 38,
    fontWeight: '900',
    color: '#D32F2F',
    letterSpacing: 4,
    textAlign: 'center',
  },
  docHeader: {
    marginBottom: spacing.md,
  },
  docTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A73E8',
  },
  docSubtitle: {
    fontSize: 12,
    color: '#5F6368',
    marginTop: 2,
  },
  docDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: spacing.sm,
  },
  docBody: {
    gap: spacing.sm,
  },
  docParagraph: {
    fontSize: 11,
    lineHeight: 16,
    color: '#202124',
  },
  highlightBlock: {
    position: 'absolute',
    opacity: 0.45,
    borderRadius: 2,
  },
  signatureStamp: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    ...elevation.sm,
  },
  annotationBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  toolItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  ocrBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  ocrModal: {
    width: '100%',
    maxWidth: 380,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    ...elevation.lg,
  },
  ocrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  ocrTextScroll: {
    maxHeight: 220,
  },
  watermarkInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});

