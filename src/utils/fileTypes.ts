import { FileCategory } from '../types/file';

export const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'heic', 'avif', 'svg', 'raw', 'cr2', 'nef', 'dng', 'arw']);
export const VIDEO_EXTENSIONS = new Set(['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', '3gp', 'm4v', 'ts']);
export const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'aac', 'flac', 'ogg', 'm4a', 'wma', 'opus', 'mid', 'amr']);
export const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'html', 'htm', 'json', 'xml', 'md', 'epub', 'log']);
export const ARCHIVE_EXTENSIONS = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'tgz']);
export const APK_EXTENSIONS = new Set(['apk', 'xapk', 'apks']);

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


