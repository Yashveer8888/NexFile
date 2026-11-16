import { FileCategory, FileItem } from './file';

export interface CategoryStorageStat {
  category: FileCategory;
  name: string;
  bytes: number;
  fileCount: number;
  percentage: number;
  color: string;
}

export interface DuplicateGroup {
  id: string;
  hash: string;
  size: number;
  originalFile: FileItem;
  duplicateFiles: FileItem[];
  reclaimableBytes: number;
}

export interface StorageAnalysisReport {
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  categories: CategoryStorageStat[];
  largeFiles: FileItem[];
  duplicateGroups: DuplicateGroup[];
  emptyFolders: FileItem[];
  oldDownloads: FileItem[];
  totalReclaimableBytes: number;
}

