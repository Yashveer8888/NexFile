import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FolderOpen } from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionTitle?: string;
  onActionPress?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionTitle,
  onActionPress,
}) => {
  const { colors } = useThemeStore();

  return (
    <View style={styles.container}>
      <View style={[styles.iconWrapper, { backgroundColor: colors.surfaceVariant }]}>
        {icon || <FolderOpen size={48} color={colors.textMuted} />}
      </View>
      <Text style={[typography.h3, { color: colors.text, marginTop: spacing.md }]}>
        {title}
      </Text>
      {description && (
        <Text style={[typography.bodyMedium, { color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs, maxWidth: 280 }]}>
          {description}
        </Text>
      )}
      {actionTitle && onActionPress && (
        <View style={styles.actionContainer}>
          <Button title={actionTitle} onPress={onActionPress} size="sm" variant="secondary" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 240,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContainer: {
    marginTop: spacing.base,
  },
});

