import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, History, X, Clock, FileSearch } from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { SearchBar } from '../../components/common/SearchBar';
import { FileItem } from '../../components/file/FileItem';
import { FileDetailsModal } from '../../components/dialogs/FileDetailsModal';
import { EmptyState } from '../../components/common/EmptyState';
import { FileItem as FileItemType } from '../../types/file';
import { fileService } from '../../services/filesystem/fileService';
import { isImageFile, isAudioFile, isVideoFile } from '../../utils/fileTypes';

const PREF_KEY_RECENT_SEARCH_FILES = 'NEX_RECENT_SEARCHED_FILES_V1';
const PREF_KEY_RECENT_QUERIES = 'NEX_RECENT_QUERIES_V1';

export const SearchScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();

  const [query, setQuery] = useState<string>(route?.params?.initialQuery || '');
  const [results, setResults] = useState<FileItemType[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);
  const [recentSearchedFiles, setRecentSearchedFiles] = useState<FileItemType[]>([]);
  const [detailsItem, setDetailsItem] = useState<FileItemType | null>(null);

  // Load saved recent searched files and queries on mount
  useEffect(() => {
    Promise.all([
      fileService.getPreference(PREF_KEY_RECENT_SEARCH_FILES, '[]'),
      fileService.getPreference(PREF_KEY_RECENT_QUERIES, '["mp3", "download", "screenshot", ".pdf"]'),
    ]).then(([rawFiles, rawQueries]) => {
      try {
        if (rawFiles && rawFiles.trim().length > 0) {
          const list = JSON.parse(rawFiles);
          if (Array.isArray(list)) {
            setRecentSearchedFiles(list);
          }
        }
      } catch (e) {
        console.warn('Failed to parse recent search files:', e);
      }

      try {
        if (rawQueries && rawQueries.trim().length > 0) {
          const queries = JSON.parse(rawQueries);
          if (Array.isArray(queries)) {
            setRecentQueries(queries);
          }
        }
      } catch (e) {
        console.warn('Failed to parse recent queries:', e);
      }
    });
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const found = await fileService.searchFiles(q);
      setResults(found);
    } catch {
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 150);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleSelectRecentQuery = (item: string) => {
    setQuery(item);
  };

  const handleRemoveRecentQuery = (item: string) => {
    setRecentQueries((prev) => {
      const next = prev.filter((q) => q !== item);
      fileService.savePreference(PREF_KEY_RECENT_QUERIES, JSON.stringify(next));
      return next;
    });
  };

  const handleClearAllQueries = () => {
    setRecentQueries([]);
    fileService.savePreference(PREF_KEY_RECENT_QUERIES, '[]');
  };

  const saveQueryToHistory = (searchedText: string) => {
    const trimmed = searchedText.trim();
    if (!trimmed) return;
    setRecentQueries((prev) => {
      const next = [
        trimmed,
        ...prev.filter((q) => q.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, 10);
      fileService.savePreference(PREF_KEY_RECENT_QUERIES, JSON.stringify(next));
      return next;
    });
  };

  const addFileToSearchHistory = (file: FileItemType) => {
    setRecentSearchedFiles((prev) => {
      const filtered = prev.filter((item) => item.path !== file.path && item.id !== file.id);
      const next = [file, ...filtered].slice(0, 30);
      fileService.savePreference(PREF_KEY_RECENT_SEARCH_FILES, JSON.stringify(next));
      return next;
    });
  };

  const handleClearRecentSearchedFiles = () => {
    setRecentSearchedFiles([]);
    fileService.savePreference(PREF_KEY_RECENT_SEARCH_FILES, '[]');
  };

  const handleFilePress = (f: FileItemType) => {
    Keyboard.dismiss();
    addFileToSearchHistory(f);
    if (query.trim()) {
      saveQueryToHistory(query.trim());
    }

    const activeList = query.trim() ? results : recentSearchedFiles;

    if (f.isDirectory) {
      navigation.navigate('FoldersTab');
    } else if (isImageFile(f)) {
      const images = activeList.filter((x) => isImageFile(x));
      const idx = images.findIndex((x) => x.id === f.id);
      navigation.navigate('ImageViewerScreen', {
        images: images.length > 0 ? images : [f],
        initialIndex: Math.max(0, idx),
      });
    } else if (isAudioFile(f)) {
      const audios = activeList.filter((x) => isAudioFile(x));
      navigation.navigate('AudioPlayerScreen', {
        file: f,
        playlist: audios.length > 0 ? audios : [f],
      });
    } else if (isVideoFile(f)) {
      const videos = activeList.filter((x) => isVideoFile(x));
      navigation.navigate('MediaPlayerScreen', {
        file: f,
        playlist: videos.length > 0 ? videos : [f],
      });
    } else {
      fileService.openFile(f.path, f.mimeType);
    }
  };

  const isQueryActive = Boolean(query.trim());
  const displayedData = isQueryActive ? results : recentSearchedFiles;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Search Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.searchBarWrapper}>
          <SearchBar
            value={query}
            onChangeText={setQuery}
            autoFocus
            placeholder="Search files by name or extension..."
            onClear={() => setQuery('')}
          />
        </View>
      </View>

      {/* Main List */}
      <FlatList
        data={displayedData}
        keyExtractor={(item) => item.id || item.path}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {/* Recent Searches Tag Cloud (only shown when query is empty) */}
            {!isQueryActive && recentQueries.length > 0 && (
              <View style={styles.recentQueriesContainer}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleWithIcon}>
                    <History size={16} color={colors.textMuted} />
                    <Text style={[typography.labelMedium, { color: colors.textMuted, marginLeft: 6 }]}>
                      RECENT SEARCHES
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleClearAllQueries}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                      Clear All
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.recentQueriesWrap}>
                  {recentQueries.map((item) => (
                    <TouchableOpacity
                      key={item}
                      style={[styles.recentChip, { backgroundColor: colors.surfaceVariant }]}
                      onPress={() => handleSelectRecentQuery(item)}
                      activeOpacity={0.7}
                    >
                      <History size={13} color={colors.textMuted} />
                      <Text style={[typography.bodySmall, { color: colors.text, marginHorizontal: 6 }]}>
                        {item}
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveRecentQuery(item)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <X size={12} color={colors.textMuted} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Results or Recent Search Files Header */}
            <View style={styles.resultsHeader}>
              {!isQueryActive ? (
                recentSearchedFiles.length > 0 ? (
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleWithIcon}>
                      <Clock size={16} color={colors.primary} />
                      <Text style={[typography.labelMedium, { color: colors.text, fontWeight: '700', marginLeft: 6 }]}>
                        RECENT SEARCH FILES ({recentSearchedFiles.length})
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleClearRecentSearchedFiles}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                        Clear All
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null
              ) : (
                <View style={styles.sectionTitleWithIcon}>
                  <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>
                    {isSearching
                      ? 'Searching files...'
                      : `${results.length} result(s) found for "${query}"`}
                  </Text>
                </View>
              )}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <FileItem
            item={item}
            onPress={handleFilePress}
            onLongPress={(f) => setDetailsItem(f)}
            onMorePress={(f) => setDetailsItem(f)}
            isSelected={false}
            isSelectionMode={false}
          />
        )}
        ListEmptyComponent={
          isQueryActive ? (
            !isSearching ? (
              <EmptyState
                title="No Files Found"
                description={`No files matching "${query}" were found on storage.`}
              />
            ) : null
          ) : recentSearchedFiles.length === 0 ? (
            <EmptyState
              title="No Recent Search Files"
              description="Files you search for and open will appear here."
              icon={<FileSearch size={48} color={colors.textMuted} />}
            />
          ) : null
        }
      />

      <FileDetailsModal
        visible={Boolean(detailsItem)}
        item={detailsItem}
        onClose={() => setDetailsItem(null)}
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
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    padding: spacing.xs,
    marginRight: spacing.sm,
  },
  searchBarWrapper: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  recentQueriesContainer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recentQueriesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  resultsHeader: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
});
