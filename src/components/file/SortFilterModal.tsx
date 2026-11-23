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
  Clock,
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
  title?: string;
  sortBy: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
  viewMode?: 'list' | 'grid';
  onViewModeChange?: (mode: 'list' | 'grid') => void;
  showHidden?: boolean;
  onToggleShowHidden?: () => void;
}

export const SortFilterModal: React.FC<SortFilterModalProps> = ({
  visible,
  onClose,
  title,
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
    { id: 'date', label: 'Date Modified', icon: Calendar },
    { id: 'size', label: 'File Size', icon: HardDrive },
    { id: 'duration', label: 'Duration', icon: Clock },
    { id: 'type', label: 'File Type', icon: FileCode },
  ];

  const hasViewMode = Boolean(viewMode && onViewModeChange);
  const hasHiddenToggle = typeof showHidden === 'boolean' && Boolean(onToggleShowHidden);

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
            <Text style={[typography.h3, { color: colors.text }]}>
              {title || (hasViewMode ? 'View & Sort' : 'Sort Files')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* View Mode (Optional) */}
          {hasViewMode && (
            <>
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
                  onPress={() => onViewModeChange?.('list')}
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
                  onPress={() => onViewModeChange?.('grid')}
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
            </>
          )}

          {/* Sort By */}
          <Text style={[typography.labelMedium, { color: colors.textMuted, marginTop: hasViewMode ? spacing.lg : spacing.md }]}>
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

          {/* Hidden Files Toggle (Optional) */}
          {hasHiddenToggle && (
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
          )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  viewModeRow: {
    flexDirection: 'row',
    gap: spacing.base,
    marginTop: spacing.sm,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  sortList: {
    marginTop: spacing.sm,
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
    marginTop: spacing.base,
    borderTopWidth: 1,
  },
  switchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
