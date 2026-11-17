import React from 'react';
import { CreateItemDialog } from './CreateItemDialog';

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
  return (
    <CreateItemDialog
      visible={visible}
      initialType="folder"
      onCreateFolder={onCreate}
      onCreateFile={(name) => onCreate(name)}
      onCancel={onCancel}
    />
  );
};
