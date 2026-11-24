import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
} from 'react-native';
import { Copy, FolderInput, Archive, FolderDown, Trash2, CheckCircle2 } from 'lucide-react-native';
import { useFileStore } from '../../app/store/useFileStore';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';

export const FileOperationProgressModal: React.FC = () => {
  const { colors } = useThemeStore();
  const operationProgress = useFileStore((s) => s.operationProgress);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (operationProgress && !operationProgress.isCompleted) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [operationProgress?.isCompleted, pulseAnim]);

  if (!operationProgress) {
    return null;
  }

  const {
    type,
    title,
    currentItem,
    totalItems,
    completedItems,
    percent,
    isCompleted,
  } = operationProgress;

  const displayTitle = title || (
    type === 'copy'
      ? 'Copying files...'
      : type === 'move'
      ? 'Moving files...'
      : type === 'compress'
      ? 'Compressing archive...'
      : type === 'extract'
      ? 'Extracting archive...'
      : type === 'delete'
      ? 'Deleting files...'
      : 'Processing...'
  );

  const displayPercent = Math.min(100, Math.max(0, Math.round(percent)));

  const getIcon = () => {
    if (isCompleted) {
      return <CheckCircle2 size={32} color="#2E7D32" />;
    }
    switch (type) {
      case 'copy':
        return <Copy size={30} color={colors.primary} />;
      case 'move':
        return <FolderInput size={30} color={colors.primary} />;
      case 'compress':
        return <Archive size={30} color={colors.primary} />;
      case 'extract':
        return <FolderDown size={30} color={colors.primary} />;
      case 'delete':
        return <Trash2 size={30} color="#D32F2F" />;
      default:
        return <Copy size={30} color={colors.primary} />;
    }
  };

  const getIconBg = () => {
    if (isCompleted) return '#E8F5E9';
    if (type === 'delete') return '#FFEBEE';
    return `${colors.primary}1A`;
  };

  return (
    <Modal visible={true} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header Icon Pill */}
          <View style={styles.iconContainer}>
            <Animated.View
              style={[
                styles.iconCircle,
                {
                  transform: [{ scale: pulseAnim }],
                  backgroundColor: getIconBg(),
                },
              ]}
            >
              {getIcon()}
            </Animated.View>
          </View>

          {/* Title */}
          <Text style={[typography.h3, styles.title, { color: colors.text }]}>
            {displayTitle}
          </Text>

          {/* Current File Name */}
          {Boolean(currentItem) && (
            <Text
              style={[typography.labelMedium, styles.fileName, { color: colors.primary }]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {currentItem}
            </Text>
          )}

          {/* Counter info */}
          {totalItems > 1 && (
            <Text style={[typography.bodySmall, styles.counter, { color: colors.textSecondary }]}>
              {completedItems} of {totalItems} items
            </Text>
          )}

          {/* Progress Bar */}
          <View style={[styles.progressBarTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${displayPercent}%`,
                  backgroundColor: isCompleted ? '#2E7D32' : colors.primary,
                },
              ]}
            />
          </View>

          {/* Progress Percent Label */}
          <View style={styles.progressFooter}>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              {isCompleted ? 'Finished' : 'Please wait...'}
            </Text>
            <Text style={[typography.bodySmall, styles.percentText, { color: colors.text }]}>
              {displayPercent}%
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: borderRadius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.xl,
    alignItems: 'center',
    ...elevation.md,
  },
  iconContainer: {
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  fileName: {
    textAlign: 'center',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  counter: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  progressBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressFooter: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xxs,
  },
  percentText: {
    fontWeight: '600',
  },
});
