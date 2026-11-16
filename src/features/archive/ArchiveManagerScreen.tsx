import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Archive,
  FolderArchive,
  Download,
  FolderOpen,
  FileCheck,
  CheckCircle2,
  Lock,
  Plus,
  Sliders,
  X,
  Check,
  CheckSquare,
  Square,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { useArchiveStore } from '../../app/store/useArchiveStore';
import { useFileStore } from '../../app/store/useFileStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { formatBytes, formatDate } from '../../utils/formatters';
import { fileService } from '../../services/filesystem/fileService';
import { FileItem as FileItemType } from '../../types/file';
import { ArchiveEntry } from '../../types/archive';

export const ArchiveManagerScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const {
    currentArchive,
    selectedEntries,
    isLoading,
    inspectArchive,
    toggleSelectEntry,
    selectAllEntries,
    clearSelection,
    createArchive,
    extractArchive,
  } = useArchiveStore();

  const [archiveFiles, setArchiveFiles] = useState<FileItemType[]>([]);
  const [inspectModalVisible, setInspectModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [archiveName, setArchiveName] = useState('New_Archive');
  const [compressionLevel, setCompressionLevel] = useState<number>(6); // 1 = fast, 6 = normal, 9 = max
  const [passwordProtection, setPasswordProtection] = useState(false);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  useEffect(() => {
    loadArchiveFiles();
  }, []);

  const loadArchiveFiles = async () => {
    const archives = await fileService.getFilesByCategory('archives');
    setArchiveFiles(archives);
  };

  const handleInspect = async (file: FileItemType) => {
    await inspectArchive(file.path);
    setInspectModalVisible(true);
  };

  const handleExtractAll = async () => {
    if (!currentArchive) return;
    try {
      const dest = `/storage/emulated/0/Download/${currentArchive.name.replace('.zip', '')}`;
      const extracted = await extractArchive(currentArchive.path, dest, false);
      setInspectModalVisible(false);
      setStatusToast(`Extracted ${extracted.length} files to Download folder`);
      setTimeout(() => setStatusToast(null), 4000);
    } catch (e: any) {
      console.warn('Extraction error:', e);
    }
  };

  const handleExtractSelected = async () => {
    if (!currentArchive || selectedEntries.size === 0) return;
    try {
      const dest = `/storage/emulated/0/Download/${currentArchive.name.replace('.zip', '')}`;
      const extracted = await extractArchive(currentArchive.path, dest, true);
      setInspectModalVisible(false);
      setStatusToast(`Selectively extracted ${extracted.length} item(s)`);
      setTimeout(() => setStatusToast(null), 4000);
    } catch (e: any) {
      console.warn('Extraction error:', e);
    }
  };

  const handleCreateArchive = async () => {
    try {
      const sampleSources = [
        '/storage/emulated/0/Documents/Contract_Agreement_Signed.pdf',
        '/storage/emulated/0/Documents/Meeting_Notes.txt',
      ];
      const dest = `/storage/emulated/0/Download/${archiveName.trim() || 'Archive'}.zip`;
      await createArchive(sampleSources, dest, compressionLevel);
      setCreateModalVisible(false);
      await loadArchiveFiles();
      setStatusToast(`Created archive: ${dest.split('/').pop()}`);
      setTimeout(() => setStatusToast(null), 4000);
    } catch (e) {
      console.warn('Create archive error:', e);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Header
        title="Archive Manager"
        subtitle="ZIP, TAR, GZ & 7Z Engine"
        showBack
        onBack={() => navigation.goBack()}
        showThemeToggle
        rightActions={
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setCreateModalVisible(true)}
          >
            <Plus size={20} color={colors.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Create Archive Card */}
        <Card style={styles.heroCard} elevated>
          <View style={styles.heroRow}>
            <View style={[styles.archiveIconCircle, { backgroundColor: `${colors.archiveColor}20` }]}>
              <FolderArchive size={30} color={colors.archiveColor} />
            </View>
            <View style={styles.heroTextGroup}>
              <Text style={[typography.h3, { color: colors.text }]}>Archive Packaging</Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                Compress multiple files into ZIP or 7Z archives with adjustable compression and password security.
              </Text>
            </View>
          </View>
          <Button
            title="Create New Archive"
            variant="primary"
            icon={<Plus size={16} color="#FFFFFF" />}
            onPress={() => setCreateModalVisible(true)}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {statusToast && (
          <View style={[styles.toastContainer, { backgroundColor: colors.primaryLight }]}>
            <Text style={[typography.labelMedium, { color: colors.primary }]}>{statusToast}</Text>
          </View>
        )}

        {/* Existing Archives List */}
        <View style={[styles.sectionTitleRow, { marginTop: spacing.xl }]}>
          <Text style={[typography.h3, { color: colors.text }]}>Archives on Device</Text>
          <Text style={[typography.labelSmall, { color: colors.textMuted }]}>
            ({archiveFiles.length})
          </Text>
        </View>

        {archiveFiles.map((file) => (
          <Card key={file.id} style={styles.archiveFileCard}>
            <View style={styles.archiveRow}>
              <View style={[styles.archiveBadge, { backgroundColor: `${colors.archiveColor}15` }]}>
                <Archive size={22} color={colors.archiveColor} />
              </View>

              <View style={styles.archiveInfo}>
                <Text style={[typography.labelLarge, { color: colors.text }]} numberOfLines={1}>
                  {file.name}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
                  {formatBytes(file.size)} • {formatDate(file.lastModified)}
                </Text>
              </View>

              <Button
                title="Preview"
                size="sm"
                variant="outline"
                onPress={() => handleInspect(file)}
              />
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* Archive Inspection & Selective Extraction Modal */}
      {currentArchive && (
        <Modal visible={inspectModalVisible} animationType="slide" onRequestClose={() => setInspectModalVisible(false)}>
          <View style={[styles.modalContainer, { backgroundColor: colors.background, paddingTop: insets.top }]}>
            <View style={[styles.modalHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setInspectModalVisible(false)} style={styles.iconBtn}>
                <X size={22} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.modalTitleGroup}>
                <Text style={[typography.h4, { color: colors.text }]} numberOfLines={1}>
                  {currentArchive.name}
                </Text>
                <Text style={[typography.labelSmall, { color: colors.textMuted }]}>
                  {currentArchive.totalFiles} files • {formatBytes(currentArchive.uncompressedSize)} uncompressed
                </Text>
              </View>
              <Badge
                label={`-${currentArchive.compressionRatio}%`}
                color={colors.success}
                backgroundColor={colors.successBackground}
              />
            </View>

            {/* Selection Toolbar */}
            <View style={[styles.selectToolbar, { backgroundColor: colors.surfaceVariant }]}>
              <TouchableOpacity onPress={selectAllEntries} style={styles.toolbarSelectAll}>
                <CheckSquare size={16} color={colors.primary} />
                <Text style={[typography.labelSmall, { color: colors.primary, marginLeft: 6 }]}>
                  Select All
                </Text>
              </TouchableOpacity>
              <Text style={[typography.labelSmall, { color: colors.textSecondary }]}>
                {selectedEntries.size} selected
              </Text>
            </View>

            {/* Entries List */}
            <FlatList
              data={currentArchive.entries}
              keyExtractor={(item) => item.name}
              contentContainerStyle={{ padding: spacing.base }}
              renderItem={({ item }) => {
                const isSelected = selectedEntries.has(item.name);
                return (
                  <TouchableOpacity
                    style={[
                      styles.entryRow,
                      {
                        backgroundColor: isSelected ? colors.primaryLight : colors.card,
                        borderColor: isSelected ? colors.primary : colors.cardBorder,
                      },
                    ]}
                    onPress={() => !item.isDirectory && toggleSelectEntry(item.name)}
                  >
                    {!item.isDirectory && (
                      <View style={styles.checkbox}>
                        {isSelected ? (
                          <CheckSquare size={18} color={colors.primary} />
                        ) : (
                          <Square size={18} color={colors.textMuted} />
                        )}
                      </View>
                    )}

                    <View style={styles.entryInfo}>
                      <Text style={[typography.labelMedium, { color: colors.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[typography.labelSmall, { color: colors.textMuted, marginTop: 2 }]}>
                        {item.isDirectory ? 'Folder' : `${formatBytes(item.size)} (Compressed: ${formatBytes(item.compressedSize)})`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />

            {/* Extraction Footer */}
            <View style={[styles.extractFooter, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
              {selectedEntries.size > 0 && (
                <Button
                  title={`Extract Selected (${selectedEntries.size})`}
                  variant="outline"
                  onPress={handleExtractSelected}
                  style={{ flex: 1, marginRight: spacing.sm }}
                />
              )}
              <Button
                title="Extract All"
                variant="primary"
                icon={<Download size={16} color="#FFFFFF" />}
                onPress={handleExtractAll}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </Modal>
      )}

      {/* Create Archive Modal */}
      <Modal visible={createModalVisible} transparent animationType="fade">
        <View style={[styles.dialogBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialogBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dialogHeader}>
              <Text style={[typography.h3, { color: colors.text }]}>Create Archive</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.dialogInput,
                typography.bodyLarge,
                { color: colors.text, backgroundColor: colors.surfaceVariant, borderColor: colors.border },
              ]}
              value={archiveName}
              onChangeText={setArchiveName}
              placeholder="Archive Name"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[typography.labelSmall, { color: colors.textMuted, marginTop: spacing.md }]}>
              COMPRESSION LEVEL
            </Text>
            <View style={styles.levelRow}>
              {[
                { label: 'Fastest', level: 1 },
                { label: 'Normal', level: 6 },
                { label: 'Maximum', level: 9 },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.level}
                  style={[
                    styles.levelBtn,
                    {
                      backgroundColor: compressionLevel === opt.level ? colors.primaryLight : colors.surfaceVariant,
                      borderColor: compressionLevel === opt.level ? colors.primary : 'transparent',
                    },
                  ]}
                  onPress={() => setCompressionLevel(opt.level)}
                >
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: compressionLevel === opt.level ? colors.primary : colors.text },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.dialogButtons}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setCreateModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Create ZIP"
                variant="primary"
                onPress={handleCreateArchive}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing.xxxl,
  },
  heroCard: {
    padding: spacing.base,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  archiveIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextGroup: {
    flex: 1,
    marginLeft: spacing.md,
  },
  toastContainer: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  archiveFileCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  archiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  archiveBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archiveInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    padding: spacing.xs,
  },
  modalTitleGroup: {
    flex: 1,
    marginHorizontal: spacing.md,
  },
  selectToolbar: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
  },
  toolbarSelectAll: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  checkbox: {
    marginRight: spacing.md,
  },
  entryInfo: {
    flex: 1,
  },
  extractFooter: {
    padding: spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dialogBackdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialogBox: {
    width: '100%',
    maxWidth: 360,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    ...elevation.lg,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  dialogInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  levelRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  levelBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
