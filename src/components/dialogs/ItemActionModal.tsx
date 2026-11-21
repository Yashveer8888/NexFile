import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  ExternalLink,
  Share2,
  Copy,
  Move,
  Edit3,
  Archive,
  ArchiveRestore,
  Star,
  EyeOff,
  Eye,
  Lock,
  Info,
  Hash,
  Trash2,
  X,
  Folder,
} from 'lucide-react-native';
import { FileItem } from '../../types/file';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { formatBytes, formatDate } from '../../utils/formatters';
import { FileIcon } from '../file/FileIcon';

interface ItemActionModalProps {
  visible: boolean;
  item: FileItem | null;
  onClose: () => void;
  onOpenWith: (item: FileItem) => void;
  onShare: (item: FileItem) => void;
  onCopy: (item: FileItem) => void;
  onMove?: (item: FileItem) => void;
  hideMove?: boolean;
  onRename: (item: FileItem) => void;
  onCompress: (item: FileItem) => void;
  onExtract?: (item: FileItem) => void;
  onToggleFavorite: (item: FileItem) => void;
  onToggleHide: (item: FileItem) => void;
  onLockInVault: (item: FileItem) => void;
  onDetails: (item: FileItem) => void;
  onChecksum: (item: FileItem) => void;
  onDelete: (item: FileItem) => void;
}

export const ItemActionModal: React.FC<ItemActionModalProps> = ({
  visible,
  item,
  onClose,
  onOpenWith,
  onShare,
  onCopy,
  onMove,
  hideMove = false,
  onRename,
  onCompress,
  onExtract,
  onToggleFavorite,
  onToggleHide,
  onLockInVault,
  onDetails,
  onChecksum,
  onDelete,
}) => {
  const { colors } = useThemeStore();

  if (!item) return null;

  const isHidden = item.name.startsWith('.');
  const isArchive =
    !item.isDirectory &&
    ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(item.extension?.toLowerCase() || '');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.sheetContainer,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Header Card */}
          <View style={styles.itemHeader}>
            <View style={styles.iconContainer}>
              <FileIcon item={item} size={36} />
            </View>
            <View style={styles.headerInfo}>
              <Text
                style={[typography.labelLarge, { color: colors.text }]}
                numberOfLines={1}
                ellipsizeMode="middle"
              >
                {item.name}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                {item.isDirectory ? 'Folder' : formatBytes(item.size)} • {formatDate(item.lastModified)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Action List */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* 1. Open With (Non-directories) */}
            {!item.isDirectory && (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  onClose();
                  onOpenWith(item);
                }}
              >
                <View style={[styles.actionIconPill, { backgroundColor: colors.primaryLight }]}>
                  <ExternalLink size={18} color={colors.primary} />
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={[typography.labelMedium, { color: colors.text }]}>Open With...</Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    Choose installed app to open
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* 2. Share */}
            {!item.isDirectory && (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  onClose();
                  onShare(item);
                }}
              >
                <View style={[styles.actionIconPill, { backgroundColor: colors.surfaceVariant }]}>
                  <Share2 size={18} color={colors.text} />
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={[typography.labelMedium, { color: colors.text }]}>Share / Send</Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    Transfer via Bluetooth, Quick Share, Apps
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* 3. Copy */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                onClose();
                onCopy(item);
              }}
            >
              <View style={[styles.actionIconPill, { backgroundColor: colors.surfaceVariant }]}>
                <Copy size={18} color={colors.text} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={[typography.labelMedium, { color: colors.text }]}>Copy</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  Duplicate to clipboard
                </Text>
              </View>
            </TouchableOpacity>

            {/* 4. Move / Cut */}
            {!hideMove && Boolean(onMove) && (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  onClose();
                  onMove?.(item);
                }}
              >
                <View style={[styles.actionIconPill, { backgroundColor: colors.surfaceVariant }]}>
                  <Move size={18} color={colors.text} />
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={[typography.labelMedium, { color: colors.text }]}>Cut / Move</Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    Transfer without leaving a copy
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* 5. Rename */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                onClose();
                onRename(item);
              }}
            >
              <View style={[styles.actionIconPill, { backgroundColor: colors.surfaceVariant }]}>
                <Edit3 size={18} color={colors.text} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={[typography.labelMedium, { color: colors.text }]}>Rename</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  Change name or extension (e.g. .txt to .json)
                </Text>
              </View>
            </TouchableOpacity>

            {/* 6. Extract (If archive) */}
            {isArchive && onExtract && (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  onClose();
                  onExtract(item);
                }}
              >
                <View style={[styles.actionIconPill, { backgroundColor: '#E0F7FA' }]}>
                  <ArchiveRestore size={18} color="#00838F" />
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={[typography.labelMedium, { color: '#00838F', fontWeight: '700' }]}>
                    Extract (Unzip)
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    Unpack archive into current directory
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* 7. Compress (Zip) */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                onClose();
                onCompress(item);
              }}
            >
              <View style={[styles.actionIconPill, { backgroundColor: colors.surfaceVariant }]}>
                <Archive size={18} color={colors.text} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={[typography.labelMedium, { color: colors.text }]}>Compress (.zip)</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  Create compressed zip archive
                </Text>
              </View>
            </TouchableOpacity>

            {/* 8. Pin to Favorites */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                onClose();
                onToggleFavorite(item);
              }}
            >
              <View
                style={[
                  styles.actionIconPill,
                  { backgroundColor: item.isFavorite ? '#FFF8E1' : colors.surfaceVariant },
                ]}
              >
                <Star
                  size={18}
                  color={item.isFavorite ? '#FFB300' : colors.text}
                  fill={item.isFavorite ? '#FFB300' : 'transparent'}
                />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={[typography.labelMedium, { color: colors.text }]}>
                  {item.isFavorite ? 'Unpin from Favorites' : 'Pin to Favorites / Bookmarks'}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  Quick access from home or folders
                </Text>
              </View>
            </TouchableOpacity>

            {/* 9. Hide / Unhide (dot prefix) */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                onClose();
                onToggleHide(item);
              }}
            >
              <View style={[styles.actionIconPill, { backgroundColor: colors.surfaceVariant }]}>
                {isHidden ? <Eye size={18} color={colors.text} /> : <EyeOff size={18} color={colors.text} />}
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={[typography.labelMedium, { color: colors.text }]}>
                  {isHidden ? 'Unhide File' : 'Hide (Dot Prefix)'}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  {isHidden ? 'Remove dot prefix to make visible' : 'Add dot prefix (e.g. .secret) to hide from gallery'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* 10. Lock in Private Vault */}
            {!item.isDirectory && (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  onClose();
                  onLockInVault(item);
                }}
              >
                <View style={[styles.actionIconPill, { backgroundColor: '#E8F5E9' }]}>
                  <Lock size={18} color="#2E7D32" />
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={[typography.labelMedium, { color: '#2E7D32', fontWeight: '700' }]}>
                    Lock in Private Vault
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    Encrypt and store behind PIN & Fingerprint
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* 11. Properties & Details */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                onClose();
                onDetails(item);
              }}
            >
              <View style={[styles.actionIconPill, { backgroundColor: colors.surfaceVariant }]}>
                <Info size={18} color={colors.text} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={[typography.labelMedium, { color: colors.text }]}>
                  Properties / Details
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  Path, size, timestamps, permissions
                </Text>
              </View>
            </TouchableOpacity>

            {/* 12. Checksum */}
            {!item.isDirectory && (
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  onClose();
                  onChecksum(item);
                }}
              >
                <View style={[styles.actionIconPill, { backgroundColor: colors.surfaceVariant }]}>
                  <Hash size={18} color={colors.text} />
                </View>
                <View style={styles.actionTextWrap}>
                  <Text style={[typography.labelMedium, { color: colors.text }]}>
                    Checksum Verification
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    MD5, SHA-1, SHA-256 integrity hashes
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* 13. Delete */}
            <TouchableOpacity
              style={[styles.actionRow, { marginBottom: spacing.md }]}
              onPress={() => {
                onClose();
                onDelete(item);
              }}
            >
              <View style={[styles.actionIconPill, { backgroundColor: colors.errorBackground }]}>
                <Trash2 size={18} color={colors.error} />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={[typography.labelMedium, { color: colors.error, fontWeight: '700' }]}>
                  Delete
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  Recycle Bin or permanent delete
                </Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderTopWidth: 1,
    maxHeight: '82%',
    paddingTop: spacing.base,
    paddingBottom: spacing.xxl,
    ...elevation.lg,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  iconContainer: {
    marginRight: spacing.md,
  },
  headerInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md - 2,
  },
  actionIconPill: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  actionTextWrap: {
    flex: 1,
  },
});
