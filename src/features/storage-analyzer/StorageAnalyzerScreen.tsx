import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PieChart,
  Trash2,
  AlertTriangle,
  HardDrive,
  Copy,
  FolderX,
  Clock,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Check,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { useAnalyzerStore } from '../../app/store/useAnalyzerStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ProgressBar } from '../../components/common/ProgressBar';
import { Badge } from '../../components/common/Badge';
import { ConfirmDialog } from '../../components/dialogs/ConfirmDialog';
import { formatBytes, formatDate } from '../../utils/formatters';
import { DuplicateGroup } from '../../types/analyzer';
import { FileItem } from '../../types/file';

export const StorageAnalyzerScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const {
    report,
    isLoading,
    runAnalysis,
    cleanDuplicates,
    cleanOldDownloads,
    deleteEmptyFolder,
  } = useAnalyzerStore();

  const [confirmGroup, setConfirmGroup] = useState<DuplicateGroup | null>(null);
  const [confirmOldDownloads, setConfirmOldDownloads] = useState(false);
  const [confirmEmptyFolder, setConfirmEmptyFolder] = useState<FileItem | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  useEffect(() => {
    runAnalysis();
  }, []);

  const handleCleanDuplicates = async () => {
    if (!confirmGroup) return;
    await cleanDuplicates(confirmGroup.id);
    setConfirmGroup(null);
    setStatusToast(`Reclaimed ${formatBytes(confirmGroup.reclaimableBytes)} from duplicate copies.`);
    setTimeout(() => setStatusToast(null), 3000);
  };

  const handleCleanOldDownloads = async () => {
    await cleanOldDownloads();
    setConfirmOldDownloads(false);
    setStatusToast('Old downloads moved to Recycle Bin.');
    setTimeout(() => setStatusToast(null), 3000);
  };

  const handleDeleteEmptyFolder = async () => {
    if (!confirmEmptyFolder) return;
    await deleteEmptyFolder(confirmEmptyFolder.path);
    setConfirmEmptyFolder(null);
    setStatusToast(`Deleted empty folder: ${confirmEmptyFolder.name}`);
    setTimeout(() => setStatusToast(null), 3000);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Header
        title="Storage Analyzer"
        subtitle="Health & Cleanup Inspector"
        showBack
        onBack={() => navigation.goBack()}
        showThemeToggle
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {statusToast && (
          <View style={[styles.toast, { backgroundColor: colors.successBackground }]}>
            <Text style={[typography.labelMedium, { color: colors.success }]}>{statusToast}</Text>
          </View>
        )}

        {report && (
          <>
            {/* Storage Hero Overview */}
            <Card style={styles.heroCard} elevated>
              <View style={styles.heroHeader}>
                <View style={[styles.pieIconBox, { backgroundColor: `${colors.primary}20` }]}>
                  <PieChart size={28} color={colors.primary} />
                </View>
                <View style={styles.heroStats}>
                  <Text style={[typography.h3, { color: colors.text }]}>
                    {formatBytes(report.usedBytes)} Used
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                    {formatBytes(report.freeBytes)} free of {formatBytes(report.totalBytes)} total
                  </Text>
                </View>
              </View>

              {/* Multi-category distribution bar */}
              <View style={styles.multiBar}>
                {report.categories.map((cat) => (
                  <View
                    key={cat.category}
                    style={{
                      height: 10,
                      width: `${Math.max(4, cat.percentage)}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                ))}
              </View>

              {/* Categories Legend Grid */}
              <View style={styles.legendGrid}>
                {report.categories.map((cat) => (
                  <View key={cat.category} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                    <View>
                      <Text style={[typography.labelSmall, { color: colors.text }]}>{cat.name}</Text>
                      <Text style={[typography.bodySmall, { color: colors.textMuted, fontSize: 11 }]}>
                        {formatBytes(cat.bytes)} ({cat.percentage}%)
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>

            {/* Reclaimable Space Recommendation */}
            {report.totalReclaimableBytes > 0 && (
              <Card style={[styles.reclaimCard, { backgroundColor: colors.primaryLight, borderColor: colors.primary }]}>
                <View style={styles.reclaimRow}>
                  <Sparkles size={24} color={colors.primary} />
                  <View style={styles.reclaimInfo}>
                    <Text style={[typography.labelLarge, { color: colors.primary }]}>
                      Safe Cleanup Opportunity
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                      You can safely reclaim up to {formatBytes(report.totalReclaimableBytes)} from duplicates and old downloads.
                    </Text>
                  </View>
                </View>
              </Card>
            )}

            {/* Duplicate Files Section */}
            <View style={styles.sectionTitleRow}>
              <Text style={[typography.h3, { color: colors.text }]}>
                Duplicate Files ({report.duplicateGroups.length} groups)
              </Text>
            </View>

            {report.duplicateGroups.map((group) => (
              <Card key={group.id} style={styles.groupCard}>
                <View style={styles.groupHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.labelMedium, { color: colors.text }]} numberOfLines={1}>
                      {group.originalFile.name}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                      {formatBytes(group.size)} • {group.duplicateFiles.length} duplicate copy
                    </Text>
                  </View>
                  <Button
                    title="Clean Copy"
                    size="sm"
                    variant="danger"
                    onPress={() => setConfirmGroup(group)}
                  />
                </View>
              </Card>
            ))}

            {/* Large Files Section (> 50MB) */}
            <View style={[styles.sectionTitleRow, { marginTop: spacing.xl }]}>
              <Text style={[typography.h3, { color: colors.text }]}>
                Large Files ({report.largeFiles.length})
              </Text>
            </View>

            {report.largeFiles.slice(0, 5).map((file) => (
              <Card key={file.id} style={styles.fileCard}>
                <View style={styles.fileRow}>
                  <HardDrive size={20} color={colors.primary} />
                  <View style={styles.fileInfo}>
                    <Text style={[typography.labelLarge, { color: colors.text }]} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                      {file.path}
                    </Text>
                  </View>
                  <Badge label={formatBytes(file.size)} color={colors.primary} />
                </View>
              </Card>
            ))}

            {/* Empty Folders Section */}
            {report.emptyFolders.length > 0 && (
              <>
                <View style={[styles.sectionTitleRow, { marginTop: spacing.xl }]}>
                  <Text style={[typography.h3, { color: colors.text }]}>
                    Empty Folders ({report.emptyFolders.length})
                  </Text>
                </View>

                {report.emptyFolders.map((folder) => (
                  <Card key={folder.id} style={styles.fileCard}>
                    <View style={styles.fileRow}>
                      <FolderX size={20} color={colors.textMuted} />
                      <View style={styles.fileInfo}>
                        <Text style={[typography.labelLarge, { color: colors.text }]} numberOfLines={1}>
                          {folder.name}
                        </Text>
                        <Text style={[typography.bodySmall, { color: colors.textMuted }]}>
                          0 items inside
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => setConfirmEmptyFolder(folder)}
                        style={styles.deleteEmptyBtn}
                      >
                        <Trash2 size={16} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </Card>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        visible={Boolean(confirmGroup)}
        title="Clean Duplicate Copies"
        message={`Delete ${confirmGroup?.duplicateFiles.length} duplicate copy of "${confirmGroup?.originalFile.name}"? The original file will be safely kept, and copies moved to Recycle Bin.`}
        confirmTitle="Clean Duplicates"
        isDestructive
        onConfirm={handleCleanDuplicates}
        onCancel={() => setConfirmGroup(null)}
      />

      <ConfirmDialog
        visible={Boolean(confirmEmptyFolder)}
        title="Delete Empty Folder"
        message={`Remove the empty directory "${confirmEmptyFolder?.name}"?`}
        confirmTitle="Delete"
        isDestructive
        onConfirm={handleDeleteEmptyFolder}
        onCancel={() => setConfirmEmptyFolder(null)}
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
  toast: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  heroCard: {
    padding: spacing.base,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pieIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStats: {
    marginLeft: spacing.md,
    flex: 1,
  },
  multiBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginTop: spacing.md,
    backgroundColor: '#E0E0E0',
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '45%',
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  reclaimCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  reclaimRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reclaimInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  sectionTitleRow: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  groupCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fileCard: {
    marginBottom: spacing.xs,
    padding: spacing.md,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  deleteEmptyBtn: {
    padding: spacing.xs,
  },
});
