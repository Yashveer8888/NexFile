import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Palette,
  Shield,
  Trash2,
  HardDrive,
  Info,
  ChevronRight,
  Eye,
  Sliders,
  ExternalLink,
  Check,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { useFileStore } from '../../app/store/useFileStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { ConfirmDialog } from '../../components/dialogs/ConfirmDialog';
import { openAppSettings } from '../../services/permissions/permissionsService';
import { fileService } from '../../services/filesystem/fileService';

export const SettingsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, mode, setThemeMode } = useThemeStore();
  const { showHidden, toggleShowHidden } = useFileStore();

  const [confirmEmptyBin, setConfirmEmptyBin] = useState(false);
  const [recycleBinCount, setRecycleBinCount] = useState(
    fileService.getRecycleBinItems().length
  );

  const handleEmptyRecycleBin = () => {
    fileService.emptyRecycleBin();
    setRecycleBinCount(0);
    setConfirmEmptyBin(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Header title="Settings" subtitle="Preferences & Storage" />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Theme Settings */}
        <Text style={[typography.labelMedium, { color: colors.textMuted, marginBottom: spacing.sm }]}>
          APPEARANCE & THEME
        </Text>
        <Card style={styles.sectionCard}>
          <View style={styles.themeOptionsRow}>
            {(['light', 'dark', 'amoled'] as const).map((t) => {
              const isSelected = mode === t;
              return (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.themeOptionBtn,
                    {
                      backgroundColor: isSelected ? colors.primaryLight : colors.surfaceVariant,
                      borderColor: isSelected ? colors.primary : 'transparent',
                    },
                  ]}
                  onPress={() => setThemeMode(t)}
                >
                  <Text
                    style={[
                      typography.labelMedium,
                      { color: isSelected ? colors.primary : colors.text, textTransform: 'capitalize' },
                    ]}
                  >
                    {t}
                  </Text>
                  {isSelected && <Check size={16} color={colors.primary} style={{ marginTop: 4 }} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* File Display Settings */}
        <Text style={[typography.labelMedium, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
          FILE DISPLAY
        </Text>
        <Card style={styles.sectionCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Eye size={20} color={colors.text} />
              <View style={styles.settingTextGroup}>
                <Text style={[typography.bodyLarge, { color: colors.text }]}>Show Hidden Files</Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                  Display files starting with a dot (.)
                </Text>
              </View>
            </View>
            <Switch
              value={showHidden}
              onValueChange={toggleShowHidden}
              thumbColor={showHidden ? colors.primary : colors.surfaceVariant}
              trackColor={{ false: colors.surfaceVariant, true: colors.primaryLight }}
            />
          </View>
        </Card>

        {/* Storage & Recycle Bin */}
        <Text style={[typography.labelMedium, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
          STORAGE MANAGEMENT
        </Text>
        <Card style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.settingRowClickable}
            onPress={() => setConfirmEmptyBin(true)}
          >
            <View style={styles.settingLeft}>
              <Trash2 size={20} color={colors.error} />
              <View style={styles.settingTextGroup}>
                <Text style={[typography.bodyLarge, { color: colors.text }]}>Recycle Bin</Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                  {recycleBinCount} items in trash
                </Text>
              </View>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.divider }]} />

          <TouchableOpacity style={styles.settingRowClickable} onPress={openAppSettings}>
            <View style={styles.settingLeft}>
              <Shield size={20} color={colors.primary} />
              <View style={styles.settingTextGroup}>
                <Text style={[typography.bodyLarge, { color: colors.text }]}>App Permissions</Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                  Manage Scoped Storage & Media permissions
                </Text>
              </View>
            </View>
            <ExternalLink size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* About App */}
        <Text style={[typography.labelMedium, { color: colors.textMuted, marginTop: spacing.xl, marginBottom: spacing.sm }]}>
          ABOUT
        </Text>
        <Card style={styles.sectionCard}>
          <View style={styles.aboutRow}>
            <Info size={20} color={colors.primary} />
            <View style={styles.settingTextGroup}>
              <Text style={[typography.bodyLarge, { color: colors.text, fontWeight: '600' }]}>
                NexFile Smart File Manager
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
                Version 1.0.0 (Build 20261115)
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}>
                Architecture: React Native New Architecture • Hermes Engine
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>

      <ConfirmDialog
        visible={confirmEmptyBin}
        title="Empty Recycle Bin"
        message="Permanently delete all items currently in the Recycle Bin? This action cannot be undone."
        confirmTitle="Empty Trash"
        isDestructive
        onConfirm={handleEmptyRecycleBin}
        onCancel={() => setConfirmEmptyBin(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing.xxxl,
  },
  sectionCard: {
    padding: spacing.sm,
  },
  themeOptionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.xs,
  },
  themeOptionBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  settingRowClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTextGroup: {
    marginLeft: spacing.md,
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.sm,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
  },
});

