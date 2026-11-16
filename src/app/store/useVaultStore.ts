import { create } from 'zustand';
import { VaultItem, VaultSettings } from '../../types/vault';
import { vaultService } from '../../services/encryption/vaultService';
import { getCategoryFromExtension } from '../../utils/fileTypes';

interface VaultState {
  isUnlocked: boolean;
  isPinSet: boolean;
  pinHash: string | null;
  items: VaultItem[];
  activeCategory: 'all' | 'images' | 'videos' | 'documents';
  autoLockMinutes: number;
  lastUnlockedTime: number;

  setPin: (pin: string) => void;
  unlockWithPin: (pin: string) => boolean;
  lockVault: () => void;
  setActiveCategory: (cat: 'all' | 'images' | 'videos' | 'documents') => void;
  importFileToVault: (sourcePath: string, pin: string) => Promise<VaultItem>;
  exportFileFromVault: (itemId: string, destDirPath: string, pin: string) => Promise<string>;
  deleteVaultItem: (itemId: string) => void;
}

export const useVaultStore = create<VaultState>((set, get) => ({
  isUnlocked: false,
  isPinSet: true, // initial default pin: 1234
  pinHash: vaultService.hashPin('1234'),
  autoLockMinutes: 5,
  lastUnlockedTime: 0,
  activeCategory: 'all',

  items: [
    {
      id: 'vlt_sample_1',
      name: 'Passport_Scan.jpg',
      originalPath: '/storage/emulated/0/DCIM/Camera/Passport_Scan.jpg',
      encryptedPath: '/storage/emulated/0/.vault/nvlt_passport.nvlt',
      category: 'images',
      size: 3450000,
      encryptedAt: Date.now() - 86400000,
      mimeType: 'image/jpeg',
    },
    {
      id: 'vlt_sample_2',
      name: 'Tax_Return_2025.pdf',
      originalPath: '/storage/emulated/0/Documents/Tax_Return_2025.pdf',
      encryptedPath: '/storage/emulated/0/.vault/nvlt_tax.nvlt',
      category: 'documents',
      size: 1850000,
      encryptedAt: Date.now() - 172800000,
      mimeType: 'application/pdf',
    },
  ],

  setPin: (pin: string) => {
    const hash = vaultService.hashPin(pin);
    set({ isPinSet: true, pinHash: hash, isUnlocked: true });
  },

  unlockWithPin: (pin: string) => {
    const { pinHash } = get();
    const hash = vaultService.hashPin(pin);
    if (hash === pinHash) {
      set({ isUnlocked: true, lastUnlockedTime: Date.now() });
      return true;
    }
    return false;
  },

  lockVault: () => {
    set({ isUnlocked: false });
  },

  setActiveCategory: (activeCategory) => {
    set({ activeCategory });
  },

  importFileToVault: async (sourcePath, pin) => {
    const fileName = sourcePath.split('/').pop() || 'file';
    const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
    const rawCategory = getCategoryFromExtension(ext);
    const category =
      rawCategory === 'images' || rawCategory === 'videos' || rawCategory === 'documents'
        ? rawCategory
        : 'other';

    const encryptedPath = `/storage/emulated/0/.vault/${Date.now()}_${fileName}.nvlt`;

    await vaultService.encryptFile(sourcePath, encryptedPath, pin);

    const newItem: VaultItem = {
      id: `vlt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: fileName,
      originalPath: sourcePath,
      encryptedPath,
      category,
      size: 2500000,
      encryptedAt: Date.now(),
      mimeType: `application/${ext}`,
    };

    set((state) => ({ items: [newItem, ...state.items] }));
    return newItem;
  },

  exportFileFromVault: async (itemId, destDirPath, pin) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) throw new Error('Vault item not found');

    const destPath = `${destDirPath}/${item.name}`;
    await vaultService.decryptFile(item.encryptedPath, destPath, pin);

    // Remove from vault on export
    set((state) => ({ items: state.items.filter((i) => i.id !== itemId) }));
    return destPath;
  },

  deleteVaultItem: (itemId) => {
    set((state) => ({ items: state.items.filter((i) => i.id !== itemId) }));
  },
}));

