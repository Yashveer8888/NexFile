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
  Info,
  X,
  FileText,
  Clock,
  HardDrive,
  Folder,
  ShieldCheck,
  Hash,
  ExternalLink,
} from 'lucide-react-native';
import { FileItem } from '../../types/file';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { formatBytes, formatDate } from '../../utils/formatters';
import { FileIcon } from '../file/FileIcon';
import { Button } from '../common/Button';
import { fileService } from '../../services/filesystem/fileService';

interface FileDetailsModalProps {
  visible: boolean;
  item: FileItem | null;
  onClose: () => void;
  onOpenChecksum?: (item: FileItem) => void;
}

export const FileDetailsModal: React.FC<FileDetailsModalProps> = ({
  visible,
  item,
  onClose,
  onOpenChecksum,
}) => {
  const { colors } = useThemeStore();

  if (!item) return null;

  const handleOpenWith = () => {
    fileService.openFile(item.path, item.mimeType);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Info size={20} color={colors.primary} />
              <Text style={[typography.h3, { color: colors.text, marginLeft: 8 }]}>Details</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* File Header Preview */}
            <View style={styles.fileHero}>
              <FileIcon item={item} size={54} iconSize={28} />
              <Text style={[typography.labelLarge, { color: colors.text, marginTop: spacing.sm, textAlign: 'center' }]}>
                {item.name}
              </Text>
            </View>

            {/* Metadata Rows */}
            <View style={[styles.metaSection, { backgroundColor: colors.surfaceVariant }]}>
              <View style={styles.metaRow}>
                <Folder size={16} color={colors.textMuted} />
                <View style={styles.metaTextGroup}>
                  <Text style={[typography.labelSmall, { color: colors.textMuted }]}>LOCATION</Text>
                  <Text style={[typography.bodySmall, { color: colors.text, marginTop: 2 }]} numberOfLines={2}>
                    {item.path}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <HardDrive size={16} color={colors.textMuted} />
                <View style={styles.metaTextGroup}>
                  <Text style={[typography.labelSmall, { color: colors.textMuted }]}>SIZE</Text>
                  <Text style={[typography.bodyMedium, { color: colors.text, marginTop: 2 }]}>
                    {item.isDirectory
                      ? `${item.itemCount ?? 0} items`
                      : `${formatBytes(item.size)} (${item.size.toLocaleString()} bytes)`}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <Clock size={16} color={colors.textMuted} />
                <View style={styles.metaTextGroup}>
                  <Text style={[typography.labelSmall, { color: colors.textMuted }]}>MODIFIED</Text>
                  <Text style={[typography.bodyMedium, { color: colors.text, marginTop: 2 }]}>
                    {formatDate(item.lastModified)}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <FileText size={16} color={colors.textMuted} />
                <View style={styles.metaTextGroup}>
                  <Text style={[typography.labelSmall, { color: colors.textMuted }]}>MIME TYPE</Text>
                  <Text style={[typography.bodyMedium, { color: colors.text, marginTop: 2 }]}>
                    {item.mimeType || 'unknown'}
                  </Text>
                </View>
              </View>

              <View style={styles.metaRow}>
                <ShieldCheck size={16} color={colors.textMuted} />
                <View style={styles.metaTextGroup}>
                  <Text style={[typography.labelSmall, { color: colors.textMuted }]}>PERMISSIONS</Text>
                  <Text style={[typography.bodyMedium, { color: colors.text, marginTop: 2 }]}>
                    {item.canRead ? 'Read' : ''} {item.canWrite ? '• Write' : ''}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              {!item.isDirectory && onOpenChecksum && (
                <Button
                  title="Checksum"
                  variant="outline"
                  icon={<Hash size={16} color={colors.text} />}
                  onPress={() => {
                    onClose();
                    onOpenChecksum(item);
                  }}
                  style={styles.actionBtn}
                />
              )}
              {!item.isDirectory && (
                <Button
                  title="Open With"
                  variant="primary"
                  icon={<ExternalLink size={16} color="#FFFFFF" />}
                  onPress={handleOpenWith}
                  style={styles.actionBtn}
                />
              )}
            </View>
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
  container: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.base,
    maxHeight: '80%',
    borderWidth: 1,
    ...elevation.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeBtn: {
    padding: spacing.xs,
  },
  fileHero: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  metaSection: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  metaTextGroup: {
    marginLeft: spacing.md,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.base,
    marginBottom: spacing.sm,
  },
  actionBtn: {
    flex: 1,
  },
});

