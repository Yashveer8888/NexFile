import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Shield, Lock, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useVaultStore } from '../../app/store/useVaultStore';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';

export const VaultProgressModal: React.FC = () => {
  const { colors } = useThemeStore();
  const movingProgress = useVaultStore((s) => s.movingProgress);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (movingProgress?.visible && movingProgress.status === 'moving') {
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
  }, [movingProgress?.visible, movingProgress?.status, pulseAnim]);

  if (!movingProgress || !movingProgress.visible) {
    return null;
  }

  const { title, currentFileName, currentIndex, totalCount, status, errorMessage, type } =
    movingProgress;
  const progressRatio = totalCount > 0 ? Math.min(1, Math.max(0, currentIndex / totalCount)) : 0;
  const progressPercent = Math.round(progressRatio * 100);

  const isCompleted = status === 'completed';
  const isError = status === 'error';

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
                  backgroundColor: isError
                    ? '#FFEBEE'
                    : isCompleted
                    ? '#E8F5E9'
                    : '#E8F5E9',
                },
              ]}
            >
              {isError ? (
                <AlertCircle size={32} color="#D32F2F" />
              ) : isCompleted ? (
                <CheckCircle2 size={32} color="#2E7D32" />
              ) : type === 'restore' ? (
                <Shield size={32} color="#2E7D32" />
              ) : (
                <Lock size={32} color="#2E7D32" />
              )}
            </Animated.View>
          </View>

          {/* Title */}
          <Text style={[typography.h3, styles.title, { color: colors.text }]}>
            {title}
          </Text>

          {/* Current File Name */}
          {Boolean(currentFileName) && (
            <Text
              style={[typography.labelMedium, styles.fileName, { color: colors.primary }]}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {currentFileName}
            </Text>
          )}

          {/* Error Message if failed */}
          {isError && Boolean(errorMessage) && (
            <Text style={[typography.bodySmall, styles.errorText]}>{errorMessage}</Text>
          )}

          {/* Progress Bar & Counter (when moving) */}
          {!isError && (
            <View style={styles.progressSection}>
              <View style={[styles.progressBarTrack, { backgroundColor: colors.surfaceVariant }]}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: isCompleted ? '100%' : `${Math.max(8, progressPercent)}%`,
                      backgroundColor: isCompleted ? '#2E7D32' : colors.primary,
                    },
                  ]}
                />
              </View>

              <View style={styles.progressInfoRow}>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  {isCompleted
                    ? '100% Completed'
                    : totalCount > 1
                    ? `Item ${currentIndex} of ${totalCount}`
                    : 'Verifying & Securing...'}
                </Text>
                <Text style={[typography.labelSmall, { color: colors.text, fontWeight: '700' }]}>
                  {isCompleted ? 'Done' : `${progressPercent}%`}
                </Text>
              </View>
            </View>
          )}

          {/* Status Subtitle / Trust Indicator */}
          <View style={[styles.trustBadge, { backgroundColor: `${colors.primary}12` }]}>
            <Shield size={14} color={colors.primary} />
            <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: 6 }]}>
              {isCompleted
                ? 'File verification complete'
                : 'Safe Move • Full Data Protection'}
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
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    ...elevation.lg,
  },
  iconContainer: {
    marginBottom: spacing.base,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.xs,
    fontWeight: '700',
  },
  fileName: {
    textAlign: 'center',
    marginBottom: spacing.base,
    paddingHorizontal: spacing.sm,
  },
  errorText: {
    color: '#D32F2F',
    textAlign: 'center',
    marginBottom: spacing.base,
  },
  progressSection: {
    width: '100%',
    marginBottom: spacing.base,
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: 2,
  },
  trustBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.xs,
  },
});
