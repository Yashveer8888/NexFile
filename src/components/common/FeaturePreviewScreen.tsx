import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeStore } from '../../app/store/useThemeStore';
import { Header } from './Header';
import { Badge } from './Badge';
import { Card } from './Card';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

interface FeaturePreviewProps {
  title: string;
  subtitle: string;
  phase: string;
  description: string;
  capabilities: string[];
  icon: any;
  accentColor: string;
  navigation: any;
}

export const FeaturePreviewScreen: React.FC<FeaturePreviewProps> = ({
  title,
  subtitle,
  phase,
  description,
  capabilities,
  icon: IconComp,
  accentColor,
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Header
        title={title}
        subtitle={subtitle}
        showBack
        onBack={() => navigation.goBack()}
        showThemeToggle
      />

      <View style={styles.content}>
        <Card style={styles.heroCard}>
          <View style={[styles.iconBox, { backgroundColor: `${accentColor}20` }]}>
            <IconComp size={40} color={accentColor} />
          </View>
          <View style={styles.phaseBadgeRow}>
            <Badge label={phase} color={accentColor} backgroundColor={`${accentColor}20`} />
          </View>
          <Text style={[typography.h2, { color: colors.text, marginTop: spacing.md, textAlign: 'center' }]}>
            {title}
          </Text>
          <Text
            style={[
              typography.bodyMedium,
              { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' },
            ]}
          >
            {description}
          </Text>
        </Card>

        <Text style={[typography.labelMedium, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
          PLANNED CAPABILITIES
        </Text>

        <Card style={styles.capabilitiesCard}>
          {capabilities.map((cap, idx) => (
            <View key={idx} style={styles.capabilityRow}>
              <View style={[styles.bullet, { backgroundColor: accentColor }]} />
              <Text style={[typography.bodyMedium, { color: colors.text, flex: 1 }]}>
                {cap}
              </Text>
            </View>
          ))}
        </Card>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.base,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  iconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseBadgeRow: {
    marginTop: spacing.md,
  },
  capabilitiesCard: {
    gap: spacing.md,
  },
  capabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.md,
  },
});

