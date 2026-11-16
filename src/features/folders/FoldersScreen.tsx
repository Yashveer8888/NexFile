import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FolderPlus,
  ClipboardPaste,
  X,
  HardDrive,
  SlidersHorizontal,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { useFileStore } from '../../app/store/useFileStore';
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
import { CreateFolderDialog } from '../../components/dialogs/CreateFolderDialog';
import { ConfirmDialog } from '../../components/dialogs/ConfirmDialog';
import { ChecksumModal } from '../../components/dialogs/ChecksumModal';
import { EmptyState } from '../../components/common/EmptyState';
import { FileItem as FileItemType } from '../../types/file';
import { fileService } from '../../services/filesystem/fileService';
import { isImageFile } from '../../utils/fileTypes';

export const FoldersScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const {
    currentPath,
    files,
    history,
    storageVolumes,
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
    clearSelection,
    clipboard,
    setClipboard,
    clearClipboard,
    pasteClipboard,
    createFolder,
    renameItem,
    deleteSelected,
    getBreadcrumbs,
  } = useFileStore();

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [createFolderVisible, setCreateFolderVisible] = useState(false);
  const [detailsItem, setDetailsItem] = useState<FileItemType | null>(null);
  const [renameItemTarget, setRenameItemTarget] = useState<FileItemType | null>(null);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [checksumItem, setChecksumItem] = useState<FileItemType | null>(null);

  const breadcrumbs = getBreadcrumbs();
  const isSelectionMode = selectedFileIds.size > 0;
  const canGoBack = history.length > 0 || breadcrumbs.length > 1;

  // Handle hardware & gesture back button one by one:
  // 1. Modals -> 2. Selection mode -> 3. Parent directory -> 4. Default back
  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (filterModalVisible) {
          setFilterModalVisible(false);
          return true;
        }
        if (createFolderVisible) {
          setCreateFolderVisible(false);
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
        if (confirmBatchDelete) {
          setConfirmBatchDelete(false);
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
      createFolderVisible,
      detailsItem,
      renameItemTarget,
      confirmBatchDelete,
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
    } else {
      fileService.openFile(item.path, item.mimeType);
    }
  };

  const handleFileLongPress = (item: FileItemType) => {
    toggleSelectFile(item.id);
  };

  const handleMorePress = (item: FileItemType) => {
    setDetailsItem(item);
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
            onPress={() => setCreateFolderVisible(true)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <FolderPlus size={20} color={colors.text} />
          </TouchableOpacity>
        }
      />

      {/* Breadcrumb Trail */}
      <Breadcrumb items={breadcrumbs} onNavigate={(path) => loadDirectory(path)} />

      {/* Paste Clipboard Banner */}
      {clipboard && (
        <View style={[styles.clipboardBanner, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
          <View style={styles.clipboardTextGroup}>
            <Text style={[typography.labelMedium, { color: colors.primary }]}>
              {clipboard.mode === 'copy' ? 'Copying' : 'Moving'} {clipboard.items.length} item(s)
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              Paste into current folder
            </Text>
          </View>
          <View style={styles.clipboardActions}>
            <TouchableOpacity
              style={[styles.pasteBtn, { backgroundColor: colors.primary }]}
              onPress={pasteClipboard}
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
              actionTitle="Create Folder"
              onActionPress={() => setCreateFolderVisible(true)}
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
          onShare={() => {
            console.log('Share files');
          }}
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
          onSelectAll={selectAll}
          onClose={clearSelection}
        />
      )}

      {/* Modals */}
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

      <CreateFolderDialog
        visible={createFolderVisible}
        onCreate={async (name) => {
          await createFolder(name);
          setCreateFolderVisible(false);
        }}
        onCancel={() => setCreateFolderVisible(false)}
      />

      <FileDetailsModal
        visible={Boolean(detailsItem)}
        item={detailsItem}
        onClose={() => setDetailsItem(null)}
        onOpenChecksum={(item) => setChecksumItem(item)}
      />

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

      <ConfirmDialog
        visible={confirmBatchDelete}
        title="Delete Selected Files"
        message={`Are you sure you want to delete ${selectedFileIds.size} item(s)?`}
        confirmTitle="Delete"
        isDestructive
        onConfirm={async () => {
          await deleteSelected();
          setConfirmBatchDelete(false);
        }}
        onCancel={() => setConfirmBatchDelete(false)}
      />

      <ChecksumModal
        visible={Boolean(checksumItem)}
        item={checksumItem}
        onClose={() => setChecksumItem(null)}
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
