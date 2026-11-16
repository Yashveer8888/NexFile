import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { FolderPlus, X } from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Button } from '../common/Button';

interface CreateFolderDialogProps {
  visible: boolean;
  onCreate: (name: string) => void;
  onCancel: () => void;
}

export const CreateFolderDialog: React.FC<CreateFolderDialogProps> = ({
  visible,
  onCreate,
  onCancel,
}) => {
  const { colors } = useThemeStore();
  const [folderName, setFolderName] = useState('');

  const handleCreate = () => {
    const trimmed = folderName.trim();
    if (trimmed) {
      onCreate(trimmed);
      setFolderName('');
    }
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
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <FolderPlus size={20} color={colors.primary} />
              <Text style={[typography.h3, { color: colors.text, marginLeft: 8 }]}>New Folder</Text>
            </View>
            <TouchableOpacity onPress={onCancel}>
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

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
            placeholder="Folder name"
            placeholderTextColor={colors.textMuted}
            value={folderName}
            onChangeText={setFolderName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

          <View style={styles.buttonRow}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => {
                setFolderName('');
                onCancel();
              }}
              style={styles.dialogButton}
            />
            <Button
              title="Create"
              variant="primary"
              onPress={handleCreate}
              disabled={!folderName.trim()}
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
    maxWidth: 360,
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
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
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

