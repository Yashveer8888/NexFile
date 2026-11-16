import { fileService } from '../src/services/filesystem/fileService';
import { FileItem } from '../src/types/file';

describe('fileService', () => {
  test('returns storage volumes', async () => {
    const volumes = await fileService.getStorageVolumes();
    expect(volumes.length).toBeGreaterThan(0);
    expect(volumes[0].id).toBe('internal');
    expect(volumes[0].totalBytes).toBeGreaterThan(0);
  });

  test('lists files in internal storage directory', async () => {
    const files = await fileService.listDirectory('/storage/emulated/0');
    expect(files.length).toBeGreaterThan(0);
    const downloadFolder = files.find((f) => f.name === 'Download');
    expect(downloadFolder).toBeDefined();
    expect(downloadFolder?.isDirectory).toBe(true);
  });

  test('filters files by category', async () => {
    const docs = await fileService.getFilesByCategory('documents');
    expect(docs.length).toBeGreaterThan(0);
    expect(docs.every((d) => ['pdf', 'docx', 'txt', 'xlsx'].includes(d.extension.toLowerCase()))).toBe(true);

    const apks = await fileService.getFilesByCategory('apks');
    expect(apks.length).toBeGreaterThan(0);
    expect(apks[0].extension.toLowerCase()).toBe('apk');
  });

  test('sorts files by name ascending and descending', () => {
    const mockFiles: FileItem[] = [
      { id: '1', name: 'Zebra.txt', path: '/Zebra.txt', isDirectory: false, size: 100, lastModified: 1000, extension: 'txt', mimeType: 'text/plain' },
      { id: '2', name: 'Alpha.txt', path: '/Alpha.txt', isDirectory: false, size: 200, lastModified: 2000, extension: 'txt', mimeType: 'text/plain' },
      { id: '3', name: 'FolderB', path: '/FolderB', isDirectory: true, size: 0, lastModified: 1500, extension: '', mimeType: 'inode/directory' },
    ];

    const sortedAsc = fileService.sortFiles(mockFiles, 'name', 'asc');
    // Folders come first
    expect(sortedAsc[0].name).toBe('FolderB');
    expect(sortedAsc[1].name).toBe('Alpha.txt');
    expect(sortedAsc[2].name).toBe('Zebra.txt');

    const sortedDesc = fileService.sortFiles(mockFiles, 'name', 'desc');
    expect(sortedDesc[0].name).toBe('FolderB');
    expect(sortedDesc[1].name).toBe('Zebra.txt');
    expect(sortedDesc[2].name).toBe('Alpha.txt');
  });

  test('calculates file checksums for MD5 and SHA-256', async () => {
    const md5 = await fileService.calculateChecksum('/storage/emulated/0/Download/Project_Specification_2026.pdf', 'MD5');
    const sha256 = await fileService.calculateChecksum('/storage/emulated/0/Download/Project_Specification_2026.pdf', 'SHA-256');

    expect(typeof md5).toBe('string');
    expect(md5.length).toBeGreaterThan(0);
    expect(typeof sha256).toBe('string');
    expect(sha256.length).toBeGreaterThan(0);
  });

  test('creates a folder, renames, and moves to recycle bin', async () => {
    const createdPath = await fileService.createFolder('/storage/emulated/0', 'Test_Jest_Folder');
    expect(createdPath).toBe('/storage/emulated/0/Test_Jest_Folder');

    const renamedPath = await fileService.rename(createdPath, 'Test_Jest_Folder_Renamed');
    expect(renamedPath).toBe('/storage/emulated/0/Test_Jest_Folder_Renamed');

    await fileService.delete(renamedPath, true);
    const trash = fileService.getRecycleBinItems();
    expect(trash.some((t) => t.originalPath === renamedPath)).toBe(true);

    fileService.emptyRecycleBin();
    expect(fileService.getRecycleBinItems().length).toBe(0);
  });

  test('manages favorites toggling', () => {
    const testPath = '/storage/emulated/0/Documents/Contract_Agreement_Signed.pdf';
    expect(fileService.isFavorite(testPath)).toBe(false);

    fileService.toggleFavorite(testPath);
    expect(fileService.isFavorite(testPath)).toBe(true);

    fileService.toggleFavorite(testPath);
    expect(fileService.isFavorite(testPath)).toBe(false);
  });
});

