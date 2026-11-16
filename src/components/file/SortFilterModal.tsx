import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Calendar,
  HardDrive,
  FileCode,
  LayoutList,
  LayoutGrid,
  Eye,
  X,
  Check,
} from 'lucide-react-native';
import { SortField, SortOrder } from '../../types/file';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';

interface SortFilterModalProps {
  visible: boolean;
  onClose: () => void;
  sortBy: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
  viewMode: 'list' | 'grid';
  onViewModeChange: (mode: 'list' | 'grid') => void;
  showHidden: boolean;
  onToggleShowHidden: () => void;
}

export const SortFilterModal: React.FC<SortFilterModalProps> = ({
  visible,
  onClose,
  sortBy,
  sortOrder,
  onSortChange,
  viewMode,
  onViewModeChange,
  showHidden,
  onToggleShowHidden,
}) => {
  const { colors } = useThemeStore();

  const sortFields: { id: SortField; label: string; icon: any }[] = [
    { id: 'name', label: 'Name', icon: sortOrder === 'asc' ? ArrowDownAZ : ArrowUpAZ },
    { id: 'date', label: 'Modified Date', icon: Calendar },
    { id: 'size', label: 'File Size', icon: HardDrive },
    { id: 'type', label: 'File Type', icon: FileCode },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.content,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[typography.h3, { color: colors.text }]}>View & Sort</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* View Mode */}
          <Text style={[typography.labelMedium, { color: colors.textMuted, marginTop: spacing.md }]}>
            VIEW STYLE
          </Text>
          <View style={styles.viewModeRow}>
            <TouchableOpacity
              style={[
                styles.viewModeButton,
                {
                  backgroundColor: viewMode === 'list' ? colors.primaryLight : colors.surfaceVariant,
                  borderColor: viewMode === 'list' ? colors.primary : 'transparent',
                },
              ]}
              onPress={() => onViewModeChange('list')}
            >
              <LayoutList size={18} color={viewMode === 'list' ? colors.primary : colors.text} />
              <Text
                style={[
                  typography.labelMedium,
                  { color: viewMode === 'list' ? colors.primary : colors.text, marginLeft: 8 },
                ]}
              >
                List
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.viewModeButton,
                {
                  backgroundColor: viewMode === 'grid' ? colors.primaryLight : colors.surfaceVariant,
                  borderColor: viewMode === 'grid' ? colors.primary : 'transparent',
                },
              ]}
              onPress={() => onViewModeChange('grid')}
            >
              <LayoutGrid size={18} color={viewMode === 'grid' ? colors.primary : colors.text} />
              <Text
                style={[
                  typography.labelMedium,
                  { color: viewMode === 'grid' ? colors.primary : colors.text, marginLeft: 8 },
                ]}
              >
                Grid
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sort By */}
          <Text style={[typography.labelMedium, { color: colors.textMuted, marginTop: spacing.lg }]}>
            SORT BY
          </Text>
          <View style={styles.sortList}>
            {sortFields.map((field) => {
              const isSelected = sortBy === field.id;
              const IconComp = field.icon;

              return (
                <TouchableOpacity
                  key={field.id}
                  style={[
                    styles.sortRow,
                    {
                      backgroundColor: isSelected ? colors.primaryLight : 'transparent',
                    },
                  ]}
                  onPress={() => {
                    if (isSelected) {
                      // Toggle order
                      onSortChange(field.id, sortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      onSortChange(field.id, 'asc');
                    }
                  }}
                >
                  <View style={styles.sortLeft}>
                    <IconComp size={18} color={isSelected ? colors.primary : colors.textMuted} />
                    <Text
                      style={[
                        typography.bodyMedium,
                        {
                          color: isSelected ? colors.primary : colors.text,
                          fontWeight: isSelected ? '600' : '400',
                          marginLeft: spacing.md,
                        },
                      ]}
                    >
                      {field.label}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.sortRight}>
                      <Text style={[typography.labelSmall, { color: colors.primary, marginRight: 4 }]}>
                        {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                      </Text>
                      <Check size={16} color={colors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Hidden Files Toggle */}
          <View style={[styles.switchRow, { borderTopColor: colors.divider }]}>
            <View style={styles.switchLeft}>
              <Eye size={18} color={colors.text} />
              <Text style={[typography.bodyMedium, { color: colors.text, marginLeft: spacing.md }]}>
                Show Hidden Files
              </Text>
            </View>
            <Switch
              value={showHidden}
              onValueChange={onToggleShowHidden}
              thumbColor={showHidden ? colors.primary : colors.surfaceVariant}
              trackColor={{ false: colors.surfaceVariant, true: colors.primaryLight }}
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
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.base,
    borderWidth: 1,
    ...elevation.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  viewModeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  sortList: {
    marginTop: spacing.xs,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
  },
  sortLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.base,
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  switchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

