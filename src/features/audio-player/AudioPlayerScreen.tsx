import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  StatusBar,
  PanResponder,
  Modal,
  BackHandler,
  Animated,
  Easing,
  AppState,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  Zap,
  ChevronLeft,
  ListMusic,
  Heart,
  Sliders,
  Check,
  Music,
  Headphones,
  X,
  Clock,
} from 'lucide-react-native';
import { spacing, borderRadius } from '../../theme/spacing';
import { fileService } from '../../services/filesystem/fileService';
import { NexVideo, NexVideoLoadEvent, NexVideoProgressEvent } from '../../components/video/NexVideo';
import { FileItem } from '../../types/file';
import { useVideoResumeStore } from '../../app/store/useVideoResumeStore';
import { useFileStore } from '../../app/store/useFileStore';
import { formatBytes, formatDuration } from '../../utils/formatters';

export type RepeatMode = 'off' | 'all' | 'one';

export const AudioPlayerScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  // Route parameters: file and playlist
  const initialFile: FileItem | undefined = route?.params?.file;
  const initialPlaylist: FileItem[] = useMemo(() => {
    const list = route?.params?.playlist || (initialFile ? [initialFile] : []);
    return list.length > 0 ? list : initialFile ? [initialFile] : [];
  }, [route?.params?.playlist, initialFile]);

  const [playlist, setPlaylist] = useState<FileItem[]>(initialPlaylist);
  const [currentFile, setCurrentFile] = useState<FileItem | null>(initialFile || null);

  // Resume playback position
  const initialResumePos = useMemo(() => {
    if (!initialFile || !initialFile.path) return 0;
    return useVideoResumeStore.getState().getResumePosition(initialFile.path);
  }, [initialFile]);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const isPlayingRef = useRef<boolean>(true);
  isPlayingRef.current = isPlaying;

  const [currentTime, setCurrentTime] = useState<number>(initialResumePos > 2 ? initialResumePos : 0);
  const currentTimeRef = useRef<number>(initialResumePos > 2 ? initialResumePos : 0);
  currentTimeRef.current = currentTime;

  const [duration, setDuration] = useState<number>(0);
  const durationRef = useRef<number>(0);
  durationRef.current = duration;

  const [seekTarget, setSeekTarget] = useState<number | undefined>(
    initialResumePos > 2 ? initialResumePos : undefined
  );
  const isAwaitingInitialResumeRef = useRef<boolean>(initialResumePos > 2);

  // Playback modes: Repeat & Shuffle
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const repeatModeRef = useRef<RepeatMode>('all');
  repeatModeRef.current = repeatMode;

  const [isShuffle, setIsShuffle] = useState<boolean>(false);
  const isShuffleRef = useRef<boolean>(false);
  isShuffleRef.current = isShuffle;

  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isFavorite, setIsFavorite] = useState<boolean>(Boolean(initialFile?.isFavorite));

  // Audio volume & boost (0 - 200%)
  const [totalVolume, setTotalVolume] = useState<number>(100);
  const [volumeLevel, setVolumeLevel] = useState<number>(1.0);

  // Modals
  const [queueModalVisible, setQueueModalVisible] = useState<boolean>(false);
  const [speedModalVisible, setSpeedModalVisible] = useState<boolean>(false);
  const [volumeModalVisible, setVolumeModalVisible] = useState<boolean>(false);

  // Scrubbing & progress animation
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const isScrubbingRef = useRef<boolean>(false);
  isScrubbingRef.current = isScrubbing;
  const [scrubTime, setScrubTime] = useState<number>(0);
  const [trackWidth, setTrackWidth] = useState<number>(windowWidth - 64);
  const trackWidthRef = useRef<number>(windowWidth - 64);
  trackWidthRef.current = trackWidth;
  const trackContainerRef = useRef<any>(null);
  const trackLayoutRef = useRef<{ pageX: number; width: number }>({ pageX: 0, width: 0 });
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Refs for state preservation
  const currentFileRef = useRef<FileItem | null>(currentFile);
  currentFileRef.current = currentFile;
  const playlistRef = useRef<FileItem[]>(playlist);
  playlistRef.current = playlist;

  // Vinyl Spin Animation (Continuous 360-degree rotation)
  const spinValue = useRef(new Animated.Value(0)).current;
  const spinDegreeRef = useRef<number>(0);
  const spinAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  const startSpinAnimation = useCallback(() => {
    if (spinAnimRef.current) {
      spinAnimRef.current.stop();
    }
    const currentProg = spinDegreeRef.current % 1;
    const remainingDuration = (1 - currentProg) * 12000;

    spinValue.setValue(currentProg);
    spinAnimRef.current = Animated.sequence([
      Animated.timing(spinValue, {
        toValue: 1,
        duration: Math.max(100, remainingDuration),
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 12000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ),
    ]);
    spinAnimRef.current.start();
  }, [spinValue]);

  const stopSpinAnimation = useCallback(() => {
    if (spinAnimRef.current) {
      spinAnimRef.current.stop();
      spinAnimRef.current = null;
    }
    spinValue.stopAnimation((val) => {
      spinDegreeRef.current = val;
    });
  }, [spinValue]);

  useEffect(() => {
    if (isPlaying) {
      startSpinAnimation();
    } else {
      stopSpinAnimation();
    }
  }, [isPlaying, startSpinAnimation, stopSpinAnimation]);

  const spinInterpolate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Animated Equalizer Bars (7 bars dancing to the beat)
  const eqBars = useRef(
    Array.from({ length: 7 }, () => new Animated.Value(6))
  ).current;

  useEffect(() => {
    let timers: any[] = [];
    let isMounted = true;

    if (isPlaying) {
      eqBars.forEach((barAnim, index) => {
        const animateBar = () => {
          if (!isMounted || !isPlayingRef.current) return;
          const targetHeight = Math.floor(Math.random() * 24) + 6;
          const speed = Math.floor(Math.random() * 250) + 200;
          Animated.timing(barAnim, {
            toValue: targetHeight,
            duration: speed,
            easing: Easing.ease,
            useNativeDriver: false,
          }).start(() => {
            if (isMounted && isPlayingRef.current) {
              const timer = setTimeout(animateBar, 50);
              timers.push(timer);
            }
          });
        };
        const initialDelay = setTimeout(animateBar, index * 60);
        timers.push(initialDelay);
      });
    } else {
      eqBars.forEach((barAnim) => {
        Animated.timing(barAnim, {
          toValue: 4,
          duration: 300,
          easing: Easing.ease,
          useNativeDriver: false,
        }).start();
      });
    }

    return () => {
      isMounted = false;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [isPlaying, eqBars]);

  // Lock orientation to portrait & fetch initial volume
  useEffect(() => {
    fileService.setScreenOrientation('portrait');
    fileService.setImmersiveMode(false);
    StatusBar.setBarStyle('light-content');

    (async () => {
      try {
        const curVol = await fileService.getDeviceVolume();
        if (typeof curVol === 'number' && !isNaN(curVol)) {
          setTotalVolume(Math.round(curVol * 100));
        }
      } catch {}
    })();

    return () => {
      if (currentFileRef.current && currentTimeRef.current > 0) {
        useVideoResumeStore.getState().saveResumePosition(
          currentFileRef.current,
          currentTimeRef.current,
          durationRef.current,
          playlistRef.current
        );
      }
    };
  }, []);

  // Listen for AppState changes to save resume position
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        if (currentFileRef.current && currentTimeRef.current > 0) {
          useVideoResumeStore.getState().saveResumePosition(
            currentFileRef.current,
            currentTimeRef.current,
            durationRef.current,
            playlistRef.current
          );
        }
      }
    });
    return () => sub.remove();
  }, []);

  // Hardware Back button handling
  useEffect(() => {
    const onBackPress = () => {
      navigation.goBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [navigation]);

  // Mark as watched & load saved position
  const handleLoad = useCallback((event: { nativeEvent: NexVideoLoadEvent }) => {
    const d = event.nativeEvent.duration || 0;
    setDuration(d);
    durationRef.current = d;

    if (currentFileRef.current && currentFileRef.current.path) {
      useVideoResumeStore.getState().markAsWatched(currentFileRef.current);
      const savedPos = useVideoResumeStore.getState().getResumePosition(currentFileRef.current.path);
      if (savedPos > 2 && (!d || savedPos < d - 5)) {
        setCurrentTime(savedPos);
        currentTimeRef.current = savedPos;
        isAwaitingInitialResumeRef.current = true;
        setSeekTarget(savedPos);
        if (d > 0) {
          progressAnim.setValue(Math.max(0, Math.min(1, savedPos / d)));
        }
      } else {
        isAwaitingInitialResumeRef.current = false;
        progressAnim.setValue(0);
      }
    } else {
      isAwaitingInitialResumeRef.current = false;
      progressAnim.setValue(0);
    }
  }, [progressAnim]);

  // Progress update from native player
  const handleProgress = useCallback((event: { nativeEvent: NexVideoProgressEvent }) => {
    if (isScrubbingRef.current) return;

    const t = event.nativeEvent.currentTime || 0;
    const d = event.nativeEvent.duration || durationRef.current || 0;

    if (isAwaitingInitialResumeRef.current) {
      if (t <= 0.5 && currentTimeRef.current > 2) {
        return;
      }
      isAwaitingInitialResumeRef.current = false;
    }

    setCurrentTime(t);
    currentTimeRef.current = t;

    if (d > 0) {
      setDuration(d);
      durationRef.current = d;
      progressAnim.setValue(Math.max(0, Math.min(1, t / d)));
    }
  }, [progressAnim]);

  // Switch to specific track in playlist
  const playTrack = useCallback((track: FileItem) => {
    if (currentFileRef.current && currentTimeRef.current > 0) {
      useVideoResumeStore.getState().saveResumePosition(
        currentFileRef.current,
        currentTimeRef.current,
        durationRef.current,
        playlistRef.current
      );
    }
    const savedPos = useVideoResumeStore.getState().getResumePosition(track.path);
    setCurrentFile(track);
    currentFileRef.current = track;
    setIsPlaying(true);
    setCurrentTime(savedPos > 2 ? savedPos : 0);
    currentTimeRef.current = savedPos > 2 ? savedPos : 0;
    isAwaitingInitialResumeRef.current = savedPos > 2;
    setSeekTarget(savedPos > 2 ? savedPos : 0);
    setDuration(0);
    durationRef.current = 0;
    progressAnim.setValue(0);
    setIsFavorite(Boolean(track.isFavorite));
  }, [progressAnim]);

  // Previous Track
  const handlePrevTrack = useCallback(() => {
    // If playing more than 3 seconds, restart current track
    if (currentTimeRef.current > 3) {
      setSeekTarget(0);
      setCurrentTime(0);
      currentTimeRef.current = 0;
      progressAnim.setValue(0);
      return;
    }

    const currentList = playlistRef.current;
    if (currentList.length <= 1) return;

    const curIdx = currentList.findIndex(
      (f) => (f.id && f.id === currentFileRef.current?.id) || f.path === currentFileRef.current?.path
    );
    const prevIdx = (curIdx - 1 + currentList.length) % currentList.length;
    playTrack(currentList[prevIdx]);
  }, [playTrack, progressAnim]);

  // Next Track
  const handleNextTrack = useCallback(() => {
    const currentList = playlistRef.current;
    if (currentList.length === 0) return;

    if (currentList.length === 1) {
      setSeekTarget(0);
      setCurrentTime(0);
      currentTimeRef.current = 0;
      progressAnim.setValue(0);
      return;
    }

    const curIdx = currentList.findIndex(
      (f) => (f.id && f.id === currentFileRef.current?.id) || f.path === currentFileRef.current?.path
    );

    if (isShuffleRef.current) {
      let nextIdx = Math.floor(Math.random() * currentList.length);
      if (nextIdx === curIdx && currentList.length > 1) {
        nextIdx = (curIdx + 1) % currentList.length;
      }
      playTrack(currentList[nextIdx]);
    } else {
      const nextIdx = (curIdx + 1) % currentList.length;
      playTrack(currentList[nextIdx]);
    }
  }, [playTrack, progressAnim]);

  // Track Ended event
  const handleEnd = useCallback(() => {
    if (repeatModeRef.current === 'one') {
      setSeekTarget(0);
      setCurrentTime(0);
      currentTimeRef.current = 0;
      progressAnim.setValue(0);
      setIsPlaying(true);
    } else if (repeatModeRef.current === 'all' || isShuffleRef.current) {
      handleNextTrack();
    } else {
      // Repeat off: check if last track
      const currentList = playlistRef.current;
      const curIdx = currentList.findIndex(
        (f) => (f.id && f.id === currentFileRef.current?.id) || f.path === currentFileRef.current?.path
      );
      if (curIdx < currentList.length - 1) {
        handleNextTrack();
      } else {
        setIsPlaying(false);
      }
    }
  }, [handleNextTrack, progressAnim]);

  // Toggle Repeat Mode ('off' -> 'all' -> 'one' -> 'off')
  const handleToggleRepeat = () => {
    if (repeatMode === 'off') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
  };

  // Toggle Shuffle Mode
  const handleToggleShuffle = () => {
    setIsShuffle((prev) => !prev);
  };

  // Toggle Favorite
  const handleToggleFavorite = () => {
    if (currentFile && currentFile.path) {
      const nextVal = !isFavorite;
      setIsFavorite(nextVal);
      useFileStore.getState().toggleFavorite(currentFile.path);
    }
  };

  // Fast Play/Pause toggle
  const handleTogglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  // Progress Bar PanResponder for smooth finger scrubbing
  const progressPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          setIsScrubbing(true);
          isScrubbingRef.current = true;
          const clickX = evt.nativeEvent.locationX;
          const w = trackWidthRef.current || 300;
          const ratio = Math.max(0, Math.min(1, clickX / w));
          const target = ratio * (durationRef.current || 0);
          setScrubTime(target);
          progressAnim.setValue(ratio);
        },
        onPanResponderMove: (evt, gestureState) => {
          const w = trackWidthRef.current || 300;
          const { pageX } = trackLayoutRef.current;
          let touchX = gestureState.moveX - pageX;
          if (pageX === 0) {
            touchX = evt.nativeEvent.locationX;
          }
          const ratio = Math.max(0, Math.min(1, touchX / w));
          const target = ratio * (durationRef.current || 0);
          setScrubTime(target);
          progressAnim.setValue(ratio);
        },
        onPanResponderRelease: () => {
          setIsScrubbing(false);
          isScrubbingRef.current = false;
          const target = scrubTime;
          setCurrentTime(target);
          currentTimeRef.current = target;
          setSeekTarget(target);
        },
      }),
    [progressAnim, scrubTime]
  );

  // Volume & Boost adjustment (0 - 200%)
  const handleVolumeChange = async (val: number) => {
    const clamped = Math.max(0, Math.min(200, val));
    setTotalVolume(clamped);
    if (clamped <= 100) {
      setVolumeLevel(1.0);
      try {
        await fileService.setDeviceVolume(clamped / 100);
      } catch {}
    } else {
      const boostVal = 1.0 + ((clamped - 100) / 100);
      setVolumeLevel(boostVal);
      try {
        await fileService.setDeviceVolume(1.0);
      } catch {}
    }
  };

  const currentTrackIndex = useMemo(() => {
    return playlist.findIndex(
      (f) => (f.id && f.id === currentFile?.id) || f.path === currentFile?.path
    );
  }, [playlist, currentFile]);

  // Clean title: remove file extension if present
  const cleanSongTitle = useMemo(() => {
    if (!currentFile?.name) return 'Unknown Audio';
    const parts = currentFile.name.split('.');
    if (parts.length > 1) {
      parts.pop();
      return parts.join('.');
    }
    return currentFile.name;
  }, [currentFile]);

  // File extension badge
  const fileExtBadge = useMemo(() => {
    if (!currentFile?.name) return 'AUDIO';
    const parts = currentFile.name.split('.');
    return parts.length > 1 ? parts.pop()?.toUpperCase() || 'AUDIO' : 'AUDIO';
  }, [currentFile]);

  const progressWidthPercent = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="light-content" />

      {/* Hidden Hardware MediaPlayer Engine */}
      <View style={styles.hiddenNativePlayer} pointerEvents="none">
        <NexVideo
          style={styles.nativeVideo}
          videoPath={currentFile?.path}
          paused={!isPlaying}
          seekTo={seekTarget}
          rate={playbackSpeed}
          volume={volumeLevel}
          isLooping={repeatMode === 'one'}
          resizeMode="contain"
          onVideoLoad={handleLoad}
          onVideoProgress={handleProgress}
          onVideoEnd={handleEnd}
        />
      </View>

      {/* =========================================================================
          1. TOP NAVIGATION & HEADER BAR
          ========================================================================= */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <ChevronLeft size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleBox}>
          <Text style={styles.nowPlayingTag}>NOW PLAYING</Text>
          <Text style={styles.playlistPositionText}>
            {playlist.length > 0
              ? `Track ${Math.max(1, currentTrackIndex + 1)} of ${playlist.length}`
              : 'Single Track'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => setQueueModalVisible(true)}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          <ListMusic size={22} color="#FFFFFF" />
          {playlist.length > 1 && (
            <View style={styles.queueCountBadge}>
              <Text style={styles.queueCountBadgeText}>{playlist.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* =========================================================================
          2. VINYL DISC & EQUALIZER VISUALIZER
          ========================================================================= */}
      <View style={styles.vinylContainer}>
        {/* Soft Ambient Neon Glow Aura */}
        <View style={styles.vinylGlow} />

        {/* Rotating Vinyl Record */}
        <Animated.View
          style={[
            styles.vinylDisc,
            {
              transform: [{ rotate: spinInterpolate }],
            },
          ]}
        >
          {/* Concentric Vinyl Grooves */}
          <View style={[styles.grooveRing, { width: '92%', height: '92%' }]} />
          <View style={[styles.grooveRing, { width: '84%', height: '84%' }]} />
          <View style={[styles.grooveRing, { width: '76%', height: '76%' }]} />
          <View style={[styles.grooveRing, { width: '68%', height: '68%' }]} />

          {/* Center Album Art Disc / Label */}
          <View style={styles.centerAlbumLabel}>
            <View style={styles.labelArtworkGlow}>
              <Headphones size={36} color="#69F0AE" />
            </View>
            {/* Center Spindle Metal Ring */}
            <View style={styles.spindleHole}>
              <View style={styles.spindleDot} />
            </View>
          </View>
        </Animated.View>

        {/* Dynamic Animated Equalizer Waveform Bars */}
        <View style={styles.eqContainer}>
          {eqBars.map((barHeight, idx) => (
            <Animated.View
              key={idx}
              style={[
                styles.eqBar,
                {
                  height: barHeight,
                  backgroundColor: isPlaying ? '#69F0AE' : '#475569',
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* =========================================================================
          3. SONG METADATA & FAVORITE BUTTON
          ========================================================================= */}
      <View style={styles.metaContainer}>
        <View style={styles.titleInfoColumn}>
          <Text style={styles.songTitleText} numberOfLines={1}>
            {cleanSongTitle}
          </Text>
          <View style={styles.tagsRow}>
            <View style={styles.formatBadge}>
              <Text style={styles.formatBadgeText}>{fileExtBadge}</Text>
            </View>
            {currentFile?.size ? (
              <Text style={styles.metaSubText}>{formatBytes(currentFile.size)}</Text>
            ) : null}
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaSubText} numberOfLines={1}>
              {currentFile?.parentFolder || 'Music'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.favoriteBtn}
          onPress={handleToggleFavorite}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Heart
            size={24}
            color={isFavorite ? '#FF5252' : '#94A3B8'}
            fill={isFavorite ? '#FF5252' : 'transparent'}
          />
        </TouchableOpacity>
      </View>

      {/* =========================================================================
          4. TIMELINE SCRUBBER & TIMESTAMPS
          ========================================================================= */}
      <View style={styles.scrubberContainer}>
        <View
          ref={trackContainerRef}
          style={styles.progressTrackContainer}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            setTrackWidth(w);
            trackWidthRef.current = w;
            trackContainerRef.current?.measure(
              (_x: number, _y: number, width: number, _height: number, pageX: number) => {
                if (width > 0 && pageX !== undefined && !isNaN(pageX)) {
                  trackLayoutRef.current = { pageX, width };
                }
              }
            );
          }}
          {...progressPanResponder.panHandlers}
        >
          {/* Base Inactive Track */}
          <View style={styles.progressTrackBg}>
            <Animated.View style={[styles.progressTrackFill, { width: progressWidthPercent }]} />
          </View>

          {/* Scrubber Knob (Smooth 60fps) */}
          <Animated.View style={[styles.progressThumb, { left: progressWidthPercent }]} />
        </View>

        {/* Time Labels */}
        <View style={styles.timeLabelsRow}>
          <Text style={styles.timeText}>
            {isScrubbing ? formatDuration(scrubTime) : formatDuration(currentTime)}
          </Text>
          <Text style={styles.timeText}>{formatDuration(duration)}</Text>
        </View>
      </View>

      {/* =========================================================================
          5. MAIN PLAYBACK CONTROLS (SHUFFLE, PREV, PLAY/PAUSE, NEXT, REPEAT)
          ========================================================================= */}
      <View style={styles.mainControlsRow}>
        {/* Shuffle Button */}
        <TouchableOpacity
          style={styles.auxControlBtn}
          onPress={handleToggleShuffle}
          activeOpacity={0.7}
        >
          <Shuffle size={22} color={isShuffle ? '#69F0AE' : '#94A3B8'} />
          {isShuffle && <View style={styles.activeDot} />}
        </TouchableOpacity>

        {/* Previous Track */}
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handlePrevTrack}
          activeOpacity={0.7}
        >
          <SkipBack size={32} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Primary Play / Pause Button */}
        <TouchableOpacity
          style={styles.playPauseMainBtn}
          onPress={handleTogglePlayPause}
          activeOpacity={0.8}
        >
          {isPlaying ? (
            <Pause size={34} color="#0B0C11" fill="#0B0C11" />
          ) : (
            <Play size={34} color="#0B0C11" fill="#0B0C11" style={{ marginLeft: 3 }} />
          )}
        </TouchableOpacity>

        {/* Next Track */}
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleNextTrack}
          activeOpacity={0.7}
        >
          <SkipForward size={32} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Repeat Button */}
        <TouchableOpacity
          style={styles.auxControlBtn}
          onPress={handleToggleRepeat}
          activeOpacity={0.7}
        >
          {repeatMode === 'one' ? (
            <Repeat1 size={22} color="#69F0AE" />
          ) : (
            <Repeat size={22} color={repeatMode === 'all' ? '#69F0AE' : '#94A3B8'} />
          )}
          {repeatMode !== 'off' && <View style={styles.activeDot} />}
        </TouchableOpacity>
      </View>

      {/* =========================================================================
          6. SECONDARY BOTTOM UTILITY BAR (SPEED, VOLUME BOOST, QUEUE)
          ========================================================================= */}
      <View style={styles.bottomUtilityBar}>
        {/* Speed Selector */}
        <TouchableOpacity
          style={styles.utilityPillBtn}
          onPress={() => setSpeedModalVisible(true)}
          activeOpacity={0.7}
        >
          <Clock size={16} color="#94A3B8" />
          <Text style={styles.utilityPillText}>{playbackSpeed}x</Text>
        </TouchableOpacity>

        {/* Volume & Boost */}
        <TouchableOpacity
          style={styles.utilityPillBtn}
          onPress={() => setVolumeModalVisible(true)}
          activeOpacity={0.7}
        >
          {totalVolume > 100 ? (
            <Zap size={16} color="#FF5252" />
          ) : (
            <Volume2 size={16} color="#69F0AE" />
          )}
          <Text
            style={[
              styles.utilityPillText,
              totalVolume > 100 && { color: '#FF5252', fontWeight: '800' },
            ]}
          >
            {totalVolume > 100 ? `Boost ${totalVolume}%` : `${totalVolume}%`}
          </Text>
        </TouchableOpacity>

        {/* Playlist Queue */}
        <TouchableOpacity
          style={styles.utilityPillBtn}
          onPress={() => setQueueModalVisible(true)}
          activeOpacity={0.7}
        >
          <ListMusic size={16} color="#69F0AE" />
          <Text style={styles.utilityPillText}>Queue</Text>
        </TouchableOpacity>
      </View>

      {/* =========================================================================
          7. PLAYLIST / QUEUE BOTTOM SHEET MODAL
          ========================================================================= */}
      <Modal
        visible={queueModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setQueueModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setQueueModalVisible(false)}
        >
          <View style={styles.queueSheetContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.queueDragHandle} />
            <View style={styles.queueHeaderRow}>
              <View>
                <Text style={styles.queueTitleText}>Up Next</Text>
                <Text style={styles.queueSubtitleText}>
                  {playlist.length} {playlist.length === 1 ? 'Track' : 'Tracks'} in Playlist
                </Text>
              </View>
              <TouchableOpacity
                style={styles.queueCloseBtn}
                onPress={() => setQueueModalVisible(false)}
              >
                <X size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <FlatList
              data={playlist}
              keyExtractor={(item, index) => item.id || item.path || String(index)}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: spacing.xxl }}
              renderItem={({ item, index }) => {
                const isItemActive =
                  (item.id && item.id === currentFile?.id) || item.path === currentFile?.path;
                return (
                  <TouchableOpacity
                    style={[styles.queueItemRow, isItemActive && styles.activeQueueItemRow]}
                    onPress={() => {
                      playTrack(item);
                      setQueueModalVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.queueTrackNumBox}>
                      {isItemActive && isPlaying ? (
                        <View style={styles.queueMiniEq}>
                          <View style={[styles.miniBar, { height: 12 }]} />
                          <View style={[styles.miniBar, { height: 18 }]} />
                          <View style={[styles.miniBar, { height: 10 }]} />
                        </View>
                      ) : (
                        <Text
                          style={[
                            styles.queueTrackNumText,
                            isItemActive && { color: '#69F0AE', fontWeight: '800' },
                          ]}
                        >
                          {index + 1}
                        </Text>
                      )}
                    </View>

                    <View style={styles.queueItemInfo}>
                      <Text
                        style={[
                          styles.queueItemTitle,
                          isItemActive && { color: '#69F0AE', fontWeight: '700' },
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text style={styles.queueItemMeta}>
                        {formatBytes(item.size || 0)} • {item.parentFolder || 'Audio'}
                      </Text>
                    </View>

                    {isItemActive && (
                      <View style={styles.nowPlayingPill}>
                        <Text style={styles.nowPlayingPillText}>PLAYING</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* =========================================================================
          8. PLAYBACK SPEED SELECTOR MODAL
          ========================================================================= */}
      <Modal
        visible={speedModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSpeedModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSpeedModalVisible(false)}
        >
          <View style={styles.modalSheetBox} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>Playback Speed</Text>
            {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((spd) => (
              <TouchableOpacity
                key={spd}
                style={[styles.modalItemRow, playbackSpeed === spd && styles.activeModalRow]}
                onPress={() => {
                  setPlaybackSpeed(spd);
                  setSpeedModalVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.modalItemText,
                    playbackSpeed === spd && { color: '#69F0AE', fontWeight: '800' },
                  ]}
                >
                  {spd === 1.0 ? '1.0x (Normal)' : `${spd}x`}
                </Text>
                {playbackSpeed === spd && <Check size={18} color="#69F0AE" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* =========================================================================
          9. VOLUME & LOUDNESS BOOST MODAL (0 - 200%)
          ========================================================================= */}
      <Modal
        visible={volumeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setVolumeModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setVolumeModalVisible(false)}
        >
          <View style={styles.modalSheetBox} onStartShouldSetResponder={() => true}>
            <View style={styles.volumeModalHeader}>
              <Text style={styles.modalTitle}>Audio Output & Boost</Text>
              <Text
                style={[
                  styles.volumePercentText,
                  totalVolume > 100 && { color: '#FF5252', fontWeight: '800' },
                ]}
              >
                {totalVolume > 100 ? `⚡ Boost ${totalVolume}%` : `${totalVolume}%`}
              </Text>
            </View>

            {/* Quick Presets */}
            <View style={styles.volumePresetsRow}>
              {[25, 50, 75, 100, 150, 200].map((preset) => (
                <TouchableOpacity
                  key={preset}
                  style={[
                    styles.volumePresetBtn,
                    totalVolume === preset && styles.activeVolumePresetBtn,
                  ]}
                  onPress={() => handleVolumeChange(preset)}
                >
                  <Text
                    style={[
                      styles.volumePresetText,
                      totalVolume === preset && { color: '#0B0C11', fontWeight: '800' },
                    ]}
                  >
                    {preset > 100 ? `+${preset}%` : `${preset}%`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.volumeSliderTrack}>
              <View
                style={[
                  styles.volumeSliderFill,
                  {
                    width: `${Math.min(100, (totalVolume / 200) * 100)}%`,
                    backgroundColor: totalVolume > 100 ? '#FF5252' : '#69F0AE',
                  },
                ]}
              />
            </View>
            <Text style={styles.volumeHelpText}>
              Volumes above 100% utilize hardware loudness enhancement for quiet recordings.
            </Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C11',
    justifyContent: 'space-between',
  },
  hiddenNativePlayer: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    top: -100,
    left: -100,
  },
  nativeVideo: {
    width: 1,
    height: 1,
  },

  // 1. Header Bar
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  nowPlayingTag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    color: '#69F0AE',
    marginBottom: 2,
  },
  playlistPositionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
  queueCountBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#69F0AE',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  queueCountBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#0B0C11',
  },

  // 2. Center Vinyl & Visualizer Section
  vinylContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  vinylGlow: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(105, 240, 174, 0.08)',
  },
  vinylDisc: {
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#141620',
    borderWidth: 4,
    borderColor: '#1E2235',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
  },
  grooveRing: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  centerAlbumLabel: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#1E2436',
    borderWidth: 3,
    borderColor: '#69F0AE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelArtworkGlow: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(105, 240, 174, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spindleHole: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0B0C11',
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spindleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#69F0AE',
  },

  // Equalizer Bars
  eqContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 36,
    gap: 6,
    marginTop: spacing.lg,
  },
  eqBar: {
    width: 4,
    borderRadius: 2,
  },

  // 3. Song Metadata
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xs,
  },
  titleInfoColumn: {
    flex: 1,
    marginRight: spacing.md,
  },
  songTitleText: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  formatBadge: {
    backgroundColor: 'rgba(105, 240, 174, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: borderRadius.xs,
  },
  formatBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#69F0AE',
    letterSpacing: 0.5,
  },
  metaDot: {
    color: '#475569',
    fontSize: 12,
  },
  metaSubText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
  favoriteBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 4. Scrubber
  scrubberContainer: {
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  progressTrackContainer: {
    height: 30,
    justifyContent: 'center',
  },
  progressTrackBg: {
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressTrackFill: {
    height: '100%',
    backgroundColor: '#69F0AE',
    borderRadius: 3,
  },
  progressThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#69F0AE',
    marginLeft: -7,
    elevation: 4,
    shadowColor: '#69F0AE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  timeLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    fontVariant: ['tabular-nums'],
  },

  // 5. Main Playback Controls
  mainControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  auxControlBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#69F0AE',
  },
  skipBtn: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playPauseMainBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#69F0AE',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#69F0AE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },

  // 6. Secondary Bottom Utility Bar
  bottomUtilityBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  utilityPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  utilityPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E2E8F0',
  },

  // Modal Backdrop
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },

  // Queue Sheet
  queueSheetContainer: {
    backgroundColor: '#141620',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxHeight: '75%',
  },
  queueDragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  queueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  queueTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  queueSubtitleText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 2,
  },
  queueCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: 4,
  },
  activeQueueItemRow: {
    backgroundColor: 'rgba(105, 240, 174, 0.1)',
  },
  queueTrackNumBox: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  queueTrackNumText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  queueMiniEq: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 18,
  },
  miniBar: {
    width: 3,
    backgroundColor: '#69F0AE',
    borderRadius: 1,
  },
  queueItemInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  queueItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  queueItemMeta: {
    fontSize: 12,
    color: '#64748B',
  },
  nowPlayingPill: {
    backgroundColor: 'rgba(105, 240, 174, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  nowPlayingPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#69F0AE',
    letterSpacing: 0.5,
  },

  // Generic Dialog Modal Box
  modalSheetBox: {
    backgroundColor: '#1E2235',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: spacing.md,
  },
  modalItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  activeModalRow: {
    backgroundColor: 'rgba(105, 240, 174, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  modalItemText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#E2E8F0',
  },

  // Volume Modal
  volumeModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  volumePercentText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#69F0AE',
  },
  volumePresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  volumePresetBtn: {
    flex: 1,
    minWidth: 50,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeVolumePresetBtn: {
    backgroundColor: '#69F0AE',
  },
  volumePresetText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  volumeSliderTrack: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  volumeSliderFill: {
    height: '100%',
    borderRadius: 4,
  },
  volumeHelpText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: spacing.md,
    lineHeight: 16,
  },
});
