import { create } from 'zustand';
import {
  FileItem,
  FileCategory,
  SortField,
  SortOrder,
  StorageVolume,
  BreadcrumbItem,
} from '../../types/file';
import { fileService } from '../../services/filesystem/fileService';

interface FileState {
  currentPath: string;
  history: string[];
  files: FileItem[];
  recentFiles: FileItem[];
  categoryFiles: FileItem[];
  storageVolumes: StorageVolume[];
  activeCategory: FileCategory;
  viewMode: 'list' | 'grid';
  sortBy: SortField;
  sortOrder: SortOrder;
  showHidden: boolean;
  selectedFileIds: Set<string>;
  clipboard: { mode: 'copy' | 'move'; items: FileItem[] } | null;
  isLoading: boolean;
  searchQuery: string;

  // Actions
  initialize: () => Promise<void>;
  loadDirectory: (path: string) => Promise<void>;
  enterDirectory: (dir: FileItem) => Promise<void>;
  navigateUp: () => Promise<void>;
  refresh: () => Promise<void>;
  setActiveCategory: (category: FileCategory) => Promise<void>;
  setViewMode: (mode: 'list' | 'grid') => void;
  setSort: (field: SortField, order: SortOrder) => void;
  toggleShowHidden: () => Promise<void>;
  toggleSelectFile: (fileId: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setClipboard: (mode: 'copy' | 'move', items: FileItem[]) => void;
  clearClipboard: () => void;
  pasteClipboard: () => Promise<void>;
  createFolder: (name: string) => Promise<string>;
  renameItem: (path: string, newName: string) => Promise<string>;
  deleteSelected: () => Promise<void>;
  deleteSingle: (path: string) => Promise<void>;
  toggleFavorite: (path: string) => void;
  setSearchQuery: (query: string) => void;
  getBreadcrumbs: () => BreadcrumbItem[];
}

const DEFAULT_PATH = '/storage/emulated/0';

export const useFileStore = create<FileState>((set, get) => ({
  currentPath: DEFAULT_PATH,
  history: [],
  files: [],
  recentFiles: [],
  categoryFiles: [],
  storageVolumes: [],
  activeCategory: 'all',
  viewMode: 'list',
  sortBy: 'name',
  sortOrder: 'asc',
  showHidden: false,
  selectedFileIds: new Set(),
  clipboard: null,
  isLoading: false,
  searchQuery: '',

  initialize: async () => {
    set({ isLoading: true });
    try {
      const volumes = await fileService.getStorageVolumes();
      const recents = await fileService.getRecentFiles(500);
      const initialRoot = volumes[0]?.path || DEFAULT_PATH;
      const files = await fileService.listDirectory(initialRoot, get().showHidden);
      const sorted = fileService.sortFiles(files, get().sortBy, get().sortOrder);

      set({
        storageVolumes: volumes,
        recentFiles: recents,
        currentPath: initialRoot,
        files: sorted,
        isLoading: false,
      });
    } catch (err) {
      console.warn('Error during store initialization:', err);
      set({ isLoading: false });
    }
  },

  loadDirectory: async (path: string) => {
    set({ isLoading: true });
    try {
      const rawFiles = await fileService.listDirectory(path, get().showHidden);
      const sorted = fileService.sortFiles(rawFiles, get().sortBy, get().sortOrder);
      set({
        currentPath: path,
        files: sorted,
        isLoading: false,
        selectedFileIds: new Set(),
      });
    } catch (err) {
      console.warn(`Error loading directory ${path}:`, err);
      set({ isLoading: false });
    }
  },

  enterDirectory: async (dir: FileItem) => {
    if (!dir.isDirectory) return;
    const current = get().currentPath;
    const nextHistory = [...get().history, current];
    set({ history: nextHistory });
    await get().loadDirectory(dir.path);
  },

  navigateUp: async () => {
    const { history, currentPath } = get();
    if (history.length > 0) {
      const previousPath = history[history.length - 1];
      const newHistory = history.slice(0, -1);
      set({ history: newHistory });
      await get().loadDirectory(previousPath);
    } else {
      const parent = currentPath.substring(0, currentPath.lastIndexOf('/'));
      if (parent && parent.length >= '/storage'.length) {
        await get().loadDirectory(parent);
      }
    }
  },

  refresh: async () => {
    const { currentPath, activeCategory } = get();
    await get().loadDirectory(currentPath);
    const recents = await fileService.getRecentFiles(500);
    const catFiles = await fileService.getFilesByCategory(activeCategory);
    set({ recentFiles: recents, categoryFiles: catFiles });
  },

  setActiveCategory: async (category: FileCategory) => {
    set({ activeCategory: category, isLoading: true });
    try {
      const catFiles = await fileService.getFilesByCategory(category);
      const sorted = fileService.sortFiles(catFiles, get().sortBy, get().sortOrder);
      set({ categoryFiles: sorted, isLoading: false });
    } catch (err) {
      console.warn('Error fetching category files:', err);
      set({ isLoading: false });
    }
  },

  setViewMode: (viewMode: 'list' | 'grid') => {
    set({ viewMode });
  },

  setSort: (sortBy: SortField, sortOrder: SortOrder) => {
    const sortedFiles = fileService.sortFiles(get().files, sortBy, sortOrder);
    const sortedCategory = fileService.sortFiles(get().categoryFiles, sortBy, sortOrder);
    set({ sortBy, sortOrder, files: sortedFiles, categoryFiles: sortedCategory });
  },

  toggleShowHidden: async () => {
    const nextVal = !get().showHidden;
    set({ showHidden: nextVal });
    await get().loadDirectory(get().currentPath);
  },

  toggleSelectFile: (fileId: string) => {
    const nextSelected = new Set(get().selectedFileIds);
    if (nextSelected.has(fileId)) {
      nextSelected.delete(fileId);
    } else {
      nextSelected.add(fileId);
    }
    set({ selectedFileIds: nextSelected });
  },

  selectAll: () => {
    const allIds = new Set(get().files.map((f) => f.id));
    set({ selectedFileIds: allIds });
  },

  clearSelection: () => {
    set({ selectedFileIds: new Set() });
  },

  setClipboard: (mode: 'copy' | 'move', items: FileItem[]) => {
    set({ clipboard: { mode, items }, selectedFileIds: new Set() });
  },

  clearClipboard: () => {
    set({ clipboard: null });
  },

  pasteClipboard: async () => {
    const { clipboard, currentPath } = get();
    if (!clipboard || clipboard.items.length === 0) return;

    set({ isLoading: true });
    try {
      for (const item of clipboard.items) {
        if (clipboard.mode === 'copy') {
          await fileService.copy(item.path, currentPath);
        } else {
          await fileService.move(item.path, currentPath);
        }
      }
      set({ clipboard: null });
      await get().refresh();
    } catch (err) {
      console.warn('Error pasting items:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  createFolder: async (name: string) => {
    const { currentPath } = get();
    const newPath = await fileService.createFolder(currentPath, name);
    await get().loadDirectory(currentPath);
    return newPath;
  },

  renameItem: async (path: string, newName: string) => {
    const newPath = await fileService.rename(path, newName);
    await get().refresh();
    return newPath;
  },

  deleteSelected: async () => {
    const { selectedFileIds, files } = get();
    set({ isLoading: true });
    try {
      for (const id of selectedFileIds) {
        const item = files.find((f) => f.id === id);
        if (item) {
          await fileService.delete(item.path, true);
        }
      }
      set({ selectedFileIds: new Set() });
      await get().refresh();
    } catch (err) {
      console.warn('Error deleting selected items:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  deleteSingle: async (path: string) => {
    await fileService.delete(path, true);
    await get().refresh();
  },

  toggleFavorite: (path: string) => {
    fileService.toggleFavorite(path);
    const updated = get().files.map((f) =>
      f.path === path ? { ...f, isFavorite: !f.isFavorite } : f
    );
    set({ files: updated });
  },

  setSearchQuery: (searchQuery: string) => {
    set({ searchQuery });
  },

  getBreadcrumbs: (): BreadcrumbItem[] => {
    const { currentPath } = get();
    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    let accumulated = '';
    for (let i = 0; i < parts.length; i++) {
      accumulated += `/${parts[i]}`;
      // Friendly label for root paths
      let label = parts[i];
      if (accumulated === '/storage/emulated/0') {
        label = 'Internal Storage';
      } else if (accumulated === '/storage') {
        continue;
      } else if (accumulated === '/storage/emulated') {
        continue;
      }
      breadcrumbs.push({ name: label, path: accumulated });
    }

    return breadcrumbs.length > 0 ? breadcrumbs : [{ name: 'Root', path: currentPath }];
  },
}));

