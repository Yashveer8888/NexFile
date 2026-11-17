import React from 'react';
import { requireNativeComponent, ViewProps } from 'react-native';

export interface NexVideoProgressEvent {
  currentTime: number;
  duration: number;
}

export interface NexVideoLoadEvent {
  duration: number;
  width: number;
  height: number;
  audioTracks?: { index: number; language: string }[];
  subtitleTracks?: { index: number; language: string }[];
  hasSubtitles?: boolean;
}

export interface NexVideoErrorEvent {
  error: string;
}

export interface NexVideoProps extends ViewProps {
  videoPath?: string;
  paused?: boolean;
  seekTo?: number;
  rate?: number;
  volume?: number;
  isLooping?: boolean;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'zoom';
  selectedAudioTrack?: number;
  onVideoProgress?: (event: { nativeEvent: NexVideoProgressEvent }) => void;
  onVideoLoad?: (event: { nativeEvent: NexVideoLoadEvent }) => void;
  onVideoEnd?: () => void;
  onVideoError?: (event: { nativeEvent: NexVideoErrorEvent }) => void;
}

const NativeNexVideo = requireNativeComponent<NexVideoProps>('NexVideoView');

export const NexVideo: React.FC<NexVideoProps> = (props) => {
  return <NativeNexVideo {...props} />;
};
