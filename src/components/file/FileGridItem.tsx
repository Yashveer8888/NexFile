import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {
  CheckCircle2,
  Circle,
  Star,
} from 'lucide-react-native';
import { FileItem as FileItemType } from '../../types/file';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { formatBytes } from '../../utils/formatters';
import { FileIcon } from './FileIcon';
import { triggerHaptic } from '../../utils/haptics';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - spacing.base * 2 - spacing.md * 2) / 3;

interface FileGridItemProps {
  item: FileItemType;
  onPress: (item: FileItemType) => void;
  onLongPress: (item: FileItemType) => void;
  onMorePress: (item: FileItemType) => void;
  isSelected: boolean;
  isSelectionMode: boolean;
}

export const FileGridItem: React.FC<FileGridItemProps> = ({
  item,
  onPress,
  onLongPress,
  isSelected,
  isSelectionMode,
}) => {
  const { colors } = useThemeStore();

  const handlePress = () => {
    if (isSelectionMode) {
      triggerHaptic('selection');
    }
    onPress(item);
  };

  const handleLongPress = () => {
    triggerHaptic('medium');
    onLongPress(item);
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          width: ITEM_WIDTH,
          backgroundColor: isSelected ? colors.primaryLight : colors.card,
          borderColor: isSelected ? colors.primary : colors.cardBorder,
        },
      ]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      delayLongPress={300}
    >
      {isSelectionMode && (
        <View style={styles.selectionBadge}>
          {isSelected ? (
            <CheckCircle2 size={18} color={colors.primary} fill="#FFFFFF" />
          ) : (
            <Circle size={18} color={colors.textMuted} />
          )}
        </View>
      )}

      {item.isFavorite && (
        <View style={styles.starBadge}>
          <Star size={12} color="#F59E0B" fill="#F59E0B" />
        </View>
      )}

      <View style={styles.iconWrapper}>
        <FileIcon item={item} size={56} iconSize={28} />
      </View>

      <Text
        style={[typography.labelMedium, { color: colors.text, textAlign: 'center', marginTop: spacing.sm }]}
        numberOfLines={1}
      >
        {item.name}
      </Text>

      <Text
        style={[typography.labelSmall, { color: colors.textMuted, textAlign: 'center', marginTop: 2 }]}
        numberOfLines={1}
      >
        {item.isDirectory
          ? `${item.itemCount ?? 0} items`
          : (item.parentFolder ? `${item.parentFolder} • ${formatBytes(item.size)}` : formatBytes(item.size))}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    margin: spacing.xs,
    borderWidth: 1,
    position: 'relative',
  },
  selectionBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
  },
  starBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 2,
  },
  iconWrapper: {
    marginTop: spacing.xs,
  },
});

