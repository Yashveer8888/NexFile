import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Trash2, AlertTriangle, ShieldCheck, X } from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Button } from '../common/Button';

interface DeleteChoiceModalProps {
  visible: boolean;
  itemCount: number;
  itemName?: string;
  onDelete: (permanent: boolean) => Promise<void> | void;
  onCancel: () => void;
}

export const DeleteChoiceModal: React.FC<DeleteChoiceModalProps> = ({
  visible,
  itemCount,
  itemName,
  onDelete,
  onCancel,
}) => {
  const { colors } = useThemeStore();
  const [permanent, setPermanent] = useState(false);

  const titleText = itemCount === 1 && itemName ? `Delete "${itemName}"` : `Delete ${itemCount} Item(s)`;

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
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: permanent ? colors.errorBackground : colors.primaryLight },
                ]}
              >
                {permanent ? (
                  <AlertTriangle size={20} color={colors.error} />
                ) : (
                  <Trash2 size={20} color={colors.primary} />
                )}
              </View>
              <Text
                style={[typography.h3, { color: colors.text, marginLeft: 10, flex: 1 }]}
                numberOfLines={1}
              >
                {titleText}
              </Text>
            </View>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Choose how you want to remove {itemCount === 1 ? 'this item' : 'these items'}:
          </Text>

          {/* Option 1: Move to Recycle Bin (Recoverable) */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              {
                backgroundColor: !permanent ? colors.primaryLight : colors.surfaceVariant,
                borderColor: !permanent ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setPermanent(false)}
            activeOpacity={0.8}
          >
            <View style={styles.optionHeader}>
              <View style={styles.optionTitleRow}>
                <ShieldCheck size={18} color={!permanent ? colors.primary : colors.textMuted} />
                <Text
                  style={[
                    typography.labelMedium,
                    {
                      color: !permanent ? colors.primary : colors.text,
                      marginLeft: 8,
                      fontWeight: '700',
                    },
                  ]}
                >
                  Move to Recycle Bin
                </Text>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: !permanent ? colors.primary : colors.border },
                ]}
              >
                {!permanent && (
                  <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                )}
              </View>
            </View>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4, marginLeft: 26 }]}>
              Items can be safely restored anytime from the Recycle Bin.
            </Text>
          </TouchableOpacity>

          {/* Option 2: Permanently Delete */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              {
                backgroundColor: permanent ? colors.errorBackground : colors.surfaceVariant,
                borderColor: permanent ? colors.error : colors.border,
                marginTop: spacing.sm,
              },
            ]}
            onPress={() => setPermanent(true)}
            activeOpacity={0.8}
          >
            <View style={styles.optionHeader}>
              <View style={styles.optionTitleRow}>
                <AlertTriangle size={18} color={permanent ? colors.error : colors.textMuted} />
                <Text
                  style={[
                    typography.labelMedium,
                    {
                      color: permanent ? colors.error : colors.text,
                      marginLeft: 8,
                      fontWeight: '700',
                    },
                  ]}
                >
                  Permanently Delete
                </Text>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: permanent ? colors.error : colors.border },
                ]}
              >
                {permanent && (
                  <View style={[styles.radioInner, { backgroundColor: colors.error }]} />
                )}
              </View>
            </View>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4, marginLeft: 26 }]}>
              Frees up storage immediately. Cannot be undone or recovered.
            </Text>
          </TouchableOpacity>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={onCancel}
              style={styles.dialogButton}
            />
            <Button
              title={permanent ? 'Delete Forever' : 'Move to Trash'}
              variant={permanent ? 'danger' : 'primary'}
              onPress={() => onDelete(permanent)}
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
    flex: 1,
    marginRight: spacing.sm,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCard: {
    borderWidth: 1.5,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
