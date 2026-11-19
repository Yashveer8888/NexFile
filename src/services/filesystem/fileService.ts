import { FileItem, FileCategory, SortField, SortOrder, StorageVolume, RecycleBinItem } from '../../types/file';
import { NativeBridgeService, SaveImageOptions } from './nativeBridge';
import { getCategoryFromExtension, isUsefulRecentFile, isJunkOrSystemFile } from '../../utils/fileTypes';
import { extractParentFolder } from '../../utils/formatters';

class FileService {
  private favorites: Set<string> = new Set();
  private recycleBin: RecycleBinItem[] = [];
  private favoritesLoaded: boolean = false;
  private dirCache: Map<string, { files: FileItem[]; timestamp: number }> = new Map();

  getCachedDirectory(path: string, showHidden: boolean): FileItem[] | null {
    const key = `${path}__${showHidden}`;
    const cached = this.dirCache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp < 30000) {
      return cached.files;
    }
    return null;
  }

  clearDirectoryCache(path?: string): void {
    if (path) {
      for (const key of this.dirCache.keys()) {
        if (key.startsWith(path)) {
          this.dirCache.delete(key);
        }
      }
    } else {
      this.dirCache.clear();
    }
  }

  async initFavorites(): Promise<void> {
    if (this.favoritesLoaded) return;
    try {
      const raw = await NativeBridgeService.getPreference('NEX_FAVORITES', '[]');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          this.favorites = new Set(arr);
        }
      }
    } catch (e) {
      console.warn('Failed to load favorites preference:', e);
    }
    this.favoritesLoaded = true;
  }

  async getStorageVolumes(): Promise<StorageVolume[]> {
    return await NativeBridgeService.getStorageVolumes();
  }

  async listDirectory(path: string, showHidden: boolean = false, forceRefresh: boolean = false): Promise<FileItem[]> {
    const key = `${path}__${showHidden}`;
    if (!forceRefresh) {
      const cached = this.getCachedDirectory(path, showHidden);
      if (cached) return cached;
    }

    const items = await NativeBridgeService.listFiles(path, showHidden);
    const mapped = items.map((item) => ({
      ...item,
      isFavorite: this.favorites.has(item.path),
    }));

    this.dirCache.set(key, { files: mapped, timestamp: Date.now() });
    return mapped;
  }

  async getAllImages(): Promise<FileItem[]> {
    return await NativeBridgeService.getAllImages();
  }

  async getAllVideos(): Promise<FileItem[]> {
    return await NativeBridgeService.getAllVideos();
  }

  async getRecentFiles(limit: number = 500): Promise<FileItem[]> {
    const allFiles = await NativeBridgeService.getRecentFiles(limit);
    return allFiles
      .filter((file) => isUsefulRecentFile(file))
      .sort((a, b) => b.lastModified - a.lastModified)
      .map((item) => ({
        ...item,
        parentFolder: item.parentFolder || extractParentFolder(item.path),
        isFavorite: this.favorites.has(item.path),
      }));
  }

  async getFilesByCategory(category: FileCategory): Promise<FileItem[]> {
    let allFiles = await NativeBridgeService.getRecentFiles(2500);
    if (!allFiles || allFiles.length === 0) {
      allFiles = NativeBridgeService.getAllMockFiles();
    }
    const filtered = category === 'all'
      ? allFiles.filter((file) => isUsefulRecentFile(file))
      : allFiles.filter((file) => {
          if (!isUsefulRecentFile(file)) return false;
          if (category === 'downloads') {
            return file.path.toLowerCase().includes('/download');
          }
          if (category === 'whatsapp') {
            return (
              file.path.toLowerCase().includes('whatsapp') ||
              file.path.toLowerCase().includes('com.whatsapp')
            );
          }
          if (category === 'bluetooth') {
            return file.path.toLowerCase().includes('/bluetooth');
          }
          return getCategoryFromExtension(file.extension) === category;
        });

    return filtered
      .sort((a, b) => b.lastModified - a.lastModified)
      .map((item) => ({
        ...item,
        parentFolder: item.parentFolder || extractParentFolder(item.path),
        isFavorite: this.favorites.has(item.path),
      }));
  }

  async searchFiles(query: string, rootPath?: string, extension?: string): Promise<FileItem[]> {
    let allFiles = await NativeBridgeService.getRecentFiles(3000);
    if (!allFiles || allFiles.length === 0) {
      allFiles = NativeBridgeService.getAllMockFiles();
    }
    const cleanQuery = query.toLowerCase().trim();
    const cleanExt = extension ? extension.toLowerCase().replace(/^\./, '') : null;

    return allFiles
      .filter((file) => {
        if (!isUsefulRecentFile(file)) return false;
        if (rootPath && !file.path.startsWith(rootPath)) return false;
        if (cleanExt && file.extension.toLowerCase() !== cleanExt) return false;
        if (!cleanQuery) return true;
        return (
          file.name.toLowerCase().includes(cleanQuery) ||
          (file.extension && file.extension.toLowerCase().includes(cleanQuery))
        );
      })
      .sort((a, b) => b.lastModified - a.lastModified)
      .map((item) => ({
        ...item,
        parentFolder: item.parentFolder || extractParentFolder(item.path),
        isFavorite: this.favorites.has(item.path),
      }));
  }

  sortFiles(items: FileItem[], field: SortField, order: SortOrder): FileItem[] {
    return [...items].sort((a, b) => {
      // Folders always first
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;

      let comparison = 0;
      switch (field) {
        case 'name': {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          comparison = nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
          break;
        }
        case 'date':
          comparison = a.lastModified - b.lastModified;
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'type': {
          const extA = (a.extension || '').toLowerCase();
          const extB = (b.extension || '').toLowerCase();
          comparison = extA < extB ? -1 : extA > extB ? 1 : 0;
          break;
        }
      }
      return order === 'asc' ? comparison : -comparison;
    });
  }

  async createFolder(parentPath: string, folderName: string): Promise<string> {
    this.clearDirectoryCache(parentPath);
    return await NativeBridgeService.createDirectory(parentPath, folderName);
  }

  async createFile(parentPath: string, fileName: string, content: string = ''): Promise<string> {
    this.clearDirectoryCache(parentPath);
    return await NativeBridgeService.createFile(parentPath, fileName, content);
  }

  async openWith(filePath: string): Promise<boolean> {
    return await NativeBridgeService.openWith(filePath);
  }

  async shareFiles(filePaths: string[]): Promise<boolean> {
    return await NativeBridgeService.shareFiles(filePaths);
  }

  async rename(path: string, newName: string): Promise<string> {
    this.clearDirectoryCache();
    const newPath = await NativeBridgeService.renameItem(path, newName);
    if (this.favorites.has(path)) {
      this.favorites.delete(path);
      this.favorites.add(newPath);
    }
    return newPath;
  }

  async batchRename(
    items: FileItem[],
    pattern: { prefix?: string; suffix?: string; startNumber?: number; replaceFrom?: string; replaceTo?: string }
  ): Promise<string[]> {
    const renamedPaths: string[] = [];
    let count = pattern.startNumber ?? 1;

    for (const item of items) {
      let ext = item.extension ? `.${item.extension}` : '';
      let baseName = item.name.replace(new RegExp(`${ext}$`), '');

      if (pattern.replaceFrom !== undefined && pattern.replaceTo !== undefined) {
        baseName = baseName.split(pattern.replaceFrom).join(pattern.replaceTo);
      }

      let newName = '';
      if (pattern.prefix) newName += pattern.prefix;
      newName += baseName;
      if (pattern.startNumber !== undefined) {
        newName += `_${count}`;
        count++;
      }
      if (pattern.suffix) newName += pattern.suffix;
      newName += ext;

      const newPath = await this.rename(item.path, newName);
      renamedPaths.push(newPath);
    }

    return renamedPaths;
  }

  async delete(path: string, useRecycleBin: boolean = true): Promise<boolean> {
    this.clearDirectoryCache();
    if (useRecycleBin) {
      const all = NativeBridgeService.getAllMockFiles(true);
      const target = all.find((f) => f.path === path);
      if (target) {
        this.recycleBin.push({
          id: `trash_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          originalPath: target.path,
          trashPath: `/storage/emulated/0/.trash/${target.name}`,
          name: target.name,
          deletedAt: Date.now(),
          size: target.size,
          isDirectory: target.isDirectory,
        });
      }
    }
    return await NativeBridgeService.deleteItem(path);
  }

  async copy(sourcePath: string, destDirPath: string): Promise<string> {
    this.clearDirectoryCache(destDirPath);
    return await NativeBridgeService.copyItem(sourcePath, destDirPath);
  }

  async move(sourcePath: string, destDirPath: string): Promise<string> {
    this.clearDirectoryCache();
    return await NativeBridgeService.moveItem(sourcePath, destDirPath);
  }

  async calculateChecksum(filePath: string, algorithm: 'MD5' | 'SHA-256' = 'SHA-256'): Promise<string> {
    return await NativeBridgeService.calculateChecksum(filePath, algorithm);
  }

  async setAsWallpaper(filePath: string): Promise<boolean> {
    return await NativeBridgeService.setAsWallpaper(filePath);
  }

  async openGoogleLens(filePath: string): Promise<boolean> {
    return await NativeBridgeService.openGoogleLens(filePath);
  }

  async getImageDimensions(filePath: string): Promise<{ width: number; height: number; mimeType?: string } | null> {
    return await NativeBridgeService.getImageDimensions(filePath);
  }

  async openFile(filePath: string, mimeType?: string): Promise<boolean> {
    return await NativeBridgeService.openFile(filePath, mimeType);
  }

  toggleFavorite(path: string): boolean {
    let result = false;
    if (this.favorites.has(path)) {
      this.favorites.delete(path);
      result = false;
    } else {
      this.favorites.add(path);
      result = true;
    }
    NativeBridgeService.savePreference(
      'NEX_FAVORITES',
      JSON.stringify(Array.from(this.favorites))
    ).catch((err) => console.warn('Failed saving favorites:', err));
    return result;
  }

  getFavorites(): string[] {
    return Array.from(this.favorites);
  }

  isFavorite(path: string): boolean {
    return this.favorites.has(path);
  }

  getRecycleBinItems(): RecycleBinItem[] {
    return [...this.recycleBin];
  }

  restoreFromRecycleBin(trashId: string): boolean {
    const index = this.recycleBin.findIndex((i) => i.id === trashId);
    if (index !== -1) {
      this.recycleBin.splice(index, 1);
      return true;
    }
    return false;
  }

  async saveEditedImage(
    sourcePath: string,
    destPath: string,
    options: SaveImageOptions
  ): Promise<{ success: boolean; path: string; name: string; size: number }> {
    return NativeBridgeService.saveEditedImage(sourcePath, destPath, options);
  }

  emptyRecycleBin(): void {
    this.recycleBin = [];
  }

  async setScreenBrightness(brightness: number): Promise<boolean> {
    return NativeBridgeService.setScreenBrightness(brightness);
  }

  async getScreenBrightness(): Promise<number> {
    return NativeBridgeService.getScreenBrightness();
  }

  async setDeviceVolume(volume: number): Promise<boolean> {
    return NativeBridgeService.setDeviceVolume(volume);
  }

  async getDeviceVolume(): Promise<number> {
    return NativeBridgeService.getDeviceVolume();
  }

  async captureVideoFrame(filePath: string, timeMs: number): Promise<string> {
    return NativeBridgeService.captureVideoFrame(filePath, timeMs);
  }

  async getVideoThumbnailAt(filePath: string, timeMs: number): Promise<string | null> {
    return NativeBridgeService.getVideoThumbnailAt(filePath, timeMs);
  }

  async enterPipMode(aspectRatioNum: number = 16, aspectRatioDen: number = 9): Promise<boolean> {
    return NativeBridgeService.enterPipMode(aspectRatioNum, aspectRatioDen);
  }

  async openWithSystemPlayer(filePath: string): Promise<boolean> {
    return NativeBridgeService.openWithSystemPlayer(filePath);
  }

  async setScreenOrientation(orientation: 'landscape' | 'portrait' | 'sensor' | 'unspecified'): Promise<boolean> {
    return NativeBridgeService.setScreenOrientation(orientation);
  }

  async savePreference(key: string, value: string): Promise<boolean> {
    return NativeBridgeService.savePreference(key, value);
  }

  async getPreference(key: string, defaultValue: string = ''): Promise<string> {
    return NativeBridgeService.getPreference(key, defaultValue);
  }

  async setImmersiveMode(enable: boolean): Promise<boolean> {
    return NativeBridgeService.setImmersiveMode(enable);
  }

  async isBiometricAvailable(): Promise<boolean> {
    return NativeBridgeService.isBiometricAvailable();
  }

  async authenticateBiometric(title: string = 'Private Vault', subtitle: string = 'Touch sensor to unlock'): Promise<boolean> {
    return NativeBridgeService.authenticateBiometric(title, subtitle);
  }
}

export const fileService = new FileService();

