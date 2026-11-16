import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Switch,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Package,
  ExternalLink,
  Download,
  Settings,
  Search,
  CheckCircle2,
  Trash2,
  Info,
  Shield,
  X,
  Play,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { useAppManagerStore } from '../../app/store/useAppManagerStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { formatBytes, formatDate } from '../../utils/formatters';
import { InstalledApp, StandaloneApk } from '../../types/appManager';

export const AppManagerScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const {
    apps,
    apks,
    includeSystemApps,
    searchQuery,
    isLoading,
    loadInstalledApps,
    loadStandaloneApks,
    setIncludeSystemApps,
    setSearchQuery,
    launchApp,
    openAppSettings,
    installApk,
    backupApp,
  } = useAppManagerStore();

  const [activeTab, setActiveTab] = useState<'installed' | 'apks'>('installed');
  const [selectedApk, setSelectedApk] = useState<StandaloneApk | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  useEffect(() => {
    loadInstalledApps();
    loadStandaloneApks();
  }, []);

  const filteredApps = apps.filter(
    (a) =>
      a.appName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.packageName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBackup = async (app: InstalledApp) => {
    try {
      const backupPath = await backupApp(app.packageName);
      setStatusToast(`Backed up: ${backupPath.split('/').pop()}`);
      setTimeout(() => setStatusToast(null), 4000);
    } catch (e) {
      console.warn('Backup error:', e);
    }
  };

  const handleInstall = async (apk: StandaloneApk) => {
    try {
      await installApk(apk.path);
    } catch (e) {
      console.warn('Install error:', e);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Header
        title="App & APK Manager"
        subtitle={activeTab === 'installed' ? `${apps.length} Installed Apps` : `${apks.length} Standalone APKs`}
        showBack
        onBack={() => navigation.goBack()}
        showThemeToggle
      />

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'installed' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('installed')}
        >
          <Package size={18} color={activeTab === 'installed' ? colors.primary : colors.textMuted} />
          <Text
            style={[
              typography.labelMedium,
              { color: activeTab === 'installed' ? colors.primary : colors.textMuted, marginLeft: 6 },
            ]}
          >
            Installed Apps
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'apks' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('apks')}
        >
          <Download size={18} color={activeTab === 'apks' ? colors.primary : colors.textMuted} />
          <Text
            style={[
              typography.labelMedium,
              { color: activeTab === 'apks' ? colors.primary : colors.textMuted, marginLeft: 6 },
            ]}
          >
            APK Packages
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search & Filter Bar */}
      <View style={[styles.searchFilterRow, { backgroundColor: colors.surface }]}>
        <View style={[styles.searchInputBox, { backgroundColor: colors.surfaceVariant }]}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, typography.bodySmall, { color: colors.text }]}
            placeholder="Search by app name or package..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {activeTab === 'installed' && (
          <View style={styles.systemAppSwitch}>
            <Text style={[typography.labelSmall, { color: colors.textMuted, marginRight: 6 }]}>System</Text>
            <Switch
              value={includeSystemApps}
              onValueChange={setIncludeSystemApps}
              thumbColor={includeSystemApps ? colors.primary : colors.surfaceVariant}
              trackColor={{ false: colors.surfaceVariant, true: colors.primaryLight }}
            />
          </View>
        )}
      </View>

      {statusToast && (
        <View style={[styles.toast, { backgroundColor: colors.primaryLight }]}>
          <Text style={[typography.labelMedium, { color: colors.primary }]}>{statusToast}</Text>
        </View>
      )}

      {activeTab === 'installed' ? (
        /* Installed Apps List */
        <FlatList
          data={filteredApps}
          keyExtractor={(item) => item.packageName}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.appCard}>
              <View style={styles.appRow}>
                <View style={[styles.appIconCircle, { backgroundColor: `${colors.apkColor}20` }]}>
                  <Package size={22} color={colors.apkColor} />
                </View>

                <View style={styles.appInfo}>
                  <Text style={[typography.labelLarge, { color: colors.text }]} numberOfLines={1}>
                    {item.appName}
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.packageName}
                  </Text>
                  <Text style={[typography.labelSmall, { color: colors.textSecondary, marginTop: 2 }]}>
                    v{item.versionName} • {formatBytes(item.size)}
                  </Text>
                </View>

                <View style={styles.appActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => launchApp(item.packageName)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Play size={18} color={colors.primary} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleBackup(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Download size={18} color={colors.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => openAppSettings(item.packageName)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Settings size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          )}
        />
      ) : (
        /* Standalone APKs List */
        <FlatList
          data={apks}
          keyExtractor={(item) => item.path}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Card style={styles.appCard}>
              <View style={styles.appRow}>
                <View style={[styles.appIconCircle, { backgroundColor: `${colors.apkColor}20` }]}>
                  <Download size={22} color={colors.apkColor} />
                </View>

                <View style={styles.appInfo}>
                  <Text style={[typography.labelLarge, { color: colors.text }]} numberOfLines={1}>
                    {item.appName}
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textMuted }]} numberOfLines={1}>
                    v{item.versionName} • Target SDK {item.targetSdkVersion}
                  </Text>
                  <Text style={[typography.labelSmall, { color: colors.textSecondary, marginTop: 2 }]}>
                    {formatBytes(item.size)}
                  </Text>
                </View>

                <View style={styles.appActions}>
                  <Button
                    title="Install"
                    size="sm"
                    variant="primary"
                    onPress={() => handleInstall(item)}
                  />
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => setSelectedApk(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Info size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          )}
        />
      )}

      {/* APK Details Modal */}
      {selectedApk && (
        <Modal visible={Boolean(selectedApk)} transparent animationType="fade">
          <View style={[styles.dialogBackdrop, { backgroundColor: colors.overlay }]}>
            <View style={[styles.dialogBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.dialogHeader}>
                <Text style={[typography.h3, { color: colors.text }]}>{selectedApk.appName}</Text>
                <TouchableOpacity onPress={() => setSelectedApk(null)}>
                  <X size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                {selectedApk.packageName}
              </Text>

              <View style={[styles.metaSection, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[typography.bodySmall, { color: colors.text }]}>Version: {selectedApk.versionName}</Text>
                <Text style={[typography.bodySmall, { color: colors.text }]}>Target SDK: Android {selectedApk.targetSdkVersion}</Text>
                <Text style={[typography.bodySmall, { color: colors.text }]}>Size: {formatBytes(selectedApk.size)}</Text>
              </View>

              <Text style={[typography.labelSmall, { color: colors.textMuted, marginTop: spacing.md }]}>
                REQUIRED PERMISSIONS ({selectedApk.permissions.length})
              </Text>

              <ScrollView style={styles.permScroll}>
                {selectedApk.permissions.map((p, idx) => (
                  <Text key={idx} style={[typography.mono, { color: colors.textSecondary, fontSize: 10, marginVertical: 2 }]}>
                    • {p.replace('android.permission.', '')}
                  </Text>
                ))}
              </ScrollView>

              <Button
                title="Install APK"
                variant="primary"
                onPress={() => {
                  handleInstall(selectedApk);
                  setSelectedApk(null);
                }}
                style={{ marginTop: spacing.md }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    height: 48,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  searchInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: 38,
    borderRadius: borderRadius.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 0,
    marginLeft: spacing.xs,
  },
  systemAppSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toast: {
    padding: spacing.md,
    marginHorizontal: spacing.base,
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.base,
    paddingBottom: spacing.xxxl,
  },
  appCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  appActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionBtn: {
    padding: spacing.xs,
  },
  dialogBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialogBox: {
    width: '100%',
    maxWidth: 380,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    ...elevation.lg,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  metaSection: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: 4,
    marginTop: spacing.md,
  },
  permScroll: {
    maxHeight: 120,
    marginTop: spacing.xs,
  },
});
