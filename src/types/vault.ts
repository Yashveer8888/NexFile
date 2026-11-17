export interface VaultItem {
  id: string;
  name: string;
  originalPath: string;
  encryptedPath: string;
  vaultFilePath?: string;
  thumbnailUri?: string;
  category: 'images' | 'videos' | 'documents' | 'other';
  size: number;
  encryptedAt: number;
  mimeType: string;
}

export interface VaultSettings {
  isPinSet: boolean;
  isBiometricEnabled: boolean;
  autoLockMinutes: number; // 0 = immediate, 1, 5, 15
  lastUnlockedTimestamp: number;
}

