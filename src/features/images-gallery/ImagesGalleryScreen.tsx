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
  Modal,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Image as ImageIcon,
  Folder,
  Layers,
  ArrowLeft,
  CheckCircle2,
  Share2,
  ExternalLink,
  Calendar,
  HardDrive,
  X,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { FileItem } from '../../types/file';
import { fileService } from '../../services/filesystem/fileService';
import { sharingService } from '../../services/transfer/sharingService';
import { formatBytes, formatDate } from '../../utils/formatters';
import { EmptyState } from '../../components/common/EmptyState';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_GAP = 2;
const NUM_COLUMNS = 3;
const ITEM_SIZE = (SCREEN_WIDTH - GRID_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

const ALBUM_COLUMNS = 2;
const ALBUM_GAP = 12;
const ALBUM_WIDTH = (SCREEN_WIDTH - spacing.base * 2 - ALBUM_GAP * (ALBUM_COLUMNS - 1)) / ALBUM_COLUMNS;

interface FolderGroup {
  name: string;
  count: number;
  coverUri: string;
  images: FileItem[];
}

interface TimelineHeader {
  type: 'header';
  id: string;
  title: string;
  subtitle?: string;
  count: number;
}

interface TimelineRow {
  type: 'row';
  id: string;
  items: FileItem[];
}

type TimelineItem = TimelineHeader | TimelineRow;

function getDateGroupKey(timestamp: number): string {
  if (!timestamp || timestamp <= 0) return '0000-00-00';
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatGroupDateTitle(dateKey: string): { title: string; subtitle?: string } {
  if (!dateKey || dateKey === '0000-00-00') {
    return { title: 'Earlier' };
  }
  const parts = dateKey.split('-');
  if (parts.length !== 3) return { title: dateKey };

  const year = parseInt(parts[0], 10);
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const date = new Date(year, monthIndex, day);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  const monthName = date.toLocaleDateString('en-US', { month: 'short' });

  if (isToday) {
    return { title: 'Today', subtitle: `${weekday}, ${day} ${monthName}` };
  }
  if (isYesterday) {
    return { title: 'Yesterday', subtitle: `${weekday}, ${day} ${monthName}` };
  }
  if (year === now.getFullYear()) {
    return { title: `${day} ${monthName}`, subtitle: weekday };
  }
  return { title: `${day} ${monthName} ${year}`, subtitle: weekday };
}

function buildTimelineItems(fileList: FileItem[]): TimelineItem[] {
  const sorted = [...fileList].sort((a, b) => b.lastModified - a.lastModified);
  const groups: { [key: string]: FileItem[] } = {};

  for (const item of sorted) {
    const key = getDateGroupKey(item.lastModified);
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }

  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
  const timeline: TimelineItem[] = [];

  for (const key of sortedKeys) {
    const groupItems = groups[key];
    const { title, subtitle } = formatGroupDateTitle(key);

    timeline.push({
      type: 'header',
      id: `header_${key}`,
      title,
      subtitle,
      count: groupItems.length,
    });

    for (let i = 0; i < groupItems.length; i += NUM_COLUMNS) {
      timeline.push({
        type: 'row',
        id: `row_${key}_${i}`,
        items: groupItems.slice(i, i + NUM_COLUMNS),
      });
    }
  }

  return timeline;
}

export const ImagesGalleryScreen: React.FC<{ navigation: any; route?: any }> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();

  const [images, setImages] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'all' | 'folders'>('all');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const loadImages = async () => {
    setIsLoading(true);
    try {
      const all = await fileService.getAllImages();
      setImages(all);
    } catch (e) {
      console.warn('Failed to load images:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, []);

  // Compute folder-wise groups
  const folderGroups = useMemo<FolderGroup[]>(() => {
    const groups: { [folder: string]: FileItem[] } = {};

    for (const img of images) {
      let folder = img.parentFolder && img.parentFolder.trim().length > 0
        ? img.parentFolder
        : 'Other';
      if (folder === '0' || folder === 'emulated') {
        folder = 'Internal Storage';
      }
      if (!groups[folder]) {
        groups[folder] = [];
      }
      groups[folder].push(img);
    }

    return Object.keys(groups)
      .map((name) => ({
        name,
        count: groups[name].length,
        coverUri: groups[name][0]?.thumbnailUri || `file://${groups[name][0]?.path}`,
        images: groups[name],
      }))
      .sort((a, b) => b.count - a.count);
  }, [images]);

  // Images for selected folder if drilled down
  const folderImages = useMemo(() => {
    if (!selectedFolder) return [];
    const group = folderGroups.find((g) => g.name === selectedFolder);
    return group ? group.images : [];
  }, [folderGroups, selectedFolder]);

  // All Images Timeline (Date-wise, New to Old)
  const allImagesTimeline = useMemo(() => {
    return buildTimelineItems(images);
  }, [images]);

  // Selected Folder Timeline (Date-wise, New to Old)
  const folderTimeline = useMemo(() => {
    if (!selectedFolder) return [];
    return buildTimelineItems(folderImages);
  }, [selectedFolder, folderImages]);

  // Back handling: Step-by-step one by one:
  // 1. Folder drilldown -> returns to Folder Wise albums list
  // 2. Folder Wise tab -> returns to All Images tab
  // 3. All Images tab -> returns to previous screen (Recent)
  const handleBackPress = useCallback(() => {
    if (activeTab === 'folders' && selectedFolder) {
      setSelectedFolder(null);
    } else if (activeTab === 'folders') {
      setActiveTab('all');
    } else {
      navigation.goBack();
    }
  }, [activeTab, selectedFolder, navigation]);

  // Intercept Android hardware & gesture back button so it backs up one by one
  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        if (activeTab === 'folders' && selectedFolder) {
          setSelectedFolder(null);
          return true;
        }
        if (activeTab === 'folders') {
          setActiveTab('all');
          return true;
        }
        return false;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => subscription.remove();
    }, [activeTab, selectedFolder])
  );

  const handleImagePress = (item: FileItem) => {
    const list = activeTab === 'folders' && selectedFolder ? folderImages : images;
    const idx = list.findIndex((img) => img.id === item.id);
    navigation.navigate('ImageViewerScreen', {
      images: list.length > 0 ? list : [item],
      initialIndex: Math.max(0, idx),
    });
  };

  // Render timeline item: either Date Header or Row of up to 3 photos
  const renderTimelineItem = ({ item }: { item: TimelineItem }) => {
    if (item.type === 'header') {
      return (
        <View style={[styles.timelineHeader, { backgroundColor: colors.background }]}>
          <View style={styles.timelineHeaderLeft}>
            <Text style={[typography.h4, { color: colors.text, fontWeight: '700' }]}>
              {item.title}
            </Text>
            {item.subtitle ? (
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginLeft: 8 }]}>
                {item.subtitle}
              </Text>
            ) : null}
          </View>
          <View style={[styles.timelineCountBadge, { backgroundColor: colors.surfaceVariant }]}>
            <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
              {item.count} {item.count === 1 ? 'photo' : 'photos'}
            </Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.timelineRow}>
        {item.items.map((img, idx) => {
          const uri = img.thumbnailUri || `file://${img.path}`;
          return (
            <TouchableOpacity
              key={img.id}
              style={[
                styles.photoTile,
                idx < item.items.length - 1 && { marginRight: GRID_GAP },
              ]}
              activeOpacity={0.8}
              onPress={() => handleImagePress(img)}
            >
              <Image source={{ uri }} style={styles.photoImage} resizeMode="cover" />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // Render individual folder album card
  const renderAlbumCard = ({ item }: { item: FolderGroup }) => {
    return (
      <TouchableOpacity
        style={[
          styles.albumCard,
          {
            backgroundColor: colors.card,
            borderColor: colors.cardBorder,
          },
        ]}
        activeOpacity={0.8}
        onPress={() => setSelectedFolder(item.name)}
      >
        <View style={styles.albumCoverContainer}>
          <Image
            source={{ uri: item.coverUri }}
            style={styles.albumCover}
            resizeMode="cover"
          />
          <View style={styles.albumBadge}>
            <Text style={styles.albumBadgeText}>{item.count}</Text>
          </View>
        </View>

        <View style={styles.albumMeta}>
          <Text
            style={[typography.labelMedium, { color: colors.text, fontWeight: '700' }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          <Text
            style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}
            numberOfLines={1}
          >
            {item.count} {item.count === 1 ? 'photo' : 'photos'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const titleText =
    activeTab === 'folders' && selectedFolder
      ? selectedFolder
      : activeTab === 'all'
      ? 'All Images'
      : 'Folder Wise Images';

  const subtitleText =
    activeTab === 'folders' && selectedFolder
      ? `${folderImages.length} photos`
      : `${images.length} photos`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleBackPress}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={26} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[typography.h3, { color: colors.text }]} numberOfLines={1}>
            {titleText}
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            {subtitleText}
          </Text>
        </View>
      </View>

      {/* Main Content Area */}
      <View style={styles.contentArea}>
        {isLoading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.md }]}>
              Loading images...
            </Text>
          </View>
        ) : activeTab === 'all' ? (
          // Tab 1: All Images Date-wise Timeline (New to Old)
          <FlatList
            data={allImagesTimeline}
            key="all_images_timeline"
            keyExtractor={(item) => item.id}
            renderItem={renderTimelineItem}
            contentContainerStyle={styles.timelineContent}
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            windowSize={7}
            removeClippedSubviews={true}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={loadImages}
                colors={[colors.primary]}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title="No Images Found"
                description="No pictures discovered on your device storage."
              />
            }
          />
        ) : selectedFolder ? (
          // Tab 2 (Drilled in): Images of Selected Folder (Date-wise Timeline)
          <View style={styles.flex}>
            {/* Back to folders pill bar */}
            <View style={[styles.folderBanner, { backgroundColor: colors.surfaceVariant }]}>
              <TouchableOpacity
                style={styles.folderBackAction}
                onPress={() => setSelectedFolder(null)}
              >
                <ArrowLeft size={16} color={colors.primary} />
                <Text style={[typography.labelMedium, { color: colors.primary, marginLeft: 6 }]}>
                  All Folders
                </Text>
              </TouchableOpacity>
              <Text style={[typography.labelSmall, { color: colors.textMuted }]}>
                {folderImages.length} images
              </Text>
            </View>

            <FlatList
              data={folderTimeline}
              key={`folder_timeline_${selectedFolder}`}
              keyExtractor={(item) => item.id}
              renderItem={renderTimelineItem}
              contentContainerStyle={styles.timelineContent}
              initialNumToRender={15}
              maxToRenderPerBatch={15}
              windowSize={7}
              removeClippedSubviews={true}
            />
          </View>
        ) : (
          // Tab 2: Folder Wise Albums Grid
          <FlatList
            data={folderGroups}
            key="folder_wise_albums"
            numColumns={ALBUM_COLUMNS}
            keyExtractor={(item) => item.name}
            renderItem={renderAlbumCard}
            contentContainerStyle={styles.albumContent}
            refreshControl={
              <RefreshControl
                refreshing={isLoading}
                onRefresh={loadImages}
                colors={[colors.primary]}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title="No Image Folders"
                description="No image directories found."
              />
            }
          />
        )}
      </View>

      {/* Bottom Navigation with 2 Options: All Images, Folder Wise Images */}
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
            activeTab === 'all' && [styles.bottomTabItemActive, { backgroundColor: `${colors.primary}18` }],
          ]}
          onPress={() => {
            setActiveTab('all');
            setSelectedFolder(null);
          }}
          activeOpacity={0.7}
        >
          <ImageIcon
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
            All Images
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.bottomTabItem,
            activeTab === 'folders' && [styles.bottomTabItemActive, { backgroundColor: `${colors.primary}18` }],
          ]}
          onPress={() => {
            setActiveTab('folders');
          }}
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
            Folder Wise Images
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
  },
  backButton: {
    marginRight: spacing.md,
  },
  headerTitleContainer: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContent: {
    paddingVertical: GRID_GAP,
  },
  photoTile: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    backgroundColor: '#1E1E1E',
  },
  timelineContent: {
    paddingBottom: spacing.base,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.xs,
  },
  timelineHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
  },
  timelineCountBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: GRID_GAP,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  albumContent: {
    padding: spacing.base,
    gap: ALBUM_GAP,
  },
  albumCard: {
    width: ALBUM_WIDTH,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: ALBUM_GAP,
  },
  albumCoverContainer: {
    width: '100%',
    height: ALBUM_WIDTH * 0.9,
    position: 'relative',
    backgroundColor: '#2A2A2A',
  },
  albumCover: {
    width: '100%',
    height: '100%',
  },
  albumBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  albumBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  albumMeta: {
    padding: spacing.sm,
  },
  folderBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  folderBackAction: {
    flexDirection: 'row',
    alignItems: 'center',
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
  contentArea: {
    flex: 1,
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
  previewContainer: {
    flex: 1,
  },
  previewTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    zIndex: 10,
  },
  previewActionBtn: {
    padding: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewTitleContainer: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  previewFileName: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  previewActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewFullImage: {
    width: '100%',
    height: '100%',
  },
  previewBottomBar: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    zIndex: 10,
  },
  previewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewMetaText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    marginLeft: 6,
  },
});
