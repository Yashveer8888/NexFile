import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  BackHandler,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FolderPlus,
  ClipboardPaste,
  X,
  Plus,
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

  const breadcrumbs = getBreadcrumbs();
  const isSelectionMode = selectedFileIds.size > 0;
  const canGoBack = history.length > 0 || breadcrumbs.length > 1;

  // Handle hardware & gesture back button one by one
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

  const handleFilePress = (item: FileItemType) => {
    if (isSelectionMode) {
      toggleSelectFile(item.id);
    } else if (item.isDirectory) {
      enterDirectory(item);
    } else if (isImageFile(item)) {
      const imageList = files.filter((f) => isImageFile(f));
      const idx = imageList.findIndex((f) => f.id === item.id);
      navigation.navigate('ImageViewerScreen', {
        images: imageList.length > 0 ? imageList : [item],
        initialIndex: Math.max(0, idx),
      });
    } else if (isVideoFile(item) || isAudioFile(item)) {
      const mediaList = files.filter((f) => isVideoFile(f) || isAudioFile(f));
      navigation.navigate('MediaPlayerScreen', {
        file: item,
        playlist: mediaList.length > 0 ? mediaList : [item],
      });
    } else {
      fileService.openFile(item.path, item.mimeType);
    }
  };

  const handleFileLongPress = (item: FileItemType) => {
    toggleSelectFile(item.id);
  };

  const handleMorePress = (item: FileItemType) => {
    setActionModalItem(item);
  };

  // Lock single file into private vault
  const handleLockInVault = async (item: FileItemType) => {
    const { isPinSet, importFileToVault } = useVaultStore.getState();
    if (!isPinSet) {
      setPendingVaultItem(item);
      setPendingBatchVault(false);
      setSetPinModalVisible(true);
      return;
    }
    try {
      await importFileToVault(item.path, '0000');
      Alert.alert('Vault Secured', `"${item.name}" locked in Private Folder.`);
      refresh();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to lock file in vault');
    }
  };

  // Lock batch files into private vault
  const handleBatchLockInVault = async () => {
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
    try {
      await importFilesToVault(selected.map((item) => item.path), '0000');
      clearSelection();
      Alert.alert('Vault Secured', `${selected.length} item(s) locked in your Private Folder.`);
      refresh();
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
      await useVaultStore.getState().importFilesToVault(selected.map((item) => item.path), pin);
      clearSelection();
      Alert.alert('Passcode Set & Secured', `${selected.length} item(s) locked in Private Folder.`);
      refresh();
    } else if (pendingVaultItem) {
      const it = pendingVaultItem;
      setPendingVaultItem(null);
      await useVaultStore.getState().importFileToVault(it.path, pin);
      Alert.alert('Passcode Set & Secured', `"${it.name}" locked in Private Folder.`);
      refresh();
    }
  };

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
        showSearch
        onSearchPress={() => navigation.navigate('SearchScreen')}
        showFilter
        onFilterPress={() => setFilterModalVisible(true)}
        rightActions={
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => setCreateItemVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Plus size={22} color={colors.text} />
          </TouchableOpacity>
        }
      />

      {/* Breadcrumb Trail */}
      <Breadcrumb items={breadcrumbs} onNavigate={(path) => loadDirectory(path)} />

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
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} colors={[colors.primary]} />
        }
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
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
        }}
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
          const selected = files.filter((f) => selectedFileIds.has(f.id));
          for (const item of selected) {
            await fileService.delete(item.path, !permanent);
          }
          setConfirmBatchDelete(false);
          clearSelection();
          refresh();
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
});
