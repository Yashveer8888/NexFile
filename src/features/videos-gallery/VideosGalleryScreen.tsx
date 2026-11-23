import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  BackHandler,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  Play,
  Film,
  Video as VideoIcon,
  MoreVertical,
  X,
  Check,
  CheckSquare,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react-native';
import { Alert } from 'react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { useFileStore } from '../../app/store/useFileStore';
import { useVaultStore } from '../../app/store/useVaultStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { FileItem, SortField, SortOrder } from '../../types/file';
import { fileService } from '../../services/filesystem/fileService';
import { formatBytes, formatDate, extractParentFolder, formatDuration, formatVideoDuration, getVideoQuality, formatDateTime } from '../../utils/formatters';
import { EmptyState } from '../../components/common/EmptyState';
import { FileActionSheet } from '../../components/file/FileActionSheet';
import { useVideoResumeStore } from '../../app/store/useVideoResumeStore';
import { ItemActionModal } from '../../components/dialogs/ItemActionModal';
import { DeleteChoiceModal } from '../../components/dialogs/DeleteChoiceModal';
import { RenameDialog } from '../../components/dialogs/RenameDialog';
import { CompressDialog } from '../../components/dialogs/CompressDialog';
import { FileDetailsModal } from '../../components/dialogs/FileDetailsModal';
import { ChecksumModal } from '../../components/dialogs/ChecksumModal';
import { SetVaultPinModal } from '../../components/dialogs/SetVaultPinModal';
import { SortFilterModal } from '../../components/file/SortFilterModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface VideoFolderGroup {
  name: string;
  count: number;
  totalSize: number;
  coverUri?: string;
  videos: FileItem[];
}

export const VideosGalleryScreen: React.FC<{ navigation: any; route?: any }> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();

  const [videos, setVideos] = useState<FileItem[]>(() => fileService.getCachedVideos() || []);
  const [isLoading, setIsLoading] = useState<boolean>(() => !fileService.hasCachedVideos());
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const {
    renameItem,
    deleteSingleWithChoice,
    compressSelected,
    hideItem,
    unhideItem,
    toggleFavorite,
    setClipboard,
  } = useFileStore();

  const [actionModalItem, setActionModalItem] = useState<FileItem | null>(null);
  const [detailsItem, setDetailsItem] = useState<FileItem | null>(null);
  const [renameItemTarget, setRenameItemTarget] = useState<FileItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FileItem | null>(null);
  const [compressTargetItem, setCompressTargetItem] = useState<FileItem | null>(null);
  const [checksumItem, setChecksumItem] = useState<FileItem | null>(null);
  const [setPinModalVisible, setSetPinModalVisible] = useState(false);
  const [pendingVaultItem, setPendingVaultItem] = useState<FileItem | null>(null);

  // Multi-select & view tab states
  const [activeTab, setActiveTab] = useState<'folders' | 'all'>('folders');
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const isSelectionMode = selectedFileIds.size > 0;
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [pendingBatchVault, setPendingBatchVault] = useState(false);

  // Persistent Video Sorting Preference
  const PREF_KEY_VIDEOS_SORT_BY = 'NEX_VIDEOS_SORT_BY';
  const PREF_KEY_VIDEOS_SORT_ORDER = 'NEX_VIDEOS_SORT_ORDER';
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [sortModalVisible, setSortModalVisible] = useState(false);

  useEffect(() => {
    Promise.all([
      fileService.getPreference(PREF_KEY_VIDEOS_SORT_BY, 'date'),
      fileService.getPreference(PREF_KEY_VIDEOS_SORT_ORDER, 'desc'),
    ]).then(([savedSortBy, savedSortOrder]) => {
      if (savedSortBy) setSortBy(savedSortBy as SortField);
      if (savedSortOrder) setSortOrder(savedSortOrder as SortOrder);
    });
  }, []);

  const handleSortChange = (field: SortField, order: SortOrder) => {
    setSortBy(field);
    setSortOrder(order);
    fileService.savePreference(PREF_KEY_VIDEOS_SORT_BY, field);
    fileService.savePreference(PREF_KEY_VIDEOS_SORT_ORDER, order);
  };

  const handleLockInVault = async (item: FileItem) => {
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
      await importFileToVault(item.path, '0000');
      Alert.alert('Vault Secured', `"${item.name}" locked in Private Folder.`);
      loadVideos();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to lock file in vault');
    }
  };

  const handlePinCreated = async (pin: string) => {
    useVaultStore.getState().setPin(pin, true);
    setSetPinModalVisible(false);
    if (pendingBatchVault) {
      setPendingBatchVault(false);
      const list = activeTab === 'folders' && selectedFolder && currentFolderData ? currentFolderData.videos : videos;
      const selected = list.filter((f) => selectedFileIds.has(f.id));
      await useVaultStore.getState().importFilesToVault(selected.map((item) => item.path), pin);
      clearSelection();
      Alert.alert('Passcode Set & Secured', `${selected.length} video(s) locked in Private Folder.`);
      loadVideos();
    } else if (pendingVaultItem) {
      const it = pendingVaultItem;
      setPendingVaultItem(null);
      await useVaultStore.getState().importFileToVault(it.path, pin);
      Alert.alert('Passcode Set & Secured', `"${it.name}" locked in Private Folder.`);
      loadVideos();
    }
  };

  // Video Resume Store (LATEST WATCHED VIDEO, RESUME MAP & PROGRESS)
  const lastWatched = useVideoResumeStore((state) => state.lastWatched);
  const resumeMap = useVideoResumeStore((state) => state.resumeMap);
  const activeResumeVideo = lastWatched?.file || (videos.length > 0 ? videos[0] : null);
  const activeResumePos = lastWatched?.file ? lastWatched.position : 0;

  const loadVideos = async (force: boolean = false) => {
    const hasCache = fileService.hasCachedVideos();
    if (!hasCache || force) {
      setIsLoading(true);
    }
    try {
      const all = await fileService.getAllVideos(force);
      setVideos((prev) => {
        if (!force && prev.length === all.length && prev.length > 0) {
          if (prev[0]?.id === all[0]?.id && prev[0]?.lastModified === all[0]?.lastModified) {
            return prev;
          }
        }
        return all;
      });
    } catch (e) {
      console.warn('Failed to load videos:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadVideos(false);
    useVideoResumeStore.getState().hydrate();
  }, []);

  // Group videos by CLEAN last folder name ONLY (never full path)
  const folderGroups = useMemo<VideoFolderGroup[]>(() => {
    const groups: { [folderName: string]: FileItem[] } = {};

    for (const vid of videos) {
      let folder = vid.parentFolder && vid.parentFolder.trim().length > 0
        ? vid.parentFolder
        : extractParentFolder(vid.path) || 'Other';

      // Clean up common system representations to simple names
      if (folder === '0' || folder === 'emulated' || folder === 'sdcard') {
        folder = 'Internal Storage';
      } else if (folder.toLowerCase() === 'sent' || folder.toLowerCase() === 'private') {
        // If in WhatsApp Video subfolder, group into WhatsApp Video
        folder = 'WhatsApp Video';
      }

      if (!groups[folder]) {
        groups[folder] = [];
      }
      groups[folder].push(vid);
    }

    return Object.keys(groups)
      .map((folderName) => {
        const folderVideos = groups[folderName].sort((a, b) => b.lastModified - a.lastModified);
        const totalSize = folderVideos.reduce((acc, item) => acc + (item.size || 0), 0);
        return {
          name: folderName,
          count: folderVideos.length,
          totalSize,
          coverUri: folderVideos[0]?.thumbnailUri || `file://${folderVideos[0]?.path}`,
          videos: folderVideos,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [videos]);

  // Current selected folder data
  const currentFolderData = useMemo(() => {
    if (!selectedFolder) return null;
    return folderGroups.find((g) => g.name === selectedFolder) || null;
  }, [selectedFolder, folderGroups]);

  const currentVideosList = useMemo(() => {
    const raw =
      activeTab === 'folders' && selectedFolder && currentFolderData
        ? currentFolderData.videos
        : videos;
    return fileService.sortFiles(raw, sortBy, sortOrder);
  }, [activeTab, selectedFolder, currentFolderData, videos, sortBy, sortOrder]);

  const toggleSelect = (id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedFileIds.size === currentVideosList.length) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(currentVideosList.map((v) => v.id)));
    }
  };

  const invertSelection = () => {
    const next = new Set<string>();
    currentVideosList.forEach((v) => {
      if (!selectedFileIds.has(v.id)) next.add(v.id);
    });
    setSelectedFileIds(next);
  };

  const clearSelection = () => {
    setSelectedFileIds(new Set());
  };

  const handleBatchDelete = async (permanent: boolean) => {
    const selected = currentVideosList.filter((v) => selectedFileIds.has(v.id));
    const selectedIds = new Set(selected.map((v) => v.id));
    const selectedPaths = selected.map((v) => v.path);
    // Instant optimistic update in 0ms
    setVideos((prev) => prev.filter((v) => !selectedIds.has(v.id) && !selectedIds.has(v.path)));
    setConfirmBatchDelete(false);
    clearSelection();
    fileService.clearDirectoryCache();
    Promise.all(selectedPaths.map((p) => fileService.delete(p, !permanent))).catch(console.warn);
  };

  const handleBatchLockInVault = async () => {
    if (!useVaultStore.getState().isHydrated) {
      await useVaultStore.getState().hydrate();
    }
    const { isPinSet, importFilesToVault } = useVaultStore.getState();
    const selected = currentVideosList.filter((v) => selectedFileIds.has(v.id));
    if (selected.length === 0) return;

    if (!isPinSet) {
      setPendingBatchVault(true);
      setSetPinModalVisible(true);
      return;
    }

    const selectedIds = new Set(selected.map((v) => v.id));
    try {
      await importFilesToVault(selected.map((item) => item.path));
      setVideos((prev) => prev.filter((v) => !selectedIds.has(v.id) && !selectedIds.has(v.path)));
      clearSelection();
      fileService.clearDirectoryCache();
      loadVideos();
    } catch (e: any) {
      Alert.alert('Vault Error', e?.message || 'Failed to lock videos in vault');
    }
  };

  const handleBatchShare = () => {
    const selected = currentVideosList.filter((v) => selectedFileIds.has(v.id));
    if (selected.length > 0) {
      fileService.shareFiles(selected.map((s) => s.path));
    }
  };

  // Handle hardware back one-by-one and re-hydrate resume store on focus
  useFocusEffect(
    useCallback(() => {
      useVideoResumeStore.getState().hydrate();
      const onBackPress = () => {
        if (isSelectionMode) {
          clearSelection();
          return true;
        }
        if (confirmBatchDelete) {
          setConfirmBatchDelete(false);
          return true;
        }
        if (deleteTarget) {
          setDeleteTarget(null);
          return true;
        }
        if (setPinModalVisible) {
          setSetPinModalVisible(false);
          return true;
        }
        if (actionModalItem) {
          setActionModalItem(null);
          return true;
        }
        if (selectedFolder) {
          setSelectedFolder(null);
          return true;
        }
        if (activeTab === 'all') {
          setActiveTab('folders');
          return true;
        }
        navigation.goBack();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [
      isSelectionMode,
      confirmBatchDelete,
      deleteTarget,
      setPinModalVisible,
      actionModalItem,
      selectedFolder,
      activeTab,
      navigation,
    ])
  );

  const handlePlayVideo = (item: FileItem, playlist: FileItem[]) => {
    // Immediately mark as watched so NEW badge is removed on click
    useVideoResumeStore.getState().markAsWatched(item);
    navigation.navigate('MediaPlayerScreen', {
      file: item,
      playlist,
    });
  };

  const handleTopBackPress = () => {
    if (isSelectionMode) {
      clearSelection();
    } else if (selectedFolder) {
      setSelectedFolder(null);
    } else if (activeTab === 'all') {
      setActiveTab('folders');
    } else {
      navigation.goBack();
    }
  };

  const renderVideoItem = ({ item }: { item: FileItem }) => {
    const entry = resumeMap[item.path];
    const pos = typeof entry === 'number' ? entry : entry?.position || 0;
    const resumeDur = typeof entry === 'object' ? entry?.duration || 0 : 0;
    const videoDur = item.duration || resumeDur || 0;
    const completed = typeof entry === 'object' ? !!entry?.completed : false;
    const watched = typeof entry === 'object' ? !!entry?.watched : false;
    const isWatched = watched || completed || pos > 0;
    const ratio = completed ? 1.0 : videoDur > 0 ? Math.min(1.0, pos / videoDur) : pos > 0 ? 0.35 : 0;
    const isSelected = selectedFileIds.has(item.id);

    const durStr = formatVideoDuration(videoDur);
    const qualityBadge = getVideoQuality(item.width, item.height);
    const dateTimeStr = formatDateTime(item.lastModified);

    return (
      <TouchableOpacity
        style={[
          styles.videoTile,
          { backgroundColor: colors.surface },
          isSelected && { borderWidth: 2, borderColor: colors.primary },
        ]}
        onPress={() => {
          if (isSelectionMode) {
            toggleSelect(item.id);
          } else {
            handlePlayVideo(item, currentVideosList);
          }
        }}
        onLongPress={() => toggleSelect(item.id)}
        activeOpacity={0.75}
      >
        {/* Selection Check Badge */}
        {isSelectionMode && (
          <View
            style={[
              styles.videoSelectionBadge,
              isSelected
                ? { backgroundColor: colors.primary }
                : { backgroundColor: 'rgba(0,0,0,0.35)', borderWidth: 1.5, borderColor: '#FFFFFF' },
            ]}
          >
            {isSelected && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
          </View>
        )}

        {/* Thumbnail with Video Play Badge, Duration Badge, Watched Progress Bar, or NEW Tag */}
        <View style={styles.videoThumbBox}>
          <Image
            source={{ uri: item.thumbnailUri || `file://${item.path}` }}
            style={styles.videoThumb}
            resizeMode="cover"
          />
          <View style={styles.playOverlayBadge}>
            <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
          </View>

          {/* Duration Badge on thumbnail corner */}
          {videoDur > 0 && (
            <View style={styles.thumbDurationBadge}>
              <Text style={styles.thumbDurationText}>{durStr}</Text>
            </View>
          )}

          {/* 1. Progress Bar under thumbnail for watched videos */}
          {isWatched && ratio > 0 && (
            <View style={styles.thumbProgressTrack}>
              <View
                style={[
                  styles.thumbProgressFill,
                  { width: `${Math.max(6, Math.min(100, Math.round(ratio * 100)))}%` },
                ]}
              />
            </View>
          )}

          {/* 2. NEW Badge on thumbnail for unwatched videos */}
          {!isWatched && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
        </View>

        {/* Video Info - Displays Name, Size, Duration, Quality Badge, and Date/Time */}
        <View style={styles.videoTileBody}>
          <Text
            style={[
              typography.labelLarge,
              isWatched ? styles.videoTitleWatched : styles.videoTitleBright,
            ]}
            numberOfLines={1}
          >
            {item.name}
          </Text>

          {/* Video Metadata: Size • Duration • Quality • Extension */}
          <View style={[styles.videoMetaRow, isWatched && { opacity: 0.7 }]}>
            <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
              {formatBytes(item.size)}
            </Text>

            {videoDur > 0 && (
              <>
                <Text style={[typography.labelSmall, { color: colors.textMuted, marginHorizontal: 4 }]}>
                  •
                </Text>
                <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
                  {durStr}
                </Text>
              </>
            )}
            
            {Boolean(qualityBadge) && (
              <View style={[styles.qualityBadge, { backgroundColor: `${colors.primary}1A`, borderColor: `${colors.primary}50` }]}>
                <Text style={[styles.qualityBadgeText, { color: colors.primary }]}>
                  {qualityBadge}
                </Text>
              </View>
            )}

            <Text style={[typography.labelSmall, { color: colors.textMuted, marginHorizontal: 4 }]}>
                  •
            </Text>
            <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
              {dateTimeStr}
            </Text>
          </View>
        </View>

        {/* 3-Dots Menu Button */}
        {!isSelectionMode && (
          <TouchableOpacity
            style={{ padding: 10, alignSelf: 'center' }}
            onPress={() => setActionModalItem(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MoreVertical size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" />

      {/* Screen Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        {isSelectionMode ? (
          <>
            <TouchableOpacity
              onPress={clearSelection}
              style={styles.backBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <X size={26} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.headerTitleBox}>
              <Text style={[typography.h4, { color: colors.text, fontWeight: '700' }]}>
                {selectedFileIds.size} Selected
              </Text>
            </View>

            <View style={styles.headerSelectionControls}>
              <TouchableOpacity
                onPress={invertSelection}
                style={[styles.headerControlBtn, { backgroundColor: colors.surfaceVariant }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <RefreshCw size={14} color={colors.primary} />
                <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: 4 }]}>
                  Invert
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={selectAll}
                style={[styles.headerControlBtn, { backgroundColor: colors.surfaceVariant, marginLeft: 8 }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <CheckSquare size={14} color={colors.primary} />
                <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: 4 }]}>
                  {selectedFileIds.size === currentVideosList.length ? 'Clear' : 'All'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <TouchableOpacity
              onPress={handleTopBackPress}
              style={styles.backBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <ChevronLeft size={28} color={colors.text} />
            </TouchableOpacity>

            <View style={styles.headerTitleBox}>
              <Text style={[typography.h3, { color: colors.text }]} numberOfLines={1}>
                {selectedFolder ? selectedFolder : activeTab === 'all' ? 'All Videos' : 'Video Folders'}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 1 }]}>
                {selectedFolder && currentFolderData
                  ? `${currentFolderData.count} videos • ${formatBytes(currentFolderData.totalSize)}`
                  : activeTab === 'all'
                  ? `${videos.length} videos`
                  : `${folderGroups.length} folders • ${videos.length} videos`}
              </Text>
            </View>

            {(selectedFolder || activeTab === 'all') && currentVideosList.length > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity
                  onPress={() => setSortModalVisible(true)}
                  style={[styles.selectHeaderBtn, { backgroundColor: colors.surfaceVariant }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <SlidersHorizontal size={14} color={colors.primary} />
                  <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: 4, fontWeight: '700' }]}>
                    Sort
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    if (currentVideosList.length > 0) {
                      toggleSelect(currentVideosList[0].id);
                    }
                  }}
                  style={[styles.selectHeaderBtn, { backgroundColor: colors.surfaceVariant }]}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <CheckSquare size={14} color={colors.primary} />
                  <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: 4, fontWeight: '700' }]}>
                    Select
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      {/* Main Content */}
      <View style={styles.contentArea}>
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 12 }]}>
              Scanning all videos on device...
            </Text>
          </View>
        ) : selectedFolder && currentFolderData ? (
          /* 1. Selected Folder Videos View */
          <FlatList
            data={currentVideosList}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.videosListContent}
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={() => loadVideos(true)} colors={[colors.primary]} />
            }
            ListEmptyComponent={
              <EmptyState
                title="No Videos in Folder"
                description={`There are no video files in ${selectedFolder}`}
                icon={<Film size={44} color={colors.textMuted} />}
              />
            }
            renderItem={renderVideoItem}
          />
        ) : activeTab === 'all' ? (
          /* 2. All Videos Direct List View */
          <FlatList
            data={currentVideosList}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.videosListContent}
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={() => loadVideos(true)} colors={[colors.primary]} />
            }
            ListEmptyComponent={
              <EmptyState
                title="No Videos Found"
                description="No video files discovered on device storage."
                icon={<Film size={44} color={colors.textMuted} />}
              />
            }
            renderItem={renderVideoItem}
          />
        ) : (
          /* 3. Folders List View */
          <FlatList
            data={folderGroups}
            keyExtractor={(item) => item.name}
            contentContainerStyle={styles.folderListContent}
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={() => loadVideos(true)} colors={[colors.primary]} />
            }
            ListEmptyComponent={
              <EmptyState
                title="No Video Folders Found"
                description="No folders containing video files were detected on your storage."
                icon={<Folder size={48} color={colors.textMuted} />}
              />
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.folderTile, { backgroundColor: colors.surface }]}
                onPress={() => setSelectedFolder(item.name)}
                activeOpacity={0.7}
              >
                {/* Left: Prominent Folder Icon */}
                <View style={[styles.folderIconContainer, { backgroundColor: 'rgba(255, 159, 10, 0.16)' }]}>
                  <Folder size={28} color="#FF9F0A" fill="rgba(255, 159, 10, 0.35)" />
                </View>

                {/* Center: Folder Name & Stats */}
                <View style={styles.folderTileInfo}>
                  <Text
                    style={[typography.labelLarge, styles.folderTileTitle, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  <View style={styles.folderTileStatsRow}>
                    <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
                      {item.count} {item.count === 1 ? 'video' : 'videos'}
                    </Text>
                    <Text style={[typography.labelSmall, { color: colors.textMuted, marginHorizontal: 6 }]}>
                      •
                    </Text>
                    <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
                      {formatBytes(item.totalSize)}
                    </Text>
                  </View>
                </View>            

                <ChevronRight size={20} color={colors.textMuted} style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* Selection Action Sheet OR Bottom Tabs (when no folder is open) */}
      {isSelectionMode ? (
        <FileActionSheet
          selectedCount={selectedFileIds.size}
          totalCount={currentVideosList.length}
          hideMove={true}
          onCopy={() => {
            const selected = currentVideosList.filter((f) => selectedFileIds.has(f.id));
            setClipboard('copy', selected);
          }}
          onDelete={() => setConfirmBatchDelete(true)}
          onShare={handleBatchShare}
          onLockInVault={handleBatchLockInVault}
          onSelectAll={selectAll}
          onInvertSelection={invertSelection}
          onClose={clearSelection}
        />
      ) : !selectedFolder ? (
        <View
          style={[
            styles.bottomNavContainer,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, spacing.xs),
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.bottomTabItem,
              activeTab === 'folders' && [styles.bottomTabItemActive, { backgroundColor: `${colors.primary}18` }],
            ]}
            onPress={() => setActiveTab('folders')}
            activeOpacity={0.7}
          >
            <Folder
              size={22}
              color={activeTab === 'folders' ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                typography.labelMedium,
                {
                  color: activeTab === 'folders' ? colors.primary : colors.textMuted,
                  fontWeight: activeTab === 'folders' ? '700' : '500',
                  marginTop: 2,
                },
              ]}
            >
              Folders
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.bottomTabItem,
              activeTab === 'all' && [styles.bottomTabItemActive, { backgroundColor: `${colors.primary}18` }],
            ]}
            onPress={() => setActiveTab('all')}
            activeOpacity={0.7}
          >
            <VideoIcon
              size={22}
              color={activeTab === 'all' ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                typography.labelMedium,
                {
                  color: activeTab === 'all' ? colors.primary : colors.textMuted,
                  fontWeight: activeTab === 'all' ? '700' : '500',
                  marginTop: 2,
                },
              ]}
            >
              All Videos
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Quick Resume FAB (Bottom-Right, only when not in selection mode) */}
      {!isSelectionMode && activeResumeVideo && (
        <TouchableOpacity
          style={[
            styles.resumeFab,
            {
              bottom: insets.bottom + (!selectedFolder ? 65 : 20),
              right: 18,
            },
          ]}
          onPress={() => {
            handlePlayVideo(
              activeResumeVideo,
              lastWatched?.playlist && lastWatched.playlist.length > 0
                ? lastWatched.playlist
                : (currentFolderData?.videos || videos)
            );
          }}
          activeOpacity={0.85}
        >
          <View style={styles.resumeFabContent}>
            <View style={styles.resumeFabIconCircle}>
              <Play size={18} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 2 }} />
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Batch Delete with Choice Dialog */}
      <DeleteChoiceModal
        visible={confirmBatchDelete}
        itemCount={selectedFileIds.size}
        onDelete={handleBatchDelete}
        onCancel={() => setConfirmBatchDelete(false)}
      />

      {/* 3-Dots Item Action Modal (Context Menu for single file/folder) */}
      <ItemActionModal
        visible={Boolean(actionModalItem)}
        item={actionModalItem}
        hideMove={true}
        onClose={() => setActionModalItem(null)}
        onOpenWith={(item) => fileService.openWith(item.path)}
        onShare={(item) => fileService.shareFiles([item.path])}
        onCopy={(item) => setClipboard('copy', [item])}
        onRename={(item) => setRenameItemTarget(item)}
        onCompress={(item) => setCompressTargetItem(item)}
        onToggleFavorite={(item) => {
          toggleFavorite(item.path);
          loadVideos();
        }}
        onToggleHide={async (item) => {
          if (item.name.startsWith('.')) {
            await unhideItem(item.path);
          } else {
            await hideItem(item.path);
          }
          loadVideos();
        }}
        onLockInVault={handleLockInVault}
        onDetails={(item) => setDetailsItem(item)}
        onChecksum={(item) => setChecksumItem(item)}
        onDelete={(item) => setDeleteTarget(item)}
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
            setVideos((prev) => prev.filter((v) => v.id !== targetId && v.path !== targetPath));
            setDeleteTarget(null);
            fileService.clearDirectoryCache();
            fileService.delete(targetPath, !permanent).catch(console.warn);
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Single Item Compress Dialog */}
      <CompressDialog
        visible={Boolean(compressTargetItem)}
        defaultName={compressTargetItem?.name ? `${compressTargetItem.name}.zip` : 'video.zip'}
        itemCount={1}
        onCompress={async (zipName) => {
          if (compressTargetItem) {
            await compressSelected(zipName, '/storage/emulated/0/DCIM');
            setCompressTargetItem(null);
            loadVideos();
          }
        }}
        onCancel={() => setCompressTargetItem(null)}
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
            setVideos((prev) =>
              prev.map((v) =>
                v.id === oldId || v.path === oldPath
                  ? { ...v, name: newName, path: newPath, id: newPath, extension: newExt }
                  : v
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

      {/* Set Vault Passcode Modal */}
      <SetVaultPinModal
        visible={setPinModalVisible}
        onPinSet={handlePinCreated}
        onCancel={() => {
          setSetPinModalVisible(false);
          setPendingVaultItem(null);
        }}
      />

      {/* Persistent Video Sort Filter Modal */}
      <SortFilterModal
        visible={sortModalVisible}
        onClose={() => setSortModalVisible(false)}
        title="Sort Videos"
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  headerTitleBox: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  // Folder List Tile Styles (Horizontal Tile / List mode)
  folderListContent: {
    padding: spacing.base,
    gap: 10,
  },
  folderTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  folderIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  folderTileInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  folderTileTitle: {
    fontWeight: '700',
    fontSize: 16,
  },
  folderTileStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  folderThumbPreviewBox: {
    width: 46,
    height: 46,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1E1E22',
  },
  folderThumbPreview: {
    width: '100%',
    height: '100%',
  },
  playMiniBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  // Inside Folder Video List Styles
  videosListContent: {
    padding: spacing.base,
    gap: 10,
  },
  videoTile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  videoThumbBox: {
    width: 78,
    height: 54,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  videoThumb: {
    width: '100%',
    height: '100%',
  },
  playOverlayBadge: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbDurationBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  thumbDurationText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  videoTileBody: {
    flex: 1,
    justifyContent: 'center',
  },
  videoMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  qualityBadge: {
    marginLeft: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 0.8,
  },
  qualityBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  formatTag: {
    marginLeft: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  formatTagText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  // Watched Progress Bar on Thumbnail
  thumbProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
  thumbProgressFill: {
    height: '100%',
    backgroundColor: '#FF3B30',
  },
  // NEW Badge on Thumbnail for unwatched videos
  newBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: '#00C853',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 1.5,
  },
  newBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Video Title Contrast States
  videoTitleBright: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  videoTitleWatched: {
    color: 'rgba(255, 255, 255, 0.45)',
    fontWeight: '500',
    fontSize: 15,
  },
  // Latest Video Quick Resume Floating Action Button (FAB)
  resumeFab: {
    position: 'absolute',
    backgroundColor: '#FF9F0A',
    borderRadius: 28,
    paddingVertical: 9,
    paddingHorizontal: 14,
    maxWidth: SCREEN_WIDTH * 0.72,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    zIndex: 999,
  },
  resumeFabContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resumeFabIconCircle: {
    width: 25,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resumeFabTextBox: {
    flexShrink: 1,
  },
  resumeFabTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  resumeFabSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 11,
    marginTop: 1,
  },
  contentArea: {
    flex: 1,
  },
  videoSelectionBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  headerSelectionControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerControlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 1,
    borderRadius: borderRadius.md,
  },
  selectHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
  },
  bottomNavContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bottomTabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  bottomTabItemActive: {
    borderRadius: borderRadius.md,
  },
});
