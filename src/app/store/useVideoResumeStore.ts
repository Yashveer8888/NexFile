import { create } from 'zustand';
import { FileItem } from '../../types/file';
import { fileService } from '../../services/filesystem/fileService';

export interface LastWatchedVideo {
  file: FileItem;
  position: number;
  playlist: FileItem[];
  timestamp: number;
}

export interface VideoProgressData {
  position: number;
  duration: number;
  completed?: boolean;
  watched?: boolean;
}

interface VideoResumeState {
  resumeMap: Record<string, VideoProgressData | number>;
  lastWatched: LastWatchedVideo | null;
  isHydrated: boolean;

  // Actions
  hydrate: () => Promise<void>;
  getResumePosition: (path: string) => number;
  getVideoProgress: (path: string) => {
    position: number;
    duration: number;
    ratio: number;
    isWatched: boolean;
    completed: boolean;
  };
  markAsWatched: (file: FileItem) => void;
  saveResumePosition: (
    file: FileItem,
    position: number,
    duration: number,
    playlist?: FileItem[]
  ) => void;
  clearResumePosition: (path: string) => void;
}

const PREF_KEY_MAP = 'NEX_VIDEO_RESUME_MAP';
const PREF_KEY_LAST = 'NEX_LAST_WATCHED_VIDEO';

export const useVideoResumeStore = create<VideoResumeState>((set, get) => ({
  resumeMap: {},
  lastWatched: null,
  isHydrated: false,

  hydrate: async () => {
    try {
      const [mapStr, lastStr] = await Promise.all([
        fileService.getPreference(PREF_KEY_MAP, '{}'),
        fileService.getPreference(PREF_KEY_LAST, ''),
      ]);

      let resumeMap: Record<string, VideoProgressData | number> = {};
      try {
        if (mapStr && mapStr.trim().length > 0) {
          resumeMap = JSON.parse(mapStr);
        }
      } catch {}

      let lastWatched: LastWatchedVideo | null = null;
      try {
        if (lastStr && lastStr.trim().length > 0) {
          lastWatched = JSON.parse(lastStr);
        }
      } catch {}

      set({ resumeMap, lastWatched, isHydrated: true });
    } catch {
      set({ isHydrated: true });
    }
  },

  getResumePosition: (path: string) => {
    if (!path) return 0;
    const item = get().resumeMap[path];
    if (!item) return 0;
    return typeof item === 'number' ? item : item.position || 0;
  },

  getVideoProgress: (path: string) => {
    if (!path) return { position: 0, duration: 0, ratio: 0, isWatched: false, completed: false };
    const item = get().resumeMap[path];
    if (!item) return { position: 0, duration: 0, ratio: 0, isWatched: false, completed: false };
    const pos = typeof item === 'number' ? item : item.position || 0;
    const dur = typeof item === 'object' ? item.duration || 0 : 0;
    const completed = typeof item === 'object' ? !!item.completed : false;
    const watched = typeof item === 'object' ? !!item.watched : false;
    const isWatched = watched || completed || pos > 0;
    const ratio = completed ? 1.0 : dur > 0 ? Math.min(1.0, pos / dur) : pos > 0 ? 0.35 : 0;
    return { position: pos, duration: dur, ratio, isWatched, completed };
  },

  markAsWatched: (file: FileItem) => {
    if (!file || !file.path) return;
    const currentMap = get().resumeMap;
    const prev = currentMap[file.path];
    const prevPos = typeof prev === 'number' ? prev : prev?.position || 0;
    const prevDur = typeof prev === 'object' ? prev?.duration || 0 : 0;
    const prevComp = typeof prev === 'object' ? !!prev?.completed : false;

    const updatedMap = {
      ...currentMap,
      [file.path]: {
        position: prevPos,
        duration: prevDur,
        completed: prevComp,
        watched: true,
      },
    };

    set({ resumeMap: updatedMap });
    fileService.savePreference(PREF_KEY_MAP, JSON.stringify(updatedMap));
  },

  saveResumePosition: (
    file: FileItem,
    position: number,
    duration: number,
    playlist?: FileItem[]
  ) => {
    if (!file || !file.path) return;

    // If near end (last 5 seconds) or finished, mark completed and reset position to 0
    const isFinished = (duration > 0 && position >= duration - 5) || (duration > 0 && position >= duration);
    const finalPos = isFinished ? 0 : Math.max(0, Math.floor(position));
    const finalDur = Math.max(0, Math.floor(duration));

    const currentMap = get().resumeMap;

    const updatedMap = {
      ...currentMap,
      [file.path]: {
        position: finalPos,
        duration: finalDur,
        completed: isFinished,
        watched: true,
      },
    };

    const currentLast = get().lastWatched;
    const updatedLast: LastWatchedVideo = {
      file,
      position: finalPos,
      playlist: playlist && playlist.length > 0 ? playlist : (currentLast?.playlist || [file]),
      timestamp: Date.now(),
    };

    set({
      resumeMap: updatedMap,
      lastWatched: updatedLast,
    });

    // Persist asynchronously
    fileService.savePreference(PREF_KEY_MAP, JSON.stringify(updatedMap));
    fileService.savePreference(PREF_KEY_LAST, JSON.stringify(updatedLast));
  },

  clearResumePosition: (path: string) => {
    if (!path) return;
    const updatedMap = { ...get().resumeMap };
    delete updatedMap[path];
    set({ resumeMap: updatedMap });
    fileService.savePreference(PREF_KEY_MAP, JSON.stringify(updatedMap));
  },
}));

// Auto-hydrate on import
useVideoResumeStore.getState().hydrate();
