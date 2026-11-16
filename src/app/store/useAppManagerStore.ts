import { create } from 'zustand';
import { InstalledApp, StandaloneApk } from '../../types/appManager';
import { appManagerService } from '../../services/app-manager/appManagerService';
import { fileService } from '../../services/filesystem/fileService';

interface AppManagerState {
  apps: InstalledApp[];
  apks: StandaloneApk[];
  includeSystemApps: boolean;
  searchQuery: string;
  isLoading: boolean;

  loadInstalledApps: () => Promise<void>;
  loadStandaloneApks: () => Promise<void>;
  setIncludeSystemApps: (include: boolean) => Promise<void>;
  setSearchQuery: (query: string) => void;
  launchApp: (packageName: string) => Promise<boolean>;
  openAppSettings: (packageName: string) => Promise<boolean>;
  installApk: (apkPath: string) => Promise<boolean>;
  backupApp: (packageName: string) => Promise<string>;
}

export const useAppManagerStore = create<AppManagerState>((set, get) => ({
  apps: [],
  apks: [],
  includeSystemApps: false,
  searchQuery: '',
  isLoading: false,

  loadInstalledApps: async () => {
    set({ isLoading: true });
    try {
      const apps = await appManagerService.getInstalledApps(get().includeSystemApps);
      set({ apps, isLoading: false });
    } catch (e) {
      console.warn('Load apps error:', e);
      set({ isLoading: false });
    }
  },

  loadStandaloneApks: async () => {
    try {
      const allApkFiles = await fileService.getFilesByCategory('apks');
      const inspectedList: StandaloneApk[] = [];
      for (const f of allApkFiles) {
        const info = await appManagerService.inspectApk(f.path);
        inspectedList.push(info);
      }
      set({ apks: inspectedList });
    } catch (e) {
      console.warn('Load APKs error:', e);
    }
  },

  setIncludeSystemApps: async (includeSystemApps) => {
    set({ includeSystemApps });
    await get().loadInstalledApps();
  },

  setSearchQuery: (searchQuery) => {
    set({ searchQuery });
  },

  launchApp: async (packageName) => {
    return await appManagerService.launchApp(packageName);
  },

  openAppSettings: async (packageName) => {
    return await appManagerService.openAppSettings(packageName);
  },

  installApk: async (apkPath) => {
    return await appManagerService.installApk(apkPath);
  },

  backupApp: async (packageName) => {
    return await appManagerService.backupApp(packageName);
  },
}));

