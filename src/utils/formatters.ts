export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return '0 B';
  if (bytes < 0 || isNaN(bytes)) return '--';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);

  return `${parseFloat((bytes / Math.pow(k, safeI)).toFixed(dm))} ${sizes[safeI]}`;
}

export function formatDate(timestamp: number): string {
  if (!timestamp || isNaN(timestamp)) return '--';

  const date = new Date(timestamp);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Today, ${timeString}`;
  }
  if (isYesterday) {
    return `Yesterday, ${timeString}`;
  }

  const isSameYear = date.getFullYear() === now.getFullYear();
  if (isSameYear) {
    const month = date.toLocaleDateString([], { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}, ${timeString}`;
  }

  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

export function truncateMiddle(text: string, maxLength: number = 30): string {
  if (text.length <= maxLength) return text;
  const extIndex = text.lastIndexOf('.');
  const ext = extIndex !== -1 ? text.substring(extIndex) : '';
  const name = extIndex !== -1 ? text.substring(0, extIndex) : text;

  const keepLength = maxLength - ext.length - 3;
  if (keepLength <= 3) return text.substring(0, maxLength - 3) + '...';

  const frontChars = Math.ceil(keepLength / 2);
  const backChars = Math.floor(keepLength / 2);

  return `${name.substring(0, frontChars)}...${name.substring(name.length - backChars)}${ext}`;
}

export function extractParentFolder(filePath: string): string {
  if (!filePath) return '';
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 1) return '';
  // parts[parts.length - 1] is file name, parts[parts.length - 2] is the immediate containing folder
  const parentFolder = parts[parts.length - 2];
  if (parentFolder === '0' || parentFolder === 'emulated' || parentFolder === 'sdcard') {
    return 'Internal Storage';
  }
  return parentFolder;
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}



