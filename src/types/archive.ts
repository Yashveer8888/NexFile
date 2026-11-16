export interface ArchiveEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  compressedSize: number;
  time: number;
  crc?: number;
}

export interface ArchiveInfo {
  path: string;
  name: string;
  totalFiles: number;
  uncompressedSize: number;
  compressedSize: number;
  compressionRatio: number;
  entries: ArchiveEntry[];
}

