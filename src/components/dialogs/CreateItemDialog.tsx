import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { FolderPlus, FilePlus, X, FileText, Folder } from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Button } from '../common/Button';

interface CreateItemDialogProps {
  visible: boolean;
  initialType?: 'folder' | 'file';
  onCreateFolder: (name: string) => Promise<void> | void;
  onCreateFile: (name: string, content: string) => Promise<void> | void;
  onCancel: () => void;
}

const COMMON_EXTENSIONS = ['.txt', '.json', '.md', '.csv', '.xml', '.log'];

export const CreateItemDialog: React.FC<CreateItemDialogProps> = ({
  visible,
  initialType = 'folder',
  onCreateFolder,
  onCreateFile,
  onCancel,
}) => {
  const { colors } = useThemeStore();
  const [itemType, setItemType] = useState<'folder' | 'file'>(initialType);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    if (itemType === 'folder') {
      await onCreateFolder(trimmed);
    } else {
      let finalName = trimmed;
      if (!finalName.includes('.')) {
        finalName += '.txt';
      }
      await onCreateFile(finalName, content);
    }

    setName('');
    setContent('');
    setItemType('folder');
  };

  const handleExtensionPick = (ext: string) => {
    let base = name.trim();
    if (base.includes('.')) {
      base = base.substring(0, base.lastIndexOf('.'));
    }
    setName(`${base || 'new_file'}${ext}`);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onCancel}
      >
        <View
          style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              {itemType === 'folder' ? (
                <FolderPlus size={22} color={colors.primary} />
              ) : (
                <FilePlus size={22} color="#00C853" />
              )}
              <Text style={[typography.h3, { color: colors.text, marginLeft: 8 }]}>
                {itemType === 'folder' ? 'New Folder' : 'New Text File'}
              </Text>
            </View>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Type Selector Tabs */}
          <View style={[styles.tabRow, { backgroundColor: colors.surfaceVariant }]}>
            <TouchableOpacity
              style={[
                styles.tabBtn,
                itemType === 'folder' && {
                  backgroundColor: colors.primary,
                  elevation: 2,
                },
              ]}
              onPress={() => setItemType('folder')}
              activeOpacity={0.8}
            >
              <Folder size={16} color={itemType === 'folder' ? '#FFFFFF' : colors.textSecondary} />
              <Text
                style={[
                  typography.labelMedium,
                  {
                    color: itemType === 'folder' ? '#FFFFFF' : colors.textSecondary,
                    marginLeft: 6,
                    fontWeight: itemType === 'folder' ? '700' : '500',
                  },
                ]}
              >
                Folder
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tabBtn,
                itemType === 'file' && {
                  backgroundColor: colors.primary,
                  elevation: 2,
                },
              ]}
              onPress={() => setItemType('file')}
              activeOpacity={0.8}
            >
              <FileText size={16} color={itemType === 'file' ? '#FFFFFF' : colors.textSecondary} />
              <Text
                style={[
                  typography.labelMedium,
                  {
                    color: itemType === 'file' ? '#FFFFFF' : colors.textSecondary,
                    marginLeft: 6,
                    fontWeight: itemType === 'file' ? '700' : '500',
                  },
                ]}
              >
                Blank File
              </Text>
            </TouchableOpacity>
          </View>

          {/* Name Input */}
          <Text style={[typography.labelSmall, { color: colors.textMuted, marginTop: spacing.md }]}>
            {itemType === 'folder' ? 'FOLDER NAME' : 'FILE NAME & EXTENSION (e.g. notes.txt, data.json)'}
          </Text>
          <TextInput
            style={[
              styles.input,
              typography.bodyLarge,
              {
                color: colors.text,
                backgroundColor: colors.surfaceVariant,
                borderColor: colors.border,
              },
            ]}
            placeholder={itemType === 'folder' ? 'My New Folder' : 'notes.txt'}
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType={itemType === 'folder' ? 'done' : 'next'}
            onSubmitEditing={itemType === 'folder' ? handleCreate : undefined}
          />

          {/* Extension Quick Pick for Files */}
          {itemType === 'file' && (
            <View style={styles.extensionContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {COMMON_EXTENSIONS.map((ext) => (
                  <TouchableOpacity
                    key={ext}
                    style={[
                      styles.extChip,
                      {
                        backgroundColor: name.toLowerCase().endsWith(ext)
                          ? colors.primaryLight
                          : colors.surfaceVariant,
                        borderColor: name.toLowerCase().endsWith(ext)
                          ? colors.primary
                          : colors.border,
                      },
                    ]}
                    onPress={() => handleExtensionPick(ext)}
                  >
                    <Text
                      style={[
                        typography.labelSmall,
                        {
                          color: name.toLowerCase().endsWith(ext)
                            ? colors.primary
                            : colors.textSecondary,
                        },
                      ]}
                    >
                      {ext}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Optional Content for File */}
          {itemType === 'file' && (
            <>
              <Text
                style={[
                  typography.labelSmall,
                  { color: colors.textMuted, marginTop: spacing.sm },
                ]}
              >
                INITIAL CONTENT (OPTIONAL)
              </Text>
              <TextInput
                style={[
                  styles.contentInput,
                  typography.bodyMedium,
                  {
                    color: colors.text,
                    backgroundColor: colors.surfaceVariant,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Write initial text here..."
                placeholderTextColor={colors.textMuted}
                value={content}
                onChangeText={setContent}
                multiline
                numberOfLines={3}
              />
            </>
          )}

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => {
                setName('');
                setContent('');
                onCancel();
              }}
              style={styles.dialogButton}
            />
            <Button
              title="Create"
              variant="primary"
              onPress={handleCreate}
              disabled={!name.trim()}
              style={styles.dialogButton}
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    ...elevation.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    borderRadius: borderRadius.lg,
    padding: 3,
    marginBottom: spacing.xs,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.xs,
  },
  extensionContainer: {
    marginTop: spacing.xs,
  },
  extChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    marginRight: 6,
  },
  contentInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    height: 70,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  dialogButton: {
    flex: 1,
  },
});
