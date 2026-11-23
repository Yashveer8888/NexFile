import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  BackHandler,
  AppState,
  Animated,
  PanResponder,
  ScrollView,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  HardDrive,
  ShieldAlert,
  ArrowUpRight,
  Lock,
  Plus,
  ClipboardPaste,
  X,
  Star,
  Folder,
  FileCode,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { useFileStore } from '../../app/store/useFileStore';
import { useVaultStore } from '../../app/store/useVaultStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { formatBytes } from '../../utils/formatters';
import { isImageFile, isVideoFile, isAudioFile, isUsefulRecentFile } from '../../utils/fileTypes';
import { FileItem as FileItemType } from '../../types/file';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { ProgressBar } from '../../components/common/ProgressBar';
import { CategoryChips } from '../../components/file/CategoryChips';
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
import { fileService } from '../../services/filesystem/fileService';
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
    invertSelection,
    clearSelection,
    deleteSelectedWithChoice,
    deleteSingleWithChoice,
    renameItem,
    createFolder,
    createFile,
    compressSelected,
    extractArchive,
    hideItem,
    unhideItem,
    toggleFavorite,
    clipboard,
    setClipboard,
    clearClipboard,
    pasteClipboard,
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
  const [hasAllFilesAccess, setHasAllFilesAccess] = useState<boolean>(true);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const [setPinModalVisible, setSetPinModalVisible] = useState(false);
  const [pendingVaultItem, setPendingVaultItem] = useState<FileItemType | null>(null);
  const [pendingBatchVault, setPendingBatchVault] = useState(false);

  // Two-Finger Top-to-Bottom Slide to Open Private Folder / Vault
  const isNavigatingToVaultRef = useRef(false);
  const pullDistanceAnim = useRef(new Animated.Value(0)).current;

  const twoFingerSlideResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponderCapture: (evt) => {
          return evt.nativeEvent.touches && evt.nativeEvent.touches.length === 2;
        },
        onMoveShouldSetPanResponderCapture: (evt, gesture) => {
          const numTouches = evt.nativeEvent.touches?.length || gesture.numberActiveTouches;
          return numTouches === 2 && gesture.dy > 10;
        },
        onPanResponderGrant: () => {
          pullDistanceAnim.setValue(0);
        },
        onPanResponderMove: (_evt, gesture) => {
          if (gesture.dy > 0) {
            pullDistanceAnim.setValue(Math.min(90, gesture.dy));
          }
          if (gesture.dy > 65 && !isNavigatingToVaultRef.current) {
            isNavigatingToVaultRef.current = true;
            navigation.navigate('PrivateVaultScreen');
            setTimeout(() => {
              isNavigatingToVaultRef.current = false;
              Animated.spring(pullDistanceAnim, { toValue: 0, useNativeDriver: true }).start();
            }, 800);
          }
        },
        onPanResponderRelease: () => {
          Animated.spring(pullDistanceAnim, { toValue: 0, useNativeDriver: true }).start();
          isNavigatingToVaultRef.current = false;
        },
        onPanResponderTerminate: () => {
          Animated.spring(pullDistanceAnim, { toValue: 0, useNativeDriver: true }).start();
          isNavigatingToVaultRef.current = false;
        },
      }),
    [navigation, pullDistanceAnim]
  );

  useEffect(() => {
    initialize();
    checkPermissionStatus();

    const sub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkPermissionStatus();
        // Only load if no files are currently present
        if (useFileStore.getState().recentFiles.length === 0) {
          refresh();
        }
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

  const handlePullRefresh = useCallback(async () => {
    setIsPullRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsPullRefreshing(false);
    }
  }, [refresh]);

  const displayedFiles = useMemo(() => {
    return (activeCategory === 'all' ? recentFiles : categoryFiles)
      .filter((file) => isUsefulRecentFile(file))
      .slice()
      .sort((a, b) => b.lastModified - a.lastModified);
  }, [activeCategory, recentFiles, categoryFiles]);

  const isSelectionMode = selectedFileIds.size > 0;

  // Filter pinned favorites
  const favoriteFiles = useMemo(() => {
    return displayedFiles.filter((f) => f.isFavorite);
  }, [displayedFiles]);

  // Handle hardware back on Recent screen one by one
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

  const storageUsagePercent =
    primaryVolume.totalBytes > 0
      ? primaryVolume.usedBytes / primaryVolume.totalBytes
      : 0.35;

  const handleFilePress = useCallback(
    (item: FileItemType) => {
      if (isSelectionMode) {
        toggleSelectFile(item.id);
      } else if (item.isDirectory) {
        navigation.navigate('FoldersTab');
      } else if (isImageFile(item)) {
        const currentRecents = useFileStore.getState().recentFiles;
        const imageList = currentRecents.filter((f) => isImageFile(f));
        const idx = imageList.findIndex((f) => f.id === item.id);
        navigation.navigate('ImageViewerScreen', {
          images: imageList.length > 0 ? imageList : [item],
          initialIndex: Math.max(0, idx),
        });
      } else if (isAudioFile(item)) {
        const currentRecents = useFileStore.getState().recentFiles;
        const audioList = currentRecents.filter((f) => isAudioFile(f));
        navigation.navigate('AudioPlayerScreen', {
          file: item,
          playlist: audioList.length > 0 ? audioList : [item],
        });
      } else if (isVideoFile(item)) {
        const currentRecents = useFileStore.getState().recentFiles;
        const videoList = currentRecents.filter((f) => isVideoFile(f));
        navigation.navigate('MediaPlayerScreen', {
          file: item,
          playlist: videoList.length > 0 ? videoList : [item],
        });
      } else {
        fileService.openFile(item.path, item.mimeType);
      }
    },
    [isSelectionMode, toggleSelectFile, navigation]
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
    try {
      await importFileToVault(item.path);
      useFileStore.setState((state) => ({
        recentFiles: state.recentFiles.filter((f) => f.id !== item.id && f.path !== item.path),
        files: state.files.filter((f) => f.id !== item.id && f.path !== item.path),
      }));
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
    const selected = displayedFiles.filter((f) => selectedFileIds.has(f.id) && !f.isDirectory);
    if (selected.length === 0) {
      Alert.alert('Vault Notice', 'Only files (not folders) can be locked in the Private Vault.');
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
      useFileStore.setState((state) => ({
        recentFiles: state.recentFiles.filter((f) => !selectedIds.has(f.id) && !selectedIds.has(f.path)),
        files: state.files.filter((f) => !selectedIds.has(f.id) && !selectedIds.has(f.path)),
        selectedFileIds: new Set(),
      }));
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
      const selected = displayedFiles.filter((f) => selectedFileIds.has(f.id) && !f.isDirectory);
      const selectedIds = new Set(selected.map((f) => f.id));
      try {
        await useVaultStore.getState().importFilesToVault(selected.map((item) => item.path), pin);
        useFileStore.setState((state) => ({
          recentFiles: state.recentFiles.filter((f) => !selectedIds.has(f.id) && !selectedIds.has(f.path)),
          files: state.files.filter((f) => !selectedIds.has(f.id) && !selectedIds.has(f.path)),
          selectedFileIds: new Set(),
        }));
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
        useFileStore.setState((state) => ({
          recentFiles: state.recentFiles.filter((f) => f.id !== it.id && f.path !== it.path),
          files: state.files.filter((f) => f.id !== it.id && f.path !== it.path),
        }));
        fileService.clearDirectoryCache();
      } catch (e: any) {
        Alert.alert('Vault Error', e?.message || 'Failed to lock file in vault');
      }
    }
  };

  // Share batch files
  const handleBatchShare = () => {
    const selected = displayedFiles.filter((f) => selectedFileIds.has(f.id) && !f.isDirectory);
    if (selected.length > 0) {
      fileService.shareFiles(selected.map((s) => s.path));
    }
  };

  const handleSelectAll = useCallback(() => {
    if (selectedFileIds.size === displayedFiles.length) {
      clearSelection();
    } else {
      useFileStore.setState({ selectedFileIds: new Set(displayedFiles.map((f) => f.id)) });
    }
  }, [selectedFileIds.size, displayedFiles, clearSelection]);

  const renderListHeader = useMemo(() => (
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
            Used:{' '}
            <Text style={{ fontWeight: '600', color: colors.text }}>
              {formatBytes(primaryVolume.usedBytes)}
            </Text>
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            Free:{' '}
            <Text style={{ fontWeight: '600', color: colors.text }}>
              {formatBytes(primaryVolume.freeBytes)}
            </Text>
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

      {/* Pinned Favorites Quick Access Strip */}
      {favoriteFiles.length > 0 && (
        <View style={styles.favoritesSection}>
          <View style={styles.favHeaderRow}>
            <Star size={16} color="#FFB300" fill="#FFB300" style={{ marginRight: 6 }} />
            <Text style={[typography.labelMedium, { color: colors.text, fontWeight: '700' }]}>
              Pinned Favorites ({favoriteFiles.length})
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favScroll}>
            {favoriteFiles.map((fav) => (
              <TouchableOpacity
                key={fav.id}
                style={[
                  styles.favCard,
                  { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
                ]}
                onPress={() => handleFilePress(fav)}
                activeOpacity={0.7}
              >
                {fav.isDirectory ? (
                  <Folder size={18} color={colors.primary} />
                ) : (
                  <FileCode size={18} color="#00C853" />
                )}
                <Text
                  style={[typography.labelSmall, { color: colors.text, marginLeft: 6, maxWidth: 100 }]}
                  numberOfLines={1}
                >
                  {fav.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
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
          } else if (cat === 'videos') {
            navigation.navigate('VideosGalleryScreen');
          } else if (cat === 'all') {
            setActiveCategory('all');
          } else {
            navigation.navigate('CategoryFilesScreen', { category: cat });
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
  ), [
    primaryVolume,
    storageUsagePercent,
    hasAllFilesAccess,
    favoriteFiles,
    activeCategory,
    displayedFiles.length,
    colors,
    navigation,
    handleGrantPermission,
    handleFilePress,
    setActiveCategory,
  ]);

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}
      {...twoFingerSlideResponder.panHandlers}
    >
      {/* Two-finger Pull Down Indicator Banner */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.twoFingerPullBanner,
          {
            opacity: pullDistanceAnim.interpolate({
              inputRange: [0, 20, 65],
              outputRange: [0, 0.7, 1],
              extrapolate: 'clamp',
            }),
            transform: [
              {
                translateY: pullDistanceAnim.interpolate({
                  inputRange: [0, 65],
                  outputRange: [-45, 10],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.twoFingerPullPill}>
          <Lock size={16} color="#69F0AE" style={{ marginRight: 6 }} />
          <Text style={styles.twoFingerPullText}>Opening Private Folder...</Text>
        </View>
      </Animated.View>

      <Header
        title="NexFile"
        subtitle="Smart File Manager"
        showSearch
        onSearchPress={() => navigation.navigate('SearchScreen')}
        showThemeToggle
      />

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
              Ready to paste in Root Storage
            </Text>
          </View>
          <View style={styles.clipboardActions}>
            <TouchableOpacity
              style={[styles.pasteBtn, { backgroundColor: colors.primary }]}
              onPress={() => pasteClipboard('/storage/emulated/0')}
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

      <FlatList
        data={displayedFiles}
        key={viewMode}
        numColumns={viewMode === 'grid' ? 3 : 1}
        keyExtractor={keyExtractor}
        getItemLayout={viewMode === 'list' ? getItemLayout : undefined}
        renderItem={renderItem}
        extraData={selectedFileIds}
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={5}
        updateCellsBatchingPeriod={16}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl refreshing={isPullRefreshing} onRefresh={handlePullRefresh} colors={[colors.primary]} />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={renderListHeader}
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
          onShare={handleBatchShare}
          onCompress={() => setBatchCompressVisible(true)}
          onLockInVault={handleBatchLockInVault}
          onSelectAll={handleSelectAll}
          onInvertSelection={() => invertSelection(displayedFiles)}
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
            await extractArchive(item.path);
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
          await createFolder(name, '/storage/emulated/0');
          setCreateItemVisible(false);
        }}
        onCreateFile={async (name, content) => {
          await createFile(name, content, '/storage/emulated/0');
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
            const path = deleteTarget.path;
            setDeleteTarget(null);
            await deleteSingleWithChoice(path, permanent);
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
            await compressSelected(zipName, '/storage/emulated/0');
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
          await compressSelected(zipName, '/storage/emulated/0');
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
  favoritesSection: {
    marginHorizontal: spacing.base,
    marginTop: spacing.md,
  },
  favHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  favScroll: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  favCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  // Two-Finger Pull Down Indicator Banner
  twoFingerPullBanner: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  twoFingerPullPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E1E24',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#69F0AE',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  twoFingerPullText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
