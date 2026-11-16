import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  AppState,
  BackHandler,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HardDrive, Sparkles, SlidersHorizontal, ArrowUpRight, ShieldAlert } from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { useFileStore } from '../../app/store/useFileStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { ProgressBar } from '../../components/common/ProgressBar';
import { CategoryChips } from '../../components/file/CategoryChips';
import { FileItem } from '../../components/file/FileItem';
import { FileGridItem } from '../../components/file/FileGridItem';
import { FileActionSheet } from '../../components/file/FileActionSheet';
import { SortFilterModal } from '../../components/file/SortFilterModal';
import { FileDetailsModal } from '../../components/dialogs/FileDetailsModal';
import { RenameDialog } from '../../components/dialogs/RenameDialog';
import { ConfirmDialog } from '../../components/dialogs/ConfirmDialog';
import { ChecksumModal } from '../../components/dialogs/ChecksumModal';
import { EmptyState } from '../../components/common/EmptyState';
import { formatBytes } from '../../utils/formatters';
import { FileItem as FileItemType, FileCategory } from '../../types/file';
import { fileService } from '../../services/filesystem/fileService';
import { isImageFile } from '../../utils/fileTypes';
import {
  checkAllFilesPermission,
  requestAllFilesPermission,
} from '../../services/permissions/permissionsService';

export const RecentScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const {
    recentFiles,
    categoryFiles,
    activeCategory,
    setActiveCategory,
    storageVolumes,
    initialize,
    refresh,
    isLoading,
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
    deleteSelected,
    deleteSingle,
    renameItem,
    setClipboard,
  } = useFileStore();

  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [detailsItem, setDetailsItem] = useState<FileItemType | null>(null);
  const [renameItemTarget, setRenameItemTarget] = useState<FileItemType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileItemType | null>(null);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [checksumItem, setChecksumItem] = useState<FileItemType | null>(null);
  const [hasAllFilesAccess, setHasAllFilesAccess] = useState<boolean>(true);

  useEffect(() => {
    initialize();
    checkPermissionStatus();

    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkPermissionStatus();
        refresh();
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  const checkPermissionStatus = async () => {
    const granted = await checkAllFilesPermission();
    setHasAllFilesAccess(granted);
  };

  const handleGrantPermission = async () => {
    await requestAllFilesPermission();
  };

  const displayedFiles = (activeCategory === 'all' ? recentFiles : categoryFiles)
    .slice()
    .sort((a, b) => b.lastModified - a.lastModified);
  const isSelectionMode = selectedFileIds.size > 0;

  // Handle hardware back on Recent screen one by one:
  // 1. Modals -> 2. Selection mode -> 3. Category filter reset -> 4. Default back
  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (filterModalVisible) {
          setFilterModalVisible(false);
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
        if (checksumItem) {
          setChecksumItem(null);
          return true;
        }
        if (isSelectionMode) {
          clearSelection();
          return true;
        }
        if (activeCategory !== 'all') {
          setActiveCategory('all');
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => subscription.remove();
    }, [
      filterModalVisible,
      detailsItem,
      renameItemTarget,
      deleteTarget,
      confirmBatchDelete,
      checksumItem,
      isSelectionMode,
      activeCategory,
      clearSelection,
      setActiveCategory,
    ])
  );

  const primaryVolume = storageVolumes[0] || {
    name: 'Internal Storage',
    totalBytes: 128 * 1024 * 1024 * 1024,
    usedBytes: 42.4 * 1024 * 1024 * 1024,
    freeBytes: 85.6 * 1024 * 1024 * 1024,
  };

  const storageUsagePercent = primaryVolume.totalBytes > 0
    ? primaryVolume.usedBytes / primaryVolume.totalBytes
    : 0.35;

  const handleFilePress = (item: FileItemType) => {
    if (isSelectionMode) {
      toggleSelectFile(item.id);
    } else if (item.isDirectory) {
      navigation.navigate('FoldersTab');
    } else if (isImageFile(item)) {
      const imageList = displayedFiles.filter((f) => isImageFile(f));
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
        title="NexFile"
        subtitle="Smart File Manager"
        showSearch
        onSearchPress={() => navigation.navigate('SearchScreen')}
        showThemeToggle
        showFilter
        onFilterPress={() => setFilterModalVisible(true)}
      />

      <FlatList
        data={displayedFiles}
        key={viewMode}
        numColumns={viewMode === 'grid' ? 3 : 1}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} colors={[colors.primary]} />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.headerComponent}>
            {/* Storage Card */}
            <Card style={styles.storageCard}>
              <View style={styles.storageHeader}>
                <View style={styles.storageTitleRow}>
                  <HardDrive size={20} color={colors.primary} />
                  <Text style={[typography.labelLarge, { color: colors.text, marginLeft: 8 }]}>
                    {primaryVolume.name}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.analyzerShortcut}
                  onPress={() => navigation.navigate('StorageAnalyzerScreen')}
                >
                  <Text style={[typography.labelSmall, { color: colors.primary }]}>Analyze</Text>
                  <ArrowUpRight size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <ProgressBar
                progress={storageUsagePercent}
                color={storageUsagePercent > 0.85 ? colors.error : colors.primary}
                style={{ marginTop: spacing.md }}
              />

              <View style={styles.storageStatsRow}>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  Used: <Text style={{ fontWeight: '600', color: colors.text }}>{formatBytes(primaryVolume.usedBytes)}</Text>
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  Free: <Text style={{ fontWeight: '600', color: colors.text }}>{formatBytes(primaryVolume.freeBytes)}</Text>
                </Text>
              </View>
            </Card>

            {/* Permission Banner if All Files Access is missing */}
            {!hasAllFilesAccess && (
              <View
                style={[
                  styles.permissionBanner,
                  {
                    backgroundColor: colors.primary + '15',
                    borderColor: colors.primary,
                  },
                ]}
              >
                <ShieldAlert size={24} color={colors.primary} style={{ marginRight: spacing.sm }} />
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Text style={[typography.labelMedium, { color: colors.text, fontWeight: '700' }]}>
                    All Files Access Required
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                    Allow storage access to view PDF, TXT, HTML & document files.
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.grantButton, { backgroundColor: colors.primary }]}
                  onPress={handleGrantPermission}
                  activeOpacity={0.8}
                >
                  <Text style={[typography.labelSmall, { color: '#FFFFFF', fontWeight: 'bold' }]}>
                    Grant
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Categories */}
            <View style={styles.sectionTitleRow}>
              <Text style={[typography.h3, { color: colors.text }]}>Categories</Text>
            </View>

            <CategoryChips
              selectedCategory={activeCategory}
              onSelectCategory={(cat) => {
                if (cat === 'images') {
                  navigation.navigate('ImagesGalleryScreen');
                } else {
                  setActiveCategory(cat);
                }
              }}
            />

            {/* Recent / Category Files Title */}
            <View style={[styles.sectionTitleRow, { marginTop: spacing.lg }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[typography.h3, { color: colors.text }]}>
                  {activeCategory === 'all' ? 'Recent Files' : `${activeCategory.toUpperCase()} Files`}
                </Text>
                <Text style={[typography.labelSmall, { color: colors.textMuted, marginLeft: 8 }]}>
                  ({displayedFiles.length})
                </Text>
              </View>
            </View>
          </View>
        }
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
              title="No Files Found"
              description="No files in this category yet."
            />
          ) : undefined
        }
      />

      {/* Floating Action Sheet when files are selected */}
      {isSelectionMode && (
        <FileActionSheet
          selectedCount={selectedFileIds.size}
          totalCount={displayedFiles.length}
          onCopy={() => {
            const selected = displayedFiles.filter((f) => selectedFileIds.has(f.id));
            setClipboard('copy', selected);
          }}
          onMove={() => {
            const selected = displayedFiles.filter((f) => selectedFileIds.has(f.id));
            setClipboard('move', selected);
          }}
          onDelete={() => setConfirmBatchDelete(true)}
          onShare={() => {
            console.log('Share files');
          }}
          onRename={
            selectedFileIds.size === 1
              ? () => {
                  const target = displayedFiles.find((f) => selectedFileIds.has(f.id));
                  if (target) setRenameItemTarget(target);
                }
              : undefined
          }
          onChecksum={
            selectedFileIds.size === 1
              ? () => {
                  const target = displayedFiles.find((f) => selectedFileIds.has(f.id));
                  if (target) setChecksumItem(target);
                }
              : undefined
          }
          onSelectAll={selectAll}
          onClose={clearSelection}
        />
      )}

      {/* Modals & Dialogs */}
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
        message={`Are you sure you want to move ${selectedFileIds.size} file(s) to the Recycle Bin?`}
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
  listContent: {
    paddingBottom: spacing.xxl,
  },
  headerComponent: {
    paddingBottom: spacing.sm,
  },
  storageCard: {
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
  },
  storageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storageTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  analyzerShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storageStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionTitleRow: {
    paddingHorizontal: spacing.base,
    marginTop: spacing.base,
    marginBottom: spacing.xs,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  grantButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
});
