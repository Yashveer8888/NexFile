import { create } from 'zustand';
import { VaultItem, VaultMovingProgress } from '../../types/vault';
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
  movingProgress: VaultMovingProgress | null;

  hydrate: () => Promise<void>;
  setPin: (pin: string, enableBiometric?: boolean) => Promise<void> | void;
  setBiometricEnabled: (enabled: boolean) => void;
  unlockWithPin: (pin: string) => boolean;
  unlockWithBiometric: () => void;
  lockVault: () => void;
  setActiveCategory: (cat: 'all' | 'images' | 'videos' | 'audio' | 'documents' | 'other') => void;
  setMovingProgress: (progress: VaultMovingProgress | null) => void;
  importFileToVault: (sourcePath: string, pin?: string) => Promise<VaultItem>;
  importFilesToVault: (sourcePaths: string[], pin?: string) => Promise<VaultItem[]>;
  exportFileFromVault: (itemId: string, destDirPath: string, pin?: string) => Promise<string>;
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
  items: [],
  autoLockMinutes: 5,
  lastUnlockedTime: 0,
  activeCategory: 'all',
  movingProgress: null,

  setMovingProgress: (progress) => {
    set({ movingProgress: progress });
  },

  hydrate: async () => {
    try {
      const [savedHash, savedBio, savedItemsRaw] = await Promise.all([
        fileService.getPreference(PREF_KEY_PIN_HASH, ''),
        fileService.getPreference(PREF_KEY_BIOMETRIC, 'true'),
        fileService.getPreference(PREF_KEY_ITEMS_LIST, '[]'),
      ]);

      const hasPin = Boolean(savedHash && savedHash.trim().length > 0);
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

  importFileToVault: async (sourcePath: string, _pin?: string) => {
    const fileName = sourcePath.split('/').pop() || 'file';
    const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
    const rawCategory = getCategoryFromExtension(ext);
    const category =
      rawCategory === 'images' || rawCategory === 'videos' || rawCategory === 'audio' || rawCategory === 'documents'
        ? rawCategory
        : 'other';

    // Show visible progress dialog so user sees file moving
    set({
      movingProgress: {
        visible: true,
        type: 'import',
        title: 'Moving to Private Folder',
        currentFileName: fileName,
        currentIndex: 1,
        totalCount: 1,
        status: 'moving',
      },
    });

    try {
      const cleanId = `vlt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      // Stored in dedicated directory per item: /storage/emulated/0/.vault/files/${cleanId}/
      // The file name on disk is EXACTLY fileName! It is NEVER changed or renamed!
      const itemDir = `/storage/emulated/0/.vault/files/${cleanId}`;

      const moveResult = await vaultService.secureMoveToVault(sourcePath, itemDir);
      const vaultFilePath = moveResult.path;

      let duration = 0;
      let width = 0;
      let height = 0;
      if (category === 'videos') {
        try {
          const meta = await fileService.getVideoMetadata(vaultFilePath);
          duration = meta?.duration || 0;
          width = meta?.width || 0;
          height = meta?.height || 0;
        } catch (e) {}
      }

      const newItem: VaultItem = {
        id: cleanId,
        name: fileName, // Pure original file name preserved
        originalPath: sourcePath,
        encryptedPath: vaultFilePath,
        vaultFilePath,
        thumbnailUri: `file://${vaultFilePath}`,
        category,
        size: moveResult.size || 0,
        encryptedAt: Date.now(),
        mimeType: `application/${ext || 'octet-stream'}`,
        duration,
        width,
        height,
      };

      const nextItems = [newItem, ...get().items];
      set({
        items: nextItems,
        movingProgress: {
          visible: true,
          type: 'import',
          title: 'Moved Safely to Private Folder',
          currentFileName: fileName,
          currentIndex: 1,
          totalCount: 1,
          status: 'completed',
        },
      });

      // Persist items
      await fileService.savePreference(PREF_KEY_ITEMS_LIST, JSON.stringify(nextItems));

      // Refresh general file store
      try {
        useFileStore.getState().refresh();
      } catch (e) {
        console.warn('File refresh error:', e);
      }

      // Smoothly hide progress dialog after brief completion indication
      setTimeout(() => {
        set({ movingProgress: null });
      }, 700);

      return newItem;
    } catch (err: any) {
      set({
        movingProgress: {
          visible: true,
          type: 'import',
          title: 'Failed to Move File',
          currentFileName: fileName,
          currentIndex: 1,
          totalCount: 1,
          status: 'error',
          errorMessage: err?.message || 'File move failed. Original file is intact.',
        },
      });
      setTimeout(() => {
        set({ movingProgress: null });
      }, 2000);
      throw err;
    }
  },

  importFilesToVault: async (sourcePaths: string[], _pin?: string) => {
    const totalCount = sourcePaths.length;
    if (totalCount === 0) return [];

    const newItems: VaultItem[] = [];

    set({
      movingProgress: {
        visible: true,
        type: 'import',
        title: 'Moving to Private Folder',
        currentFileName: sourcePaths[0].split('/').pop() || 'file',
        currentIndex: 0,
        totalCount,
        status: 'moving',
      },
    });

    for (let i = 0; i < sourcePaths.length; i++) {
      const sourcePath = sourcePaths[i];
      const fileName = sourcePath.split('/').pop() || 'file';

      set({
        movingProgress: {
          visible: true,
          type: 'import',
          title: 'Moving to Private Folder',
          currentFileName: fileName,
          currentIndex: i + 1,
          totalCount,
          status: 'moving',
        },
      });

      try {
        const ext = fileName.includes('.') ? fileName.split('.').pop() || '' : '';
        const rawCategory = getCategoryFromExtension(ext);
        const category =
          rawCategory === 'images' || rawCategory === 'videos' || rawCategory === 'audio' || rawCategory === 'documents'
            ? rawCategory
            : 'other';

        const cleanId = `vlt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const itemDir = `/storage/emulated/0/.vault/files/${cleanId}`;

        const moveResult = await vaultService.secureMoveToVault(sourcePath, itemDir);
        const vaultFilePath = moveResult.path;

        let duration = 0;
        let width = 0;
        let height = 0;
        if (category === 'videos') {
          try {
            const meta = await fileService.getVideoMetadata(vaultFilePath);
            duration = meta?.duration || 0;
            width = meta?.width || 0;
            height = meta?.height || 0;
          } catch (e) {}
        }

        const newItem: VaultItem = {
          id: cleanId,
          name: fileName,
          originalPath: sourcePath,
          encryptedPath: vaultFilePath,
          vaultFilePath,
          thumbnailUri: `file://${vaultFilePath}`,
          category,
          size: moveResult.size || 0,
          encryptedAt: Date.now(),
          mimeType: `application/${ext || 'octet-stream'}`,
          duration,
          width,
          height,
        };
        newItems.push(newItem);
      } catch (err) {
        console.warn('Failed to import file to vault safely:', sourcePath, err);
      }
    }

    if (newItems.length > 0) {
      const nextItems = [...newItems, ...get().items];
      set({
        items: nextItems,
        movingProgress: {
          visible: true,
          type: 'import',
          title: 'All Files Secured',
          currentFileName: `${newItems.length} files secured safely`,
          currentIndex: totalCount,
          totalCount,
          status: 'completed',
        },
      });
      await fileService.savePreference(PREF_KEY_ITEMS_LIST, JSON.stringify(nextItems));
      try {
        useFileStore.getState().refresh();
      } catch (e) {
        console.warn('File refresh error:', e);
      }
    } else {
      set({
        movingProgress: {
          visible: true,
          type: 'import',
          title: 'Error Moving Files',
          currentFileName: 'Could not secure files',
          currentIndex: totalCount,
          totalCount,
          status: 'error',
          errorMessage: 'Files could not be moved. Original files remain safe.',
        },
      });
    }

    setTimeout(() => {
      set({ movingProgress: null });
    }, 800);

    return newItems;
  },

  exportFileFromVault: async (itemId: string, destDirPath: string, _pin?: string) => {
    const item = get().items.find((i) => i.id === itemId);
    if (!item) throw new Error('Vault item not found');

    const vPath =
      item.vaultFilePath ||
      item.encryptedPath.replace('/.vault/', '/.vault/files/').replace(/\.nvlt$/, '');

    set({
      movingProgress: {
        visible: true,
        type: 'restore',
        title: 'Exporting File',
        currentFileName: item.name,
        currentIndex: 1,
        totalCount: 1,
        status: 'moving',
      },
    });

    try {
      const res = await vaultService.restoreFromVault(vPath, destDirPath, item.name);

      // Remove from vault items
      const nextItems = get().items.filter((i) => i.id !== itemId);
      set({
        items: nextItems,
        movingProgress: {
          visible: true,
          type: 'restore',
          title: 'File Exported Safely',
          currentFileName: item.name,
          currentIndex: 1,
          totalCount: 1,
          status: 'completed',
        },
      });
      await fileService.savePreference(PREF_KEY_ITEMS_LIST, JSON.stringify(nextItems));

      try {
        useFileStore.getState().refresh();
      } catch (e) {
        console.warn('File refresh error:', e);
      }

      setTimeout(() => {
        set({ movingProgress: null });
      }, 700);

      return res.path;
    } catch (err: any) {
      set({
        movingProgress: {
          visible: true,
          type: 'restore',
          title: 'Export Failed',
          currentFileName: item.name,
          currentIndex: 1,
          totalCount: 1,
          status: 'error',
          errorMessage: err?.message || 'Could not export file',
        },
      });
      setTimeout(() => {
        set({ movingProgress: null });
      }, 1500);
      throw err;
    }
  },

  deleteVaultItem: async (itemId: string) => {
    const item = get().items.find((i) => i.id === itemId);
    if (item) {
      const vPath =
        item.vaultFilePath ||
        item.encryptedPath.replace('/.vault/', '/.vault/files/').replace(/\.nvlt$/, '');

      try {
        await fileService.delete(vPath, false);
        // Also cleanup item parent folder if it exists
        const parentDir = vPath.substring(0, vPath.lastIndexOf('/'));
        if (parentDir.includes('/.vault/files/vlt_')) {
          await fileService.delete(parentDir, false);
        }
      } catch (e) {}

      try {
        if (item.encryptedPath && item.encryptedPath !== vPath) {
          await fileService.delete(item.encryptedPath, false);
        }
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
          const parentDir = vPath.substring(0, vPath.lastIndexOf('/'));
          if (parentDir.includes('/.vault/files/vlt_')) {
            await fileService.delete(parentDir, false);
          }
        } catch (e) {}

        try {
          if (item.encryptedPath && item.encryptedPath !== vPath) {
            await fileService.delete(item.encryptedPath, false);
          }
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

    set({
      movingProgress: {
        visible: true,
        type: 'restore',
        title: 'Restoring to Original Location',
        currentFileName: item.name,
        currentIndex: 1,
        totalCount: 1,
        status: 'moving',
      },
    });

    try {
      const res = await vaultService.restoreFromVault(vPath, parentDir, item.name);

      const nextItems = get().items.filter((i) => i.id !== itemId);
      set({
        items: nextItems,
        movingProgress: {
          visible: true,
          type: 'restore',
          title: 'Restored Successfully',
          currentFileName: item.name,
          currentIndex: 1,
          totalCount: 1,
          status: 'completed',
        },
      });

      await fileService.savePreference(PREF_KEY_ITEMS_LIST, JSON.stringify(nextItems));

      try {
        useFileStore.getState().refresh();
      } catch (e) {}

      setTimeout(() => {
        set({ movingProgress: null });
      }, 700);

      return res.path;
    } catch (err: any) {
      set({
        movingProgress: {
          visible: true,
          type: 'restore',
          title: 'Restore Failed',
          currentFileName: item.name,
          currentIndex: 1,
          totalCount: 1,
          status: 'error',
          errorMessage: err?.message || 'Could not restore file',
        },
      });
      setTimeout(() => {
        set({ movingProgress: null });
      }, 1500);
      throw err;
    }
  },

  restoreFilesFromVault: async (itemIds: string[]) => {
    const totalCount = itemIds.length;
    let restoredCount = 0;
    let failedCount = 0;
    const currentItems = get().items;
    const remainingItems: VaultItem[] = [];

    set({
      movingProgress: {
        visible: true,
        type: 'restore',
        title: 'Restoring from Private Folder',
        currentFileName: '',
        currentIndex: 0,
        totalCount,
        status: 'moving',
      },
    });

    for (let i = 0; i < currentItems.length; i++) {
      const item = currentItems[i];
      if (itemIds.includes(item.id)) {
        set({
          movingProgress: {
            visible: true,
            type: 'restore',
            title: 'Restoring Files',
            currentFileName: item.name,
            currentIndex: restoredCount + failedCount + 1,
            totalCount,
            status: 'moving',
          },
        });

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

          await vaultService.restoreFromVault(vPath, parentDir, item.name);
          restoredCount++;
        } catch (err) {
          console.warn('Failed restoring item:', item.name, err);
          failedCount++;
          remainingItems.push(item);
        }
      } else {
        remainingItems.push(item);
      }
    }

    set({
      items: remainingItems,
      movingProgress: {
        visible: true,
        type: 'restore',
        title: restoredCount > 0 ? 'Files Restored' : 'Restore Finished',
        currentFileName: `${restoredCount} file${restoredCount > 1 ? 's' : ''} restored safely`,
        currentIndex: totalCount,
        totalCount,
        status: 'completed',
      },
    });

    await fileService.savePreference(PREF_KEY_ITEMS_LIST, JSON.stringify(remainingItems));

    try {
      useFileStore.getState().refresh();
    } catch (e) {}

    setTimeout(() => {
      set({ movingProgress: null });
    }, 800);

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
