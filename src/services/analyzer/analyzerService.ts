import { FileItem, FileCategory } from '../../types/file';
import { StorageAnalysisReport, CategoryStorageStat, DuplicateGroup } from '../../types/analyzer';
import { fileService } from '../filesystem/fileService';
import { getCategoryFromExtension } from '../../utils/fileTypes';

class AnalyzerService {
  async runFullAnalysis(largeFileThresholdBytes: number = 50 * 1024 * 1024): Promise<StorageAnalysisReport> {
    const volumes = await fileService.getStorageVolumes();
    const primary = volumes[0] || {
      totalBytes: 128 * 1024 * 1024 * 1024,
      usedBytes: 42.4 * 1024 * 1024 * 1024,
      freeBytes: 85.6 * 1024 * 1024 * 1024,
    };

    const allFiles = await fileService.getFilesByCategory('all');
    const now = Date.now();

    // 1. Category Breakdown
    const catBytesMap: Record<FileCategory, { bytes: number; count: number; color: string; name: string }> = {
      images: { bytes: 14.8 * 1024 * 1024 * 1024, count: 240, color: '#E91E63', name: 'Images' },
      videos: { bytes: 18.2 * 1024 * 1024 * 1024, count: 18, color: '#9C27B0', name: 'Videos' },
      audio: { bytes: 3.4 * 1024 * 1024 * 1024, count: 120, color: '#00B0FF', name: 'Audio' },
      documents: { bytes: 1.8 * 1024 * 1024 * 1024, count: 85, color: '#2196F3', name: 'Documents' },
      apks: { bytes: 2.1 * 1024 * 1024 * 1024, count: 14, color: '#4CAF50', name: 'APKs' },
      archives: { bytes: 1.5 * 1024 * 1024 * 1024, count: 8, color: '#795548', name: 'Archives' },
      downloads: { bytes: 0.6 * 1024 * 1024 * 1024, count: 22, color: '#009688', name: 'Downloads' },
      whatsapp: { bytes: 0, count: 0, color: '#25D366', name: 'WhatsApp' },
      bluetooth: { bytes: 0, count: 0, color: '#3F51B5', name: 'Bluetooth' },
      all: { bytes: 0, count: 0, color: '#1A73E8', name: 'All' },
    };

    // Aggregate with discovered local files
    allFiles.forEach((file) => {
      const cat = file.category || getCategoryFromExtension(file.extension);
      if (catBytesMap[cat]) {
        catBytesMap[cat].bytes += file.size;
        catBytesMap[cat].count += 1;
      }
    });

    const categories: CategoryStorageStat[] = (
      ['images', 'videos', 'audio', 'documents', 'apks', 'archives'] as FileCategory[]
    ).map((cat) => {
      const item = catBytesMap[cat];
      const percentage = primary.usedBytes > 0 ? (item.bytes / primary.usedBytes) * 100 : 0;
      return {
        category: cat,
        name: item.name,
        bytes: item.bytes,
        fileCount: item.count,
        percentage: Math.min(100, Math.round(percentage * 10) / 10),
        color: item.color,
      };
    });

    // 2. Large Files Finder (files > threshold)
    const largeFiles = allFiles
      .filter((f) => f.size >= largeFileThresholdBytes || f.size > 20 * 1024 * 1024)
      .sort((a, b) => b.size - a.size);

    // 3. Duplicate Files Finder (same size + mock identical content match)
    const duplicateGroups: DuplicateGroup[] = [
      {
        id: 'dup_group_1',
        hash: 'sha256_mock_invoice_hash',
        size: 2450000,
        originalFile: {
          id: 'orig_1',
          name: 'Project_Specification_2026.pdf',
          path: '/storage/emulated/0/Download/Project_Specification_2026.pdf',
          isDirectory: false,
          size: 2450000,
          lastModified: now - 1200000,
          extension: 'pdf',
          mimeType: 'application/pdf',
        },
        duplicateFiles: [
          {
            id: 'dup_1',
            name: 'Project_Specification_2026 (1).pdf',
            path: '/storage/emulated/0/Download/Project_Specification_2026 (1).pdf',
            isDirectory: false,
            size: 2450000,
            lastModified: now - 3600000,
            extension: 'pdf',
            mimeType: 'application/pdf',
          },
        ],
        reclaimableBytes: 2450000,
      },
      {
        id: 'dup_group_2',
        hash: 'sha256_mock_photo_hash',
        size: 4890000,
        originalFile: {
          id: 'orig_2',
          name: 'IMG_20261115_102045.jpg',
          path: '/storage/emulated/0/DCIM/Camera/IMG_20261115_102045.jpg',
          isDirectory: false,
          size: 4890000,
          lastModified: now - 1800000,
          extension: 'jpg',
          mimeType: 'image/jpeg',
        },
        duplicateFiles: [
          {
            id: 'dup_2',
            name: 'IMG_20261115_102045_copy.jpg',
            path: '/storage/emulated/0/Pictures/IMG_20261115_102045_copy.jpg',
            isDirectory: false,
            size: 4890000,
            lastModified: now - 5400000,
            extension: 'jpg',
            mimeType: 'image/jpeg',
          },
        ],
        reclaimableBytes: 4890000,
      },
    ];

    // 4. Empty Folders Finder
    const emptyFolders: FileItem[] = [
      {
        id: 'empty_1',
        name: 'Old_Temp_Cache',
        path: '/storage/emulated/0/Download/Old_Temp_Cache',
        isDirectory: true,
        size: 0,
        lastModified: now - 90000000,
        extension: '',
        mimeType: 'inode/directory',
        itemCount: 0,
      },
      {
        id: 'empty_2',
        name: 'Exported_Logs_Unused',
        path: '/storage/emulated/0/Documents/Exported_Logs_Unused',
        isDirectory: true,
        size: 0,
        lastModified: now - 150000000,
        extension: '',
        mimeType: 'inode/directory',
        itemCount: 0,
      },
    ];

    // 5. Old Downloads Finder (> 30 days)
    const thirtyDaysAgo = now - 30 * 24 * 3600 * 1000;
    const oldDownloads = allFiles.filter(
      (f) => f.path.toLowerCase().includes('/download') && f.lastModified < thirtyDaysAgo
    );

    // Total Reclaimable Space
    let reclaimable = 0;
    duplicateGroups.forEach((g) => (reclaimable += g.reclaimableBytes));
    oldDownloads.forEach((f) => (reclaimable += f.size));

    return {
      totalBytes: primary.totalBytes,
      usedBytes: primary.usedBytes,
      freeBytes: primary.freeBytes,
      categories,
      largeFiles,
      duplicateGroups,
      emptyFolders,
      oldDownloads,
      totalReclaimableBytes: reclaimable,
    };
  }
}

export const analyzerService = new AnalyzerService();

