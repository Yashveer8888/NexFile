export type PlaybackState = 'idle' | 'playing' | 'paused' | 'buffering';

export interface AudioTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // in seconds
  uri: string;
  artwork?: string;
  size: number;
}

export interface VideoPlaybackConfig {
  playbackSpeed: number;
  isLooping: boolean;
  isMuted: boolean;
  resizeMode: 'contain' | 'cover' | 'stretch';
  showSubtitles: boolean;
}

