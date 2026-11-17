import { FileCategory } from '../types/file';

export const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'avif', 'svg', 'raw', 'cr2', 'nef', 'dng', 'arw']);
export const VIDEO_EXTENSIONS = new Set(['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', '3gp', 'm4v', 'ts']);
export const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma', 'opus', 'mid', 'amr']);
export const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'html', 'htm', 'json', 'xml', 'md', 'epub']);
export const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'tgz']);
export const APK_EXTENSIONS = new Set(['apk', 'xapk', 'apks']);

export const ALLOWED_RECENT_EXTENSIONS = new Set([
  ...IMAGE_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
  ...AUDIO_EXTENSIONS,
  ...DOCUMENT_EXTENSIONS,
  ...ARCHIVE_EXTENSIONS,
  ...APK_EXTENSIONS,
]);

export const IGNORED_RECENT_EXTENSIONS = new Set([
  'db',
  'db-wal',
  'db-shm',
  'sqlite',
  'sqlite3',
  'realm',
  'log',
  'trace',
  'tmp',
  'temp',
  'cache',
  'dat',
  'bin',
  'sys',
  'ini',
  'cfg',
  'conf',
  'prop',
  'properties',
  'bak',
  'backup',
  'old',
  'swp',
  'swo',
  'dump',
  'dmp',
  'stackdump',
  'part',
  'crdownload',
  'nomedia',
  'idx',
  'idx2',
  'thumb',
  'thumbnails',
  'exo',
  'dex',
  'class',
]);

export function isJunkOrSystemFile(item: { name: string; path?: string; extension?: string }): boolean {
  const name = (item.name || '').toLowerCase();
  const ext = (item.extension || '').toLowerCase().replace(/^\./, '');
  const path = (item.path || '').toLowerCase();

  // Hidden files and Private Vault files (.vault directory or .nvlt files)
  if (name.startsWith('.') || ext === 'nvlt' || path.includes('/.vault')) return true;

  // WhatsApp crypt files (crypt, crypt12, crypt14, crypt15, etc.)
  if (ext.startsWith('crypt') || name.includes('.db.crypt')) return true;

  // Database, log and system junk extensions
  if (IGNORED_RECENT_EXTENSIONS.has(ext)) return true;

  // Additional name checks
  if (name.endsWith('.db') || name.endsWith('.db-wal') || name.endsWith('.db-shm')) return true;
  if (name.startsWith('msgstore') || name.startsWith('chatsettingsbackup') || name.startsWith('wa.db')) return true;

  // Databases, backups, thumbnails directories
  if (
    path.includes('/databases/') ||
    path.includes('/databases') ||
    path.includes('/backups/') ||
    path.includes('/.thumbnails/') ||
    path.includes('/cache/')
  ) {
    if (!path.includes('/whatsapp/media') && !path.includes('/whatsapp business/media')) {
      return true;
    }
  }

  return false;
}

export function isUsefulRecentFile(item: { isDirectory?: boolean; name: string; path?: string; extension?: string }): boolean {
  if (item.isDirectory) return false;
  if (isJunkOrSystemFile(item)) return false;

  let ext = (item.extension || '').toLowerCase().replace(/^\./, '');
  if (!ext && item.name && item.name.includes('.')) {
    const parts = item.name.split('.');
    ext = parts[parts.length - 1].toLowerCase();
  }

  return ALLOWED_RECENT_EXTENSIONS.has(ext);
}

export function getCategoryFromExtension(ext: string): FileCategory {
  const cleanExt = ext.toLowerCase().replace(/^\./, '');
  if (IMAGE_EXTENSIONS.has(cleanExt)) return 'images';
  if (VIDEO_EXTENSIONS.has(cleanExt)) return 'videos';
  if (AUDIO_EXTENSIONS.has(cleanExt)) return 'audio';
  if (DOCUMENT_EXTENSIONS.has(cleanExt)) return 'documents';
  if (ARCHIVE_EXTENSIONS.has(cleanExt)) return 'archives';
  if (APK_EXTENSIONS.has(cleanExt)) return 'apks';
  return 'all';
}

export function getCategoryTitle(category: FileCategory): string {
  switch (category) {
    case 'images':
      return 'Images';
    case 'videos':
      return 'Videos';
    case 'audio':
      return 'Audio';
    case 'documents':
      return 'Documents';
    case 'apks':
      return 'APKs';
    case 'archives':
      return 'Archives';
    case 'downloads':
      return 'Downloads';
    case 'whatsapp':
      return 'WhatsApp';
    case 'bluetooth':
      return 'Bluetooth';
    case 'all':
    default:
      return 'All Files';
  }
}

export function isImageFile(item: { isDirectory?: boolean; extension?: string; mimeType?: string }): boolean {
  if (item.isDirectory) return false;
  const ext = (item.extension || '').toLowerCase().replace(/^\./, '');
  if (IMAGE_EXTENSIONS.has(ext)) return true;
  if (item.mimeType && item.mimeType.toLowerCase().startsWith('image/')) return true;
  return false;
}

export function isVideoFile(item: { isDirectory?: boolean; extension?: string; mimeType?: string }): boolean {
  if (item.isDirectory) return false;
  const ext = (item.extension || '').toLowerCase().replace(/^\./, '');
  if (VIDEO_EXTENSIONS.has(ext)) return true;
  if (item.mimeType && item.mimeType.toLowerCase().startsWith('video/')) return true;
  return false;
}

export function isAudioFile(item: { isDirectory?: boolean; extension?: string; mimeType?: string }): boolean {
  if (item.isDirectory) return false;
  const ext = (item.extension || '').toLowerCase().replace(/^\./, '');
  if (AUDIO_EXTENSIONS.has(ext)) return true;
  if (item.mimeType && item.mimeType.toLowerCase().startsWith('audio/')) return true;
  return false;
}



