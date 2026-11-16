import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

interface BadgeProps {
  label: string | number;
  color?: string;
  backgroundColor?: string;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  color,
  backgroundColor,
  style,
}) => {
  const { colors } = useThemeStore();

  const textColor = color || colors.primary;
  const bgColor = backgroundColor || colors.primaryLight;

  return (
    <View style={[styles.badge, { backgroundColor: bgColor }, style]}>
      <Text style={[typography.labelSmall, { color: textColor }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
});

