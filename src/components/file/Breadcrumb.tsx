import React from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { ChevronRight, Home } from 'lucide-react-native';
import { BreadcrumbItem } from '../../types/file';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  onNavigate: (path: string) => void;
  style?: any;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items, onNavigate, style }) => {
  const { colors } = useThemeStore();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderBottomColor: colors.border }, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isFirst = index === 0;

          return (
            <View key={item.path} style={styles.itemWrapper}>
              <TouchableOpacity
                onPress={() => onNavigate(item.path)}
                disabled={isLast}
                style={styles.crumbButton}
                activeOpacity={0.7}
              >
                {isFirst && (
                  <Home
                    size={14}
                    color={isLast ? colors.primary : colors.textSecondary}
                    style={styles.homeIcon}
                  />
                )}
                <Text
                  style={[
                    typography.labelMedium,
                    {
                      color: isLast ? colors.primary : colors.textSecondary,
                      fontWeight: isLast ? '700' : '500',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
              {!isLast && (
                <ChevronRight size={14} color={colors.textMuted} style={styles.separator} />
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 42,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
  },
  itemWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  crumbButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  homeIcon: {
    marginRight: 4,
  },
  separator: {
    marginHorizontal: 2,
  },
});

