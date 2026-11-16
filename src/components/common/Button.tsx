import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  style,
}) => {
  const { colors } = useThemeStore();

  const getContainerStyles = (): ViewStyle => {
    let bg = colors.primary;
    let border = 'transparent';

    switch (variant) {
      case 'primary':
        bg = colors.primary;
        break;
      case 'secondary':
        bg = colors.surfaceVariant;
        break;
      case 'outline':
        bg = 'transparent';
        border = colors.border;
        break;
      case 'danger':
        bg = colors.error;
        break;
      case 'ghost':
        bg = 'transparent';
        break;
    }

    let paddingVertical = spacing.md;
    let paddingHorizontal = spacing.lg;

    if (size === 'sm') {
      paddingVertical = spacing.xs + 2;
      paddingHorizontal = spacing.md;
    } else if (size === 'lg') {
      paddingVertical = spacing.base;
      paddingHorizontal = spacing.xl;
    }

    return {
      backgroundColor: disabled ? colors.surfaceVariant : bg,
      borderColor: border,
      borderWidth: variant === 'outline' ? 1 : 0,
      borderRadius: borderRadius.md,
      paddingVertical,
      paddingHorizontal,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: disabled ? 0.6 : 1,
    };
  };

  const getTextStyles = (): TextStyle => {
    let color = '#FFFFFF';

    if (disabled) {
      color = colors.textMuted;
    } else {
      switch (variant) {
        case 'primary':
        case 'danger':
          color = '#FFFFFF';
          break;
        case 'secondary':
        case 'outline':
        case 'ghost':
          color = colors.text;
          break;
      }
    }

    const baseTypography = size === 'sm' ? typography.labelMedium : typography.labelLarge;

    return {
      ...baseTypography,
      color,
      marginLeft: icon && !loading ? spacing.sm : 0,
    };
  };

  return (
    <TouchableOpacity
      style={[getContainerStyles(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? colors.primary : '#FFFFFF'}
        />
      ) : (
        <>
          {icon && <View>{icon}</View>}
          <Text style={getTextStyles()}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

