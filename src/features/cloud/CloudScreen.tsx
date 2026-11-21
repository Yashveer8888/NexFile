import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  RefreshControl,
  Alert,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Plus,
  FileText,
  Folder,
  FolderPlus,
  Camera,
  ArrowLeft,
  MoreVertical,
  Trash2,
  Edit3,
  Share2,
  X,
  Cloud,
  Check,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { formatBytes, formatDate } from '../../utils/formatters';
import { FileItem as FileItemType } from '../../types/file';
import { fileService } from '../../services/filesystem/fileService';
import { PdfScannerModal } from '../pdf-studio/PdfScannerModal';

const GOOGLE_DRIVE_ROOT = '/storage/emulated/0/google drive files';

export const CloudScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();

  const [currentPath, setCurrentPath] = useState(GOOGLE_DRIVE_ROOT);
  const [history, setHistory] = useState<string[]>([]);
  const [files, setFiles] = useState<FileItemType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  // Add Button Options Modal
  const [showAddMenu, setShowAddMenu] = useState(false);

  // PDF Scanner Modal
  const [scannerVisible, setScannerVisible] = useState(false);

  // Create Folder Modal
  const [createFolderVisible, setCreateFolderVisible] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Item Action Modal (Rename / Delete / Share)
  const [actionItem, setActionItem] = useState<FileItemType | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameNewName, setRenameNewName] = useState('');
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);

  // Load directory contents
  const loadDirectory = useCallback(async (dirPath: string) => {
    setIsLoading(true);
    try {
      // Ensure the root "google drive files" directory exists
      await fileService.createFolder('/storage/emulated/0', 'google drive files').catch(() => {});
      const items = await fileService.listDirectory(dirPath, false, true);
      const sorted = fileService.sortFiles(items, 'name', 'asc');
      setFiles(sorted);
    } catch (e) {
      console.warn('Error reading google drive files directory:', e);
      setFiles([]);
    } finally {
      setIsLoading(false);
      setIsPullRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDirectory(currentPath);
    }, [currentPath, loadDirectory])
  );

  // Hardware Back Handler for navigating subfolders
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (showAddMenu) {
          setShowAddMenu(false);
          return true;
        }
        if (scannerVisible) {
          setScannerVisible(false);
          return true;
        }
        if (createFolderVisible) {
          setCreateFolderVisible(false);
          return true;
        }
        if (actionItem) {
          setActionItem(null);
          return true;
        }
        if (history.length > 0) {
          const prev = history[history.length - 1];
          setHistory((prevHist) => prevHist.slice(0, -1));
          setCurrentPath(prev);
          loadDirectory(prev);
          return true;
        }
        return false;
      };

      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [showAddMenu, scannerVisible, createFolderVisible, actionItem, history, loadDirectory])
  );

  const handlePullRefresh = () => {
    setIsPullRefreshing(true);
    loadDirectory(currentPath);
  };

  const handleNavigateUp = () => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((prevHist) => prevHist.slice(0, -1));
      setCurrentPath(prev);
      loadDirectory(prev);
    }
  };

  const handleItemPress = (item: FileItemType) => {
    if (item.isDirectory) {
      setHistory((prev) => [...prev, currentPath]);
      setCurrentPath(item.path);
      loadDirectory(item.path);
    } else {
      fileService.openFile(item.path, item.mimeType);
    }
  };

  // Add Folder Handler
  const handleCreateFolder = async () => {
    const trimmed = newFolderName.trim();
    if (!trimmed) return;

    try {
      await fileService.createFolder(currentPath, trimmed);
      setNewFolderName('');
      setCreateFolderVisible(false);
      loadDirectory(currentPath);
      Alert.alert('Folder Created', `"${trimmed}" folder created successfully.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to create folder');
    }
  };

  // PDF Scan Save Success Handler
  const handleScanSaveSuccess = (savedPath: string) => {
    loadDirectory(currentPath);
    Alert.alert(
      'Document Saved',
      `Scanned PDF saved successfully in Google Drive Files:\n${savedPath.split('/').pop()}`
    );
  };

  // Rename Item
  const handleRenameSubmit = async () => {
    if (!actionItem) return;
    const trimmed = renameNewName.trim();
    if (!trimmed || trimmed === actionItem.name) {
      setRenameModalVisible(false);
      return;
    }

    try {
      await fileService.rename(actionItem.path, trimmed);
      setRenameModalVisible(false);
      setActionItem(null);
      loadDirectory(currentPath);
      Alert.alert('Renamed', `Renamed to "${trimmed}"`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to rename item');
    }
  };

  // Delete Item
  const handleDeleteSubmit = async () => {
    if (!actionItem) return;

    try {
      await fileService.delete(actionItem.path, false);
      setDeleteConfirmVisible(false);
      setActionItem(null);
      loadDirectory(currentPath);
      Alert.alert('Deleted', `"${actionItem.name}" deleted.`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to delete item');
    }
  };

  // Subtitle showing current path / folder
  const currentFolderName = useMemo(() => {
    if (currentPath === GOOGLE_DRIVE_ROOT) {
      return 'google drive files';
    }
    return currentPath.split('/').pop() || 'google drive files';
  }, [currentPath]);

  const isAtRoot = currentPath === GOOGLE_DRIVE_ROOT;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Top Header - Note: Top-right add button is removed as requested */}
      <Header
        title="Google Drive"
        subtitle={isAtRoot ? 'Internal Storage > google drive files' : `.../${currentFolderName}`}
        showThemeToggle
        showBack={!isAtRoot}
        onBack={handleNavigateUp}
      />

      {/* Directory Content List */}
      <FlatList
        data={files}
        keyExtractor={(item) => item.path || item.id}
        refreshControl={
          <RefreshControl
            refreshing={isPullRefreshing}
            onRefresh={handlePullRefresh}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          files.length === 0 && styles.listContentEmpty,
        ]}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.itemCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleItemPress(item)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.iconBox,
                {
                  backgroundColor: item.isDirectory
                    ? `${colors.primary}15`
                    : '#FF572215',
                },
              ]}
            >
              {item.isDirectory ? (
                <Folder size={26} color={colors.primary} fill={colors.primary} />
              ) : (
                <FileText size={26} color="#FF5722" />
              )}
            </View>

            <View style={styles.itemInfo}>
              <Text style={[typography.labelLarge, { color: colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 3 }]}>
                {item.isDirectory
                  ? 'Folder'
                  : `${formatBytes(item.size)} • ${formatDate(item.lastModified)}`}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.moreBtn}
              onPress={() => setActionItem(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MoreVertical size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: `${colors.primary}15` }]}>
                <Cloud size={52} color={colors.primary} />
              </View>
              <Text style={[typography.h3, { color: colors.text, marginTop: spacing.lg }]}>
                Google Drive Files
              </Text>
              <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: spacing.xs, textAlign: 'center' }]}>
                No documents or folders here yet.{'\n'}Tap the "+" button below to scan documents or add folders.
              </Text>
            </View>
          ) : undefined
        }
      />

      {/* 2. Floating Action Button at Bottom-Right */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => setShowAddMenu(true)}
        activeOpacity={0.85}
      >
        <Plus size={28} color="#FFFFFF" strokeWidth={2.6} />
      </TouchableOpacity>

      {/* 4. Add Button Options Modal: 1) Scan Document, 2) Add Folder */}
      <Modal visible={showAddMenu} transparent animationType="fade" onRequestClose={() => setShowAddMenu(false)}>
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
          activeOpacity={1}
          onPress={() => setShowAddMenu(false)}
        >
          <View style={[styles.optionsSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sheetHeader}>
              <Text style={[typography.h4, { color: colors.text }]}>Add to Google Drive</Text>
              <TouchableOpacity onPress={() => setShowAddMenu(false)} style={styles.sheetCloseBtn}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Option 1: Scan Document */}
            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: colors.surfaceVariant }]}
              onPress={() => {
                setShowAddMenu(false);
                setScannerVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconBox, { backgroundColor: `${colors.primary}20` }]}>
                <Camera size={24} color={colors.primary} />
              </View>
              <View style={styles.optionTextGroup}>
                <Text style={[typography.labelLarge, { color: colors.text, fontWeight: '700' }]}>
                  Scan Document
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  Scan and save PDF directly into google drive files
                </Text>
              </View>
            </TouchableOpacity>

            {/* Option 2: Add Folder */}
            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: colors.surfaceVariant, marginTop: spacing.md }]}
              onPress={() => {
                setShowAddMenu(false);
                setNewFolderName('');
                setCreateFolderVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.optionIconBox, { backgroundColor: '#FFB30020' }]}>
                <FolderPlus size={24} color="#FFB300" />
              </View>
              <View style={styles.optionTextGroup}>
                <Text style={[typography.labelLarge, { color: colors.text, fontWeight: '700' }]}>
                  Add Folder
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  Create a new folder in google drive files
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 5. PDF Scanner Modal (Saves to google drive files folder) */}
      <PdfScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onSaveSuccess={handleScanSaveSuccess}
        targetDirectory={currentPath}
      />

      {/* Create Folder Dialog */}
      <Modal visible={createFolderVisible} transparent animationType="fade" onRequestClose={() => setCreateFolderVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.dialogHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <FolderPlus size={22} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={[typography.h4, { color: colors.text }]}>New Folder</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateFolderVisible(false)}>
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[
                styles.dialogInput,
                typography.bodyMedium,
                { color: colors.text, backgroundColor: colors.surfaceVariant, borderColor: colors.border },
              ]}
              placeholder="Folder name"
              placeholderTextColor={colors.textMuted}
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
            />

            <View style={styles.dialogButtonRow}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setCreateFolderVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Create"
                variant="primary"
                onPress={handleCreateFolder}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Item Action Sheet (Rename / Delete / Share) */}
      {actionItem && (
        <Modal visible={Boolean(actionItem)} transparent animationType="fade" onRequestClose={() => setActionItem(null)}>
          <TouchableOpacity
            style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
            activeOpacity={1}
            onPress={() => setActionItem(null)}
          >
            <View style={[styles.optionsSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.sheetHeader}>
                <Text style={[typography.h4, { color: colors.text }]} numberOfLines={1}>
                  {actionItem.name}
                </Text>
                <TouchableOpacity onPress={() => setActionItem(null)}>
                  <X size={20} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Share */}
              {!actionItem.isDirectory && (
                <TouchableOpacity
                  style={[styles.sheetItemRow, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    const itemToShare = actionItem;
                    setActionItem(null);
                    fileService.shareFiles([itemToShare.path]);
                  }}
                >
                  <Share2 size={20} color={colors.primary} style={{ marginRight: 12 }} />
                  <Text style={[typography.labelLarge, { color: colors.text }]}>Share File</Text>
                </TouchableOpacity>
              )}

              {/* Rename */}
              <TouchableOpacity
                style={[styles.sheetItemRow, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setRenameNewName(actionItem.name);
                  setRenameModalVisible(true);
                }}
              >
                <Edit3 size={20} color={colors.primary} style={{ marginRight: 12 }} />
                <Text style={[typography.labelLarge, { color: colors.text }]}>Rename</Text>
              </TouchableOpacity>

              {/* Delete */}
              <TouchableOpacity
                style={styles.sheetItemRow}
                onPress={() => setDeleteConfirmVisible(true)}
              >
                <Trash2 size={20} color={colors.error} style={{ marginRight: 12 }} />
                <Text style={[typography.labelLarge, { color: colors.error }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Rename Dialog */}
      <Modal visible={renameModalVisible} transparent animationType="fade" onRequestClose={() => setRenameModalVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[typography.h4, { color: colors.text, marginBottom: spacing.md }]}>
              Rename Item
            </Text>
            <TextInput
              style={[
                styles.dialogInput,
                typography.bodyMedium,
                { color: colors.text, backgroundColor: colors.surfaceVariant, borderColor: colors.border },
              ]}
              value={renameNewName}
              onChangeText={setRenameNewName}
              autoFocus
            />
            <View style={styles.dialogButtonRow}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setRenameModalVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Save"
                variant="primary"
                onPress={handleRenameSubmit}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteConfirmVisible} transparent animationType="fade" onRequestClose={() => setDeleteConfirmVisible(false)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.dialogCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[typography.h4, { color: colors.text, marginBottom: spacing.sm }]}>
              Confirm Delete
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
              Are you sure you want to delete "{actionItem?.name}"?
            </Text>
            <View style={styles.dialogButtonRow}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setDeleteConfirmVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Delete"
                variant="danger"
                onPress={handleDeleteSubmit}
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
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: spacing.base,
    paddingBottom: 100,
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    ...elevation.sm,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  moreBtn: {
    padding: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.lg,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  optionsSheet: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
    ...elevation.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  sheetCloseBtn: {
    padding: spacing.xs,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    borderRadius: borderRadius.xl,
  },
  optionIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextGroup: {
    flex: 1,
    marginLeft: spacing.md,
  },
  dialogCard: {
    width: '90%',
    maxWidth: 380,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    marginBottom: 'auto',
    marginTop: 'auto',
    ...elevation.lg,
  },
  dialogHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  dialogInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  dialogButtonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  sheetItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
