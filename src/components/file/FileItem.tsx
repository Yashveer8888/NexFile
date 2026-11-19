import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {
  MoreVertical,
  CheckCircle2,
  Circle,
  Star,
  Folder,
} from 'lucide-react-native';
import { FileItem as FileItemType } from '../../types/file';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { formatBytes, formatDate } from '../../utils/formatters';
import { FileIcon } from './FileIcon';
import { triggerHaptic } from '../../utils/haptics';

interface FileItemProps {
  item: FileItemType;
  onPress: (item: FileItemType) => void;
  onLongPress: (item: FileItemType) => void;
  onMorePress: (item: FileItemType) => void;
  isSelected: boolean;
  isSelectionMode: boolean;
}

export const FileItem = React.memo<FileItemProps>(
  ({
    item,
    onPress,
    onLongPress,
    onMorePress,
    isSelected,
    isSelectionMode,
  }) => {
    const { colors } = useThemeStore();

    const handlePress = useCallback(() => {
      if (isSelectionMode) {
        triggerHaptic('selection');
      }
      onPress(item);
    }, [isSelectionMode, onPress, item]);

    const handleLongPress = useCallback(() => {
      triggerHaptic('medium');
      onLongPress(item);
    }, [onLongPress, item]);

    const handleMore = useCallback(() => {
      onMorePress(item);
    }, [onMorePress, item]);

    const subtitle = item.isDirectory
      ? (item.itemCount !== undefined && item.itemCount >= 0
          ? `${item.itemCount} items • ${formatDate(item.lastModified)}`
          : `Folder • ${formatDate(item.lastModified)}`)
      : `${formatBytes(item.size)} • ${formatDate(item.lastModified)}`;

    return (
      <TouchableOpacity
        style={[
          styles.container,
          {
            backgroundColor: isSelected ? colors.primaryLight : 'transparent',
            borderBottomColor: colors.divider,
          },
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.7}
        delayLongPress={300}
      >
        {isSelectionMode && (
          <View style={styles.selectionContainer}>
            {isSelected ? (
              <CheckCircle2 size={20} color={colors.primary} fill={colors.primaryLight} />
            ) : (
              <Circle size={20} color={colors.textMuted} />
            )}
          </View>
        )}

        <FileIcon item={item} />

        <View style={styles.infoContainer}>
          <View style={styles.nameRow}>
            <Text
              style={[typography.labelLarge, { color: colors.text, flex: 1 }]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {item.isFavorite && (
              <Star size={14} color="#F59E0B" fill="#F59E0B" style={styles.starIcon} />
            )}
          </View>
          <View style={styles.metaRow}>
            <Text
              style={[typography.bodySmall, { color: colors.textMuted }]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
            {Boolean(item.parentFolder) && (
              <View style={[styles.folderBadge, { backgroundColor: colors.surfaceVariant || colors.border }]}>
                <Folder size={11} color={colors.primary} />
                <Text
                  style={[typography.labelSmall, { color: colors.primary, marginLeft: 4, fontWeight: '600' }]}
                  numberOfLines={1}
                >
                  {item.parentFolder}
                </Text>
              </View>
            )}
          </View>
        </View>

        {!isSelectionMode && (
          <TouchableOpacity
            style={styles.moreButton}
            onPress={handleMore}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MoreVertical size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  },
  (prev, next) => {
    return (
      prev.item.path === next.item.path &&
      prev.item.lastModified === next.item.lastModified &&
      prev.item.size === next.item.size &&
      prev.item.isFavorite === next.item.isFavorite &&
      prev.isSelected === next.isSelected &&
      prev.isSelectionMode === next.isSelectionMode &&
      prev.onPress === next.onPress &&
      prev.onLongPress === next.onLongPress &&
      prev.onMorePress === next.onMorePress
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectionContainer: {
    marginRight: spacing.md,
  },
  infoContainer: {
    flex: 1,
    marginLeft: spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIcon: {
    marginLeft: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 3,
  },
  folderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    maxWidth: 160,
  },
  moreButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
});

