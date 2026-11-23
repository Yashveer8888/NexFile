export interface VaultItem {
  id: string;
  name: string;
  originalPath: string;
  encryptedPath: string;
  vaultFilePath?: string;
  thumbnailUri?: string;
  category: 'images' | 'videos' | 'audio' | 'documents' | 'other';
  size: number;
  encryptedAt: number;
  mimeType: string;
  duration?: number;
  width?: number;
  height?: number;
}

export interface VaultSettings {
  isPinSet: boolean;
  isBiometricEnabled: boolean;
  autoLockMinutes: number; // 0 = immediate, 1, 5, 15
  lastUnlockedTimestamp: number;
}

export interface VaultMovingProgress {
  visible: boolean;
  type: 'import' | 'restore';
  title: string;
  currentFileName: string;
  currentIndex: number;
  totalCount: number;
  status: 'moving' | 'verifying' | 'completed' | 'error';
  errorMessage?: string;
}
