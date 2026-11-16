import { NativeModules, Platform } from 'react-native';
import { FileItem, StorageVolume, FileCategory } from '../../types/file';
import { getCategoryFromExtension } from '../../utils/fileTypes';
import { extractParentFolder } from '../../utils/formatters';

const { NexFileManager } = NativeModules;

// In-Memory Virtual Filesystem State for offline/fallback/test execution
const VIRTUAL_STORAGE_ROOT = '/storage/emulated/0';

interface VirtualFileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastModified: number;
  mimeType: string;
  isHidden?: boolean;
}

const mockFileSystem: Map<string, VirtualFileNode[]> = new Map();

function initMockFileSystem() {
  if (mockFileSystem.size > 0) return;

  const now = Date.now();

  // Root Directories
  mockFileSystem.set(VIRTUAL_STORAGE_ROOT, [
    { name: 'Download', path: `${VIRTUAL_STORAGE_ROOT}/Download`, isDirectory: true, size: 0, lastModified: now - 3600000, mimeType: 'inode/directory' },
    { name: 'Documents', path: `${VIRTUAL_STORAGE_ROOT}/Documents`, isDirectory: true, size: 0, lastModified: now - 7200000, mimeType: 'inode/directory' },
    { name: 'DCIM', path: `${VIRTUAL_STORAGE_ROOT}/DCIM`, isDirectory: true, size: 0, lastModified: now - 18000000, mimeType: 'inode/directory' },
    { name: 'Pictures', path: `${VIRTUAL_STORAGE_ROOT}/Pictures`, isDirectory: true, size: 0, lastModified: now - 86400000, mimeType: 'inode/directory' },
    { name: 'Music', path: `${VIRTUAL_STORAGE_ROOT}/Music`, isDirectory: true, size: 0, lastModified: now - 172800000, mimeType: 'inode/directory' },
    { name: 'Movies', path: `${VIRTUAL_STORAGE_ROOT}/Movies`, isDirectory: true, size: 0, lastModified: now - 259200000, mimeType: 'inode/directory' },
    { name: '.hidden_config', path: `${VIRTUAL_STORAGE_ROOT}/.hidden_config`, isDirectory: true, size: 0, lastModified: now - 500000000, mimeType: 'inode/directory', isHidden: true },
  ]);

  // Downloads folder contents
  mockFileSystem.set(`${VIRTUAL_STORAGE_ROOT}/Download`, [
    { name: 'Project_Specification_2026.pdf', path: `${VIRTUAL_STORAGE_ROOT}/Download/Project_Specification_2026.pdf`, isDirectory: false, size: 2450000, lastModified: now - 1200000, mimeType: 'application/pdf' },
    { name: 'NexFile_Alpha_v1.0.apk', path: `${VIRTUAL_STORAGE_ROOT}/Download/NexFile_Alpha_v1.0.apk`, isDirectory: false, size: 38200000, lastModified: now - 4500000, mimeType: 'application/vnd.android.package-archive' },
    { name: 'Dataset_Archive_Q4.zip', path: `${VIRTUAL_STORAGE_ROOT}/Download/Dataset_Archive_Q4.zip`, isDirectory: false, size: 145000000, lastModified: now - 80000000, mimeType: 'application/zip' },
    { name: 'Financial_Summary_2026.xlsx', path: `${VIRTUAL_STORAGE_ROOT}/Download/Financial_Summary_2026.xlsx`, isDirectory: false, size: 780000, lastModified: now - 95000000, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  ]);

  // Documents folder contents
  mockFileSystem.set(`${VIRTUAL_STORAGE_ROOT}/Documents`, [
    { name: 'Contract_Agreement_Signed.pdf', path: `${VIRTUAL_STORAGE_ROOT}/Documents/Contract_Agreement_Signed.pdf`, isDirectory: false, size: 1840000, lastModified: now - 15000000, mimeType: 'application/pdf' },
    { name: 'Product_Roadmap_2027.docx', path: `${VIRTUAL_STORAGE_ROOT}/Documents/Product_Roadmap_2027.docx`, isDirectory: false, size: 940000, lastModified: now - 40000000, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    { name: 'Meeting_Notes.txt', path: `${VIRTUAL_STORAGE_ROOT}/Documents/Meeting_Notes.txt`, isDirectory: false, size: 42000, lastModified: now - 60000000, mimeType: 'text/plain' },
    { name: 'Architecture_Design.pdf', path: `${VIRTUAL_STORAGE_ROOT}/Documents/Architecture_Design.pdf`, isDirectory: false, size: 4120000, lastModified: now - 120000000, mimeType: 'application/pdf' },
  ]);

  // DCIM folder contents
  mockFileSystem.set(`${VIRTUAL_STORAGE_ROOT}/DCIM`, [
    { name: 'Camera', path: `${VIRTUAL_STORAGE_ROOT}/DCIM/Camera`, isDirectory: true, size: 0, lastModified: now - 500000, mimeType: 'inode/directory' },
    { name: 'Screenshots', path: `${VIRTUAL_STORAGE_ROOT}/DCIM/Screenshots`, isDirectory: true, size: 0, lastModified: now - 1500000, mimeType: 'inode/directory' },
  ]);

  mockFileSystem.set(`${VIRTUAL_STORAGE_ROOT}/DCIM/Camera`, [
    { name: 'IMG_20261115_102045.jpg', path: `${VIRTUAL_STORAGE_ROOT}/DCIM/Camera/IMG_20261115_102045.jpg`, isDirectory: false, size: 4890000, lastModified: now - 1800000, mimeType: 'image/jpeg' },
    { name: 'IMG_20261115_091530.jpg', path: `${VIRTUAL_STORAGE_ROOT}/DCIM/Camera/IMG_20261115_091530.jpg`, isDirectory: false, size: 5210000, lastModified: now - 5400000, mimeType: 'image/jpeg' },
    { name: 'VID_20261114_183022.mp4', path: `${VIRTUAL_STORAGE_ROOT}/DCIM/Camera/VID_20261114_183022.mp4`, isDirectory: false, size: 98500000, lastModified: now - 72000000, mimeType: 'video/mp4' },
  ]);

  // Music folder contents
  mockFileSystem.set(`${VIRTUAL_STORAGE_ROOT}/Music`, [
    { name: 'Acoustic_Breeze.mp3', path: `${VIRTUAL_STORAGE_ROOT}/Music/Acoustic_Breeze.mp3`, isDirectory: false, size: 6850000, lastModified: now - 90000000, mimeType: 'audio/mpeg' },
    { name: 'Ambient_Focus_Flow.flac', path: `${VIRTUAL_STORAGE_ROOT}/Music/Ambient_Focus_Flow.flac`, isDirectory: false, size: 28400000, lastModified: now - 150000000, mimeType: 'audio/flac' },
  ]);
}

export interface SaveImageOptions {
  rotation?: number;
  straighten?: number;
  flipH?: boolean;
  flipV?: boolean;
  crop?: { x?: number; y?: number; width: number; height: number };
  brightness?: number;
  contrast?: number;
  saturation?: number;
  temperature?: number;
  tint?: number;
  vignette?: number;
  filter?: string;
  resizeWidth?: number;
  resizeHeight?: number;
  format?: 'jpg' | 'png' | 'webp';
  quality?: number;
  textOverlay?: string;
  textColor?: string;
  textSize?: number;
}

export class NativeBridgeService {
  static isNativeAvailable(): boolean {
    return Platform.OS === 'android' && Boolean(NexFileManager);
  }

  static async getStorageVolumes(): Promise<StorageVolume[]> {
    if (this.isNativeAvailable()) {
      try {
        return await NexFileManager.getStorageVolumes();
      } catch (err) {
        console.warn('Native getStorageVolumes failed, using fallback:', err);
      }
    }

    initMockFileSystem();
    return [
      {
        id: 'internal',
        name: 'Internal Storage',
        path: VIRTUAL_STORAGE_ROOT,
        isRemovable: false,
        isPrimary: true,
        totalBytes: 128 * 1024 * 1024 * 1024, // 128 GB
        usedBytes: 42.4 * 1024 * 1024 * 1024, // 42.4 GB used
        freeBytes: 85.6 * 1024 * 1024 * 1024, // 85.6 GB free
      },
      {
        id: 'sdcard_1',
        name: 'SD Card (SanDisk 64GB)',
        path: '/storage/0000-0000',
        isRemovable: true,
        isPrimary: false,
        totalBytes: 64 * 1024 * 1024 * 1024,
        usedBytes: 18.2 * 1024 * 1024 * 1024,
        freeBytes: 45.8 * 1024 * 1024 * 1024,
      },
    ];
  }

  static async listFiles(dirPath: string, showHidden: boolean = false): Promise<FileItem[]> {
    if (this.isNativeAvailable()) {
      try {
        const rawFiles = await NexFileManager.listFiles(dirPath, showHidden);
        return rawFiles.map((file: any) => ({
          id: file.path,
          name: file.name,
          path: file.path,
          isDirectory: Boolean(file.isDirectory),
          isHidden: Boolean(file.isHidden),
          size: Number(file.size || 0),
          lastModified: Number(file.lastModified || Date.now()),
          extension: file.extension || '',
          mimeType: file.mimeType || '*/*',
          canRead: Boolean(file.canRead ?? true),
          canWrite: Boolean(file.canWrite ?? true),
          itemCount: file.itemCount,
          category: getCategoryFromExtension(file.extension || ''),
        }));
      } catch (err) {
        console.warn('Native listFiles failed, using fallback:', err);
      }
    }

    initMockFileSystem();
    const normalizedPath = dirPath.replace(/\/+$/, '');
    const items = mockFileSystem.get(normalizedPath) || [];

    return items
      .filter((node) => showHidden || !node.isHidden)
      .map((node) => {
        const ext = node.name.includes('.') ? node.name.split('.').pop() || '' : '';
        const children = node.isDirectory ? mockFileSystem.get(node.path) : undefined;
        return {
          id: node.path,
          name: node.name,
          path: node.path,
          isDirectory: node.isDirectory,
          isHidden: Boolean(node.isHidden),
          size: node.size,
          lastModified: node.lastModified,
          extension: ext,
          mimeType: node.mimeType,
          canRead: true,
          canWrite: true,
          itemCount: children ? children.length : 0,
          category: getCategoryFromExtension(ext),
        };
      });
  }

  static async createDirectory(parentPath: string, dirName: string): Promise<string> {
    if (this.isNativeAvailable()) {
      return await NexFileManager.createDirectory(parentPath, dirName);
    }

    initMockFileSystem();
    const normalized = parentPath.replace(/\/+$/, '');
    const newPath = `${normalized}/${dirName}`;
    const parentList = mockFileSystem.get(normalized) || [];

    if (parentList.some((item) => item.name === dirName)) {
      throw new Error(`Item ${dirName} already exists`);
    }

    const newNode: VirtualFileNode = {
      name: dirName,
      path: newPath,
      isDirectory: true,
      size: 0,
      lastModified: Date.now(),
      mimeType: 'inode/directory',
      isHidden: dirName.startsWith('.'),
    };

    parentList.push(newNode);
    mockFileSystem.set(normalized, parentList);
    mockFileSystem.set(newPath, []);

    return newPath;
  }

  static async renameItem(path: string, newName: string): Promise<string> {
    if (this.isNativeAvailable()) {
      return await NexFileManager.renameItem(path, newName);
    }

    initMockFileSystem();
    const parent = path.substring(0, path.lastIndexOf('/'));
    const items = mockFileSystem.get(parent) || [];
    const target = items.find((f) => f.path === path);
    if (!target) throw new Error('File not found');

    const newPath = `${parent}/${newName}`;
    target.name = newName;
    target.path = newPath;
    target.lastModified = Date.now();

    if (target.isDirectory && mockFileSystem.has(path)) {
      const children = mockFileSystem.get(path) || [];
      mockFileSystem.delete(path);
      mockFileSystem.set(newPath, children);
    }

    return newPath;
  }

  static async deleteItem(path: string): Promise<boolean> {
    if (this.isNativeAvailable()) {
      return await NexFileManager.deleteItem(path);
    }

    initMockFileSystem();
    const parent = path.substring(0, path.lastIndexOf('/'));
    const items = mockFileSystem.get(parent) || [];
    mockFileSystem.set(
      parent,
      items.filter((f) => f.path !== path)
    );
    mockFileSystem.delete(path);
    return true;
  }

  static async copyItem(sourcePath: string, destinationDirPath: string): Promise<string> {
    if (this.isNativeAvailable()) {
      return await NexFileManager.copyItem(sourcePath, destinationDirPath);
    }

    initMockFileSystem();
    const sourceParent = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
    const sourceItems = mockFileSystem.get(sourceParent) || [];
    const source = sourceItems.find((f) => f.path === sourcePath);
    if (!source) throw new Error('Source file not found');

    const destNormalized = destinationDirPath.replace(/\/+$/, '');
    const newPath = `${destNormalized}/${source.name}`;
    const destItems = mockFileSystem.get(destNormalized) || [];

    const copyNode: VirtualFileNode = {
      ...source,
      path: newPath,
      lastModified: Date.now(),
    };

    destItems.push(copyNode);
    mockFileSystem.set(destNormalized, destItems);

    return newPath;
  }

  static async moveItem(sourcePath: string, destinationDirPath: string): Promise<string> {
    if (this.isNativeAvailable()) {
      return await NexFileManager.moveItem(sourcePath, destinationDirPath);
    }

    const newPath = await this.copyItem(sourcePath, destinationDirPath);
    await this.deleteItem(sourcePath);
    return newPath;
  }

  static async calculateChecksum(filePath: string, algorithm: 'MD5' | 'SHA-256' = 'SHA-256'): Promise<string> {
    if (this.isNativeAvailable()) {
      return await NexFileManager.calculateChecksum(filePath, algorithm);
    }

    // Mock deterministic hash for development/testing
    let hash = 0;
    const str = `${filePath}:${algorithm}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    return algorithm === 'SHA-256'
      ? `${hex}7d91e4b85c1320496825dfa14bce037a912e84c9`
      : `${hex}8b02c4a9`;
  }

  static async setAsWallpaper(filePath: string): Promise<boolean> {
    if (this.isNativeAvailable() && NexFileManager?.setAsWallpaper) {
      try {
        return await NexFileManager.setAsWallpaper(filePath);
      } catch (e) {
        console.warn('Failed to set wallpaper via native bridge', e);
      }
    }
    return false;
  }

  static async getImageDimensions(filePath: string): Promise<{ width: number; height: number; mimeType?: string } | null> {
    if (this.isNativeAvailable() && NexFileManager?.getImageDimensions) {
      try {
        return await NexFileManager.getImageDimensions(filePath);
      } catch (e) {
        console.warn('Failed to get image dimensions', e);
      }
    }
    return null;
  }

  static async openFile(filePath: string, mimeType?: string): Promise<boolean> {
    if (this.isNativeAvailable()) {
      return await NexFileManager.openFile(filePath, mimeType || '*/*');
    }
    console.log(`[FileViewer] Simulating opening file: ${filePath} (${mimeType || 'auto'})`);
    return true;
  }

  static async checkAllFilesPermission(): Promise<boolean> {
    if (this.isNativeAvailable() && NexFileManager?.checkAllFilesPermission) {
      try {
        return await NexFileManager.checkAllFilesPermission();
      } catch (e) {
        console.warn('Failed to check all files permission', e);
      }
    }
    return true;
  }

  static async requestAllFilesPermission(): Promise<boolean> {
    if (this.isNativeAvailable() && NexFileManager?.requestAllFilesPermission) {
      try {
        return await NexFileManager.requestAllFilesPermission();
      } catch (e) {
        console.warn('Failed to request all files permission', e);
      }
    }
    return false;
  }

  static async getAllImages(): Promise<FileItem[]> {
    if (this.isNativeAvailable() && NexFileManager?.getAllImages) {
      try {
        const nativeImages: FileItem[] = await NexFileManager.getAllImages();
        if (nativeImages && nativeImages.length > 0) {
          return nativeImages.map((file) => ({
            ...file,
            category: 'images' as FileCategory,
            parentFolder: file.parentFolder || extractParentFolder(file.path),
          }));
        }
      } catch (err) {
        console.warn('Failed to load images from native bridge:', err);
      }
    }
    return this.getAllMockFiles(false).filter((f) => f.category === 'images');
  }

  static async saveEditedImage(
    sourcePath: string,
    destPath: string,
    options: SaveImageOptions
  ): Promise<{ success: boolean; path: string; name: string; size: number }> {
    if (this.isNativeAvailable() && NexFileManager?.saveEditedImage) {
      try {
        return await NexFileManager.saveEditedImage(sourcePath, destPath, options);
      } catch (err) {
        console.warn('Native saveEditedImage error:', err);
      }
    }
    return {
      success: true,
      path: destPath,
      name: destPath.split('/').pop() || 'edited.jpg',
      size: 1024 * 1024,
    };
  }

  static async setImmersiveMode(enable: boolean = true): Promise<boolean> {
    if (this.isNativeAvailable() && NexFileManager?.setImmersiveMode) {
      try {
        return await NexFileManager.setImmersiveMode(enable);
      } catch (e) {
        console.warn('Failed to set immersive mode', e);
        return false;
      }
    }
    return true;
  }

  static async getRecentFiles(limit: number = 250): Promise<FileItem[]> {
    if (this.isNativeAvailable() && NexFileManager?.getRecentFiles) {
      try {
        const nativeFiles: FileItem[] = await NexFileManager.getRecentFiles(limit);
        if (nativeFiles && nativeFiles.length > 0) {
          return nativeFiles.map((file) => ({
            ...file,
            category: getCategoryFromExtension(file.extension),
            parentFolder: file.parentFolder || extractParentFolder(file.path),
          }));
        }
      } catch (err) {
        console.warn('Failed to load recent files from native MediaStore:', err);
      }
    }
    // Fallback to local files
    return this.getAllMockFiles(false)
      .sort((a, b) => b.lastModified - a.lastModified)
      .slice(0, limit);
  }

  static getAllMockFiles(includeDirectories: boolean = false): FileItem[] {
    initMockFileSystem();
    const allFiles: FileItem[] = [];
    for (const [_, items] of mockFileSystem.entries()) {
      for (const item of items) {
        if (includeDirectories || !item.isDirectory) {
          const ext = item.name.includes('.') ? item.name.split('.').pop() || '' : '';
          allFiles.push({
            id: item.path,
            name: item.name,
            path: item.path,
            isDirectory: item.isDirectory,
            isHidden: Boolean(item.isHidden),
            size: item.size,
            lastModified: item.lastModified,
            extension: ext,
            mimeType: item.mimeType,
            canRead: true,
            canWrite: true,
            category: getCategoryFromExtension(ext),
            parentFolder: extractParentFolder(item.path),
          });
        }
      }
    }
    return allFiles;
  }
}

