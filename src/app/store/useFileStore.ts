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
import { archiveService } from '../../services/archive/archiveService';
import { getMimeTypeFromExtension } from '../../utils/fileTypes';

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
  loadDirectory: (path: string, forceRefresh?: boolean) => Promise<void>;
  enterDirectory: (dir: FileItem) => Promise<void>;
  navigateUp: () => Promise<void>;
  refresh: () => Promise<void>;
  setActiveCategory: (category: FileCategory) => Promise<void>;
  setViewMode: (mode: 'list' | 'grid') => void;
  setSort: (field: SortField, order: SortOrder) => void;
  toggleShowHidden: () => Promise<void>;
  toggleSelectFile: (fileId: string) => void;
  selectAll: () => void;
  invertSelection: (poolFiles?: FileItem[]) => void;
  clearSelection: () => void;
  setClipboard: (mode: 'copy' | 'move', items: FileItem[]) => void;
  clearClipboard: () => void;
  pasteClipboard: (targetDirPath?: string) => Promise<void>;
  createFolder: (name: string, parentPath?: string) => Promise<string>;
  createFile: (name: string, content?: string, parentPath?: string) => Promise<string>;
  renameItem: (path: string, newName: string) => Promise<string>;
  deleteSelected: () => Promise<void>;
  deleteSelectedWithChoice: (permanent: boolean) => Promise<void>;
  deleteSingle: (path: string) => Promise<void>;
  deleteSingleWithChoice: (path: string, permanent: boolean) => Promise<void>;
  compressSelected: (zipName: string, destDirPath?: string) => Promise<string>;
  extractArchive: (archivePath: string, destDirPath?: string) => Promise<string[]>;
  hideItem: (path: string) => Promise<string>;
  unhideItem: (path: string) => Promise<string>;
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
      await fileService.initFavorites();
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

  loadDirectory: async (path: string, forceRefresh: boolean = false) => {
    const cached = fileService.getCachedDirectory(path, get().showHidden);
    if (cached && !forceRefresh) {
      const sorted = fileService.sortFiles(cached, get().sortBy, get().sortOrder);
      set({
        currentPath: path,
        files: sorted,
        isLoading: false,
        selectedFileIds: new Set(),
      });
      fileService.preloadSubdirectories(cached, get().showHidden);
      return;
    }

    set({ currentPath: path, selectedFileIds: new Set(), isLoading: true });
    try {
      const rawFiles = await fileService.listDirectory(path, get().showHidden, forceRefresh);
      const sorted = fileService.sortFiles(rawFiles, get().sortBy, get().sortOrder);
      set({
        files: sorted,
        isLoading: false,
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
    const cached = fileService.getCachedDirectory(dir.path, get().showHidden);
    if (cached) {
      // 0.00ms immediate synchronous switch!
      const sorted = fileService.sortFiles(cached, get().sortBy, get().sortOrder);
      set({
        history: nextHistory,
        currentPath: dir.path,
        files: sorted,
        isLoading: false,
        selectedFileIds: new Set(),
      });
      fileService.preloadSubdirectories(cached, get().showHidden);
      return;
    }

    set({ history: nextHistory });
    await get().loadDirectory(dir.path);
  },

  navigateUp: async () => {
    const { history, currentPath } = get();
    let previousPath = '';
    let newHistory = history;
    if (history.length > 0) {
      previousPath = history[history.length - 1];
      newHistory = history.slice(0, -1);
    } else {
      const parent = currentPath.substring(0, currentPath.lastIndexOf('/'));
      if (parent && parent.length >= '/storage'.length) {
        previousPath = parent;
      }
    }
    if (!previousPath) return;

    const cached = fileService.getCachedDirectory(previousPath, get().showHidden);
    if (cached) {
      // 0.00ms immediate synchronous back switch!
      const sorted = fileService.sortFiles(cached, get().sortBy, get().sortOrder);
      set({
        history: newHistory,
        currentPath: previousPath,
        files: sorted,
        isLoading: false,
        selectedFileIds: new Set(),
      });
      fileService.preloadSubdirectories(cached, get().showHidden);
      return;
    }

    set({ history: newHistory });
    await get().loadDirectory(previousPath);
  },

  refresh: async () => {
    const { currentPath, activeCategory, recentFiles, categoryFiles } = get();
    await get().loadDirectory(currentPath, true);
    const recents = await fileService.getRecentFiles(500, true);
    const catFiles = await fileService.getFilesByCategory(activeCategory, true);

    const isRecentsSame =
      recentFiles.length === recents.length &&
      (recentFiles.length === 0 ||
        (recentFiles[0]?.id === recents[0]?.id &&
          recentFiles[0]?.lastModified === recents[0]?.lastModified));

    const isCatSame =
      categoryFiles.length === catFiles.length &&
      (categoryFiles.length === 0 ||
        (categoryFiles[0]?.id === catFiles[0]?.id &&
          categoryFiles[0]?.lastModified === catFiles[0]?.lastModified));

    if (!isRecentsSame || !isCatSame) {
      set({
        recentFiles: isRecentsSame ? recentFiles : recents,
        categoryFiles: isCatSame ? categoryFiles : catFiles,
      });
    }
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
    const pool = get().files.length > 0 ? get().files : get().recentFiles;
    const allIds = new Set(pool.map((f) => f.id));
    set({ selectedFileIds: allIds });
  },

  invertSelection: (poolFiles?: FileItem[]) => {
    const targetFiles = poolFiles || (get().files.length > 0 ? get().files : get().recentFiles);
    const currentSelected = get().selectedFileIds;
    const inverted = new Set<string>();
    targetFiles.forEach((f) => {
      if (!currentSelected.has(f.id)) {
        inverted.add(f.id);
      }
    });
    set({ selectedFileIds: inverted });
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

  pasteClipboard: async (targetDirPath?: string) => {
    const { clipboard, currentPath } = get();
    if (!clipboard || clipboard.items.length === 0) return;
    const dest = targetDirPath || currentPath;

    set({ isLoading: true });
    try {
      for (const item of clipboard.items) {
        if (clipboard.mode === 'copy') {
          await fileService.copy(item.path, dest);
        } else {
          await fileService.move(item.path, dest);
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

  createFolder: async (name: string, parentPath?: string) => {
    const targetDir = (parentPath || get().currentPath).replace(/\/$/, '');
    const newPath = `${targetDir}/${name}`;
    const newFolder: FileItem = {
      id: newPath,
      name,
      path: newPath,
      isDirectory: true,
      size: 0,
      lastModified: Date.now(),
      extension: '',
      mimeType: 'directory',
    };

    if (targetDir === get().currentPath.replace(/\/$/, '')) {
      const updated = fileService.sortFiles([newFolder, ...get().files], get().sortBy, get().sortOrder);
      set({ files: updated });
      fileService.setCachedDirectory(targetDir, get().showHidden, updated);
    }
    fileService.createFolder(targetDir, name).catch((err) => {
      console.warn('Error creating folder:', err);
    });
    return newPath;
  },

  createFile: async (name: string, content: string = '', parentPath?: string) => {
    const targetDir = (parentPath || get().currentPath).replace(/\/$/, '');
    const newPath = `${targetDir}/${name}`;
    const ext = name.includes('.') ? '.' + name.split('.').pop() : '';
    const newFile: FileItem = {
      id: newPath,
      name,
      path: newPath,
      isDirectory: false,
      size: (content || '').length,
      lastModified: Date.now(),
      extension: ext,
      mimeType: getMimeTypeFromExtension(name),
    };

    if (targetDir === get().currentPath.replace(/\/$/, '')) {
      const updated = fileService.sortFiles([newFile, ...get().files], get().sortBy, get().sortOrder);
      set({ files: updated, recentFiles: [newFile, ...get().recentFiles] });
      fileService.setCachedDirectory(targetDir, get().showHidden, updated);
    }
    fileService.createFile(targetDir, name, content).catch((err) => {
      console.warn('Error creating file:', err);
    });
    return newPath;
  },

  renameItem: async (path: string, newName: string) => {
    const parentDir = path.substring(0, path.lastIndexOf('/'));
    const newPath = `${parentDir}/${newName}`;
    const newExt = newName.includes('.') ? '.' + newName.split('.').pop() : '';

    const updateItem = (f: FileItem): FileItem => {
      if (f.path === path || f.id === path) {
        return {
          ...f,
          name: newName,
          path: newPath,
          id: newPath,
          extension: newExt,
          mimeType: f.isDirectory ? 'directory' : getMimeTypeFromExtension(newName),
        };
      }
      return f;
    };

    const nextFiles = fileService.sortFiles(get().files.map(updateItem), get().sortBy, get().sortOrder);
    const nextCategory = fileService.sortFiles(get().categoryFiles.map(updateItem), get().sortBy, get().sortOrder);
    const nextRecent = get().recentFiles.map(updateItem);

    set({
      files: nextFiles,
      categoryFiles: nextCategory,
      recentFiles: nextRecent,
    });

    fileService.setCachedDirectory(get().currentPath, get().showHidden, nextFiles);
    fileService.updateCachedItem(path, updateItem);
    fileService.rename(path, newName).catch((err) => {
      console.warn('Error renaming item:', err);
    });
    return newPath;
  },

  deleteSelected: async () => {
    await get().deleteSelectedWithChoice(false);
  },

  deleteSelectedWithChoice: async (permanent: boolean) => {
    const { selectedFileIds, files, recentFiles, categoryFiles, currentPath, showHidden } = get();
    if (selectedFileIds.size === 0) return;

    const ids = new Set(selectedFileIds);
    const allFiles = [...files, ...recentFiles, ...categoryFiles];
    const pathsToDelete = Array.from(ids)
      .map((id) => allFiles.find((f) => f.id === id || f.path === id)?.path)
      .filter((p): p is string => Boolean(p));

    const nextFiles = files.filter((f) => !ids.has(f.id) && !ids.has(f.path));
    const nextRecent = recentFiles.filter((f) => !ids.has(f.id) && !ids.has(f.path));
    const nextCategory = categoryFiles.filter((f) => !ids.has(f.id) && !ids.has(f.path));

    set({
      files: nextFiles,
      recentFiles: nextRecent,
      categoryFiles: nextCategory,
      selectedFileIds: new Set(),
      isLoading: false,
    });

    fileService.setCachedDirectory(currentPath, showHidden, nextFiles);
    pathsToDelete.forEach((p) => fileService.removeCachedItem(p));
    Promise.all(pathsToDelete.map((p) => fileService.delete(p, !permanent))).catch((err) => {
      console.warn('Error deleting selected items:', err);
    });
  },

  deleteSingle: async (path: string) => {
    await get().deleteSingleWithChoice(path, true);
  },

  deleteSingleWithChoice: async (path: string, permanent: boolean) => {
    const nextFiles = get().files.filter((f) => f.path !== path && f.id !== path);
    const nextRecent = get().recentFiles.filter((f) => f.path !== path && f.id !== path);
    const nextCategory = get().categoryFiles.filter((f) => f.path !== path && f.id !== path);
    const nextSelected = new Set(get().selectedFileIds);
    nextSelected.delete(path);

    set({
      files: nextFiles,
      recentFiles: nextRecent,
      categoryFiles: nextCategory,
      selectedFileIds: nextSelected,
    });

    fileService.setCachedDirectory(get().currentPath, get().showHidden, nextFiles);
    fileService.removeCachedItem(path);
    fileService.delete(path, !permanent).catch((err) => {
      console.warn('Error deleting single item:', err);
    });
  },

  compressSelected: async (zipName: string, destDirPath?: string) => {
    const { selectedFileIds, files, recentFiles, currentPath } = get();
    const allFiles = [...files, ...recentFiles];
    const sourcePaths = Array.from(selectedFileIds)
      .map((id) => allFiles.find((f) => f.id === id)?.path)
      .filter((p): p is string => Boolean(p));

    if (sourcePaths.length === 0) return '';
    const cleanZipName = zipName.toLowerCase().endsWith('.zip') ? zipName : `${zipName}.zip`;
    const targetDir = destDirPath || currentPath;
    const destZipPath = `${targetDir}/${cleanZipName}`;
    const result = await archiveService.createArchive(sourcePaths, destZipPath);
    await get().refresh();
    set({ selectedFileIds: new Set() });
    return result;
  },

  extractArchive: async (archivePath: string, destDirPath?: string) => {
    const dest = destDirPath || archivePath.substring(0, archivePath.lastIndexOf('/'));
    const result = await archiveService.extractArchive(archivePath, dest);
    await get().refresh();
    return result;
  },

  hideItem: async (path: string) => {
    const fileName = path.split('/').pop() || '';
    if (!fileName.startsWith('.')) {
      const newName = `.${fileName}`;
      const newPath = await fileService.rename(path, newName);
      await get().refresh();
      return newPath;
    }
    return path;
  },

  unhideItem: async (path: string) => {
    const fileName = path.split('/').pop() || '';
    if (fileName.startsWith('.')) {
      const newName = fileName.replace(/^\.+/, '');
      const newPath = await fileService.rename(path, newName);
      await get().refresh();
      return newPath;
    }
    return path;
  },

  toggleFavorite: (path: string) => {
    fileService.toggleFavorite(path);
    const updateFav = (f: FileItem) =>
      f.path === path ? { ...f, isFavorite: !f.isFavorite } : f;
    set({
      files: get().files.map(updateFav),
      recentFiles: get().recentFiles.map(updateFav),
      categoryFiles: get().categoryFiles.map(updateFav),
    });
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

