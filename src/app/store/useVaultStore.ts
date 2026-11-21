import { create } from 'zustand';
import { VaultItem } from '../../types/vault';
import { vaultService } from '../../services/encryption/vaultService';
import { fileService } from '../../services/filesystem/fileService';
import { getCategoryFromExtension } from '../../utils/fileTypes';
import { useFileStore } from './useFileStore';

interface VaultState {
  isUnlocked: boolean;
  isPinSet: boolean;
  pinHash: string | null;
  biometricEnabled: boolean;
  isHydrated: boolean;
  items: VaultItem[];
  activeCategory: 'all' | 'images' | 'videos' | 'audio' | 'documents' | 'other';
  autoLockMinutes: number;
  lastUnlockedTime: number;

  hydrate: () => Promise<void>;
  setPin: (pin: string, enableBiometric?: boolean) => Promise<void> | void;
  setBiometricEnabled: (enabled: boolean) => void;
  unlockWithPin: (pin: string) => boolean;
  unlockWithBiometric: () => void;
  lockVault: () => void;
  setActiveCategory: (cat: 'all' | 'images' | 'videos' | 'audio' | 'documents' | 'other') => void;
  importFileToVault: (sourcePath: string, pin: string) => Promise<VaultItem>;
  importFilesToVault: (sourcePaths: string[], pin: string) => Promise<VaultItem[]>;
  exportFileFromVault: (itemId: string, destDirPath: string, pin: string) => Promise<string>;
  deleteVaultItem: (itemId: string) => Promise<void>;
  deleteVaultItems: (itemIds: string[]) => Promise<void>;
  restoreFileFromVault: (itemId: string) => Promise<string>;
  restoreFilesFromVault: (itemIds: string[]) => Promise<{ restoredCount: number; failedCount: number }>;
  changePin: (oldPin: string, newPin: string) => boolean;
}

const PREF_KEY_PIN_HASH = 'NEX_VAULT_PIN_HASH';
const PREF_KEY_BIOMETRIC = 'NEX_VAULT_BIOMETRIC_ENABLED';
const PREF_KEY_ITEMS_LIST = 'NEX_VAULT_ITEMS_LIST_V2';

export const useVaultStore = create<VaultState>((set, get) => ({
  isUnlocked: false,
  isPinSet: false,
  pinHash: null,
  biometricEnabled: true,
  isHydrated: false,
  items: [], // Zero demo/mock data: only real user-privatized files
  autoLockMinutes: 5,
  lastUnlockedTime: 0,
  activeCategory: 'all',

  hydrate: async () => {
    try {
      const [savedHash, savedBio, savedItemsRaw] = await Promise.all([
        fileService.getPreference(PREF_KEY_PIN_HASH, ''),
        fileService.getPreference(PREF_KEY_BIOMETRIC, 'true'),
        fileService.getPreference(PREF_KEY_ITEMS_LIST, '[]'),
      ]);

      const hasPin = !!savedHash && savedHash.trim().length > 0;
      let parsedItems: VaultItem[] = [];
      try {
        if (savedItemsRaw && savedItemsRaw.trim().length > 0) {
          const list = JSON.parse(savedItemsRaw);
          if (Array.isArray(list)) {
            parsedItems = list.map((item) => {
              const vaultFilePath =
                item.vaultFilePath ||
                item.encryptedPath.replace('/.vault/', '/.vault/files/').replace(/\.nvlt$/, '');
              return {
                ...item,
                vaultFilePath,
                thumbnailUri: item.thumbnailUri || `file://${vaultFilePath}`,
              };
            });
          }
        }
      } catch (err) {
        console.warn('Failed parsing vault items:', err);
      }

      set({
        isPinSet: hasPin,
        pinHash: hasPin ? savedHash : null,
        biometricEnabled: savedBio !== 'false',
        items: parsedItems,
        isHydrated: true,
      });
    } catch {
      set({ isHydrated: true });
    }
  },

  setPin: async (pin: string, enableBiometric: boolean = true) => {
    const hash = vaultService.hashPin(pin);
    set({
      isPinSet: true,
      pinHash: hash,
      biometricEnabled: enableBiometric,
      isUnlocked: true,
      isHydrated: true,
      lastUnlockedTime: Date.now(),
    });
    await Promise.all([
      fileService.savePreference(PREF_KEY_PIN_HASH, hash),
      fileService.savePreference(PREF_KEY_BIOMETRIC, enableBiometric ? 'true' : 'false'),
    ]);
  },

  setBiometricEnabled: (enabled: boolean) => {
    set({ biometricEnabled: enabled });
    fileService.savePreference(PREF_KEY_BIOMETRIC, enabled ? 'true' : 'false');
  },

  unlockWithPin: (pin: string) => {
    const { pinHash } = get();
    if (!pinHash) return false;
    const hash = vaultService.hashPin(pin);
    if (hash === pinHash) {
      set({ isUnlocked: true, lastUnlockedTime: Date.now() });
      return true;
    }
    return false;
  },

  unlockWithBiometric: () => {
    set({ isUnlocked: true, lastUnlockedTime: Date.now() });
  },

  lockVault: () => {
    set({ isUnlocked: false });
  },

  setActiveCategory: (activeCategory) => {
    set({ activeCategory });
  },

  importFileToVault: async (sourcePath: string, pin: string) => {
    const fileName = sourcePath.split('/').pop() || 'file';
    const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
    const rawCategory = getCategoryFromExtension(ext);
    const category =
      rawCategory === 'images' || rawCategory === 'videos' || rawCategory === 'audio' || rawCategory === 'documents'
        ? rawCategory
        : 'other';

    const vaultDir = '/storage/emulated/0/.vault/files';
    const cleanId = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const vaultFilePath = `${vaultDir}/${cleanId}_${fileName}`;
    const encryptedPath = `/storage/emulated/0/.vault/${cleanId}_${fileName}.nvlt`;

    // 1. Copy file to hidden vault files directory
    try {
      await fileService.copy(sourcePath, vaultDir);
      await fileService.rename(`${vaultDir}/${fileName}`, `${cleanId}_${fileName}`);
    } catch (e) {
      console.warn('Vault copy error:', e);
    }

    // 2. Encrypt file backup into .vault root
    try {
      await vaultService.encryptFile(sourcePath, encryptedPath, pin || '0000');
    } catch (e) {
      console.warn('Vault encryption error:', e);
    }

    // 3. Remove original file from normal storage
    try {
      await fileService.delete(sourcePath, false);
    } catch (e) {
      console.warn('Could not delete original file after vault import:', e);
    }

    const newItem: VaultItem = {
      id: `vlt_${cleanId}`,
      name: fileName,
      originalPath: sourcePath,
      encryptedPath,
      vaultFilePath,
      thumbnailUri: `file://${vaultFilePath}`,
      category,
      size: 1024,
      encryptedAt: Date.now(),
      mimeType: `application/${ext || 'octet-stream'}`,
    };

    const nextItems = [newItem, ...get().items];
    set({ items: nextItems });

    // Persist items
    await fileService.savePreference(PREF_KEY_ITEMS_LIST, JSON.stringify(nextItems));

    // Refresh general file store so file disappears immediately
    try {
      useFileStore.getState().refresh();
    } catch (e) {
      console.warn('File refresh error:', e);
    }

    return newItem;
  },

  importFilesToVault: async (sourcePaths: string[], pin: string) => {
    const newItems: VaultItem[] = [];
    const vaultDir = '/storage/emulated/0/.vault/files';

    for (const sourcePath of sourcePaths) {
      try {
        const fileName = sourcePath.split('/').pop() || 'file';
        const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
        const rawCategory = getCategoryFromExtension(ext);
        const category =
          rawCategory === 'images' || rawCategory === 'videos' || rawCategory === 'audio' || rawCategory === 'documents'
            ? rawCategory
            : 'other';

        const cleanId = `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const vaultFilePath = `${vaultDir}/${cleanId}_${fileName}`;
        const encryptedPath = `/storage/emulated/0/.vault/${cleanId}_${fileName}.nvlt`;

        // 1. Copy file to hidden vault files directory
        try {
          await fileService.copy(sourcePath, vaultDir);
          await fileService.rename(`${vaultDir}/${fileName}`, `${cleanId}_${fileName}`);
        } catch (e) {}

        // 2. Encrypt file backup
        try {
          await vaultService.encryptFile(sourcePath, encryptedPath, pin || '0000');
        } catch (e) {}

        // 3. Delete from original storage
        try {
          await fileService.delete(sourcePath, false);
        } catch (e) {}

        const newItem: VaultItem = {
          id: `vlt_${cleanId}`,
          name: fileName,
          originalPath: sourcePath,
          encryptedPath,
          vaultFilePath,
          thumbnailUri: `file://${vaultFilePath}`,
          category,
          size: 1024,
          encryptedAt: Date.now(),
          mimeType: `application/${ext || 'octet-stream'}`,
        };
        newItems.push(newItem);
      } catch (err) {
        console.warn('Failed to import file to vault:', sourcePath, err);
      }
    }

    if (newItems.length > 0) {
      const nextItems = [...newItems, ...get().items];
      set({ items: nextItems });
      await fileService.savePreference(PREF_KEY_ITEMS_LIST, JSON.stringify(nextItems));
      try {
        useFileStore.getState().refresh();
      } catch (e) {
        console.warn('File refresh error:', e);
      }
    }

    return newItems;
  },

  exportFileFromVault: async (itemId: string, destDirPath: string, pin: string) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) throw new Error('Vault item not found');

    const destPath = `${destDirPath}/${item.name}`;
    const vPath =
      item.vaultFilePath ||
      item.encryptedPath.replace('/.vault/', '/.vault/files/').replace(/\.nvlt$/, '');

    let restored = false;
    try {
      await fileService.copy(vPath, destDirPath);
      await fileService.delete(vPath, false);
      restored = true;
    } catch (e) {
      console.warn('Direct vault move failed, attempting decrypt:', e);
    }

    if (!restored) {
      try {
        await vaultService.decryptFile(item.encryptedPath, destPath, pin || '0000');
      } catch (e) {
        console.warn('Decrypt fallback error:', e);
      }
    }

    try {
      await fileService.delete(item.encryptedPath, false);
    } catch (e) {}

    // Remove from vault items
    const nextItems = get().items.filter((i) => i.id !== itemId);
    set({ items: nextItems });
    await fileService.savePreference(PREF_KEY_ITEMS_LIST, JSON.stringify(nextItems));

    // Refresh general file store so exported file appears
    try {
      useFileStore.getState().refresh();
    } catch (e) {
      console.warn('File refresh error:', e);
    }

    return destPath;
  },

  deleteVaultItem: async (itemId: string) => {
    const item = get().items.find((i) => i.id === itemId);
    if (item) {
      const vPath =
        item.vaultFilePath ||
        item.encryptedPath.replace('/.vault/', '/.vault/files/').replace(/\.nvlt$/, '');
      try {
        await fileService.delete(vPath, false);
      } catch (e) {}
      try {
        await fileService.delete(item.encryptedPath, false);
      } catch (e) {}
    }
    const nextItems = get().items.filter((i) => i.id !== itemId);
    set({ items: nextItems });
    await fileService.savePreference(PREF_KEY_ITEMS_LIST, JSON.stringify(nextItems));
  },

  deleteVaultItems: async (itemIds: string[]) => {
    const currentItems = get().items;
    const remainingItems: VaultItem[] = [];

    for (const item of currentItems) {
      if (itemIds.includes(item.id)) {
        const vPath =
          item.vaultFilePath ||
          item.encryptedPath.replace('/.vault/', '/.vault/files/').replace(/\.nvlt$/, '');
        try {
          await fileService.delete(vPath, false);
        } catch (e) {}
        try {
          await fileService.delete(item.encryptedPath, false);
        } catch (e) {}
      } else {
        remainingItems.push(item);
      }
    }

    set({ items: remainingItems });
    await fileService.savePreference(PREF_KEY_ITEMS_LIST, JSON.stringify(remainingItems));
  },

  restoreFileFromVault: async (itemId: string) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) throw new Error('Vault item not found');

    const vPath =
      item.vaultFilePath ||
      item.encryptedPath.replace('/.vault/', '/.vault/files/').replace(/\.nvlt$/, '');

    let parentDir = item.originalPath
      ? item.originalPath.substring(0, item.originalPath.lastIndexOf('/'))
      : '';
    if (!parentDir || parentDir.length < 5) {
      parentDir = '/storage/emulated/0/Download';
    }

    let restored = false;
    try {
      await fileService.copy(vPath, parentDir);
      await fileService.delete(vPath, false);
      restored = true;
    } catch (e) {
      console.warn('Direct restore copy failed, attempting decrypt:', e);
    }

    if (!restored) {
      const destPath = `${parentDir}/${item.name}`;
      try {
        await vaultService.decryptFile(item.encryptedPath, destPath, '0000');
        restored = true;
      } catch (e) {
        console.warn('Decrypt fallback error:', e);
      }
    }

    try {
      await fileService.delete(item.encryptedPath, false);
    } catch (e) {}

    const nextItems = get().items.filter((i) => i.id !== itemId);
    set({ items: nextItems });
    await fileService.savePreference(PREF_KEY_ITEMS_LIST, JSON.stringify(nextItems));

    try {
      useFileStore.getState().refresh();
    } catch (e) {}

    return `${parentDir}/${item.name}`;
  },

  restoreFilesFromVault: async (itemIds: string[]) => {
    let restoredCount = 0;
    let failedCount = 0;
    const currentItems = get().items;
    const remainingItems: VaultItem[] = [];

    for (const item of currentItems) {
      if (itemIds.includes(item.id)) {
        try {
          const vPath =
            item.vaultFilePath ||
            item.encryptedPath.replace('/.vault/', '/.vault/files/').replace(/\.nvlt$/, '');

          let parentDir = item.originalPath
            ? item.originalPath.substring(0, item.originalPath.lastIndexOf('/'))
            : '';
          if (!parentDir || parentDir.length < 5) {
            parentDir = '/storage/emulated/0/Download';
          }

          let restored = false;
          try {
            await fileService.copy(vPath, parentDir);
            await fileService.delete(vPath, false);
            restored = true;
          } catch (e) {
            console.warn('Direct restore copy failed:', e);
          }

          if (!restored) {
            const destPath = `${parentDir}/${item.name}`;
            try {
              await vaultService.decryptFile(item.encryptedPath, destPath, '0000');
              restored = true;
            } catch (e) {
              console.warn('Decrypt fallback error:', e);
            }
          }

          try {
            await fileService.delete(item.encryptedPath, false);
          } catch (e) {}

          if (restored) {
            restoredCount++;
          } else {
            failedCount++;
            remainingItems.push(item);
          }
        } catch (err) {
          failedCount++;
          remainingItems.push(item);
        }
      } else {
        remainingItems.push(item);
      }
    }

    set({ items: remainingItems });
    await fileService.savePreference(PREF_KEY_ITEMS_LIST, JSON.stringify(remainingItems));

    try {
      useFileStore.getState().refresh();
    } catch (e) {}

    return { restoredCount, failedCount };
  },

  changePin: (oldPin: string, newPin: string) => {
    const { pinHash } = get();
    if (!pinHash) return false;
    const oldHash = vaultService.hashPin(oldPin);
    if (oldHash !== pinHash) return false;
    const newHash = vaultService.hashPin(newPin);
    set({ pinHash: newHash });
    fileService.savePreference(PREF_KEY_PIN_HASH, newHash);
    return true;
  },
}));

// Auto-hydrate on startup
useVaultStore.getState().hydrate();
