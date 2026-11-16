import { create } from 'zustand';
import { ArchiveInfo, ArchiveEntry } from '../../types/archive';
import { archiveService } from '../../services/archive/archiveService';

interface ArchiveState {
  currentArchive: ArchiveInfo | null;
  selectedEntries: Set<string>;
  isLoading: boolean;
  inspectArchive: (path: string) => Promise<void>;
  toggleSelectEntry: (entryName: string) => void;
  selectAllEntries: () => void;
  clearSelection: () => void;
  createArchive: (sourcePaths: string[], destPath: string, level?: number) => Promise<string>;
  extractArchive: (archivePath: string, destDirPath: string, selective?: boolean) => Promise<string[]>;
}

export const useArchiveStore = create<ArchiveState>((set, get) => ({
  currentArchive: null,
  selectedEntries: new Set(),
  isLoading: false,

  inspectArchive: async (path: string) => {
    set({ isLoading: true });
    try {
      const info = await archiveService.listContents(path);
      set({ currentArchive: info, selectedEntries: new Set(), isLoading: false });
    } catch (e) {
      console.warn('Inspect archive error:', e);
      set({ isLoading: false });
    }
  },

  toggleSelectEntry: (entryName: string) => {
    const next = new Set(get().selectedEntries);
    if (next.has(entryName)) {
      next.delete(entryName);
    } else {
      next.add(entryName);
    }
    set({ selectedEntries: next });
  },

  selectAllEntries: () => {
    const { currentArchive } = get();
    if (!currentArchive) return;
    const all = new Set(currentArchive.entries.filter((e) => !e.isDirectory).map((e) => e.name));
    set({ selectedEntries: all });
  },

  clearSelection: () => {
    set({ selectedEntries: new Set() });
  },

  createArchive: async (sourcePaths, destPath, level = 6) => {
    set({ isLoading: true });
    try {
      const result = await archiveService.createArchive(sourcePaths, destPath, level);
      set({ isLoading: false });
      return result;
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },

  extractArchive: async (archivePath, destDirPath, selective = false) => {
    set({ isLoading: true });
    try {
      const selected = selective ? Array.from(get().selectedEntries) : undefined;
      const extracted = await archiveService.extractArchive(archivePath, destDirPath, selected);
      set({ isLoading: false });
      return extracted;
    } catch (e) {
      set({ isLoading: false });
      throw e;
    }
  },
}));

