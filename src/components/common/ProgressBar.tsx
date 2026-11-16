import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { borderRadius } from '../../theme/spacing';

interface ProgressBarProps {
  progress: number; // 0 to 1
  color?: string;
  trackColor?: string;
  height?: number;
  style?: ViewStyle;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color,
  trackColor,
  height = 8,
  style,
}) => {
  const { colors } = useThemeStore();
  const clampedProgress = Math.max(0, Math.min(1, isNaN(progress) ? 0 : progress));

  return (
    <View
      style={[
        styles.track,
        {
          height,
          backgroundColor: trackColor || colors.surfaceVariant,
          borderRadius: height / 2,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${clampedProgress * 100}%`,
            backgroundColor: color || colors.primary,
            borderRadius: height / 2,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
});

