import React, { useState } from 'react';
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
  FileCode,
  ArrowRight,
  Play,
  CheckCircle2,
  Clock,
  Trash2,
  FolderOpen,
  Share2,
  ExternalLink,
  Plus,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { useConverterStore } from '../../app/store/useConverterStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ProgressBar } from '../../components/common/ProgressBar';
import { Badge } from '../../components/common/Badge';
import { formatBytes, formatDate } from '../../utils/formatters';
import { SupportedConversionFormat } from '../../types/pdf';
import { converterService } from '../../services/converter/converterService';
import { fileService } from '../../services/filesystem/fileService';

export const DocumentConverterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const {
    tasks,
    history,
    isConverting,
    addTask,
    startBatchConversion,
    clearCompleted,
    removeTask,
  } = useConverterStore();

  const [selectedSourcePath, setSelectedSourcePath] = useState(
    '/storage/emulated/0/Download/Project_Specification_2026.pdf'
  );
  const [selectedSourceFormat, setSelectedSourceFormat] = useState<SupportedConversionFormat>('pdf');
  const [selectedTargetFormat, setSelectedTargetFormat] = useState<SupportedConversionFormat>('docx');

  const availableTargets = converterService.getSupportedTargetFormats(selectedSourceFormat);

  const sampleSourceFiles = [
    { name: 'Project_Specification_2026.pdf', path: '/storage/emulated/0/Download/Project_Specification_2026.pdf', format: 'pdf' as const },
    { name: 'Product_Roadmap_2027.docx', path: '/storage/emulated/0/Documents/Product_Roadmap_2027.docx', format: 'docx' as const },
    { name: 'Financial_Summary_2026.xlsx', path: '/storage/emulated/0/Download/Financial_Summary_2026.xlsx', format: 'xlsx' as const },
    { name: 'Meeting_Notes.txt', path: '/storage/emulated/0/Documents/Meeting_Notes.txt', format: 'txt' as const },
    { name: 'IMG_20261115_102045.jpg', path: '/storage/emulated/0/DCIM/Camera/IMG_20261115_102045.jpg', format: 'jpg' as const },
  ];

  const handleSelectSource = (file: typeof sampleSourceFiles[0]) => {
    setSelectedSourcePath(file.path);
    setSelectedSourceFormat(file.format);
    const validTargets = converterService.getSupportedTargetFormats(file.format);
    setSelectedTargetFormat(validTargets[0] || 'pdf');
  };

  const handleAddToQueue = async () => {
    await addTask(selectedSourcePath, selectedSourceFormat, selectedTargetFormat);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Header
        title="Document Converter"
        subtitle="Universal Format Engine"
        showBack
        onBack={() => navigation.goBack()}
        showThemeToggle
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Source File Selection Card */}
        <Card style={styles.configCard} elevated>
          <Text style={[typography.labelMedium, { color: colors.textMuted }]}>
            1. SELECT SOURCE FILE
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sourceScroll}>
            {sampleSourceFiles.map((file) => {
              const isSelected = selectedSourcePath === file.path;
              return (
                <TouchableOpacity
                  key={file.path}
                  style={[
                    styles.sourceFileChip,
                    {
                      backgroundColor: isSelected ? colors.primaryLight : colors.surfaceVariant,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => handleSelectSource(file)}
                >
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: isSelected ? colors.primary : colors.text },
                    ]}
                    numberOfLines={1}
                  >
                    {file.name}
                  </Text>
                  <Text
                    style={[
                      typography.labelSmall,
                      { color: isSelected ? colors.primary : colors.textMuted, marginTop: 2 },
                    ]}
                  >
                    .{file.format}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Conversion Arrow & Target Format Picker */}
          <View style={styles.formatSelectionRow}>
            <View style={[styles.formatPill, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[typography.labelLarge, { color: colors.text, textTransform: 'uppercase' }]}>
                {selectedSourceFormat}
              </Text>
            </View>

            <View style={styles.arrowBox}>
              <ArrowRight size={22} color={colors.primary} />
            </View>

            <View style={styles.targetOptions}>
              {availableTargets.map((target) => {
                const isSelected = selectedTargetFormat === target;
                return (
                  <TouchableOpacity
                    key={target}
                    style={[
                      styles.targetPill,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.surfaceVariant,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedTargetFormat(target)}
                  >
                    <Text
                      style={[
                        typography.labelMedium,
                        { color: isSelected ? '#FFFFFF' : colors.text, textTransform: 'uppercase' },
                      ]}
                    >
                      {target}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Button
            title="Add to Conversion Queue"
            variant="outline"
            icon={<Plus size={16} color={colors.text} />}
            onPress={handleAddToQueue}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* Active Queue Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[typography.h3, { color: colors.text }]}>Conversion Queue</Text>
          {tasks.length > 0 && (
            <Button
              title="Convert All"
              size="sm"
              variant="primary"
              loading={isConverting}
              icon={<Play size={14} color="#FFFFFF" />}
              onPress={startBatchConversion}
            />
          )}
        </View>

        {tasks.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Clock size={32} color={colors.textMuted} />
            <Text style={[typography.bodyMedium, { color: colors.textMuted, marginTop: spacing.sm }]}>
              Queue is empty. Select a document above and add to queue.
            </Text>
          </Card>
        ) : (
          tasks.map((task) => (
            <Card key={task.id} style={styles.taskCard}>
              <View style={styles.taskHeader}>
                <View style={styles.taskInfo}>
                  <Text style={[typography.labelLarge, { color: colors.text }]} numberOfLines={1}>
                    {task.sourceName}
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
                    {task.sourceFormat.toUpperCase()} → {task.targetFormat.toUpperCase()}
                  </Text>
                </View>
                <Badge
                  label={task.status}
                  color={task.status === 'completed' ? colors.success : colors.primary}
                  backgroundColor={task.status === 'completed' ? colors.successBackground : colors.primaryLight}
                />
              </View>

              {task.status === 'converting' && (
                <ProgressBar
                  progress={task.progress}
                  color={colors.primary}
                  style={{ marginTop: spacing.md }}
                />
              )}
            </Card>
          ))
        )}

        {/* Conversion History Section */}
        <View style={[styles.sectionHeaderRow, { marginTop: spacing.xl }]}>
          <Text style={[typography.h3, { color: colors.text }]}>Conversion History</Text>
          {history.length > 0 && (
            <TouchableOpacity onPress={clearCompleted}>
              <Text style={[typography.labelSmall, { color: colors.error }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {history.map((item) => (
          <Card key={item.id} style={styles.historyCard}>
            <View style={styles.historyRow}>
              <View style={[styles.successIconCircle, { backgroundColor: colors.successBackground }]}>
                <CheckCircle2 size={20} color={colors.success} />
              </View>

              <View style={styles.historyTextGroup}>
                <Text style={[typography.labelLarge, { color: colors.text }]} numberOfLines={1}>
                  {item.outputPath?.split('/').pop() || item.sourceName}
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
                  {item.sourceFormat.toUpperCase()} → {item.targetFormat.toUpperCase()} • {formatDate(item.timestamp)}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.openConvertedBtn}
                onPress={() => item.outputPath && fileService.openFile(item.outputPath)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ExternalLink size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </Card>
        ))}
      </ScrollView>
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
  configCard: {
    padding: spacing.base,
  },
  sourceScroll: {
    marginVertical: spacing.md,
  },
  sourceFileChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginRight: spacing.sm,
    maxWidth: 160,
  },
  formatSelectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  formatPill: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  arrowBox: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    flex: 1,
  },
  targetPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  taskCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskInfo: {
    flex: 1,
  },
  historyCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  successIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTextGroup: {
    flex: 1,
    marginLeft: spacing.md,
  },
  openConvertedBtn: {
    padding: spacing.xs,
  },
});
