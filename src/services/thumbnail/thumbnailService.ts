import { NativeModules } from 'react-native';

const { NexFileManager } = NativeModules;

class ThumbnailService {
  private cache: Map<string, string> = new Map();

  getCachedThumbnail(filePath: string): string | null {
    if (!filePath) return null;
    return this.cache.get(filePath) || null;
  }

  async getThumbnail(filePath: string, extension: string): Promise<string | null> {
    if (!filePath) return null;
    const ext = extension.toLowerCase().replace(/^\./, '');

    // 1. Direct file URI for standard images
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'bmp'].includes(ext)) {
      return filePath.startsWith('file://') ? filePath : `file://${filePath}`;
    }

    // 2. Check in-memory cache
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    // 3. Request native thumbnail from NexFileManager
    if (NexFileManager && NexFileManager.getThumbnail) {
      try {
        const uri = await NexFileManager.getThumbnail(filePath);
        if (uri) {
          this.cache.set(filePath, uri);
          return uri;
        }
      } catch (err) {
        // Fallback gracefully
      }
    }

    return null;
  }
}

export const thumbnailService = new ThumbnailService();

