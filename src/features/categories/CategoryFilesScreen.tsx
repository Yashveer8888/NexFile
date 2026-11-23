import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  BackHandler,
  ScrollView,
  Alert,
} from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Music,
  FileText,
  Package,
  Download,
  Archive,
  Plus,
  ClipboardPaste,
  X,
  FileCheck,
  Video,
  SlidersHorizontal,
  ArrowUpDown,
} from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

const WhatsAppIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 22,
  color = '#25D366',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.883-9.888 9.883m0-18C5.39 3.785.64 8.535.638 14.39a11.75 11.75 0 001.6 5.922L0 24l3.771-2.205a11.83 11.83 0 005.877 1.558h.005c5.852 0 10.605-4.753 10.608-10.609 0-2.836-1.105-5.503-3.111-7.51A10.53 10.53 0 0012.051 3.785"
      fill={color}
    />
  </Svg>
);

import { useThemeStore } from '../../app/store/useThemeStore';
import { useFileStore } from '../../app/store/useFileStore';
import { useVaultStore } from '../../app/store/useVaultStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { FileItem as FileItemType, FileCategory, SortField, SortOrder } from '../../types/file';
import { fileService } from '../../services/filesystem/fileService';
import { isImageFile, isAudioFile, isVideoFile, getMimeTypeFromExtension } from '../../utils/fileTypes';
import { Header } from '../../components/common/Header';
import { FileItem } from '../../components/file/FileItem';
import { FileGridItem } from '../../components/file/FileGridItem';
import { FileActionSheet } from '../../components/file/FileActionSheet';
import { EmptyState } from '../../components/common/EmptyState';
import { SortFilterModal } from '../../components/file/SortFilterModal';
import { FileDetailsModal } from '../../components/dialogs/FileDetailsModal';
import { RenameDialog } from '../../components/dialogs/RenameDialog';
import { CreateItemDialog } from '../../components/dialogs/CreateItemDialog';
import { DeleteChoiceModal } from '../../components/dialogs/DeleteChoiceModal';
import { CompressDialog } from '../../components/dialogs/CompressDialog';
import { ItemActionModal } from '../../components/dialogs/ItemActionModal';
import { ChecksumModal } from '../../components/dialogs/ChecksumModal';
import { SetVaultPinModal } from '../../components/dialogs/SetVaultPinModal';

export const CategoryFilesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const route = useRoute<any>();
  const category: FileCategory = route.params?.category || 'documents';
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();

  const {
    clipboard,
    setClipboard,
    clearClipboard,
    pasteClipboard,
    createFolder,
    createFile,
    renameItem,
    deleteSelectedWithChoice,
    deleteSingleWithChoice,
    compressSelected,
    extractArchive,
    hideItem,
    unhideItem,
    toggleFavorite,
  } = useFileStore();

  const [rawFiles, setRawFiles] = useState<FileItemType[]>(() => fileService.getCachedCategory(category) || []);
  const [isLoading, setIsLoading] = useState(() => !fileService.hasCachedCategory(category));
  const [selectedSubTab, setSelectedSubTab] = useState('All');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  // Persistent Category Sorting Preference
  const PREF_KEY_CATEGORY_SORT_BY = 'NEX_CATEGORY_SORT_BY';
  const PREF_KEY_CATEGORY_SORT_ORDER = 'NEX_CATEGORY_SORT_ORDER';
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showHidden, setShowHidden] = useState(false);

  // Load saved category sort preference on mount
  useEffect(() => {
    Promise.all([
      fileService.getPreference(PREF_KEY_CATEGORY_SORT_BY, 'date'),
      fileService.getPreference(PREF_KEY_CATEGORY_SORT_ORDER, 'desc'),
    ]).then(([savedSortBy, savedSortOrder]) => {
      if (savedSortBy) setSortBy(savedSortBy as SortField);
      if (savedSortOrder) setSortOrder(savedSortOrder as SortOrder);
    });
  }, []);

  const handleSortChange = (field: SortField, order: SortOrder) => {
    setSortBy(field);
    setSortOrder(order);
    fileService.savePreference(PREF_KEY_CATEGORY_SORT_BY, field);
    fileService.savePreference(PREF_KEY_CATEGORY_SORT_ORDER, order);
  };

  // Multi-select state
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());

  // Dialogs and Modals
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [createItemVisible, setCreateItemVisible] = useState(false);
  const [actionModalItem, setActionModalItem] = useState<FileItemType | null>(null);
  const [detailsItem, setDetailsItem] = useState<FileItemType | null>(null);
  const [renameItemTarget, setRenameItemTarget] = useState<FileItemType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileItemType | null>(null);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [compressTargetItem, setCompressTargetItem] = useState<FileItemType | null>(null);
  const [batchCompressVisible, setBatchCompressVisible] = useState(false);
  const [checksumItem, setChecksumItem] = useState<FileItemType | null>(null);
  const [setPinModalVisible, setSetPinModalVisible] = useState(false);
  const [pendingVaultItem, setPendingVaultItem] = useState<FileItemType | null>(null);
  const [pendingBatchVault, setPendingBatchVault] = useState(false);

  const loadCategoryFiles = useCallback(async (force: boolean = false) => {
    const hasCache = fileService.hasCachedCategory(category);
    if (!hasCache || force) {
      setIsLoading(true);
    }
    try {
      const items = await fileService.getFilesByCategory(category, force);
      setRawFiles((prev) => {
        if (!force && prev.length === items.length && prev.length > 0) {
          if (prev[0]?.id === items[0]?.id && prev[0]?.lastModified === items[0]?.lastModified) {
            return prev;
          }
        }
        return items;
      });
    } catch (e) {
      console.warn('Error loading category files:', e);
    } finally {
      setIsLoading(false);
    }
  }, [category]);

  useEffect(() => {
    loadCategoryFiles(false);
  }, [loadCategoryFiles]);

  // Sub-filter tabs definition
  const subTabs = useMemo(() => {
    if (category === 'documents') {
      return ['All', 'PDF', 'Word', 'Excel', 'PPT', 'Text'];
    }
    if (category === 'whatsapp') {
      return ['All', 'Images', 'Videos', 'Audio', 'Documents'];
    }
    if (category === 'downloads') {
      return ['All', 'Recent', 'PDFs', 'APKs', 'Archives', 'Media'];
    }
    if (category === 'audio') {
      return ['All', 'MP3', 'M4A', 'WAV', 'Recordings'];
    }
    return [];
  }, [category]);

  // Filter & sort files
  const filteredFiles = useMemo(() => {
    let list = rawFiles;

    // Sub-tab filter
    if (category === 'documents' && selectedSubTab !== 'All') {
      list = list.filter((f) => {
        const ext = (f.extension || '').toLowerCase().replace(/^\./, '');
        if (selectedSubTab === 'PDF') return ext === 'pdf';
        if (selectedSubTab === 'Word') return ext === 'doc' || ext === 'docx';
        if (selectedSubTab === 'Excel') return ext === 'xls' || ext === 'xlsx' || ext === 'csv';
        if (selectedSubTab === 'PPT') return ext === 'ppt' || ext === 'pptx';
        if (selectedSubTab === 'Text') return ['txt', 'md', 'json', 'xml', 'html', 'log'].includes(ext);
        return true;
      });
    } else if (category === 'whatsapp' && selectedSubTab !== 'All') {
      list = list.filter((f) => {
        const p = f.path.toLowerCase();
        if (selectedSubTab === 'Images') return p.includes('images') || isImageFile(f);
        if (selectedSubTab === 'Videos') return p.includes('video') || isVideoFile(f);
        if (selectedSubTab === 'Audio') return p.includes('audio') || p.includes('voice') || isAudioFile(f);
        if (selectedSubTab === 'Documents') return p.includes('documents') || (!isImageFile(f) && !isVideoFile(f) && !isAudioFile(f));
        return true;
      });
    } else if (category === 'downloads' && selectedSubTab !== 'All') {
      list = list.filter((f) => {
        const ext = (f.extension || '').toLowerCase().replace(/^\./, '');
        if (selectedSubTab === 'PDFs') return ext === 'pdf';
        if (selectedSubTab === 'APKs') return ext === 'apk' || ext === 'xapk';
        if (selectedSubTab === 'Archives') return ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext);
        if (selectedSubTab === 'Media') return isImageFile(f) || isVideoFile(f) || isAudioFile(f);
        return true;
      });
    } else if (category === 'audio' && selectedSubTab !== 'All') {
      list = list.filter((f) => {
        const ext = (f.extension || '').toLowerCase().replace(/^\./, '');
        if (selectedSubTab === 'MP3') return ext === 'mp3';
        if (selectedSubTab === 'M4A') return ext === 'm4a' || ext === 'aac';
        if (selectedSubTab === 'WAV') return ext === 'wav' || ext === 'flac';
        if (selectedSubTab === 'Recordings') return f.path.toLowerCase().includes('record');
        return true;
      });
    }

    // Hidden files filter
    if (!showHidden) {
      list = list.filter((f) => !f.name.startsWith('.'));
    }

    // Sort files
    return fileService.sortFiles(list, sortBy, sortOrder);
  }, [rawFiles, category, selectedSubTab, showHidden, sortBy, sortOrder]);

  const isSelectionMode = selectedFileIds.size > 0;

  // Toggle selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = () => {
    setSelectedFileIds(new Set(filteredFiles.map((f) => f.id)));
  };

  const invertSelection = () => {
    const inverted = new Set<string>();
    filteredFiles.forEach((f) => {
      if (!selectedFileIds.has(f.id)) inverted.add(f.id);
    });
    setSelectedFileIds(inverted);
  };

  const clearSelection = () => {
    setSelectedFileIds(new Set());
  };

  // Hardware back handling step-by-step
  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (filterModalVisible) {
          setFilterModalVisible(false);
          return true;
        }
        if (createItemVisible) {
          setCreateItemVisible(false);
          return true;
        }
        if (actionModalItem) {
          setActionModalItem(null);
          return true;
        }
        if (detailsItem) {
          setDetailsItem(null);
          return true;
        }
        if (renameItemTarget) {
          setRenameItemTarget(null);
          return true;
        }
        if (deleteTarget) {
          setDeleteTarget(null);
          return true;
        }
        if (confirmBatchDelete) {
          setConfirmBatchDelete(false);
          return true;
        }
        if (compressTargetItem) {
          setCompressTargetItem(null);
          return true;
        }
        if (batchCompressVisible) {
          setBatchCompressVisible(false);
          return true;
        }
        if (checksumItem) {
          setChecksumItem(null);
          return true;
        }
        if (setPinModalVisible) {
          setSetPinModalVisible(false);
          return true;
        }
        if (isSelectionMode) {
          clearSelection();
          return true;
        }
        if (selectedSubTab !== 'All') {
          setSelectedSubTab('All');
          return true;
        }
        navigation.goBack();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => subscription.remove();
    }, [
      filterModalVisible,
      createItemVisible,
      actionModalItem,
      detailsItem,
      renameItemTarget,
      deleteTarget,
      confirmBatchDelete,
      compressTargetItem,
      batchCompressVisible,
      checksumItem,
      setPinModalVisible,
      isSelectionMode,
      selectedSubTab,
      navigation,
    ])
  );

  const handleFilePress = useCallback(
    (item: FileItemType) => {
      if (isSelectionMode) {
        toggleSelect(item.id);
        return;
      }
      if (isImageFile(item)) {
        const images = filteredFiles.filter((f) => isImageFile(f));
        const idx = images.findIndex((img) => img.id === item.id);
        navigation.navigate('ImageViewerScreen', {
          images: images.length > 0 ? images : [item],
          initialIndex: Math.max(0, idx),
        });
      } else if (isAudioFile(item)) {
        const audioList = filteredFiles.filter((f) => isAudioFile(f));
        navigation.navigate('AudioPlayerScreen', {
          file: item,
          playlist: audioList.length > 0 ? audioList : [item],
        });
      } else if (isVideoFile(item)) {
        const videoList = filteredFiles.filter((f) => isVideoFile(f));
        navigation.navigate('MediaPlayerScreen', {
          file: item,
          playlist: videoList.length > 0 ? videoList : [item],
        });
      } else {
        fileService.openFile(item.path, item.mimeType);
      }
    },
    [isSelectionMode, toggleSelect, filteredFiles, navigation]
  );

  const handleFileLongPress = useCallback(
    (item: FileItemType) => {
      toggleSelect(item.id);
    },
    [toggleSelect]
  );

  const handleMorePress = useCallback((item: FileItemType) => {
    setActionModalItem(item);
  }, []);

  const keyExtractor = useCallback((item: FileItemType) => item.path || item.id, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: 64,
      offset: 64 * index,
      index,
    }),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: FileItemType }) => {
      const isSelected = selectedFileIds.has(item.id);
      if (viewMode === 'grid') {
        return (
          <FileGridItem
            item={item}
            onPress={handleFilePress}
            onLongPress={handleFileLongPress}
            onMorePress={handleMorePress}
            isSelected={isSelected}
            isSelectionMode={isSelectionMode}
          />
        );
      }
      return (
        <FileItem
          item={item}
          onPress={handleFilePress}
          onLongPress={handleFileLongPress}
          onMorePress={handleMorePress}
          isSelected={isSelected}
          isSelectionMode={isSelectionMode}
        />
      );
    },
    [viewMode, selectedFileIds, isSelectionMode, handleFilePress, handleFileLongPress, handleMorePress]
  );

  // Lock single file into private vault
  const handleLockInVault = async (item: FileItemType) => {
    if (!useVaultStore.getState().isHydrated) {
      await useVaultStore.getState().hydrate();
    }
    const { isPinSet, importFileToVault } = useVaultStore.getState();
    if (!isPinSet) {
      setPendingVaultItem(item);
      setPendingBatchVault(false);
      setSetPinModalVisible(true);
      return;
    }
    try {
      await importFileToVault(item.path);
      setRawFiles((prev) => prev.filter((f) => f.id !== item.id && f.path !== item.path));
      fileService.clearDirectoryCache();
    } catch (e: any) {
      Alert.alert('Vault Error', e?.message || 'Failed to lock file in vault');
    }
  };

  // Lock batch files into private vault
  const handleBatchLockInVault = async () => {
    if (!useVaultStore.getState().isHydrated) {
      await useVaultStore.getState().hydrate();
    }
    const { isPinSet, importFilesToVault } = useVaultStore.getState();
    const selected = filteredFiles.filter((f) => selectedFileIds.has(f.id) && !f.isDirectory);
    if (selected.length === 0) {
      Alert.alert('Vault Notice', 'Only files can be locked in the Private Folder.');
      return;
    }
    if (!isPinSet) {
      setPendingBatchVault(true);
      setSetPinModalVisible(true);
      return;
    }
    const selectedIds = new Set(selected.map((f) => f.id));
    try {
      await importFilesToVault(selected.map((item) => item.path));
      setRawFiles((prev) => prev.filter((f) => !selectedIds.has(f.id) && !selectedIds.has(f.path)));
      clearSelection();
      fileService.clearDirectoryCache();
    } catch (e: any) {
      Alert.alert('Vault Error', e?.message || 'Failed to lock items in vault');
    }
  };

  const handlePinCreated = async (pin: string) => {
    useVaultStore.getState().setPin(pin, true);
    setSetPinModalVisible(false);
    if (pendingBatchVault) {
      setPendingBatchVault(false);
      const selected = filteredFiles.filter((f) => selectedFileIds.has(f.id) && !f.isDirectory);
      const selectedIds = new Set(selected.map((f) => f.id));
      try {
        await useVaultStore.getState().importFilesToVault(selected.map((item) => item.path), pin);
        setRawFiles((prev) => prev.filter((f) => !selectedIds.has(f.id) && !selectedIds.has(f.path)));
        clearSelection();
        fileService.clearDirectoryCache();
      } catch (e: any) {
        Alert.alert('Vault Error', e?.message || 'Failed to lock items in vault');
      }
    } else if (pendingVaultItem) {
      const it = pendingVaultItem;
      setPendingVaultItem(null);
      try {
        await useVaultStore.getState().importFileToVault(it.path, pin);
        setRawFiles((prev) => prev.filter((f) => f.id !== it.id && f.path !== it.path));
        fileService.clearDirectoryCache();
      } catch (e: any) {
        Alert.alert('Vault Error', e?.message || 'Failed to lock file in vault');
      }
    }
  };

  const categoryMeta = useMemo(() => {
    switch (category) {
      case 'videos':
        return { title: 'Videos', subtitle: `${filteredFiles.length} Videos & Movies`, icon: Video, color: colors.videoColor };
      case 'audio':
        return { title: 'Audio Files', subtitle: `${filteredFiles.length} Tracks & Recordings`, icon: Music, color: colors.audioColor };
      case 'documents':
        return { title: 'Documents', subtitle: `${filteredFiles.length} Docs, PDFs & Sheets`, icon: FileText, color: colors.documentColor };
      case 'apks':
        return { title: 'APKs & Apps', subtitle: `${filteredFiles.length} Installer Packages`, icon: Package, color: colors.apkColor };
      case 'downloads':
        return { title: 'Downloads', subtitle: `${filteredFiles.length} Downloaded Files (Date-wise)`, icon: Download, color: colors.downloadColor };
      case 'archives':
        return { title: 'Archives', subtitle: `${filteredFiles.length} Zip & Compressed Files`, icon: Archive, color: colors.archiveColor };
      case 'whatsapp':
        return { title: 'WhatsApp Media', subtitle: `${filteredFiles.length} Received & Sent Files`, icon: WhatsAppIcon, color: '#25D366' };
      default:
        return { title: 'Files', subtitle: `${filteredFiles.length} Files`, icon: FileCheck, color: colors.primary };
    }
  }, [category, filteredFiles.length, colors]);

  const defaultFolder = category === 'downloads' ? '/storage/emulated/0/Download' : '/storage/emulated/0';

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <Header
        title={categoryMeta.title}
        subtitle={categoryMeta.subtitle}
        showBack
        onBack={() => navigation.goBack()}
        showFilter
        onFilterPress={() => setFilterModalVisible(true)}
      />

      {/* Sub-Tabs / Filter Chips Bar */}
      {subTabs.length > 0 && (
        <View style={styles.subTabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subTabsScroll}>
            {subTabs.map((tab) => {
              const isSelected = selectedSubTab === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[
                    styles.subTabPill,
                    {
                      backgroundColor: isSelected ? categoryMeta.color : colors.surfaceVariant,
                      borderColor: isSelected ? categoryMeta.color : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedSubTab(tab)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      typography.labelSmall,
                      {
                        color: isSelected ? '#FFFFFF' : colors.text,
                        fontWeight: isSelected ? '700' : '500',
                      },
                    ]}
                  >
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Paste Clipboard Banner */}
      {clipboard && (
        <View
          style={[
            styles.clipboardBanner,
            { backgroundColor: colors.primaryLight, borderColor: colors.primary },
          ]}
        >
          <View style={styles.clipboardTextGroup}>
            <Text style={[typography.labelMedium, { color: colors.primary, fontWeight: '700' }]}>
              {clipboard.mode === 'copy' ? 'Copying' : 'Moving'} {clipboard.items.length} item(s)
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              Ready to paste in {categoryMeta.title}
            </Text>
          </View>
          <View style={styles.clipboardActions}>
            <TouchableOpacity
              style={[styles.pasteBtn, { backgroundColor: colors.primary }]}
              onPress={async () => {
                await pasteClipboard(defaultFolder);
                loadCategoryFiles();
              }}
            >
              <ClipboardPaste size={16} color="#FFFFFF" />
              <Text style={[typography.labelMedium, { color: '#FFFFFF', marginLeft: 4 }]}>
                Paste
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearClipboard} style={styles.cancelPasteBtn}>
              <X size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Category Files Toolbar: Item Count & Sort Button */}
      <View style={[styles.toolbarContainer, { borderBottomColor: colors.border }]}>
        <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>
          {filteredFiles.length} {filteredFiles.length === 1 ? 'item' : 'items'}
        </Text>

        <TouchableOpacity
          style={[styles.sortButton, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
          onPress={() => setFilterModalVisible(true)}
          activeOpacity={0.7}
        >
          <SlidersHorizontal size={14} color={colors.primary} />
          <Text style={[typography.labelSmall, { color: colors.text, marginLeft: 6, fontWeight: '600' }]}>
            {sortBy === 'date'
              ? sortOrder === 'desc'
                ? 'Newest'
                : 'Oldest'
              : sortBy === 'name'
              ? sortOrder === 'asc'
                ? 'Name (A-Z)'
                : 'Name (Z-A)'
              : sortBy === 'size'
              ? sortOrder === 'desc'
                ? 'Largest'
                : 'Smallest'
              : 'Type'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Files List / Grid */}
      <FlatList
        data={filteredFiles}
        key={viewMode}
        numColumns={viewMode === 'grid' ? 3 : 1}
        keyExtractor={keyExtractor}
        getItemLayout={viewMode === 'list' ? getItemLayout : undefined}
        renderItem={renderItem}
        extraData={selectedFileIds}
        initialNumToRender={18}
        maxToRenderPerBatch={18}
        windowSize={5}
        updateCellsBatchingPeriod={20}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => loadCategoryFiles(true)} colors={[colors.primary]} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title={`No ${categoryMeta.title} Found`}
              description={`No matching files found in this category.`}
              actionTitle="Create File"
              onActionPress={() => setCreateItemVisible(true)}
            />
          ) : undefined
        }
      />

      {/* Floating Action Sheet when files are selected */}
      {isSelectionMode && (
        <FileActionSheet
          selectedCount={selectedFileIds.size}
          totalCount={filteredFiles.length}
          hideMove={category === 'images' || category === 'videos'}
          onCopy={() => {
            const selected = filteredFiles.filter((f) => selectedFileIds.has(f.id));
            setClipboard('copy', selected);
          }}
          onMove={() => {
            const selected = filteredFiles.filter((f) => selectedFileIds.has(f.id));
            setClipboard('move', selected);
          }}
          onDelete={() => setConfirmBatchDelete(true)}
          onShare={() => {
            const selected = filteredFiles.filter((f) => selectedFileIds.has(f.id) && !f.isDirectory);
            if (selected.length > 0) fileService.shareFiles(selected.map((s) => s.path));
          }}
          onCompress={() => setBatchCompressVisible(true)}
          onLockInVault={handleBatchLockInVault}
          onSelectAll={selectAll}
          onInvertSelection={invertSelection}
          onRename={
            selectedFileIds.size === 1
              ? () => {
                  const target = filteredFiles.find((f) => selectedFileIds.has(f.id));
                  if (target) setRenameItemTarget(target);
                }
              : undefined
          }
          onChecksum={
            selectedFileIds.size === 1
              ? () => {
                  const target = filteredFiles.find((f) => selectedFileIds.has(f.id));
                  if (target) setChecksumItem(target);
                }
              : undefined
          }
          onClose={clearSelection}
        />
      )}

      {/* 3-Dots Item Action Modal (Context Menu for single file/folder) */}
      <ItemActionModal
        visible={Boolean(actionModalItem)}
        item={actionModalItem}
        hideMove={category === 'images' || category === 'videos'}
        onClose={() => setActionModalItem(null)}
        onOpenWith={(item) => fileService.openWith(item.path)}
        onShare={(item) => fileService.shareFiles([item.path])}
        onCopy={(item) => setClipboard('copy', [item])}
        onMove={(item) => setClipboard('move', [item])}
        onRename={(item) => setRenameItemTarget(item)}
        onCompress={(item) => setCompressTargetItem(item)}
        onExtract={async (item) => {
          try {
            await extractArchive(item.path, defaultFolder);
            Alert.alert('Extracted', `"${item.name}" unpacked successfully.`);
            loadCategoryFiles();
          } catch (e: any) {
            Alert.alert('Extraction Failed', e?.message || 'Could not unpack archive');
          }
        }}
        onToggleFavorite={(item) => {
          toggleFavorite(item.path);
          setRawFiles((prev) =>
            prev.map((f) => (f.id === item.id || f.path === item.path ? { ...f, isFavorite: !f.isFavorite } : f))
          );
        }}
        onToggleHide={async (item) => {
          if (item.name.startsWith('.')) {
            await unhideItem(item.path);
            const newName = item.name.replace(/^\.+/, '');
            setRawFiles((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, name: newName } : f))
            );
          } else {
            await hideItem(item.path);
            const newName = `.${item.name}`;
            setRawFiles((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, name: newName } : f))
            );
          }
        }}
        onLockInVault={handleLockInVault}
        onDetails={(item) => setDetailsItem(item)}
        onChecksum={(item) => setChecksumItem(item)}
        onDelete={(item) => setDeleteTarget(item)}
      />

      {/* Create Folder or Blank File Dialog */}
      <CreateItemDialog
        visible={createItemVisible}
        onCreateFolder={async (name) => {
          const targetDir = defaultFolder.replace(/\/$/, '');
          const newPath = `${targetDir}/${name}`;
          const newFolder: FileItemType = {
            id: newPath,
            name,
            path: newPath,
            isDirectory: true,
            size: 0,
            lastModified: Date.now(),
            extension: '',
            mimeType: 'directory',
          };
          setRawFiles((prev) => [newFolder, ...prev]);
          setCreateItemVisible(false);
          fileService.clearDirectoryCache();
          fileService.createFolder(targetDir, name).catch(console.warn);
        }}
        onCreateFile={async (name, content) => {
          const targetDir = defaultFolder.replace(/\/$/, '');
          const newPath = `${targetDir}/${name}`;
          const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
          const newFile: FileItemType = {
            id: newPath,
            name,
            path: newPath,
            isDirectory: false,
            size: (content || '').length,
            lastModified: Date.now(),
            extension: ext,
            mimeType: getMimeTypeFromExtension(name),
          };
          setRawFiles((prev) => [newFile, ...prev]);
          setCreateItemVisible(false);
          fileService.clearDirectoryCache();
          fileService.createFile(targetDir, name, content).catch(console.warn);
        }}
        onCancel={() => setCreateItemVisible(false)}
      />

      {/* Single Item Delete with Choice Dialog */}
      <DeleteChoiceModal
        visible={Boolean(deleteTarget)}
        itemCount={1}
        itemName={deleteTarget?.name}
        onDelete={async (permanent) => {
          if (deleteTarget) {
            const targetId = deleteTarget.id;
            const targetPath = deleteTarget.path;
            setRawFiles((prev) => prev.filter((f) => f.id !== targetId && f.path !== targetPath));
            setDeleteTarget(null);
            fileService.clearDirectoryCache();
            fileService.delete(targetPath, !permanent).catch(console.warn);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Batch Delete with Choice Dialog */}
      <DeleteChoiceModal
        visible={confirmBatchDelete}
        itemCount={selectedFileIds.size}
        onDelete={async (permanent) => {
          const selected = filteredFiles.filter((f) => selectedFileIds.has(f.id));
          const selectedIds = new Set(selected.map((f) => f.id));
          const selectedPaths = selected.map((f) => f.path);
          setRawFiles((prev) => prev.filter((f) => !selectedIds.has(f.id) && !selectedIds.has(f.path)));
          setConfirmBatchDelete(false);
          clearSelection();
          fileService.clearDirectoryCache();
          Promise.all(selectedPaths.map((p) => fileService.delete(p, !permanent))).catch(console.warn);
        }}
        onCancel={() => setConfirmBatchDelete(false)}
      />

      {/* Single Item Compress Dialog */}
      <CompressDialog
        visible={Boolean(compressTargetItem)}
        defaultName={compressTargetItem?.name ? `${compressTargetItem.name}.zip` : 'archive.zip'}
        itemCount={1}
        onCompress={async (zipName) => {
          if (compressTargetItem) {
            await compressSelected(zipName, defaultFolder);
            setCompressTargetItem(null);
            loadCategoryFiles();
          }
        }}
        onCancel={() => setCompressTargetItem(null)}
      />

      {/* Batch Compress Dialog */}
      <CompressDialog
        visible={batchCompressVisible}
        defaultName="Archive.zip"
        itemCount={selectedFileIds.size}
        onCompress={async (zipName) => {
          await compressSelected(zipName, defaultFolder);
          setBatchCompressVisible(false);
          clearSelection();
          loadCategoryFiles();
        }}
        onCancel={() => setBatchCompressVisible(false)}
      />

      {/* Sort & Filter Modal */}
      <SortFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        title={`Sort ${categoryMeta.title}`}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showHidden={showHidden}
        onToggleShowHidden={() => setShowHidden((prev) => !prev)}
      />

      {/* File Details Modal */}
      <FileDetailsModal
        visible={Boolean(detailsItem)}
        item={detailsItem}
        onClose={() => setDetailsItem(null)}
        onOpenChecksum={(item) => setChecksumItem(item)}
      />

      {/* Rename Dialog */}
      <RenameDialog
        visible={Boolean(renameItemTarget)}
        initialName={renameItemTarget?.name || ''}
        onRename={async (newName) => {
          if (renameItemTarget) {
            const oldPath = renameItemTarget.path;
            const oldId = renameItemTarget.id;
            const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'));
            const newPath = `${parentDir}/${newName}`;
            const newExt = newName.includes('.') ? '.' + newName.split('.').pop() : '';
            setRawFiles((prev) =>
              prev.map((f) =>
                f.id === oldId || f.path === oldPath
                  ? { ...f, name: newName, path: newPath, id: newPath, extension: newExt }
                  : f
              )
            );
            setRenameItemTarget(null);
            fileService.clearDirectoryCache();
            fileService.rename(oldPath, newName).catch(console.warn);
          }
        }}
        onCancel={() => setRenameItemTarget(null)}
      />

      {/* Checksum Modal */}
      <ChecksumModal
        visible={Boolean(checksumItem)}
        item={checksumItem}
        onClose={() => setChecksumItem(null)}
      />

      {/* Set Vault Passcode Modal (Prompted if passcode not set yet when locking in vault) */}
      <SetVaultPinModal
        visible={setPinModalVisible}
        onPinSet={handlePinCreated}
        onCancel={() => {
          setSetPinModalVisible(false);
          setPendingVaultItem(null);
          setPendingBatchVault(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabsContainer: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.base,
  },
  subTabsScroll: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  subTabPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  clipboardBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
  },
  clipboardTextGroup: {
    flex: 1,
  },
  clipboardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.sm,
  },
  cancelPasteBtn: {
    padding: spacing.xs,
  },
  toolbarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 3,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
});
