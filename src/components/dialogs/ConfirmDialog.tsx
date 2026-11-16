import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, Trash2, HelpCircle } from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Button } from '../common/Button';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmTitle?: string;
  cancelTitle?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  visible,
  title,
  message,
  confirmTitle = 'Confirm',
  cancelTitle = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  const { colors } = useThemeStore();

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
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: isDestructive ? colors.errorBackground : colors.primaryLight,
              },
            ]}
          >
            {isDestructive ? (
              <Trash2 size={24} color={colors.error} />
            ) : (
              <AlertTriangle size={24} color={colors.primary} />
            )}
          </View>

          <Text style={[typography.h3, { color: colors.text, marginTop: spacing.md, textAlign: 'center' }]}>
            {title}
          </Text>

          <Text
            style={[
              typography.bodyMedium,
              { color: colors.textSecondary, marginTop: spacing.sm, textAlign: 'center' },
            ]}
          >
            {message}
          </Text>

          <View style={styles.buttonRow}>
            <Button
              title={cancelTitle}
              variant="secondary"
              onPress={onCancel}
              style={styles.dialogButton}
            />
            <Button
              title={confirmTitle}
              variant={isDestructive ? 'danger' : 'primary'}
              onPress={onConfirm}
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
    maxWidth: 360,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    ...elevation.lg,
  },
  iconWrapper: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
    width: '100%',
  },
  dialogButton: {
    flex: 1,
  },
});

