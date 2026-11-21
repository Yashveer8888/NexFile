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
  RefreshCw,
  Archive,
  Lock,
  X,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';

interface FileActionSheetProps {
  selectedCount: number;
  totalCount: number;
  onCopy: () => void;
  onMove?: () => void;
  hideMove?: boolean;
  onDelete: () => void;
  onShare: () => void;
  onRename?: () => void;
  onChecksum?: () => void;
  onCompress?: () => void;
  onLockInVault?: () => void;
  onSelectAll: () => void;
  onInvertSelection?: () => void;
  onClose: () => void;
}

export const FileActionSheet: React.FC<FileActionSheetProps> = ({
  selectedCount,
  totalCount,
  onCopy,
  onMove,
  hideMove = false,
  onDelete,
  onShare,
  onRename,
  onChecksum,
  onCompress,
  onLockInVault,
  onSelectAll,
  onInvertSelection,
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
      {/* Header with Selection Info & Multi-Select Controls */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[typography.labelLarge, { color: colors.text, marginLeft: 8 }]}>
            {selectedCount} selected
          </Text>
        </View>

        <View style={styles.headerRight}>
          {onInvertSelection && (
            <TouchableOpacity
              onPress={onInvertSelection}
              style={styles.headerControlBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <RefreshCw size={16} color={colors.primary} />
              <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: 4 }]}>
                Invert
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={onSelectAll}
            style={[styles.headerControlBtn, { marginLeft: 8 }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <CheckSquare size={16} color={colors.primary} />
            <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: 4 }]}>
              {selectedCount === totalCount ? 'Clear' : 'All'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Action Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actionsRow}
      >
        {/* Share */}
        <TouchableOpacity style={styles.actionItem} onPress={onShare} activeOpacity={0.7}>
          <View style={[styles.actionIconCircle, { backgroundColor: colors.surfaceVariant }]}>
            <Share2 size={18} color={colors.text} />
          </View>
          <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>
            Share
          </Text>
        </TouchableOpacity>

        {/* Copy */}
        <TouchableOpacity style={styles.actionItem} onPress={onCopy} activeOpacity={0.7}>
          <View style={[styles.actionIconCircle, { backgroundColor: colors.surfaceVariant }]}>
            <Copy size={18} color={colors.text} />
          </View>
          <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>
            Copy
          </Text>
        </TouchableOpacity>

        {/* Move */}
        {!hideMove && Boolean(onMove) && (
          <TouchableOpacity style={styles.actionItem} onPress={onMove} activeOpacity={0.7}>
            <View style={[styles.actionIconCircle, { backgroundColor: colors.surfaceVariant }]}>
              <Move size={18} color={colors.text} />
            </View>
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>
              Move
            </Text>
          </TouchableOpacity>
        )}

        {/* Compress (Zip) */}
        {onCompress && (
          <TouchableOpacity style={styles.actionItem} onPress={onCompress} activeOpacity={0.7}>
            <View style={[styles.actionIconCircle, { backgroundColor: colors.surfaceVariant }]}>
              <Archive size={18} color={colors.text} />
            </View>
            <Text style={[typography.labelSmall, { color: colors.text, marginTop: 4 }]}>
              Zip
            </Text>
          </TouchableOpacity>
        )}

        {/* Lock in Vault */}
        {onLockInVault && (
          <TouchableOpacity style={styles.actionItem} onPress={onLockInVault} activeOpacity={0.7}>
            <View style={[styles.actionIconCircle, { backgroundColor: '#E8F5E9' }]}>
              <Lock size={18} color="#2E7D32" />
            </View>
            <Text style={[typography.labelSmall, { color: '#2E7D32', marginTop: 4, fontWeight: '700' }]}>
              Vault
            </Text>
          </TouchableOpacity>
        )}

        {/* Rename (Single selected) */}
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

        {/* Hash (Single selected) */}
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

        {/* Delete */}
        <TouchableOpacity style={styles.actionItem} onPress={onDelete} activeOpacity={0.7}>
          <View style={[styles.actionIconCircle, { backgroundColor: colors.errorBackground }]}>
            <Trash2 size={18} color={colors.error} />
          </View>
          <Text style={[typography.labelSmall, { color: colors.error, marginTop: 4, fontWeight: '700' }]}>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    padding: spacing.xs,
  },
  headerControlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: '#00E5FF15',
  },
  actionsRow: {
    paddingHorizontal: spacing.base,
    gap: spacing.base,
    alignItems: 'center',
  },
  actionItem: {
    alignItems: 'center',
    minWidth: 52,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
