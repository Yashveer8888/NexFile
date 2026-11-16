import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, History, X } from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { SearchBar } from '../../components/common/SearchBar';
import { CategoryChips } from '../../components/file/CategoryChips';
import { FileItem } from '../../components/file/FileItem';
import { FileDetailsModal } from '../../components/dialogs/FileDetailsModal';
import { EmptyState } from '../../components/common/EmptyState';
import { FileItem as FileItemType, FileCategory } from '../../types/file';
import { fileService } from '../../services/filesystem/fileService';
import { isImageFile } from '../../utils/fileTypes';

export const SearchScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const [query, setQuery] = useState(route.params?.initialQuery || '');
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>(
    (route.params?.category as FileCategory) || 'all'
  );
  const [results, setResults] = useState<FileItemType[]>([]);
  const [recentQueries, setRecentQueries] = useState<string[]>([
    'invoice',
    'presentation',
    'screenshot',
    'apk',
    '.pdf',
  ]);
  const [detailsItem, setDetailsItem] = useState<FileItemType | null>(null);

  useEffect(() => {
    performSearch();
  }, [query, selectedCategory]);

  const performSearch = async () => {
    let files: FileItemType[] = [];
    if (selectedCategory !== 'all') {
      files = await fileService.getFilesByCategory(selectedCategory);
      if (query.trim()) {
        const q = query.toLowerCase().trim();
        files = files.filter((f) => f.name.toLowerCase().includes(q));
      }
    } else {
      files = await fileService.searchFiles(query);
    }
    setResults(files);
  };

  const handleSelectRecentQuery = (item: string) => {
    setQuery(item);
  };

  const handleRemoveRecentQuery = (item: string) => {
    setRecentQueries(recentQueries.filter((q) => q !== item));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Search Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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

      {/* Category filter pills */}
      <View style={{ backgroundColor: colors.surface }}>
        <CategoryChips
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          isCompact
        />
      </View>

      {/* Recent Searches (when query is empty) */}
      {!query && recentQueries.length > 0 && (
        <View style={styles.recentQueriesContainer}>
          <Text style={[typography.labelMedium, { color: colors.textMuted, marginBottom: spacing.sm }]}>
            RECENT SEARCHES
          </Text>
          <View style={styles.recentQueriesWrap}>
            {recentQueries.map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.recentChip, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => handleSelectRecentQuery(item)}
              >
                <History size={14} color={colors.textMuted} />
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

      {/* Results Header */}
      <View style={styles.resultsHeader}>
        <Text style={[typography.labelMedium, { color: colors.textSecondary }]}>
          {results.length} result(s) found
        </Text>
      </View>

      {/* Results List */}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FileItem
            item={item}
            onPress={(f) => {
              if (f.isDirectory) {
                navigation.navigate('FoldersTab');
              } else if (isImageFile(f)) {
                const imageList = results.filter((x) => isImageFile(x));
                const idx = imageList.findIndex((x) => x.id === f.id);
                navigation.navigate('ImageViewerScreen', {
                  images: imageList.length > 0 ? imageList : [f],
                  initialIndex: Math.max(0, idx),
                });
              } else {
                fileService.openFile(f.path, f.mimeType);
              }
            }}
            onLongPress={(f) => setDetailsItem(f)}
            onMorePress={(f) => setDetailsItem(f)}
            isSelected={false}
            isSelectionMode={false}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            title="No Results Found"
            description={query ? `No files matching "${query}"` : 'Type a query or select a category.'}
          />
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
  recentQueriesContainer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
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
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  resultsHeader: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
});

