import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  Layers,
  Scissors,
  Minimize2,
  Lock,
  Unlock,
  Images,
  FileImage,
  FileSearch,
  FileText,
  ChevronRight,
  Plus,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { usePdfStore } from '../../app/store/usePdfStore';
import { useFileStore } from '../../app/store/useFileStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { FileItem } from '../../components/file/FileItem';
import { PdfScannerModal } from './PdfScannerModal';
import { PdfViewerModal } from './PdfViewerModal';
import { fileService } from '../../services/filesystem/fileService';
import { FileItem as FileItemType } from '../../types/file';

interface PdfUtility {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
}

export const PdfStudioScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const { loadDocument } = usePdfStore();

  const [scannerVisible, setScannerVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [pdfFiles, setPdfFiles] = useState<FileItemType[]>([]);
  const [activeUtilityMessage, setActiveUtilityMessage] = useState<string | null>(null);

  useEffect(() => {
    loadLocalPdfs();
  }, []);

  const loadLocalPdfs = async () => {
    const docs = await fileService.getFilesByCategory('documents');
    const pdfs = docs.filter((d) => d.extension.toLowerCase() === 'pdf');
    setPdfFiles(pdfs);
  };

  const handleOpenPdf = async (file: FileItemType) => {
    await loadDocument(file.path);
    setViewerVisible(true);
  };

  const utilities: PdfUtility[] = [
    {
      id: 'merge',
      title: 'Merge PDFs',
      description: 'Combine multiple PDF files into one',
      icon: Layers,
      color: '#1E88E5',
    },
    {
      id: 'split',
      title: 'Split PDF',
      description: 'Extract specific pages or page ranges',
      icon: Scissors,
      color: '#FB8C00',
    },
    {
      id: 'compress',
      title: 'Compress PDF',
      description: 'Reduce file size while preserving quality',
      icon: Minimize2,
      color: '#43A047',
    },
    {
      id: 'protect',
      title: 'Protect PDF',
      description: 'Encrypt document with custom password',
      icon: Lock,
      color: '#E53935',
    },
    {
      id: 'unlock',
      title: 'Unlock PDF',
      description: 'Remove password from authorized PDF',
      icon: Unlock,
      color: '#8E24AA',
    },
    {
      id: 'images-to-pdf',
      title: 'Images to PDF',
      description: 'Convert photo gallery into a PDF book',
      icon: Images,
      color: '#00ACC1',
    },
    {
      id: 'pdf-to-images',
      title: 'PDF to Images',
      description: 'Render and extract pages to JPG / PNG',
      icon: FileImage,
      color: '#D81B60',
    },
    {
      id: 'ocr',
      title: 'OCR Text Reader',
      description: 'Extract searchable text from document',
      icon: FileSearch,
      color: '#3949AB',
    },
  ];

  const handleUtilityPress = (tool: PdfUtility) => {
    setActiveUtilityMessage(`Opened ${tool.title}: Ready for input document.`);
    setTimeout(() => setActiveUtilityMessage(null), 3000);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Header
        title="PDF Studio"
        subtitle="Scanner, Editor & Utilities"
        showBack
        onBack={() => navigation.goBack()}
        showThemeToggle
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Scanner Hero Card */}
        <Card style={styles.scannerHeroCard} elevated>
          <View style={styles.heroRow}>
            <View style={[styles.cameraCircle, { backgroundColor: `${colors.primary}20` }]}>
              <Camera size={32} color={colors.primary} />
            </View>
            <View style={styles.heroTextGroup}>
              <Text style={[typography.h3, { color: colors.text }]}>Document Scanner</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                Capture documents with auto-edge crop, perspective correction & color filters.
              </Text>
            </View>
          </View>
          <Button
            title="Start Scanning"
            variant="primary"
            icon={<Camera size={18} color="#FFFFFF" />}
            onPress={() => setScannerVisible(true)}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {activeUtilityMessage && (
          <View style={[styles.statusToast, { backgroundColor: colors.primaryLight }]}>
            <Text style={[typography.labelMedium, { color: colors.primary }]}>{activeUtilityMessage}</Text>
          </View>
        )}

        {/* PDF Utilities Section */}
        <Text style={[typography.h3, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.md }]}>
          PDF Utilities
        </Text>

        <View style={styles.utilitiesGrid}>
          {utilities.map((tool) => {
            const IconComp = tool.icon;
            return (
              <TouchableOpacity
                key={tool.id}
                style={[
                  styles.utilityCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.cardBorder,
                  },
                ]}
                onPress={() => handleUtilityPress(tool)}
                activeOpacity={0.7}
              >
                <View style={[styles.utilIconBox, { backgroundColor: `${tool.color}15` }]}>
                  <IconComp size={22} color={tool.color} />
                </View>
                <Text style={[typography.labelMedium, { color: colors.text, marginTop: spacing.sm }]}>
                  {tool.title}
                </Text>
                <Text
                  style={[typography.labelSmall, { color: colors.textMuted, marginTop: 2 }]}
                  numberOfLines={2}
                >
                  {tool.description}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Device PDF Files */}
        <View style={[styles.sectionTitleRow, { marginTop: spacing.xl }]}>
          <Text style={[typography.h3, { color: colors.text }]}>PDF Documents on Device</Text>
          <Text style={[typography.labelSmall, { color: colors.textMuted }]}>
            ({pdfFiles.length})
          </Text>
        </View>

        <View style={styles.fileListWrap}>
          {pdfFiles.map((file) => (
            <FileItem
              key={file.id}
              item={file}
              onPress={handleOpenPdf}
              onLongPress={handleOpenPdf}
              onMorePress={handleOpenPdf}
              isSelected={false}
              isSelectionMode={false}
            />
          ))}
        </View>
      </ScrollView>

      {/* Modals */}
      <PdfScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onSaveSuccess={(savedPath) => {
          loadLocalPdfs();
          setActiveUtilityMessage(`PDF Saved: ${savedPath.split('/').pop()}`);
          setTimeout(() => setActiveUtilityMessage(null), 4000);
        }}
      />

      <PdfViewerModal
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing.xxxl,
  },
  scannerHeroCard: {
    padding: spacing.base,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cameraCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextGroup: {
    flex: 1,
    marginLeft: spacing.md,
  },
  statusToast: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  utilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  utilityCard: {
    width: '48.5%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    minHeight: 110,
  },
  utilIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  fileListWrap: {
    marginTop: spacing.xs,
  },
});
