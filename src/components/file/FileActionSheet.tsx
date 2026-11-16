import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Copy,
  Move,
  Trash2,
  Share2,
  Edit3,
  Hash,
  CheckSquare,
  X,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';

interface FileActionSheetProps {
  selectedCount: number;
  totalCount: number;
  onCopy: () => void;
  onMove: () => void;
  onDelete: () => void;
  onShare: () => void;
  onRename?: () => void;
  onChecksum?: () => void;
  onSelectAll: () => void;
  onClose: () => void;
}

export const FileActionSheet: React.FC<FileActionSheetProps> = ({
  selectedCount,
  totalCount,
  onCopy,
  onMove,
  onDelete,
  onShare,
  onRename,
  onChecksum,
  onSelectAll,
  onClose,
}) => {
  const { colors } = useThemeStore();

  if (selectedCount === 0) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[typography.labelLarge, { color: colors.text }]}>
          {selectedCount} selected
        </Text>
        <TouchableOpacity
          onPress={onSelectAll}
          style={styles.selectAllButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <CheckSquare size={18} color={colors.primary} />
          <Text style={[typography.labelMedium, { color: colors.primary, marginLeft: 4 }]}>
            {selectedCount === totalCount ? 'Clear' : 'All'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actionsRow}
      >
        <TouchableOpacity style={styles.actionItem} onPress={onShare} activeOpacity={0.7}>
          <View style={[styles.actionIconCircle, { backgroundColor: colors.surfaceVariant }]}>
            <Share2 size={18} color={colors.text} />
          </View>
          <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>
            Share
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem} onPress={onCopy} activeOpacity={0.7}>
          <View style={[styles.actionIconCircle, { backgroundColor: colors.surfaceVariant }]}>
            <Copy size={18} color={colors.text} />
          </View>
          <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>
            Copy
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionItem} onPress={onMove} activeOpacity={0.7}>
          <View style={[styles.actionIconCircle, { backgroundColor: colors.surfaceVariant }]}>
            <Move size={18} color={colors.text} />
          </View>
          <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>
            Move
          </Text>
        </TouchableOpacity>

        {onRename && selectedCount === 1 && (
          <TouchableOpacity style={styles.actionItem} onPress={onRename} activeOpacity={0.7}>
            <View style={[styles.actionIconCircle, { backgroundColor: colors.surfaceVariant }]}>
              <Edit3 size={18} color={colors.text} />
            </View>
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>
              Rename
            </Text>
          </TouchableOpacity>
        )}

        {onChecksum && selectedCount === 1 && (
          <TouchableOpacity style={styles.actionItem} onPress={onChecksum} activeOpacity={0.7}>
            <View style={[styles.actionIconCircle, { backgroundColor: colors.surfaceVariant }]}>
              <Hash size={18} color={colors.text} />
            </View>
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>
              Hash
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.actionItem} onPress={onDelete} activeOpacity={0.7}>
          <View style={[styles.actionIconCircle, { backgroundColor: colors.errorBackground }]}>
            <Trash2 size={18} color={colors.error} />
          </View>
          <Text style={[typography.labelSmall, { color: colors.error, marginTop: 4 }]}>
            Delete
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    paddingTop: spacing.sm,
    paddingBottom: spacing.base,
    ...elevation.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    marginBottom: spacing.sm,
  },
  closeButton: {
    padding: spacing.xs,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
  },
  actionsRow: {
    paddingHorizontal: spacing.base,
    gap: spacing.base,
    alignItems: 'center',
  },
  actionItem: {
    alignItems: 'center',
    minWidth: 54,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

