import { create } from 'zustand';
import { AudioTrack, PlaybackState, VideoPlaybackConfig } from '../../types/media';
import { FileItem } from '../../types/file';

interface PlayerState {
  // Audio Player
  currentTrack: AudioTrack | null;
  queue: AudioTrack[];
  playbackState: PlaybackState;
  position: number; // in seconds
  duration: number; // in seconds
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  volume: number; // 0 to 1

  playTrack: (track: AudioTrack) => void;
  togglePlayPause: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seekTo: (position: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setVolume: (volume: number) => void;
  setQueue: (queue: AudioTrack[]) => void;

  // Video Player
  activeVideo: FileItem | null;
  videoConfig: VideoPlaybackConfig;
  videoPosition: number;
  videoDuration: number;
  isVideoPlaying: boolean;
  isScreenLocked: boolean;

  openVideo: (file: FileItem) => void;
  toggleVideoPlay: () => void;
  setPlaybackSpeed: (speed: number) => void;
  toggleScreenLock: () => void;
  toggleSubtitles: () => void;

  // Image Viewer
  activeImage: FileItem | null;
  imageRotation: number;
  slideshowActive: boolean;

  openImage: (file: FileItem) => void;
  rotateImage: () => void;
  toggleSlideshow: () => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [
    {
      id: 'trk_1',
      title: 'Acoustic Breeze',
      artist: 'NexFile Studio',
      album: 'Chill Ambient Flow',
      duration: 185,
      uri: '/storage/emulated/0/Music/Acoustic_Breeze.mp3',
      size: 6850000,
    },
    {
      id: 'trk_2',
      title: 'Ambient Focus Flow',
      artist: 'Deep Work Labs',
      album: 'Neural Waves',
      duration: 320,
      uri: '/storage/emulated/0/Music/Ambient_Focus_Flow.flac',
      size: 28400000,
    },
  ],
  playbackState: 'idle',
  position: 0,
  duration: 185,
  isShuffle: false,
  repeatMode: 'off',
  volume: 0.8,

  playTrack: (track) => {
    set({
      currentTrack: track,
      playbackState: 'playing',
      duration: track.duration,
      position: 0,
    });
  },

  togglePlayPause: () => {
    const { playbackState, currentTrack, queue } = get();
    if (!currentTrack && queue.length > 0) {
      set({ currentTrack: queue[0], playbackState: 'playing', duration: queue[0].duration });
      return;
    }
    const nextState = playbackState === 'playing' ? 'paused' : 'playing';
    set({ playbackState: nextState });
  },

  nextTrack: () => {
    const { queue, currentTrack } = get();
    if (queue.length === 0) return;
    const currentIndex = currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : 0;
    const nextIndex = (currentIndex + 1) % queue.length;
    get().playTrack(queue[nextIndex]);
  },

  prevTrack: () => {
    const { queue, currentTrack } = get();
    if (queue.length === 0) return;
    const currentIndex = currentTrack ? queue.findIndex((t) => t.id === currentTrack.id) : 0;
    const prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    get().playTrack(queue[prevIndex]);
  },

  seekTo: (position) => {
    set({ position: Math.max(0, Math.min(get().duration, position)) });
  },

  toggleShuffle: () => {
    set((state) => ({ isShuffle: !state.isShuffle }));
  },

  toggleRepeat: () => {
    const modes: ('off' | 'all' | 'one')[] = ['off', 'all', 'one'];
    const next = modes[(modes.indexOf(get().repeatMode) + 1) % modes.length];
    set({ repeatMode: next });
  },

  setVolume: (volume) => {
    set({ volume: Math.max(0, Math.min(1, volume)) });
  },

  setQueue: (queue) => {
    set({ queue });
  },

  // Video
  activeVideo: null,
  videoConfig: {
    playbackSpeed: 1.0,
    isLooping: false,
    isMuted: false,
    resizeMode: 'contain',
    showSubtitles: true,
  },
  videoPosition: 0,
  videoDuration: 124,
  isVideoPlaying: false,
  isScreenLocked: false,

  openVideo: (file) => {
    set({
      activeVideo: file,
      isVideoPlaying: true,
      videoPosition: 0,
      videoDuration: 124,
      isScreenLocked: false,
    });
  },

  toggleVideoPlay: () => {
    set((state) => ({ isVideoPlaying: !state.isVideoPlaying }));
  },

  setPlaybackSpeed: (speed) => {
    set((state) => ({ videoConfig: { ...state.videoConfig, playbackSpeed: speed } }));
  },

  toggleScreenLock: () => {
    set((state) => ({ isScreenLocked: !state.isScreenLocked }));
  },

  toggleSubtitles: () => {
    set((state) => ({
      videoConfig: { ...state.videoConfig, showSubtitles: !state.videoConfig.showSubtitles },
    }));
  },

  // Image Viewer
  activeImage: null,
  imageRotation: 0,
  slideshowActive: false,

  openImage: (file) => {
    set({ activeImage: file, imageRotation: 0, slideshowActive: false });
  },

  rotateImage: () => {
    set((state) => ({ imageRotation: (state.imageRotation + 90) % 360 }));
  },

  toggleSlideshow: () => {
    set((state) => ({ slideshowActive: !state.slideshowActive }));
  },
}));

