import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Package,
  Download,
  Archive,
  LayoutGrid,
} from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

const WhatsAppIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 22,
  color = '#25D366',
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.883-9.888 9.883m0-18C5.39 3.785.64 8.535.638 14.39a11.75 11.75 0 001.6 5.922L0 24l3.771-2.205a11.83 11.83 0 005.877 1.558h.005c5.852 0 10.605-4.753 10.608-10.609 0-2.836-1.105-5.503-3.111-7.51A10.53 10.53 0 0012.051 3.785"
      fill={color}
    />
  </Svg>
);
import { FileCategory } from '../../types/file';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';

interface CategoryOption {
  id: FileCategory;
  label: string;
  icon: any;
  color: string;
}

interface CategoryChipsProps {
  selectedCategory: FileCategory;
  onSelectCategory: (category: FileCategory) => void;
  isCompact?: boolean;
}

export const CategoryChips: React.FC<CategoryChipsProps> = ({
  selectedCategory,
  onSelectCategory,
  isCompact = false,
}) => {
  const { colors } = useThemeStore();

  const categories: CategoryOption[] = [
    { id: 'all', label: 'All', icon: LayoutGrid, color: colors.primary },
    { id: 'images', label: 'Images', icon: ImageIcon, color: colors.imageColor },
    { id: 'videos', label: 'Videos', icon: Video, color: colors.videoColor },
    { id: 'audio', label: 'Audio', icon: Music, color: colors.audioColor },
    { id: 'documents', label: 'Documents', icon: FileText, color: colors.documentColor },
    { id: 'apks', label: 'APKs', icon: Package, color: colors.apkColor },
    { id: 'downloads', label: 'Downloads', icon: Download, color: colors.downloadColor },
    { id: 'archives', label: 'Archives', icon: Archive, color: colors.archiveColor },
    { id: 'whatsapp', label: 'WhatsApp', icon: WhatsAppIcon, color: '#25D366' },
  ];

  if (isCompact) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.compactScroll}
      >
        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          const IconComp = cat.icon;

          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.compactChip,
                {
                  backgroundColor: isSelected ? colors.primary : colors.surfaceVariant,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
              ]}
              onPress={() => onSelectCategory(isSelected && cat.id !== 'all' ? 'all' : cat.id)}
              activeOpacity={0.7}
            >
              <IconComp
                size={14}
                color={isSelected ? '#FFFFFF' : cat.color}
                style={styles.chipIcon}
              />
              <Text
                style={[
                  typography.labelMedium,
                  { color: isSelected ? '#FFFFFF' : colors.text },
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }

  // Full Grid View for Recent Dashboard
  return (
    <View style={styles.gridContainer}>
      {categories.slice(1).map((cat) => {
        const isSelected = selectedCategory === cat.id;
        const IconComp = cat.icon;

        return (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryTile,
              {
                backgroundColor: colors.card,
                borderColor: isSelected ? colors.primary : colors.cardBorder,
              },
            ]}
            onPress={() => onSelectCategory(isSelected ? 'all' : cat.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.tileIconContainer, { backgroundColor: `${cat.color}20` }]}>
              <IconComp size={22} color={cat.color} />
            </View>
            <Text
              style={[typography.labelMedium, { color: colors.text, marginTop: spacing.xs }]}
              numberOfLines={1}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  compactScroll: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  compactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  chipIcon: {
    marginRight: spacing.xs,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  categoryTile: {
    width: '23%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    padding: spacing.xs,
  },
  tileIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

