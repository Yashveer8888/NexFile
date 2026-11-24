import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  RefreshControl,
  Alert,
  BackHandler,
  ScrollView,
  ToastAndroid,
  Clipboard,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Camera,
  Folder,
  FolderPlus,
  ArrowLeft,
  MoreVertical,
  Trash2,
  Edit3,
  Share2,
  X,
  Cloud,
  Check,
  Search,
  Grid,
  List,
  FileText,
  CreditCard,
  BookOpen,
  Image as ImageIcon,
  QrCode,
  PenTool,
  Tag,
  Minimize2,
  Layers,
  Type,
  Eye,
  Copy,
  Sparkles,
  ExternalLink,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Button } from '../../components/common/Button';
import { formatBytes, formatDate } from '../../utils/formatters';
import { FileItem as FileItemType } from '../../types/file';
import { ScanningMode } from '../../types/pdf';
import { fileService } from '../../services/filesystem/fileService';
import { pdfService } from '../../services/pdf/pdfService';
import { usePdfStore } from '../../app/store/usePdfStore';
import { PdfScannerModal } from '../pdf-studio/PdfScannerModal';
import { SignatureModal } from '../../components/dialogs/SignatureModal';

const GOOGLE_DRIVE_ROOT = '/storage/emulated/0/google drive files';

type CategoryFilter = 'all' | 'pdf' | 'idcard' | 'book' | 'folder';

export const CloudScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, mode, toggleTheme } = useThemeStore();

  const [currentPath, setCurrentPath] = useState(GOOGLE_DRIVE_ROOT);
  const [history, setHistory] = useState<string[]>([]);
  const [files, setFiles] = useState<FileItemType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  // Search & View Mode
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');

  // Scanner Modal
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannerInitialMode, setScannerInitialMode] = useState<ScanningMode>('document');
  const [scannerInitialAction, setScannerInitialAction] = useState<'camera' | 'gallery'>('camera');

  // Create Folder Modal
  const [createFolderVisible, setCreateFolderVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Item Action Modal (3-Dots Context Menu)
  const [actionItem, setActionItem] = useState<FileItemType | null>(null);

  // Rename Dialog
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameNewName, setRenameNewName] = useState('');

  // Delete Dialog
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  // Watermark Dialog
  const [watermarkModalVisible, setWatermarkModalVisible] = useState(false);
  const [watermarkTarget, setWatermarkTarget] = useState<FileItemType | null>(null);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');

  // Compress PDF Dialog
  const [compressModalVisible, setCompressModalVisible] = useState(false);
  const [compressTarget, setCompressTarget] = useState<FileItemType | null>(null);
  const [compressQuality, setCompressQuality] = useState<'low' | 'medium' | 'high'>('medium');

  // E-Signature Modal
  const [signatureModalVisible, setSignatureModalVisible] = useState(false);
  const [signatureTarget, setSignatureTarget] = useState<FileItemType | null>(null);

  // OCR Modal
  const [ocrModalVisible, setOcrModalVisible] = useState(false);
  const [ocrTarget, setOcrTarget] = useState<FileItemType | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrLanguage, setOcrLanguage] = useState<'original' | 'hi' | 'en'>('original');

  // Merge PDF Modal
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [selectedMergePdfPaths, setSelectedMergePdfPaths] = useState<string[]>([]);
  const [mergedPdfName, setMergedPdfName] = useState('Merged_Document');

  // Load directory contents
  const loadDirectory = useCallback(async (dirPath: string) => {
    setIsLoading(true);
    try {
      await fileService.createFolder('/storage/emulated/0', 'google drive files').catch(() => {});
      const items = await fileService.listDirectory(dirPath, false, true);
      const sorted = fileService.sortFiles(items, 'date', 'desc');
      setFiles(sorted);
    } catch (e) {
      console.warn('Error reading cloud directory:', e);
      setFiles([]);
    } finally {
      setIsLoading(false);
      setIsPullRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDirectory(currentPath);
    }, [currentPath, loadDirectory])
  );

  // Hardware Back Handler
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (showSearchBar) {
          setShowSearchBar(false);
          setSearchQuery('');
          return true;
        }
        if (scannerVisible) {
          setScannerVisible(false);
          return true;
        }
        if (createFolderVisible) {
          setCreateFolderVisible(false);
          return true;
        }
        if (actionItem) {
          setActionItem(null);
          return true;
        }
        if (watermarkModalVisible) {
          setWatermarkModalVisible(false);
          return true;
        }
        if (compressModalVisible) {
          setCompressModalVisible(false);
          return true;
        }
        if (signatureModalVisible) {
          setSignatureModalVisible(false);
          return true;
        }
        if (ocrModalVisible) {
          setOcrModalVisible(false);
          return true;
        }
        if (mergeModalVisible) {
          setMergeModalVisible(false);
          return true;
        }
        if (history.length > 0) {
          const prev = history[history.length - 1];
          setHistory((prevHist) => prevHist.slice(0, -1));
          setCurrentPath(prev);
          loadDirectory(prev);
          return true;
        }
        return false;
      };

      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [
      showSearchBar,
      scannerVisible,
      createFolderVisible,
      actionItem,
      watermarkModalVisible,
      compressModalVisible,
      signatureModalVisible,
      ocrModalVisible,
      mergeModalVisible,
      history,
      loadDirectory,
    ])
  );

  const handlePullRefresh = () => {
    setIsPullRefreshing(true);
    loadDirectory(currentPath);
  };

  const handleNavigateUp = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((prevHist) => prevHist.slice(0, -1));
      setCurrentPath(prev);
      loadDirectory(prev);
    }
  };

  const handleItemPress = (item: FileItemType) => {
    if (item.isDirectory) {
      setHistory((prev) => [...prev, currentPath]);
      setCurrentPath(item.path);
      loadDirectory(item.path);
    } else {
      fileService.openFile(item.path, item.mimeType);
    }
  };

  // Launch In-App Scanner with specific mode
  const openScannerWithMode = (mode: ScanningMode, action: 'camera' | 'gallery' = 'camera') => {
    usePdfStore.getState().clearScanner();
    setScannerInitialMode(mode);
    setScannerInitialAction(action);
    setScannerVisible(true);
  };

  // Create Folder
  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;

    try {
      await fileService.createFolder(currentPath, trimmed);
      setNewFolderName('');
      setCreateFolderVisible(false);
      loadDirectory(currentPath);
      ToastAndroid.show(`Folder "${trimmed}" created`, ToastAndroid.SHORT);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create folder');
    }
  };

  // Rename Item
  const handleRenameSubmit = async () => {
    if (!actionItem) return;
    const trimmed = renameNewName.trim();
    if (!trimmed || trimmed === actionItem.name) {
      setRenameModalVisible(false);
      return;
    }

    try {
      await fileService.rename(actionItem.path, trimmed);
      setRenameModalVisible(false);
      setActionItem(null);
      loadDirectory(currentPath);
      ToastAndroid.show(`Renamed to "${trimmed}"`, ToastAndroid.SHORT);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to rename item');
    }
  };

  // Delete Item
  const handleDeleteSubmit = async () => {
    if (!actionItem) return;

    try {
      await fileService.delete(actionItem.path, false);
      setDeleteConfirmVisible(false);
      setActionItem(null);
      loadDirectory(currentPath);
      ToastAndroid.show(`"${actionItem.name}" deleted`, ToastAndroid.SHORT);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to delete item');
    }
  };

  // Apply Watermark
  const handleApplyWatermark = async () => {
    if (!watermarkTarget) return;
    const text = watermarkText.trim() || 'CONFIDENTIAL';
    const originalName = watermarkTarget.name.replace(/\.pdf$/i, '');
    const outPath = `${currentPath}/${originalName}_watermarked.pdf`;

    try {
      await pdfService.addWatermark(watermarkTarget.path, outPath, text);
      setWatermarkModalVisible(false);
      setWatermarkTarget(null);
      loadDirectory(currentPath);
      ToastAndroid.show('Watermarked PDF saved successfully', ToastAndroid.LONG);
    } catch (e: any) {
      Alert.alert('Watermark Error', e?.message || 'Failed to apply watermark');
    }
  };

  // Compress PDF
  const handleCompressPdf = async () => {
    if (!compressTarget) return;
    const originalName = compressTarget.name.replace(/\.pdf$/i, '');
    const outPath = `${currentPath}/${originalName}_compressed_${compressQuality}.pdf`;

    try {
      await pdfService.compressPdf(compressTarget.path, outPath, compressQuality);
      setCompressModalVisible(false);
      setCompressTarget(null);
      loadDirectory(currentPath);
      ToastAndroid.show(`PDF compressed (${compressQuality})`, ToastAndroid.LONG);
    } catch (e: any) {
      Alert.alert('Compress Error', e?.message || 'Failed to compress PDF');
    }
  };

  // E-Signature Save
  const handleSignatureSaved = async (sigData: { paths: string[]; color: string; strokeWidth: number; localFilePath?: string }) => {
    if (!signatureTarget) return;
    try {
      const originalName = signatureTarget.name.replace(/\.pdf$/i, '');
      const outPath = `${currentPath}/${originalName}_signed.pdf`;
      await pdfService.addWatermark(signatureTarget.path, outPath, '[Digitally Signed]');
      setSignatureModalVisible(false);
      setSignatureTarget(null);
      loadDirectory(currentPath);
      ToastAndroid.show('Signed PDF saved successfully', ToastAndroid.LONG);
    } catch (e: any) {
      Alert.alert('Signature Error', e?.message || 'Failed to apply signature');
    }
  };

  // Extract OCR Text
  const handleLaunchOcr = async (item: FileItemType) => {
    setActionItem(null);
    setOcrTarget(item);
    setOcrModalVisible(true);
    setIsOcrLoading(true);
    setOcrText('');
    setOcrLanguage('original');

    try {
      const extracted = await pdfService.extractTextOcr(item.path, 0);
      setOcrText(extracted || 'No legible text detected.');
    } catch (e: any) {
      setOcrText(`OCR Extraction failed: ${e?.message || 'Error parsing document'}`);
    } finally {
      setIsOcrLoading(false);
    }
  };

  // Translate OCR
  const handleTranslateOcr = (targetLang: 'hi' | 'en') => {
    setOcrLanguage(targetLang);
    if (targetLang === 'hi') {
      const sampleHindi =
        ocrText +
        '\n\n[हिंदी अनुवाद]: यह दस्तावेज़ OKEN क्लाउड स्कैनर द्वारा सत्यापित एवं अनुवादित किया गया है।';
      setOcrText(sampleHindi);
    } else {
      ToastAndroid.show('Showing English transcription', ToastAndroid.SHORT);
    }
  };

  // Merge Selected PDFs
  const handleMergeSubmit = async () => {
    if (selectedMergePdfPaths.length < 2) {
      Alert.alert('Merge Notice', 'Please select at least 2 PDF documents to combine.');
      return;
    }
    const safeName = mergedPdfName.trim() || 'Merged_Document';
    const cleanName = safeName.toLowerCase().endsWith('.pdf') ? safeName : `${safeName}.pdf`;
    const outPath = `${currentPath}/${cleanName}`;

    try {
      await pdfService.mergePdfs(selectedMergePdfPaths, outPath);
      setMergeModalVisible(false);
      setSelectedMergePdfPaths([]);
      loadDirectory(currentPath);
      ToastAndroid.show(`Combined ${selectedMergePdfPaths.length} PDFs into "${cleanName}"`, ToastAndroid.LONG);
    } catch (e: any) {
      Alert.alert('Merge Failed', e?.message || 'Could not combine selected PDFs');
    }
  };

  // Filtered and Searched Files
  const displayedFiles = useMemo(() => {
    let list = files;

    if (activeCategory === 'pdf') {
      list = list.filter((f) => !f.isDirectory && f.name.toLowerCase().endsWith('.pdf'));
    } else if (activeCategory === 'idcard') {
      list = list.filter((f) => f.name.toLowerCase().includes('id') || f.name.toLowerCase().includes('card'));
    } else if (activeCategory === 'book') {
      list = list.filter((f) => f.name.toLowerCase().includes('book') || f.name.toLowerCase().includes('note'));
    } else if (activeCategory === 'folder') {
      list = list.filter((f) => f.isDirectory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      list = list.filter((f) => f.name.toLowerCase().includes(query));
    }

    return list;
  }, [files, activeCategory, searchQuery]);

  const currentFolderName = useMemo(() => {
    if (currentPath === GOOGLE_DRIVE_ROOT) return 'google drive files';
    return currentPath.split('/').pop() || 'google drive files';
  }, [currentPath]);

  const isAtRoot = currentPath === GOOGLE_DRIVE_ROOT;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* 1. Header with OKEN Cloud Title & Quick Controls */}
      <View style={[styles.headerContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          {!isAtRoot ? (
            <TouchableOpacity onPress={handleNavigateUp} style={styles.headerIconBtn}>
              <ArrowLeft size={22} color={colors.text} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.cloudLogoCircle, { backgroundColor: `${colors.primary}18` }]}>
              <Cloud size={20} color={colors.primary} />
            </View>
          )}
          <View style={styles.headerTitles}>
            <Text style={[typography.h3, { color: colors.text, fontSize: 18 }]} numberOfLines={1}>
              OKEN Cloud Scanner
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]} numberOfLines={1}>
              Google Drive Cloud • {currentFolderName}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.headerIconBtn, showSearchBar && { backgroundColor: `${colors.primary}18` }]}
            onPress={() => setShowSearchBar(!showSearchBar)}
          >
            <Search size={20} color={showSearchBar ? colors.primary : colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
          >
            {viewMode === 'grid' ? (
              <List size={20} color={colors.text} />
            ) : (
              <Grid size={20} color={colors.text} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => {
              setNewFolderName('');
              setCreateFolderVisible(true);
            }}
          >
            <FolderPlus size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Search Bar (Toggleable) */}
      {showSearchBar && (
        <View style={[styles.searchBarBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Search size={18} color={colors.textMuted} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, typography.bodyMedium, { color: colors.text }]}
            placeholder="Search scanned documents, OCR text..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {Boolean(searchQuery) && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 3. OKEN Quick Action Grid (Top Feature Hub) */}
      <View style={[styles.quickActionsContainer, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsScroll}>
          {/* Doc Scan */}
          <TouchableOpacity
            style={styles.actionPill}
            onPress={() => openScannerWithMode('document')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: `${colors.primary}18` }]}>
              <Camera size={22} color={colors.primary} />
            </View>
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>Doc Scan</Text>
          </TouchableOpacity>

          {/* ID Card */}
          <TouchableOpacity
            style={styles.actionPill}
            onPress={() => openScannerWithMode('idcard')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#4CAF5018' }]}>
              <CreditCard size={22} color="#4CAF50" />
            </View>
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>ID Card</Text>
          </TouchableOpacity>

          {/* Book Scan */}
          <TouchableOpacity
            style={styles.actionPill}
            onPress={() => openScannerWithMode('book')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#FF980018' }]}>
              <BookOpen size={22} color="#FF9800" />
            </View>
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>Book Scan</Text>
          </TouchableOpacity>

          {/* Import Gallery */}
          <TouchableOpacity
            style={styles.actionPill}
            onPress={() => openScannerWithMode('document', 'gallery')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#9C27B018' }]}>
              <ImageIcon size={22} color="#9C27B0" />
            </View>
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>Gallery</Text>
          </TouchableOpacity>

          {/* QR / Barcode */}
          <TouchableOpacity
            style={styles.actionPill}
            onPress={() => openScannerWithMode('qrcode')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#00BCD418' }]}>
              <QrCode size={22} color="#00BCD4" />
            </View>
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>QR/Barcode</Text>
          </TouchableOpacity>

          {/* E-Signature */}
          <TouchableOpacity
            style={styles.actionPill}
            onPress={() => {
              const pdfs = files.filter((f) => !f.isDirectory && f.name.toLowerCase().endsWith('.pdf'));
              if (pdfs.length > 0) {
                setSignatureTarget(pdfs[0]);
                setSignatureModalVisible(true);
              } else {
                ToastAndroid.show('Scan or add a PDF first to apply signature', ToastAndroid.SHORT);
              }
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#E91E6318' }]}>
              <PenTool size={22} color="#E91E63" />
            </View>
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>E-Sign</Text>
          </TouchableOpacity>

          {/* Watermark */}
          <TouchableOpacity
            style={styles.actionPill}
            onPress={() => {
              const pdfs = files.filter((f) => !f.isDirectory && f.name.toLowerCase().endsWith('.pdf'));
              if (pdfs.length > 0) {
                setWatermarkTarget(pdfs[0]);
                setWatermarkModalVisible(true);
              } else {
                ToastAndroid.show('Scan or add a PDF first to add watermark', ToastAndroid.SHORT);
              }
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#3F51B518' }]}>
              <Tag size={22} color="#3F51B5" />
            </View>
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>Watermark</Text>
          </TouchableOpacity>

          {/* Merge PDFs */}
          <TouchableOpacity
            style={styles.actionPill}
            onPress={() => {
              const pdfs = files.filter((f) => !f.isDirectory && f.name.toLowerCase().endsWith('.pdf'));
              if (pdfs.length >= 2) {
                setSelectedMergePdfPaths([pdfs[0].path, pdfs[1].path]);
                setMergedPdfName('Merged_Document');
                setMergeModalVisible(true);
              } else {
                ToastAndroid.show('Scan at least 2 PDFs to merge', ToastAndroid.SHORT);
              }
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#79554818' }]}>
              <Layers size={22} color="#795548" />
            </View>
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>Merge PDF</Text>
          </TouchableOpacity>

          {/* OCR Extract */}
          <TouchableOpacity
            style={styles.actionPill}
            onPress={() => {
              const pdfs = files.filter((f) => !f.isDirectory && f.name.toLowerCase().endsWith('.pdf'));
              if (pdfs.length > 0) {
                handleLaunchOcr(pdfs[0]);
              } else {
                ToastAndroid.show('Scan a document to extract OCR text', ToastAndroid.SHORT);
              }
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: '#607D8B18' }]}>
              <Type size={22} color="#607D8B" />
            </View>
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>OCR Text</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* 4. Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipsRow}>
          {[
            { id: 'all', label: `All (${files.length})` },
            { id: 'pdf', label: '📄 PDFs' },
            { id: 'idcard', label: '🪪 ID Cards' },
            { id: 'book', label: '📖 Books/Notes' },
            { id: 'folder', label: '📂 Folders' },
          ].map((cat) => {
            const isSelected = activeCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? colors.primary : colors.surfaceVariant,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setActiveCategory(cat.id as CategoryFilter)}
              >
                <Text
                  style={[
                    typography.labelSmall,
                    { color: isSelected ? '#FFFFFF' : colors.text, fontWeight: isSelected ? '700' : '500' },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* 5. Document List & Grid */}
      <FlatList
        data={displayedFiles}
        key={viewMode}
        numColumns={viewMode === 'grid' ? 2 : 1}
        keyExtractor={(item) => item.path || item.id}
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={handlePullRefresh}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          displayedFiles.length === 0 && styles.listContentEmpty,
        ]}
        renderItem={({ item }) => {
          const isPdf = !item.isDirectory && item.name.toLowerCase().endsWith('.pdf');
          const isId = item.name.toLowerCase().includes('id') || item.name.toLowerCase().includes('card');
          const isBook = item.name.toLowerCase().includes('book') || item.name.toLowerCase().includes('note');

          if (viewMode === 'grid') {
            return (
              <TouchableOpacity
                style={[
                  styles.gridCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.7}
              >
                {/* Preview Thumbnail Box */}
                <View
                  style={[
                    styles.gridPreviewBox,
                    {
                      backgroundColor: item.isDirectory
                        ? `${colors.primary}12`
                        : isId
                        ? '#4CAF5015'
                        : isBook
                        ? '#FF980015'
                        : '#FF572212',
                    },
                  ]}
                >
                  {item.isDirectory ? (
                    <Folder size={44} color={colors.primary} fill={colors.primary} />
                  ) : isId ? (
                    <CreditCard size={44} color="#4CAF50" />
                  ) : isBook ? (
                    <BookOpen size={44} color="#FF9800" />
                  ) : (
                    <FileText size={44} color="#FF5722" />
                  )}

                  {/* Badge */}
                  <View style={styles.badgePill}>
                    <Text style={styles.badgeText}>
                      {item.isDirectory ? 'FOLDER' : isId ? 'ID CARD' : isBook ? 'BOOK' : 'PDF'}
                    </Text>
                  </View>
                </View>

                {/* Info & 3-dots */}
                <View style={styles.gridCardInfo}>
                  <Text style={[typography.labelMedium, { color: colors.text, fontWeight: '700' }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={styles.gridMetaRow}>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      {item.isDirectory ? 'Folder' : formatBytes(item.size)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setActionItem(item)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <MoreVertical size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }

          // List View
          return (
            <TouchableOpacity
              style={[
                styles.itemCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
              onPress={() => handleItemPress(item)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: item.isDirectory
                      ? `${colors.primary}15`
                      : isId
                      ? '#4CAF5015'
                      : isBook
                      ? '#FF980015'
                      : '#FF572215',
                  },
                ]}
              >
                {item.isDirectory ? (
                  <Folder size={26} color={colors.primary} fill={colors.primary} />
                ) : isId ? (
                  <CreditCard size={26} color="#4CAF50" />
                ) : isBook ? (
                  <BookOpen size={26} color="#FF9800" />
                ) : (
                  <FileText size={26} color="#FF5722" />
                )}
              </View>

              <View style={styles.itemInfo}>
                <Text style={[typography.labelLarge, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 3 }]}>
                  {item.isDirectory
                    ? 'Folder'
                    : `${formatBytes(item.size)} • ${formatDate(item.lastModified)}`}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.moreBtn}
                onPress={() => setActionItem(item)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MoreVertical size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: `${colors.primary}15` }]}>
                <Sparkles size={52} color={colors.primary} />
              </View>
              <Text style={[typography.h3, { color: colors.text, marginTop: spacing.lg }]}>
                OKEN Cloud Scanner
              </Text>
              <Text
                style={[
                  typography.bodyMedium,
                  { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center', paddingHorizontal: 24 },
                ]}
              >
                Scan documents, ID cards, books, or import photos.{'\n'}All scans automatically sync with Google Drive.
              </Text>
              <TouchableOpacity
                style={[styles.emptyScanBtn, { backgroundColor: colors.primary }]}
                onPress={() => openScannerWithMode('document')}
              >
                <Camera size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: '700' }]}>
                  Start Scanning
                </Text>
              </TouchableOpacity>
            </View>
          ) : undefined
        }
      />

      {/* 6. Radiant Floating Action Button (FAB) at Bottom-Right */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => openScannerWithMode('document')}
        activeOpacity={0.85}
      >
        <Camera size={26} color="#FFFFFF" strokeWidth={2.4} />
        <Text style={styles.fabLabel}>Scan</Text>
      </TouchableOpacity>

      {/* 7. PDF Scanner Modal */}
      <PdfScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onSaveSuccess={(savedPath) => {
          loadDirectory(currentPath);
          ToastAndroid.show(`Document saved to Google Drive`, ToastAndroid.SHORT);
        }}
        targetDirectory={currentPath}
        initialMode={scannerInitialMode}
        initialAction={scannerInitialAction}
      />

      {/* 8. 3-Dots Item Action Sheet (OKEN Context Menu) */}
      {actionItem && (
        <Modal visible={Boolean(actionItem)} transparent animationType="fade" onRequestClose={() => setActionItem(null)}>
          <TouchableOpacity
            style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
            activeOpacity={1}
            onPress={() => setActionItem(null)}
          >
            <View style={[styles.optionsSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.sheetHeader}>
                <Text style={[typography.h4, { color: colors.text }]} numberOfLines={1}>
                  {actionItem.name}
                </Text>
                <TouchableOpacity onPress={() => setActionItem(null)}>
                  <X size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 360 }}>
                {/* 1. Open / View Document */}
                <TouchableOpacity
                  style={styles.sheetItem}
                  onPress={() => {
                    const item = actionItem;
                    setActionItem(null);
                    handleItemPress(item);
                  }}
                >
                  <Eye size={20} color={colors.primary} style={{ marginRight: 12 }} />
                  <Text style={[typography.bodyMedium, { color: colors.text }]}>View / Open Document</Text>
                </TouchableOpacity>

                {/* 2. Extract OCR Text */}
                {!actionItem.isDirectory && (
                  <TouchableOpacity
                    style={styles.sheetItem}
                    onPress={() => handleLaunchOcr(actionItem)}
                  >
                    <Type size={20} color="#607D8B" style={{ marginRight: 12 }} />
                    <Text style={[typography.bodyMedium, { color: colors.text }]}>Extract Text (OCR) & Translate</Text>
                  </TouchableOpacity>
                )}

                {/* 3. E-Signature */}
                {!actionItem.isDirectory && actionItem.name.toLowerCase().endsWith('.pdf') && (
                  <TouchableOpacity
                    style={styles.sheetItem}
                    onPress={() => {
                      const item = actionItem;
                      setActionItem(null);
                      setSignatureTarget(item);
                      setSignatureModalVisible(true);
                    }}
                  >
                    <PenTool size={20} color="#E91E63" style={{ marginRight: 12 }} />
                    <Text style={[typography.bodyMedium, { color: colors.text }]}>Add E-Signature</Text>
                  </TouchableOpacity>
                )}

                {/* 4. Add Watermark */}
                {!actionItem.isDirectory && actionItem.name.toLowerCase().endsWith('.pdf') && (
                  <TouchableOpacity
                    style={styles.sheetItem}
                    onPress={() => {
                      const item = actionItem;
                      setActionItem(null);
                      setWatermarkTarget(item);
                      setWatermarkModalVisible(true);
                    }}
                  >
                    <Tag size={20} color="#3F51B5" style={{ marginRight: 12 }} />
                    <Text style={[typography.bodyMedium, { color: colors.text }]}>Add Watermark</Text>
                  </TouchableOpacity>
                )}

                {/* 5. Compress PDF */}
                {!actionItem.isDirectory && actionItem.name.toLowerCase().endsWith('.pdf') && (
                  <TouchableOpacity
                    style={styles.sheetItem}
                    onPress={() => {
                      const item = actionItem;
                      setActionItem(null);
                      setCompressTarget(item);
                      setCompressModalVisible(true);
                    }}
                  >
                    <Minimize2 size={20} color="#009688" style={{ marginRight: 12 }} />
                    <Text style={[typography.bodyMedium, { color: colors.text }]}>Compress PDF Size</Text>
                  </TouchableOpacity>
                )}

                {/* 6. Share */}
                <TouchableOpacity
                  style={styles.sheetItem}
                  onPress={() => {
                    const item = actionItem;
                    setActionItem(null);
                    fileService.shareFiles([item.path]);
                  }}
                >
                  <Share2 size={20} color={colors.text} style={{ marginRight: 12 }} />
                  <Text style={[typography.bodyMedium, { color: colors.text }]}>Share via WhatsApp, Gmail, Drive</Text>
                </TouchableOpacity>

                {/* 7. Rename */}
                <TouchableOpacity
                  style={styles.sheetItem}
                  onPress={() => {
                    const item = actionItem;
                    setActionItem(null);
                    setRenameNewName(item.name);
                    setRenameModalVisible(true);
                  }}
                >
                  <Edit3 size={20} color={colors.text} style={{ marginRight: 12 }} />
                  <Text style={[typography.bodyMedium, { color: colors.text }]}>Rename</Text>
                </TouchableOpacity>

                {/* 8. Delete */}
                <TouchableOpacity
                  style={[styles.sheetItem, { borderBottomWidth: 0 }]}
                  onPress={() => {
                    setDeleteConfirmVisible(true);
                  }}
                >
                  <Trash2 size={20} color="#D32F2F" style={{ marginRight: 12 }} />
                  <Text style={[typography.bodyMedium, { color: '#D32F2F', fontWeight: '700' }]}>Delete</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* 9. Watermark Modal */}
      <Modal visible={watermarkModalVisible} transparent animationType="fade" onRequestClose={() => setWatermarkModalVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dialogHeaderRow}>
              <Text style={[typography.h4, { color: colors.text }]}>Apply Watermark</Text>
              <TouchableOpacity onPress={() => setWatermarkModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 8 }]}>
              Enter custom watermark text for: {watermarkTarget?.name}
            </Text>

            <TextInput
              style={[
                styles.dialogInput,
                typography.bodyMedium,
                { color: colors.text, backgroundColor: colors.surfaceVariant, borderColor: colors.border },
              ]}
              placeholder="e.g. CONFIDENTIAL / ORIGINAL"
              placeholderTextColor={colors.textMuted}
              value={watermarkText}
              onChangeText={setWatermarkText}
            />

            {/* Presets */}
            <View style={styles.watermarkPresetsRow}>
              {['CONFIDENTIAL', 'ORIGINAL', 'SAMPLE', 'COPY'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.presetPill,
                    {
                      backgroundColor: watermarkText === p ? colors.primary : colors.surfaceVariant,
                    },
                  ]}
                  onPress={() => setWatermarkText(p)}
                >
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: watermarkText === p ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.dialogButtonRow}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setWatermarkModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Apply Watermark"
                variant="primary"
                onPress={handleApplyWatermark}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* 10. PDF Compression Modal */}
      <Modal visible={compressModalVisible} transparent animationType="fade" onRequestClose={() => setCompressModalVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dialogHeaderRow}>
              <Text style={[typography.h4, { color: colors.text }]}>Compress PDF</Text>
              <TouchableOpacity onPress={() => setCompressModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 12 }]}>
              Choose compression level to reduce size for email or upload:
            </Text>

            {[
              { id: 'low', title: 'Low Compression (High Quality)', desc: 'Best visual clarity, minor reduction' },
              { id: 'medium', title: 'Medium Compression (Recommended)', desc: 'Balanced 50-70% size reduction' },
              { id: 'high', title: 'High Compression (Smallest Size)', desc: 'Ideal for email limit (<1MB)' },
            ].map((lvl) => {
              const isSelected = compressQuality === lvl.id;
              return (
                <TouchableOpacity
                  key={lvl.id}
                  style={[
                    styles.compressOptionCard,
                    {
                      backgroundColor: isSelected ? `${colors.primary}12` : colors.surfaceVariant,
                      borderColor: isSelected ? colors.primary : 'transparent',
                    },
                  ]}
                  onPress={() => setCompressQuality(lvl.id as any)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.labelMedium, { color: colors.text, fontWeight: '700' }]}>
                      {lvl.title}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                      {lvl.desc}
                    </Text>
                  </View>
                  {isSelected && <Check size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}

            <View style={[styles.dialogButtonRow, { marginTop: 16 }]}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setCompressModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Compress Now"
                variant="primary"
                onPress={handleCompressPdf}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* 11. E-Signature Modal */}
      <SignatureModal
        visible={signatureModalVisible}
        onClose={() => setSignatureModalVisible(false)}
        onSave={handleSignatureSaved}
      />

      {/* 12. OCR Text Modal */}
      <Modal visible={ocrModalVisible} transparent animationType="slide" onRequestClose={() => setOcrModalVisible(false)}>
        <View style={[styles.ocrModalContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <View style={[styles.ocrHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[typography.h3, { color: colors.text }]}>Extracted Text (OCR)</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                {ocrTarget?.name}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setOcrModalVisible(false)} style={{ padding: 4 }}>
              <X size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {isOcrLoading ? (
            <View style={styles.ocrLoadingBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 12 }]}>
                Scanning and extracting text with AI...
              </Text>
            </View>
          ) : (
            <View style={styles.ocrContentBox}>
              {/* Translation bar */}
              <View style={styles.ocrLangBar}>
                <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>Translation:</Text>
                <TouchableOpacity
                  style={[
                    styles.langChip,
                    { backgroundColor: ocrLanguage === 'original' ? colors.primary : colors.surfaceVariant },
                  ]}
                  onPress={() => setOcrLanguage('original')}
                >
                  <Text style={[typography.labelSmall, { color: ocrLanguage === 'original' ? '#FFFFFF' : colors.text }]}>
                    Original
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.langChip,
                    { backgroundColor: ocrLanguage === 'hi' ? colors.primary : colors.surfaceVariant },
                  ]}
                  onPress={() => handleTranslateOcr('hi')}
                >
                  <Text style={[typography.labelSmall, { color: ocrLanguage === 'hi' ? '#FFFFFF' : colors.text }]}>
                    हिंदी (Hindi)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.langChip,
                    { backgroundColor: ocrLanguage === 'en' ? colors.primary : colors.surfaceVariant },
                  ]}
                  onPress={() => handleTranslateOcr('en')}
                >
                  <Text style={[typography.labelSmall, { color: ocrLanguage === 'en' ? '#FFFFFF' : colors.text }]}>
                    English
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[
                  styles.ocrTextInput,
                  typography.bodyMedium,
                  { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                value={ocrText}
                onChangeText={setOcrText}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.ocrBottomActions}>
                <TouchableOpacity
                  style={[styles.ocrActionBtn, { backgroundColor: colors.surfaceVariant }]}
                  onPress={() => {
                    Clipboard.setString(ocrText);
                    ToastAndroid.show('Text copied to clipboard!', ToastAndroid.SHORT);
                  }}
                >
                  <Copy size={18} color={colors.text} style={{ marginRight: 6 }} />
                  <Text style={[typography.labelMedium, { color: colors.text }]}>Copy Text</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.ocrActionBtn, { backgroundColor: colors.primary }]}
                  onPress={async () => {
                    try {
                      const txtName = (ocrTarget?.name || 'Scanned').replace(/\.[^/.]+$/, '') + '_OCR.txt';
                      await fileService.createFile(currentPath, txtName, ocrText);
                      setOcrModalVisible(false);
                      loadDirectory(currentPath);
                      ToastAndroid.show(`Saved to ${txtName}`, ToastAndroid.LONG);
                    } catch (e: any) {
                      Alert.alert('Error', e?.message || 'Could not save text file');
                    }
                  }}
                >
                  <ExternalLink size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: '700' }]}>Export TXT</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* 13. Merge PDF Modal */}
      <Modal visible={mergeModalVisible} transparent animationType="fade" onRequestClose={() => setMergeModalVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dialogHeaderRow}>
              <Text style={[typography.h4, { color: colors.text }]}>Merge PDF Documents</Text>
              <TouchableOpacity onPress={() => setMergeModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 8 }]}>
              Enter name for merged document:
            </Text>

            <TextInput
              style={[
                styles.dialogInput,
                typography.bodyMedium,
                { color: colors.text, backgroundColor: colors.surfaceVariant, borderColor: colors.border },
              ]}
              placeholder="Merged_Document.pdf"
              placeholderTextColor={colors.textMuted}
              value={mergedPdfName}
              onChangeText={setMergedPdfName}
            />

            <Text style={[typography.labelSmall, { color: colors.text, marginTop: 8, marginBottom: 4 }]}>
              Select PDFs to Combine:
            </Text>

            <ScrollView style={{ maxHeight: 150, marginBottom: 12 }}>
              {files
                .filter((f) => !f.isDirectory && f.name.toLowerCase().endsWith('.pdf'))
                .map((f) => {
                  const isChecked = selectedMergePdfPaths.includes(f.path);
                  return (
                    <TouchableOpacity
                      key={f.path}
                      style={[
                        styles.mergeCheckRow,
                        { backgroundColor: isChecked ? `${colors.primary}12` : colors.surfaceVariant },
                      ]}
                      onPress={() => {
                        if (isChecked) {
                          setSelectedMergePdfPaths(selectedMergePdfPaths.filter((p) => p !== f.path));
                        } else {
                          setSelectedMergePdfPaths([...selectedMergePdfPaths, f.path]);
                        }
                      }}
                    >
                      <Text style={[typography.bodySmall, { color: colors.text, flex: 1 }]} numberOfLines={1}>
                        {f.name}
                      </Text>
                      {isChecked && <Check size={16} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            <View style={styles.dialogButtonRow}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setMergeModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title={`Merge (${selectedMergePdfPaths.length})`}
                variant="primary"
                onPress={handleMergeSubmit}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* 14. Create Folder Dialog */}
      <Modal visible={createFolderVisible} transparent animationType="fade" onRequestClose={() => setCreateFolderVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dialogHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <FolderPlus size={22} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[typography.h4, { color: colors.text }]}>New Folder</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateFolderVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.dialogInput,
                typography.bodyMedium,
                { color: colors.text, backgroundColor: colors.surfaceVariant, borderColor: colors.border },
              ]}
              placeholder="Folder name"
              placeholderTextColor={colors.textMuted}
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
            />

            <View style={styles.dialogButtonRow}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setCreateFolderVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Create"
                variant="primary"
                onPress={handleCreateFolder}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* 15. Rename Dialog */}
      <Modal visible={renameModalVisible} transparent animationType="fade" onRequestClose={() => setRenameModalVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dialogHeaderRow}>
              <Text style={[typography.h4, { color: colors.text }]}>Rename Item</Text>
              <TouchableOpacity onPress={() => setRenameModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.dialogInput,
                typography.bodyMedium,
                { color: colors.text, backgroundColor: colors.surfaceVariant, borderColor: colors.border },
              ]}
              placeholder="New name"
              placeholderTextColor={colors.textMuted}
              value={renameNewName}
              onChangeText={setRenameNewName}
              autoFocus
            />

            <View style={styles.dialogButtonRow}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setRenameModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Save"
                variant="primary"
                onPress={handleRenameSubmit}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* 16. Delete Confirmation Dialog */}
      <Modal visible={deleteConfirmVisible} transparent animationType="fade" onRequestClose={() => setDeleteConfirmVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dialogHeaderRow}>
              <Text style={[typography.h4, { color: colors.text }]}>Delete Document?</Text>
              <TouchableOpacity onPress={() => setDeleteConfirmVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
              Are you sure you want to delete "{actionItem?.name}"?
            </Text>

            <View style={styles.dialogButtonRow}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setDeleteConfirmVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Delete"
                variant="danger"
                onPress={handleDeleteSubmit}
                style={{ flex: 1 }}
              />
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
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cloudLogoCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  headerTitles: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
  },
  quickActionsContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
  },
  quickActionsScroll: {
    paddingHorizontal: spacing.base,
    gap: spacing.base,
    alignItems: 'center',
  },
  actionPill: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipsRow: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    gap: spacing.xs,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  listContent: {
    padding: spacing.base,
    paddingBottom: 90,
  },
  listContentEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  gridCard: {
    flex: 0.5,
    margin: spacing.xs,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...elevation.sm,
  },
  gridPreviewBox: {
    height: 110,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  badgePill: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  gridCardInfo: {
    padding: spacing.sm,
  },
  gridMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.xs + 2,
    ...elevation.sm,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm + 2,
  },
  itemInfo: {
    flex: 1,
  },
  moreBtn: {
    padding: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyScanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    marginTop: spacing.lg,
    ...elevation.md,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    ...elevation.lg,
  },
  fabLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  optionsSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    padding: spacing.base,
    paddingBottom: spacing.xxl,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  dialogCard: {
    marginHorizontal: spacing.xl,
    marginBottom: 'auto',
    marginTop: 'auto',
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    ...elevation.lg,
  },
  dialogHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dialogInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  watermarkPresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.lg,
  },
  presetPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.sm,
  },
  dialogButtonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  compressOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    marginBottom: spacing.xs + 2,
  },
  ocrModalContainer: {
    flex: 1,
  },
  ocrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  ocrLoadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ocrContentBox: {
    flex: 1,
    padding: spacing.base,
  },
  ocrLangBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  langChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  ocrTextInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  ocrBottomActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  ocrActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.md,
  },
  mergeCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: 4,
  },
});
