import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Hash, X, Check, Copy } from 'lucide-react-native';
import { FileItem } from '../../types/file';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { fileService } from '../../services/filesystem/fileService';
import { Button } from '../common/Button';

interface ChecksumModalProps {
  visible: boolean;
  item: FileItem | null;
  onClose: () => void;
}

export const ChecksumModal: React.FC<ChecksumModalProps> = ({
  visible,
  item,
  onClose,
}) => {
  const { colors } = useThemeStore();
  const [md5, setMd5] = useState<string>('');
  const [sha256, setSha256] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  useEffect(() => {
    if (visible && item && !item.isDirectory) {
      calculateHashes(item.path);
    }
  }, [visible, item]);

  const calculateHashes = async (path: string) => {
    setIsLoading(true);
    setMd5('');
    setSha256('');
    try {
      const [md5Result, sha256Result] = await Promise.all([
        fileService.calculateChecksum(path, 'MD5'),
        fileService.calculateChecksum(path, 'SHA-256'),
      ]);
      setMd5(md5Result);
      setSha256(sha256Result);
    } catch (err) {
      console.warn('Checksum calculation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text: string, type: string) => {
    // Simulated clipboard copy
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  if (!item) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Hash size={20} color={colors.primary} />
              <Text style={[typography.h3, { color: colors.text, marginLeft: 8 }]}>Checksum</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[typography.bodySmall, { color: colors.textMuted }]} numberOfLines={1}>
            {item.name}
          </Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[typography.bodyMedium, { color: colors.textMuted, marginTop: spacing.md }]}>
                Calculating file hashes...
              </Text>
            </View>
          ) : (
            <View style={styles.hashesContainer}>
              {/* MD5 */}
              <View style={[styles.hashBox, { backgroundColor: colors.surfaceVariant }]}>
                <View style={styles.hashBoxHeader}>
                  <Text style={[typography.labelMedium, { color: colors.primary }]}>MD5</Text>
                  <TouchableOpacity
                    onPress={() => handleCopy(md5, 'MD5')}
                    style={styles.copyBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {copiedType === 'MD5' ? (
                      <Check size={14} color={colors.success} />
                    ) : (
                      <Copy size={14} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={[typography.mono, { color: colors.text, marginTop: 4 }]} selectable>
                  {md5 || '--'}
                </Text>
              </View>

              {/* SHA-256 */}
              <View style={[styles.hashBox, { backgroundColor: colors.surfaceVariant, marginTop: spacing.md }]}>
                <View style={styles.hashBoxHeader}>
                  <Text style={[typography.labelMedium, { color: colors.primary }]}>SHA-256</Text>
                  <TouchableOpacity
                    onPress={() => handleCopy(sha256, 'SHA-256')}
                    style={styles.copyBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {copiedType === 'SHA-256' ? (
                      <Check size={14} color={colors.success} />
                    ) : (
                      <Copy size={14} color={colors.textMuted} />
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={[typography.mono, { color: colors.text, marginTop: 4 }]} selectable>
                  {sha256 || '--'}
                </Text>
              </View>
            </View>
          )}

          <Button
            title="Done"
            variant="primary"
            onPress={onClose}
            style={{ marginTop: spacing.xl, width: '100%' }}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    ...elevation.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  hashesContainer: {
    marginTop: spacing.md,
  },
  hashBox: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  hashBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  copyBtn: {
    padding: spacing.xxs,
  },
});

