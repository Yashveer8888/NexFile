import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Archive, X, Check } from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Button } from '../common/Button';

interface CompressDialogProps {
  visible: boolean;
  defaultName?: string;
  itemCount: number;
  onCompress: (archiveName: string) => Promise<void> | void;
  onCancel: () => void;
}

export const CompressDialog: React.FC<CompressDialogProps> = ({
  visible,
  defaultName = 'archive',
  itemCount,
  onCompress,
  onCancel,
}) => {
  const { colors } = useThemeStore();
  const [archiveName, setArchiveName] = useState(defaultName);
  const [format, setFormat] = useState<'.zip' | '.tar'>('.zip');

  const handleCompress = () => {
    let base = archiveName.trim();
    if (!base) base = 'archive';
    if (base.endsWith('.zip') || base.endsWith('.tar')) {
      base = base.substring(0, base.lastIndexOf('.'));
    }
    const finalName = `${base}${format}`;
    onCompress(finalName);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onCancel}
      >
        <View
          style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                <Archive size={20} color={colors.primary} />
              </View>
              <Text style={[typography.h3, { color: colors.text, marginLeft: 10 }]}>
                Create Archive
              </Text>
            </View>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Compress {itemCount} item(s) into an archive file:
          </Text>

          {/* Archive Name Input */}
          <Text style={[typography.labelSmall, { color: colors.textMuted }]}>
            ARCHIVE NAME
          </Text>
          <TextInput
            style={[
              styles.input,
              typography.bodyLarge,
              {
                color: colors.text,
                backgroundColor: colors.surfaceVariant,
                borderColor: colors.border,
              },
            ]}
            placeholder="Archive name"
            placeholderTextColor={colors.textMuted}
            value={archiveName}
            onChangeText={setArchiveName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCompress}
          />

          {/* Format selection */}
          <Text style={[typography.labelSmall, { color: colors.textMuted, marginTop: spacing.md }]}>
            FORMAT
          </Text>
          <View style={styles.formatRow}>
            {(['.zip', '.tar'] as const).map((fmt) => (
              <TouchableOpacity
                key={fmt}
                style={[
                  styles.formatChip,
                  {
                    backgroundColor: format === fmt ? colors.primaryLight : colors.surfaceVariant,
                    borderColor: format === fmt ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setFormat(fmt)}
              >
                <Text
                  style={[
                    typography.labelMedium,
                    {
                      color: format === fmt ? colors.primary : colors.text,
                      fontWeight: format === fmt ? '700' : '500',
                    },
                  ]}
                >
                  {fmt.toUpperCase()}
                </Text>
                {format === fmt && <Check size={14} color={colors.primary} style={{ marginLeft: 4 }} />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onCancel}
              style={styles.dialogButton}
            />
            <Button
              title="Compress"
              variant="primary"
              onPress={handleCompress}
              disabled={!archiveName.trim()}
              style={styles.dialogButton}
            />
          </View>
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
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  formatRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  formatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  dialogButton: {
    flex: 1,
  },
});
