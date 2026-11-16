export type FileCategory =
  | 'all'
  | 'images'
  | 'videos'
  | 'audio'
  | 'documents'
  | 'apks'
  | 'archives'
  | 'downloads'
  | 'whatsapp'
  | 'bluetooth';

export type SortField = 'name' | 'date' | 'size' | 'type';
export type SortOrder = 'asc' | 'desc';

export interface FileItem {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  size: number; // in bytes
  lastModified: number; // timestamp
  extension: string;
  mimeType: string;
  isHidden?: boolean;
  isFavorite?: boolean;
  canRead?: boolean;
  canWrite?: boolean;
  itemCount?: number; // for directories
  thumbnailUri?: string;
  category?: FileCategory;
  parentFolder?: string;
}

export interface StorageVolume {
  id: string;
  name: string;
  path: string;
  isRemovable: boolean;
  isPrimary: boolean;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export interface FileFilter {
  category: FileCategory;
  sortBy: SortField;
  sortOrder: SortOrder;
  showHidden: boolean;
  searchQuery: string;
}

export interface FileOperationProgress {
  type: 'copy' | 'move' | 'delete' | 'compress' | 'extract' | 'encrypt' | 'decrypt';
  currentItem: string;
  totalItems: number;
  completedItems: number;
  percent: number;
  isIndeterminate: boolean;
  isCancelled: boolean;
}

export interface RecycleBinItem {
  id: string;
  originalPath: string;
  trashPath: string;
  name: string;
  deletedAt: number;
  size: number;
  isDirectory: boolean;
}

