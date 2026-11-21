import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  BackHandler,
  Alert,
  Modal,
  Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FolderPlus,
  ClipboardPaste,
  X,
  Plus,
  LayoutGrid,
  LayoutList,
  MoreHorizontal,
  ArrowUpDown,
  Eye,
  EyeOff,
  Check,
  ChevronRight,
  ArrowDownAZ,
  ArrowUpAZ,
  Calendar,
  HardDrive,
  FileCode,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { useFileStore } from '../../app/store/useFileStore';
import { useVaultStore } from '../../app/store/useVaultStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Breadcrumb } from '../../components/file/Breadcrumb';
import { FileItem } from '../../components/file/FileItem';
import { FileGridItem } from '../../components/file/FileGridItem';
import { FileActionSheet } from '../../components/file/FileActionSheet';
import { SortFilterModal } from '../../components/file/SortFilterModal';
import { FileDetailsModal } from '../../components/dialogs/FileDetailsModal';
import { RenameDialog } from '../../components/dialogs/RenameDialog';
import { CreateItemDialog } from '../../components/dialogs/CreateItemDialog';
import { DeleteChoiceModal } from '../../components/dialogs/DeleteChoiceModal';
import { CompressDialog } from '../../components/dialogs/CompressDialog';
import { ItemActionModal } from '../../components/dialogs/ItemActionModal';
import { ChecksumModal } from '../../components/dialogs/ChecksumModal';
import { SetVaultPinModal } from '../../components/dialogs/SetVaultPinModal';
import { EmptyState } from '../../components/common/EmptyState';
import { FileItem as FileItemType } from '../../types/file';
import { fileService } from '../../services/filesystem/fileService';
import { isImageFile, isVideoFile, isAudioFile } from '../../utils/fileTypes';

export const FoldersScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const {
    currentPath,
    files,
    history,
    isLoading,
    loadDirectory,
    enterDirectory,
    navigateUp,
    refresh,
    viewMode,
    setViewMode,
    sortBy,
    sortOrder,
    setSort,
    showHidden,
    toggleShowHidden,
    selectedFileIds,
    toggleSelectFile,
    selectAll,
    invertSelection,
    clearSelection,
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
    getBreadcrumbs,
  } = useFileStore();

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [folderMenuVisible, setFolderMenuVisible] = useState(false);
  const [sortModalVisible, setSortModalVisible] = useState(false);
  const [createItemVisible, setCreateItemVisible] = useState(false);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  const SORT_OPTIONS = [
    { id: 'name_asc', field: 'name' as const, order: 'asc' as const, label: 'Name (A to Z)', icon: ArrowDownAZ },
    { id: 'name_desc', field: 'name' as const, order: 'desc' as const, label: 'Name (Z to A)', icon: ArrowUpAZ },
    { id: 'date_desc', field: 'date' as const, order: 'desc' as const, label: 'Modify (Newest first)', icon: Calendar },
    { id: 'date_asc', field: 'date' as const, order: 'asc' as const, label: 'Old to New (Oldest first)', icon: Calendar },
    { id: 'size_desc', field: 'size' as const, order: 'desc' as const, label: 'Size (Largest first)', icon: HardDrive },
    { id: 'size_asc', field: 'size' as const, order: 'asc' as const, label: 'Size (Smallest first)', icon: HardDrive },
    { id: 'type_asc', field: 'type' as const, order: 'asc' as const, label: 'File Type', icon: FileCode },
  ];

  const getCurrentSortLabel = (): string => {
    if (sortBy === 'name') return sortOrder === 'asc' ? 'Name (A to Z)' : 'Name (Z to A)';
    if (sortBy === 'date') return sortOrder === 'desc' ? 'Modify (Newest first)' : 'Old to New (Oldest first)';
    if (sortBy === 'size') return sortOrder === 'desc' ? 'Size (Largest first)' : 'Size (Smallest first)';
    if (sortBy === 'type') return 'File Type';
    return 'Name (A to Z)';
  };
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

  const breadcrumbs = getBreadcrumbs();
  const isSelectionMode = selectedFileIds.size > 0;
  const canGoBack = history.length > 0 || breadcrumbs.length > 1;

  // Handle hardware & gesture back button one by one
  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (sortModalVisible) {
          setSortModalVisible(false);
          return true;
        }
        if (folderMenuVisible) {
          setFolderMenuVisible(false);
          return true;
        }
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
        if (isSelectionMode) {
          clearSelection();
          return true;
        }
        if (canGoBack) {
          navigateUp();
          return true;
        }
        return false;
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
      isSelectionMode,
      canGoBack,
      clearSelection,
      navigateUp,
    ])
  );

  const handleFilePress = useCallback(
    (item: FileItemType) => {
      if (isSelectionMode) {
        toggleSelectFile(item.id);
      } else if (item.isDirectory) {
        enterDirectory(item);
      } else if (isImageFile(item)) {
        const currentFiles = useFileStore.getState().files;
        const imageList = currentFiles.filter((f) => isImageFile(f));
        const idx = imageList.findIndex((f) => f.id === item.id);
        navigation.navigate('ImageViewerScreen', {
          images: imageList.length > 0 ? imageList : [item],
          initialIndex: Math.max(0, idx),
        });
      } else if (isAudioFile(item)) {
        const currentFiles = useFileStore.getState().files;
        const audioList = currentFiles.filter((f) => isAudioFile(f));
        navigation.navigate('AudioPlayerScreen', {
          file: item,
          playlist: audioList.length > 0 ? audioList : [item],
        });
      } else if (isVideoFile(item)) {
        const currentFiles = useFileStore.getState().files;
        const videoList = currentFiles.filter((f) => isVideoFile(f));
        navigation.navigate('MediaPlayerScreen', {
          file: item,
          playlist: videoList.length > 0 ? videoList : [item],
        });
      } else {
        fileService.openFile(item.path, item.mimeType);
      }
    },
    [isSelectionMode, toggleSelectFile, enterDirectory, navigation]
  );

  const handleFileLongPress = useCallback(
    (item: FileItemType) => {
      toggleSelectFile(item.id);
    },
    [toggleSelectFile]
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
    useFileStore.setState((state) => ({
      files: state.files.filter((f) => f.id !== item.id && f.path !== item.path),
      recentFiles: state.recentFiles.filter((f) => f.id !== item.id && f.path !== item.path),
    }));
    fileService.clearDirectoryCache();
    try {
      await importFileToVault(item.path, '0000');
      Alert.alert('Vault Secured', `"${item.name}" locked in Private Folder.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to lock file in vault');
    }
  };

  // Lock batch files into private vault
  const handleBatchLockInVault = async () => {
    if (!useVaultStore.getState().isHydrated) {
      await useVaultStore.getState().hydrate();
    }
    const { isPinSet, importFilesToVault } = useVaultStore.getState();
    const selected = files.filter((f) => selectedFileIds.has(f.id) && !f.isDirectory);
    if (selected.length === 0) {
      Alert.alert('Vault Notice', 'Only files (not folders) can be locked in the Private Folder.');
      return;
    }
    if (!isPinSet) {
      setPendingBatchVault(true);
      setSetPinModalVisible(true);
      return;
    }
    const selectedIds = new Set(selected.map((f) => f.id));
    useFileStore.setState((state) => ({
      files: state.files.filter((f) => !selectedIds.has(f.id) && !selectedIds.has(f.path)),
      recentFiles: state.recentFiles.filter((f) => !selectedIds.has(f.id) && !selectedIds.has(f.path)),
      selectedFileIds: new Set(),
    }));
    clearSelection();
    fileService.clearDirectoryCache();
    try {
      await importFilesToVault(selected.map((item) => item.path), '0000');
      Alert.alert('Vault Secured', `${selected.length} item(s) locked in your Private Vault.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to lock items in vault');
    }
  };

  const handlePinCreated = async (pin: string) => {
    useVaultStore.getState().setPin(pin, true);
    setSetPinModalVisible(false);
    if (pendingBatchVault) {
      setPendingBatchVault(false);
      const selected = files.filter((f) => selectedFileIds.has(f.id) && !f.isDirectory);
      const selectedIds = new Set(selected.map((f) => f.id));
      useFileStore.setState((state) => ({
        files: state.files.filter((f) => !selectedIds.has(f.id) && !selectedIds.has(f.path)),
        recentFiles: state.recentFiles.filter((f) => !selectedIds.has(f.id) && !selectedIds.has(f.path)),
        selectedFileIds: new Set(),
      }));
      clearSelection();
      fileService.clearDirectoryCache();
      await useVaultStore.getState().importFilesToVault(selected.map((item) => item.path), pin);
      Alert.alert('Passcode Set & Secured', `${selected.length} item(s) locked in Private Folder.`);
    } else if (pendingVaultItem) {
      const it = pendingVaultItem;
      setPendingVaultItem(null);
      useFileStore.setState((state) => ({
        files: state.files.filter((f) => f.id !== it.id && f.path !== it.path),
        recentFiles: state.recentFiles.filter((f) => f.id !== it.id && f.path !== it.path),
      }));
      fileService.clearDirectoryCache();
      await useVaultStore.getState().importFileToVault(it.path, pin);
      Alert.alert('Passcode Set & Secured', `"${it.name}" locked in Private Folder.`);
    }
  };

  const handlePullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refresh]);

  // Share batch files
  const handleBatchShare = () => {
    const selected = files.filter((f) => selectedFileIds.has(f.id) && !f.isDirectory);
    if (selected.length > 0) {
      fileService.shareFiles(selected.map((s) => s.path));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Header
        title="Folders"
        subtitle={breadcrumbs[breadcrumbs.length - 1]?.name}
        showBack={canGoBack}
        onBack={navigateUp}
        rightActions={
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => setCreateItemVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Create item"
          >
            <Plus size={22} color={colors.text} />
          </TouchableOpacity>
        }
      />

      {/* Breadcrumb Row with Grid/List Toggle and Three Horizontal Dots Options Menu */}
      <View
        style={[
          styles.breadcrumbBar,
          { backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.breadcrumbFlex}>
          <Breadcrumb
            items={breadcrumbs}
            onNavigate={(path) => loadDirectory(path)}
            style={{ borderBottomWidth: 0, height: 44 }}
          />
        </View>

        <View style={styles.breadcrumbActionsGroup}>
          {/* 1. Toggle List / Grid View */}
          <TouchableOpacity
            style={styles.breadcrumbIconBtn}
            onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Toggle list and grid view"
          >
            {viewMode === 'list' ? (
              <LayoutGrid size={20} color={colors.text} />
            ) : (
              <LayoutList size={20} color={colors.text} />
            )}
          </TouchableOpacity>

          {/* 2. Three Horizontal Dots Menu */}
          <TouchableOpacity
            style={styles.breadcrumbIconBtn}
            onPress={() => setFolderMenuVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="More options"
          >
            <MoreHorizontal size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Paste Clipboard Banner */}
      {clipboard && (
        <View style={[styles.clipboardBanner, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
          <View style={styles.clipboardTextGroup}>
            <Text style={[typography.labelMedium, { color: colors.primary, fontWeight: '700' }]}>
              {clipboard.mode === 'copy' ? 'Copying' : 'Moving'} {clipboard.items.length} item(s)
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              Paste into current folder
            </Text>
          </View>
          <View style={styles.clipboardActions}>
            <TouchableOpacity
              style={[styles.pasteBtn, { backgroundColor: colors.primary }]}
              onPress={() => pasteClipboard(currentPath)}
            >
              <ClipboardPaste size={16} color="#FFFFFF" />
              <Text style={[typography.labelMedium, { color: '#FFFFFF', marginLeft: 4 }]}>Paste</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearClipboard} style={styles.cancelPasteBtn}>
              <X size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Files List / Grid */}
      <FlatList
        data={files}
        key={viewMode}
        numColumns={viewMode === 'grid' ? 3 : 1}
        keyExtractor={keyExtractor}
        getItemLayout={viewMode === 'list' ? getItemLayout : undefined}
        renderItem={renderItem}
        extraData={selectedFileIds}
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={5}
        updateCellsBatchingPeriod={30}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl refreshing={isPullRefreshing} onRefresh={handlePullRefresh} colors={[colors.primary]} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isLoading ? (
            <EmptyState
              title="Folder is Empty"
              description="No files or directories here."
              actionTitle="Create Item"
              onActionPress={() => setCreateItemVisible(true)}
            />
          ) : undefined
        }
      />

      {/* Floating Action Sheet when files are selected */}
      {isSelectionMode && (
        <FileActionSheet
          selectedCount={selectedFileIds.size}
          totalCount={files.length}
          onCopy={() => {
            const selected = files.filter((f) => selectedFileIds.has(f.id));
            setClipboard('copy', selected);
          }}
          onMove={() => {
            const selected = files.filter((f) => selectedFileIds.has(f.id));
            setClipboard('move', selected);
          }}
          onDelete={() => setConfirmBatchDelete(true)}
          onShare={handleBatchShare}
          onCompress={() => setBatchCompressVisible(true)}
          onLockInVault={handleBatchLockInVault}
          onSelectAll={selectAll}
          onInvertSelection={() => invertSelection(files)}
          onRename={
            selectedFileIds.size === 1
              ? () => {
                  const target = files.find((f) => selectedFileIds.has(f.id));
                  if (target) setRenameItemTarget(target);
                }
              : undefined
          }
          onChecksum={
            selectedFileIds.size === 1
              ? () => {
                  const target = files.find((f) => selectedFileIds.has(f.id));
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
        onClose={() => setActionModalItem(null)}
        onOpenWith={(item) => fileService.openWith(item.path)}
        onShare={(item) => fileService.shareFiles([item.path])}
        onCopy={(item) => setClipboard('copy', [item])}
        onMove={(item) => setClipboard('move', [item])}
        onRename={(item) => setRenameItemTarget(item)}
        onCompress={(item) => setCompressTargetItem(item)}
        onExtract={async (item) => {
          try {
            await extractArchive(item.path, currentPath);
            Alert.alert('Extracted', `"${item.name}" unpacked successfully.`);
          } catch (e: any) {
            Alert.alert('Extraction Failed', e?.message || 'Could not unpack archive');
          }
        }}
        onToggleFavorite={(item) => toggleFavorite(item.path)}
        onToggleHide={async (item) => {
          if (item.name.startsWith('.')) {
            await unhideItem(item.path);
          } else {
            await hideItem(item.path);
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
          await createFolder(name, currentPath);
          setCreateItemVisible(false);
        }}
        onCreateFile={async (name, content) => {
          await createFile(name, content, currentPath);
          setCreateItemVisible(false);
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
            await deleteSingleWithChoice(deleteTarget.path, permanent);
            setDeleteTarget(null);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Batch Delete with Choice Dialog */}
      <DeleteChoiceModal
        visible={confirmBatchDelete}
        itemCount={selectedFileIds.size}
        onDelete={async (permanent) => {
          setConfirmBatchDelete(false);
          await deleteSelectedWithChoice(permanent);
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
            await compressSelected(zipName, currentPath);
            setCompressTargetItem(null);
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
          await compressSelected(zipName, currentPath);
          setBatchCompressVisible(false);
        }}
        onCancel={() => setBatchCompressVisible(false)}
      />

      {/* Sort & Filter Modal */}
      <SortFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={setSort}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        showHidden={showHidden}
        onToggleShowHidden={toggleShowHidden}
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
            await renameItem(renameItemTarget.path, newName);
            setRenameItemTarget(null);
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

      {/* Set Vault Passcode Modal */}
      <SetVaultPinModal
        visible={setPinModalVisible}
        onPinSet={handlePinCreated}
        onCancel={() => {
          setSetPinModalVisible(false);
          setPendingVaultItem(null);
          setPendingBatchVault(false);
        }}
      />

      {/* Folder Options Menu Modal (Three Horizontal Dots) */}
      <Modal
        visible={folderMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFolderMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setFolderMenuVisible(false)}
        >
          <View
            style={[
              styles.optionsSheetBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.optionsSheetHeader}>
              <Text style={[typography.h3, { color: colors.text }]}>Folder Options</Text>
              <TouchableOpacity
                onPress={() => setFolderMenuVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Option 1: Sort by */}
            <TouchableOpacity
              style={[styles.menuOptionRow, { borderBottomColor: colors.border }]}
              onPress={() => {
                setFolderMenuVisible(false);
                setTimeout(() => setSortModalVisible(true), 200);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.menuOptionLeft}>
                <View style={[styles.menuIconCircle, { backgroundColor: colors.primary + '18' }]}>
                  <ArrowUpDown size={18} color={colors.primary} />
                </View>
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <Text style={[typography.bodyMedium, { color: colors.text, fontWeight: '600' }]}>
                    Sort by
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    {getCurrentSortLabel()}
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </TouchableOpacity>

            {/* Option 2: Show hidden files */}
            <TouchableOpacity
              style={styles.menuOptionRow}
              onPress={() => toggleShowHidden()}
              activeOpacity={0.7}
            >
              <View style={styles.menuOptionLeft}>
                <View
                  style={[
                    styles.menuIconCircle,
                    {
                      backgroundColor: showHidden
                        ? colors.primary + '18'
                        : colors.surfaceVariant,
                    },
                  ]}
                >
                  {showHidden ? (
                    <Eye size={18} color={colors.primary} />
                  ) : (
                    <EyeOff size={18} color={colors.textMuted} />
                  )}
                </View>
                <View style={{ marginLeft: spacing.md, flex: 1 }}>
                  <Text style={[typography.bodyMedium, { color: colors.text, fontWeight: '600' }]}>
                    Show hidden files
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    {showHidden ? 'Hidden files visible' : 'Hidden files hidden'}
                  </Text>
                </View>
              </View>
              <Switch
                value={showHidden}
                onValueChange={() => toggleShowHidden()}
                thumbColor={showHidden ? colors.primary : colors.surfaceVariant}
                trackColor={{ false: colors.surfaceVariant, true: colors.primary + '40' }}
              />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Sort By Modal */}
      <Modal
        visible={sortModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSortModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSortModalVisible(false)}
        >
          <View
            style={[
              styles.optionsSheetBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.optionsSheetHeader}>
              <Text style={[typography.h3, { color: colors.text }]}>Sort By</Text>
              <TouchableOpacity
                onPress={() => setSortModalVisible(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {SORT_OPTIONS.map((opt) => {
              const isSelected = sortBy === opt.field && sortOrder === opt.order;
              const IconComp = opt.icon;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.sortOptionItem,
                    isSelected && { backgroundColor: colors.primary + '15' },
                  ]}
                  onPress={() => {
                    setSort(opt.field, opt.order);
                    setSortModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.sortOptionLeft}>
                    <IconComp
                      size={18}
                      color={isSelected ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        typography.bodyMedium,
                        {
                          color: isSelected ? colors.primary : colors.text,
                          fontWeight: isSelected ? '700' : '400',
                          marginLeft: spacing.md,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </View>
                  {isSelected && <Check size={18} color={colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
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
  breadcrumbBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  breadcrumbFlex: {
    flex: 1,
    overflow: 'hidden',
  },
  breadcrumbActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: spacing.sm,
  },
  breadcrumbIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  optionsSheetBox: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  optionsSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  menuOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  menuOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginVertical: 1,
  },
  sortOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
