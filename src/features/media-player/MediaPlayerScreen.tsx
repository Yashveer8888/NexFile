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
  ToastAndroid,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  RotateCw,
  Volume2,
  Sun,
  Subtitles,
  Check,
  ChevronLeft,
  Zap,
  Lock,
  Unlock,
} from 'lucide-react-native';
import { spacing } from '../../theme/spacing';
import { fileService } from '../../services/filesystem/fileService';
import { NexVideo, NexVideoLoadEvent, NexVideoProgressEvent } from '../../components/video/NexVideo';
import { FileItem } from '../../types/file';
import { useVideoResumeStore } from '../../app/store/useVideoResumeStore';
import { isAudioFile } from '../../utils/fileTypes';

// Formatter for seconds -> MM:SS or HH:MM:SS
const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
};

export const MediaPlayerScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Route parameters: file and playlist
  const initialFile: FileItem | undefined = route?.params?.file;
  const initialPlaylist: FileItem[] = route?.params?.playlist || (initialFile ? [initialFile] : []);

  const [playlist] = useState<FileItem[]>(initialPlaylist);
  const [currentFile, setCurrentFile] = useState<FileItem | null>(initialFile || null);

  // Safety check: If an audio file was passed to MediaPlayerScreen, delegate to AudioPlayerScreen
  useEffect(() => {
    if (initialFile && isAudioFile(initialFile)) {
      navigation.replace('AudioPlayerScreen', {
        file: initialFile,
        playlist: initialPlaylist,
      });
    }
  }, [initialFile]);

  // Resume playback position
  const initialResumePos = useMemo(() => {
    if (!initialFile || !initialFile.path) return 0;
    return useVideoResumeStore.getState().getResumePosition(initialFile.path);
  }, [initialFile]);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
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
  const [isLandscape, setIsLandscape] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // Pinch-to-Zoom State (1.0x to 3.5x scale)
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const zoomScaleRef = useRef<number>(1.0);
  zoomScaleRef.current = zoomScale;

  const currentFileRef = useRef<FileItem | null>(currentFile);
  currentFileRef.current = currentFile;

  const playlistRef = useRef<FileItem[]>(playlist);
  playlistRef.current = playlist;

  const lastSavedTimeRef = useRef<number>(0);
  const lastReportedSecondRef = useRef<number>(-1);

  // Audio & Boost (integrated 0 - 200%)
  const [totalVolume, setTotalVolume] = useState<number>(100); // 0 to 200
  const [volumeLevel, setVolumeLevel] = useState<number>(1.0); // 1.0 to 2.0 (boost)
  const [brightness, setBrightness] = useState<number>(0.7);
  const [audioTracks, setAudioTracks] = useState<{ index: number; language: string }[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number>(-1);

  // Stable Gesture & Hardware Tracking Refs (Keeps PanResponder 100% stable!)
  const windowWidthRef = useRef<number>(windowWidth);
  windowWidthRef.current = windowWidth;
  const windowHeightRef = useRef<number>(windowHeight);
  windowHeightRef.current = windowHeight;

  const brightnessRef = useRef<number>(brightness);
  brightnessRef.current = brightness;

  const totalVolumeRef = useRef<number>(totalVolume);
  totalVolumeRef.current = totalVolume;

  const seekTargetTimeRef = useRef<number>(0);
  const seekHudDiffRef = useRef<number>(0);

  const pinchStartDistRef = useRef<number>(0);
  const pinchStartScaleRef = useRef<number>(1.0);

  const gestureModeRef = useRef<'brightness' | 'volume' | 'seek' | 'zoom' | 'none'>('none');
  const grantPageXRef = useRef<number>(0);
  const grantPageYRef = useRef<number>(0);
  const initialGestureValRef = useRef<number>(0);

  // Subtitles (Real tracks only, Default to Off until user explicitly enables)
  const [hasSubtitles, setHasSubtitles] = useState<boolean>(false);
  const [subtitleTracks, setSubtitleTracks] = useState<{ index: number; language: string }[]>([]);
  const [selectedSubtitleTrack, setSelectedSubtitleTrack] = useState<number>(-1);
  const [selectedSubtitleLang, setSelectedSubtitleLang] = useState<string>('Off');
  const userExplicitlyTurnedOffSubtitlesRef = useRef<boolean>(true);

  // UI / Controls Visibility & Screen Lock
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isScreenLocked, setIsScreenLocked] = useState<boolean>(false);
  const isScreenLockedRef = useRef<boolean>(false);
  isScreenLockedRef.current = isScreenLocked;
  const [showLockedButton, setShowLockedButton] = useState<boolean>(false);
  const lockedBtnTimeoutRef = useRef<any>(null);
  const [hudType, setHudType] = useState<'volume' | 'brightness' | 'seek' | 'zoom' | 'lock' | 'unlock' | null>(null);
  const [hudValue, setHudValue] = useState<number>(0);
  const [seekHudDiff, setSeekHudDiff] = useState<number>(0);
  const [doubleTapFeedback, setDoubleTapFeedback] = useState<'left' | 'right' | null>(null);
  const [playPauseFeedback, setPlayPauseFeedback] = useState<'play' | 'pause' | null>(null);

  // Modals
  const [subtitleModalVisible, setSubtitleModalVisible] = useState<boolean>(false);
  const [audioModalVisible, setAudioModalVisible] = useState<boolean>(false);
  const [speedModalVisible, setSpeedModalVisible] = useState<boolean>(false);

  // Progress Bar interactive drag & buttery-smooth animation state
  const [isScrubbing, setIsScrubbing] = useState<boolean>(false);
  const isScrubbingRef = useRef<boolean>(false);
  isScrubbingRef.current = isScrubbing;
  const [scrubRatio, setScrubRatio] = useState<number | null>(null);
  const [trackWidth, setTrackWidth] = useState<number>(windowWidth - 120);
  const trackWidthRef = useRef<number>(windowWidth - 120);
  trackWidthRef.current = trackWidth;
  const trackContainerRef = useRef<any>(null);
  const trackLayoutRef = useRef<{ pageX: number; width: number }>({ pageX: 0, width: 0 });
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Stale progress suppression after seek (prevents progress bar rubber-banding/jumping)
  const seekPendingUntilRef = useRef<number>(0);
  const lastSeekTargetRef = useRef<number>(0);

  // Refs for performance throttling
  const hideControlsTimeoutRef = useRef<any>(null);
  const lastTapRef = useRef<number>(0);
  const hudTimeoutRef = useRef<any>(null);
  const playPauseFeedbackTimerRef = useRef<any>(null);
  const lastHardwareCallRef = useRef<number>(0);
  const isPlayingRef = useRef<boolean>(true);
  isPlayingRef.current = isPlaying;

  // Fetch initial device volume & brightness
  useEffect(() => {
    (async () => {
      try {
        const curVol = await fileService.getDeviceVolume();
        const curBr = await fileService.getScreenBrightness();
        if (typeof curVol === 'number' && !isNaN(curVol)) {
          setTotalVolume(Math.round(curVol * 100));
          totalVolumeRef.current = Math.round(curVol * 100);
        }
        if (typeof curBr === 'number' && !isNaN(curBr)) {
          setBrightness(curBr);
          brightnessRef.current = curBr;
        }
      } catch {}
    })();
  }, []);

  // Set immersive fullscreen mode (HIDE STATUS BAR, TIME, BATTERY, NET SPEED COMPLETELY)
  useEffect(() => {
    fileService.setImmersiveMode(true);
    StatusBar.setHidden(true, 'none');

    return () => {
      if (currentFileRef.current && currentTimeRef.current > 0) {
        useVideoResumeStore.getState().saveResumePosition(
          currentFileRef.current,
          currentTimeRef.current,
          durationRef.current,
          playlistRef.current
        );
      }
      fileService.setImmersiveMode(false);
      StatusBar.setHidden(false, 'none');
      fileService.setScreenOrientation('portrait');
    };
  }, []);

  // Listen for AppState changes to immediately pause and save playback position
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
        setIsPlaying(false);
      }
    });
    return () => sub.remove();
  }, []);

  // Auto-hide controls and all buttons after exactly 3 seconds
  const resetControlsTimer = useCallback(() => {
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    setShowControls(true);
    hideControlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const showLockedButtonTemporarily = useCallback(() => {
    setShowLockedButton(true);
    if (lockedBtnTimeoutRef.current) clearTimeout(lockedBtnTimeoutRef.current);
    lockedBtnTimeoutRef.current = setTimeout(() => {
      setShowLockedButton(false);
    }, 3000);
  }, []);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
      if (lockedBtnTimeoutRef.current) clearTimeout(lockedBtnTimeoutRef.current);
    };
  }, [resetControlsTimer]);

  // Hardware Back button handling
  useEffect(() => {
    const onBackPress = () => {
      if (isScreenLockedRef.current) {
        setHudType('lock');
        if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
        hudTimeoutRef.current = setTimeout(() => setHudType(null), 1500);
        return true;
      }
      navigation.goBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [navigation]);

  // Handle Video Load
  const handleVideoLoad = (event: { nativeEvent: NexVideoLoadEvent }) => {
    const d = event.nativeEvent.duration || 0;
    const w = event.nativeEvent.width || 0;
    const h = event.nativeEvent.height || 0;
    setDuration(d);
    durationRef.current = d;

    // Mark as watched immediately on start of playback
    if (currentFile && currentFile.path) {
      useVideoResumeStore.getState().markAsWatched(currentFile);
      const savedPos = useVideoResumeStore.getState().getResumePosition(currentFile.path);
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

    // Auto rotate: automatically rotate to landscape for widescreen/horizontal videos
    if (w > 0 && h > 0 && w < h) {
      fileService.setScreenOrientation('portrait');
      setIsLandscape(false);
    } else {
      fileService.setScreenOrientation('landscape');
      setIsLandscape(true);
    }

    // Audio tracks
    if (event.nativeEvent.audioTracks && event.nativeEvent.audioTracks.length > 0) {
      setAudioTracks(event.nativeEvent.audioTracks);
      setSelectedAudioTrack((prev) => (prev >= 0 && prev < event.nativeEvent.audioTracks!.length ? prev : 0));
    } else {
      setAudioTracks([]);
      setSelectedAudioTrack(-1);
    }

    // Subtitle tracks (Default to OFF unless user actively selects a track)
    if (event.nativeEvent.subtitleTracks && event.nativeEvent.subtitleTracks.length > 0) {
      setSubtitleTracks(event.nativeEvent.subtitleTracks);
      setHasSubtitles(true);
      if (!userExplicitlyTurnedOffSubtitlesRef.current && selectedSubtitleTrack >= 0 && selectedSubtitleTrack < event.nativeEvent.subtitleTracks.length) {
        setSelectedSubtitleLang(event.nativeEvent.subtitleTracks[selectedSubtitleTrack].language);
      } else {
        setSelectedSubtitleTrack(-1);
        setSelectedSubtitleLang('Off');
      }
    } else {
      setSubtitleTracks([]);
      setHasSubtitles(false);
      setSelectedSubtitleTrack(-1);
      setSelectedSubtitleLang('Off');
    }
  };

  // Handle Video Progress (Buttery-smooth 60fps continuous glide)
  const handleVideoProgress = (event: { nativeEvent: NexVideoProgressEvent }) => {
    if (!isScrubbingRef.current) {
      const ct = event.nativeEvent.currentTime;

      // Filter out stale pre-seek ticks while waiting for user seek to land
      if (Date.now() < seekPendingUntilRef.current) {
        if (Math.abs(ct - lastSeekTargetRef.current) > 1.5) {
          // Stale tick from before seek! Ignore it!
          return;
        }
        seekPendingUntilRef.current = 0;
      }

      // Filter out stale pre-seek ticks while waiting for initial resume seek to land
      if (isAwaitingInitialResumeRef.current && currentFileRef.current) {
        const savedPos = useVideoResumeStore.getState().getResumePosition(currentFileRef.current.path);
        if (savedPos > 2 && ct < savedPos - 2) {
          return;
        }
        isAwaitingInitialResumeRef.current = false;
      }

      currentTimeRef.current = ct;
      const d = event.nativeEvent.duration || durationRef.current;
      if (d && !durationRef.current) {
        setDuration(d);
        durationRef.current = d;
      }

      // Buttery-smooth continuous glide animation between progress ticks (100ms)
      if (d > 0) {
        const targetRatio = Math.max(0, Math.min(1, ct / d));
        Animated.timing(progressAnim, {
          toValue: targetRatio,
          duration: 100,
          easing: Easing.linear,
          useNativeDriver: false,
        }).start();
      }

      // Update text label only when second changes (eliminates 10 full re-renders/sec!)
      const currentSec = Math.floor(ct);
      if (currentSec !== lastReportedSecondRef.current) {
        lastReportedSecondRef.current = currentSec;
        setCurrentTime(ct);
      }

      // Periodically persist playback position every 2.5 seconds
      const now = Date.now();
      if (now - lastSavedTimeRef.current > 2500 && currentFileRef.current) {
        lastSavedTimeRef.current = now;
        useVideoResumeStore.getState().saveResumePosition(
          currentFileRef.current,
          ct,
          d,
          playlistRef.current
        );
      }
    }
  };

  // 1. FAST ONE-CLICK PLAY / PAUSE (NEAREST TOUCH RESPONSE)
  const handleFastPlayPause = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      if (!next && currentFile) {
        // Paused: save resume position immediately
        useVideoResumeStore.getState().saveResumePosition(
          currentFile,
          currentTimeRef.current,
          durationRef.current,
          playlist
        );
      }
      // Show feedback ripple only when controls are hidden
      if (!showControls) {
        setPlayPauseFeedback(next ? 'play' : 'pause');
        if (playPauseFeedbackTimerRef.current) clearTimeout(playPauseFeedbackTimerRef.current);
        playPauseFeedbackTimerRef.current = setTimeout(() => setPlayPauseFeedback(null), 450);
      }
      return next;
    });
    resetControlsTimer();
  }, [showControls, currentFile, playlist, resetControlsTimer]);

  // 2. DOUBLE-TAP SKIP (±10s) WITH ACCUMULATING RAPID TAPS
  const handleSkip = useCallback(
    (deltaSec: number) => {
      const baseTime = currentTimeRef.current;
      const target = Math.max(0, Math.min(durationRef.current, baseTime + deltaSec));
      currentTimeRef.current = target;
      setCurrentTime(target);
      setSeekTarget(target);
      lastSeekTargetRef.current = target;
      seekPendingUntilRef.current = Date.now() + 600;
      if (durationRef.current > 0) {
        progressAnim.stopAnimation();
        progressAnim.setValue(target / durationRef.current);
      }
      if (currentFileRef.current) {
        useVideoResumeStore.getState().saveResumePosition(
          currentFileRef.current,
          target,
          durationRef.current,
          playlistRef.current
        );
      }
      resetControlsTimer();
    },
    [resetControlsTimer]
  );

  // 3. PREVIOUS & NEXT VIDEO BUTTONS
  const currentVideoIdx = useMemo(() => {
    if (!currentFile) return -1;
    const idx = playlist.findIndex((f) => f.id === currentFile.id || f.path === currentFile.path);
    return idx >= 0 ? idx : 0;
  }, [playlist, currentFile]);

  const handlePrevVideo = useCallback(() => {
    if (playlist.length === 0) return;
    if (currentFileRef.current) {
      useVideoResumeStore.getState().saveResumePosition(
        currentFileRef.current,
        currentTimeRef.current,
        durationRef.current,
        playlistRef.current
      );
    }
    const prevIdx = currentVideoIdx > 0 ? currentVideoIdx - 1 : playlist.length - 1;
    const prevFile = playlist[prevIdx];
    const prevSavedPos = useVideoResumeStore.getState().getResumePosition(prevFile.path);
    const prevPos = prevSavedPos > 2 ? prevSavedPos : 0;

    setCurrentFile(prevFile);
    setCurrentTime(prevPos);
    currentTimeRef.current = prevPos;
    isAwaitingInitialResumeRef.current = prevPos > 2;
    setSeekTarget(prevPos);
    setSelectedSubtitleTrack(-1);
    setSelectedSubtitleLang('Off');
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    setIsPlaying(true);
    resetControlsTimer();
  }, [playlist, currentVideoIdx, resetControlsTimer]);

  const handleNextVideo = useCallback(() => {
    if (playlist.length === 0) return;
    if (currentFileRef.current) {
      useVideoResumeStore.getState().saveResumePosition(
        currentFileRef.current,
        currentTimeRef.current,
        durationRef.current,
        playlistRef.current
      );
    }
    const nextIdx = currentVideoIdx < playlist.length - 1 ? currentVideoIdx + 1 : 0;
    const nextFile = playlist[nextIdx];
    const nextSavedPos = useVideoResumeStore.getState().getResumePosition(nextFile.path);
    const nextPos = nextSavedPos > 2 ? nextSavedPos : 0;

    setCurrentFile(nextFile);
    setCurrentTime(nextPos);
    currentTimeRef.current = nextPos;
    isAwaitingInitialResumeRef.current = nextPos > 2;
    setSeekTarget(nextPos);
    setSelectedSubtitleTrack(-1);
    setSelectedSubtitleLang('Off');
    progressAnim.stopAnimation();
    progressAnim.setValue(0);
    setIsPlaying(true);
    resetControlsTimer();
  }, [playlist, currentVideoIdx, resetControlsTimer]);

  // Handle Video End -> Auto-play next if playlist available
  const handleVideoEnd = () => {
    progressAnim.stopAnimation();
    progressAnim.setValue(1);
    if (currentFileRef.current) {
      // Completed: mark finished and save
      useVideoResumeStore.getState().saveResumePosition(
        currentFileRef.current,
        durationRef.current,
        durationRef.current,
        playlistRef.current
      );
    }
    if (playlistRef.current.length > 1) {
      handleNextVideo();
    } else {
      setIsPlaying(false);
      setShowControls(true);
    }
  };

  // 4. ROTATION TOGGLE
  const toggleOrientation = useCallback(() => {
    const next = !isLandscape;
    setIsLandscape(next);
    fileService.setScreenOrientation(next ? 'landscape' : 'portrait');
    resetControlsTimer();
  }, [isLandscape, resetControlsTimer]);

  // 5. PROGRESS BAR DEDICATED PAN RESPONDER (FINGER DRAG FORWARD/BACKWARD)
  const progressPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          setIsScrubbing(true);
          isScrubbingRef.current = true;
          progressAnim.stopAnimation();

          const grantPageX = evt.nativeEvent.pageX;
          const grantLocX = evt.nativeEvent.locationX;
          if (trackLayoutRef.current.width <= 0) {
            trackLayoutRef.current.width =
              trackWidthRef.current > 0 ? trackWidthRef.current : (windowWidthRef.current - 120);
          }
          if (trackLayoutRef.current.pageX <= 0 || isNaN(trackLayoutRef.current.pageX)) {
            trackLayoutRef.current.pageX = grantPageX - grantLocX;
          }

          const trackLeft = trackLayoutRef.current.pageX;
          const trackW =
            trackLayoutRef.current.width > 0 ? trackLayoutRef.current.width : (windowWidthRef.current - 120);
          const touchX = grantLocX >= 0 && grantLocX <= trackW ? grantLocX : (grantPageX - trackLeft);
          const ratio = Math.max(0, Math.min(1, touchX / trackW));
          setScrubRatio(ratio);
          progressAnim.setValue(ratio);
          if (durationRef.current > 0) {
            const previewTime = ratio * durationRef.current;
            currentTimeRef.current = previewTime;
            setCurrentTime(previewTime);
          }
        },
        onPanResponderMove: (evt) => {
          const touchPageX = evt.nativeEvent.pageX;
          const trackLeft = trackLayoutRef.current.pageX;
          const trackW =
            trackLayoutRef.current.width > 0 ? trackLayoutRef.current.width : (windowWidthRef.current - 120);
          const ratio = Math.max(0, Math.min(1, (touchPageX - trackLeft) / trackW));
          setScrubRatio(ratio);
          progressAnim.setValue(ratio);
          if (durationRef.current > 0) {
            const previewTime = ratio * durationRef.current;
            currentTimeRef.current = previewTime;
            setCurrentTime(previewTime);
          }
        },
        onPanResponderRelease: (evt) => {
          const touchPageX = evt.nativeEvent.pageX;
          const trackLeft = trackLayoutRef.current.pageX;
          const trackW =
            trackLayoutRef.current.width > 0 ? trackLayoutRef.current.width : (windowWidthRef.current - 120);
          const ratio = Math.max(0, Math.min(1, (touchPageX - trackLeft) / trackW));
          const finalTime = ratio * durationRef.current;
          setScrubRatio(null);
          setIsScrubbing(false);
          isScrubbingRef.current = false;
          progressAnim.setValue(ratio);
          setCurrentTime(finalTime);
          currentTimeRef.current = finalTime;
          setSeekTarget(finalTime);
          lastSeekTargetRef.current = finalTime;
          seekPendingUntilRef.current = Date.now() + 600;

          if (currentFileRef.current) {
            useVideoResumeStore.getState().saveResumePosition(
              currentFileRef.current,
              finalTime,
              durationRef.current,
              playlistRef.current
            );
          }
          resetControlsTimer();
        },
      }),
    [resetControlsTimer]
  );

  // 6. SCREEN GESTURES:
  // - Two-Finger Pinch: Zoom in & Zoom out (1.0x to 3.5x scale)
  // - Horizontal Swipe: Smooth seek forward & backward without freezing video!
  // - Right Vertical Swipe: Volume & Audio Boost (0% - 200%) -> HUD on LEFT
  // - Left Vertical Swipe: Brightness (5% - 100%) -> HUD on RIGHT
  // - Double-tap Left 50%: -10s (or reset zoom if zoomed in)
  // - Double-tap Right 50%: +10s (or reset zoom if zoomed in)
  // - Single Tap: Toggle Controls
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) => {
          if (isScreenLockedRef.current) return false;
          return (
            Math.abs(gesture.dx) > 6 ||
            Math.abs(gesture.dy) > 6 ||
            gesture.numberActiveTouches === 2
          );
        },
        onPanResponderGrant: (evt) => {
          if (isScreenLockedRef.current) return;
          const touches = evt.nativeEvent.touches;
          if (touches && touches.length === 2) {
            // Two-finger pinch to zoom start
            const d = Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY
            );
            pinchStartDistRef.current = d;
            pinchStartScaleRef.current = zoomScaleRef.current;
            gestureModeRef.current = 'zoom';
          } else {
            gestureModeRef.current = 'none';
            grantPageXRef.current = evt.nativeEvent.pageX;
            grantPageYRef.current = evt.nativeEvent.pageY;
            initialGestureValRef.current = 0;
            pinchStartDistRef.current = 0;
          }
        },
        onPanResponderMove: (evt, gesture) => {
          if (isScreenLockedRef.current) return;
          const touches = evt.nativeEvent.touches;

          // 1. PINCH TO ZOOM (TWO FINGERS)
          if (touches && touches.length === 2) {
            const currentDist = Math.hypot(
              touches[0].pageX - touches[1].pageX,
              touches[0].pageY - touches[1].pageY
            );
            if (pinchStartDistRef.current <= 0) {
              pinchStartDistRef.current = currentDist;
              pinchStartScaleRef.current = zoomScaleRef.current;
              gestureModeRef.current = 'zoom';
              return;
            }
            const factor = currentDist / pinchStartDistRef.current;
            const newScale = Math.max(1.0, Math.min(3.5, pinchStartScaleRef.current * factor));
            zoomScaleRef.current = newScale;
            setZoomScale(newScale);
            setHudType('zoom');
            setHudValue(Math.round(newScale * 100));
            return;
          }

          // If currently in zoom mode but only 1 finger active, do not trigger single-finger drag
          if (gestureModeRef.current === 'zoom') {
            return;
          }

          const { dx, dy } = gesture;
          const w = windowWidthRef.current || 600;
          const h = windowHeightRef.current || 400;
          const screenHalf = w / 2;

          // Decide gesture mode
          if (gestureModeRef.current === 'none') {
            if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) {
              if (grantPageXRef.current < screenHalf) {
                // Left vertical -> Brightness
                gestureModeRef.current = 'brightness';
                initialGestureValRef.current = brightnessRef.current;
              } else {
                // Right vertical -> Volume + Boost
                gestureModeRef.current = 'volume';
                initialGestureValRef.current = totalVolumeRef.current;
              }
            } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
              // Horizontal drag -> Seek forward/backward
              gestureModeRef.current = 'seek';
              initialGestureValRef.current = currentTimeRef.current;
            }
          }

          const now = Date.now();

          // A. BRIGHTNESS (Left side vertical drag: Up = brighter, Down = darker)
          if (gestureModeRef.current === 'brightness') {
            const delta = -dy / (h * 0.65);
            const nextBr = Math.max(0.05, Math.min(1.0, initialGestureValRef.current + delta));
            brightnessRef.current = nextBr;
            setBrightness(nextBr);
            setHudType('brightness');
            setHudValue(Math.round(nextBr * 100));

            // Throttled native hardware call to prevent bridge saturation
            if (now - lastHardwareCallRef.current > 120) {
              lastHardwareCallRef.current = now;
              fileService.setScreenBrightness(nextBr);
            }
          }

          // B. VOLUME + BOOST (Right side vertical drag: Up = louder, Down = quieter)
          else if (gestureModeRef.current === 'volume') {
            const delta = (-dy / (h * 0.65)) * 200;
            const nextTotalVol = Math.max(
              0,
              Math.min(200, Math.round(initialGestureValRef.current + delta))
            );
            totalVolumeRef.current = nextTotalVol;
            setTotalVolume(nextTotalVol);

            if (nextTotalVol <= 100) {
              const devVol = nextTotalVol / 100.0;
              setVolumeLevel(1.0);
              if (now - lastHardwareCallRef.current > 120) {
                lastHardwareCallRef.current = now;
                fileService.setDeviceVolume(devVol);
              }
            } else {
              // 101% - 200%: LoudnessEnhancer audio boost
              const boost = 1.0 + (nextTotalVol - 100) / 100.0;
              setVolumeLevel(boost);
              if (now - lastHardwareCallRef.current > 120) {
                lastHardwareCallRef.current = now;
                fileService.setDeviceVolume(1.0);
              }
            }

            setHudType('volume');
            setHudValue(nextTotalVol);
          }

          // C. HORIZONTAL SEEK (Smooth drag: Left-to-Right = Forward, Right-to-Left = Backward)
          else if (gestureModeRef.current === 'seek') {
            const dur = durationRef.current || 100;
            const maxSeek = dur > 300 ? 120 : 45; // seconds
            const seekDeltaSec = Math.round((dx / w) * maxSeek);
            const target = Math.max(0, Math.min(dur, initialGestureValRef.current + seekDeltaSec));

            seekTargetTimeRef.current = target;
            seekHudDiffRef.current = seekDeltaSec;

            // Live timeline update without hardware stutter
            if (dur > 0) {
              progressAnim.stopAnimation();
              progressAnim.setValue(target / dur);
            }
            setCurrentTime(target);
            setSeekHudDiff(seekDeltaSec);
            setHudType('seek');
            setHudValue(target);
          }
        },
        onPanResponderRelease: (evt, gesture) => {
          if (isScreenLockedRef.current) {
            showLockedButtonTemporarily();
            setHudType('lock');
            if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
            hudTimeoutRef.current = setTimeout(() => setHudType(null), 1200);
            return;
          }
          const currentMode = gestureModeRef.current;

          // 1. Zoom release (Keep user-chosen zoom level intact)
          if (currentMode === 'zoom') {
            pinchStartDistRef.current = 0;
          }

          // 2. Brightness release: final hardware sync
          else if (currentMode === 'brightness') {
            fileService.setScreenBrightness(brightnessRef.current);
          }

          // 3. Volume release: final hardware sync
          else if (currentMode === 'volume') {
            const vol = totalVolumeRef.current;
            if (vol <= 100) {
              fileService.setDeviceVolume(vol / 100.0);
            } else {
              fileService.setDeviceVolume(1.0);
            }
          }

          // 4. Seek release: jump hardware decoder directly to final position!
          else if (currentMode === 'seek') {
            const finalTarget = seekTargetTimeRef.current;
            currentTimeRef.current = finalTarget;
            setCurrentTime(finalTarget);
            setSeekTarget(finalTarget);
            lastSeekTargetRef.current = finalTarget;
            seekPendingUntilRef.current = Date.now() + 600;
            if (durationRef.current > 0) {
              progressAnim.setValue(finalTarget / durationRef.current);
            }

            if (currentFileRef.current) {
              useVideoResumeStore.getState().saveResumePosition(
                currentFileRef.current,
                finalTarget,
                durationRef.current,
                playlistRef.current
              );
            }
          }

          gestureModeRef.current = 'none';

          // Clear HUD after 700ms
          if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
          hudTimeoutRef.current = setTimeout(() => {
            setHudType(null);
          }, 700);

          // Handle Tap & Double Tap
          const isTap = Math.abs(gesture.dx) < 7 && Math.abs(gesture.dy) < 7;
          if (isTap && currentMode === 'none') {
            const now = Date.now();
            const tapX = evt.nativeEvent.pageX;
            const isDoubleTap = now - lastTapRef.current < 280;

            if (isDoubleTap) {
              // Generous 50% / 50% split for double tap: left = -10s, right = +10s
              const screenW = windowWidthRef.current || 400;
              if (tapX < screenW * 0.5) {
                handleSkip(-10);
                setDoubleTapFeedback('left');
                setTimeout(() => setDoubleTapFeedback(null), 450);
              } else {
                handleSkip(10);
                setDoubleTapFeedback('right');
                setTimeout(() => setDoubleTapFeedback(null), 450);
              }
              resetControlsTimer();
            } else {
              // Single tap -> toggle controls with 3s auto-hide timer
              setShowControls((prev) => {
                if (prev) {
                  if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
                  return false;
                } else {
                  if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
                  hideControlsTimeoutRef.current = setTimeout(() => {
                    setShowControls(false);
                  }, 3000);
                  return true;
                }
              });
            }
            lastTapRef.current = now;
          }
        },
      }),
    [handleSkip]
  );

  const progressWidthPercent = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />

      {/* =========================================================================
          1. NATIVE HARDWARE-ACCELERATED VIDEO VIEW (WITH TWO-FINGER ZOOM IN/OUT)
          ========================================================================= */}
      <View style={styles.videoArea} {...panResponder.panHandlers}>
        <View
          style={[
            styles.videoScaleContainer,
            {
              transform: [{ scale: zoomScale }],
            },
          ]}
          pointerEvents="none"
        >
          <NexVideo
            style={styles.nativeVideo}
            videoPath={currentFile?.path}
            paused={!isPlaying}
            seekTo={seekTarget}
            rate={playbackSpeed}
            volume={volumeLevel}
            isLooping={false}
            resizeMode="contain"
            selectedAudioTrack={selectedAudioTrack}
            selectedSubtitleTrack={selectedSubtitleTrack}
            onVideoLoad={handleVideoLoad}
            onVideoProgress={handleVideoProgress}
            onVideoEnd={handleVideoEnd}
          />
        </View>

        {/* Double-tap Skip Animated Feedback Ripples */}
        {doubleTapFeedback === 'left' && (
          <View style={[styles.doubleTapOverlay, { left: 40 }]}>
            <RotateCcw size={40} color="#FFFFFF" />
            <Text style={styles.doubleTapText}>-10s</Text>
          </View>
        )}
        {doubleTapFeedback === 'right' && (
          <View style={[styles.doubleTapOverlay, { right: 40 }]}>
            <RotateCw size={40} color="#FFFFFF" />
            <Text style={styles.doubleTapText}>+10s</Text>
          </View>
        )}

        {/* One-Click Fast Play/Pause Ripple: ONLY shown when controls are hidden to avoid overlap */}
        {!showControls && playPauseFeedback && (
          <View style={styles.centerFeedbackRipple} pointerEvents="none">
            {playPauseFeedback === 'play' ? (
              <Play size={48} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 4 }} />
            ) : (
              <Pause size={48} color="#FFFFFF" fill="#FFFFFF" />
            )}
          </View>
        )}

        {/* HUD: Volume (Controlled from Right, Displayed on LEFT) */}
        {hudType === 'volume' && (
          <View style={styles.hudBoxLeft}>
            {hudValue > 100 ? (
              <Zap size={24} color="#FF5252" />
            ) : (
              <Volume2 size={24} color="#69F0AE" />
            )}
            <View style={styles.hudBarTrack}>
              <View
                style={[
                  styles.hudBarFill,
                  {
                    height: `${Math.min(100, Math.round((hudValue / 200) * 100))}%`,
                    backgroundColor: hudValue > 100 ? '#FF5252' : '#69F0AE',
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.hudText,
                hudValue > 100 && { color: '#FF5252', fontWeight: '800' },
              ]}
            >
              {hudValue > 100 ? `${hudValue}%` : `${hudValue}%`}
            </Text>
          </View>
        )}

        {/* HUD: Brightness (Controlled from Left, Displayed on RIGHT) */}
        {hudType === 'brightness' && (
          <View style={styles.hudBoxRight}>
            <Sun size={24} color="#FFD600" />
            <View style={styles.hudBarTrack}>
              <View
                style={[
                  styles.hudBarFill,
                  {
                    height: `${hudValue}%`,
                    backgroundColor: '#FFD600',
                  },
                ]}
              />
            </View>
            <Text style={[styles.hudText, { color: '#FFD600' }]}>{hudValue}%</Text>
          </View>
        )}

        {/* Horizontal Seek HUD (Fluid, Instant Feedback) */}
        {hudType === 'seek' && (
          <View style={styles.seekHudBox}>
            <Text style={styles.seekHudDiffText}>
              {seekHudDiff >= 0 ? `+${seekHudDiff}s` : `${seekHudDiff}s`}
            </Text>
            <Text style={styles.seekHudTimeText}>
              {formatDuration(hudValue)} / {formatDuration(duration)}
            </Text>
          </View>
        )}

        {/* Two-Finger Zoom HUD */}
        {hudType === 'zoom' && (
          <View style={styles.zoomHudBox}>
            <Text style={styles.zoomHudText}>{`${(hudValue / 100).toFixed(1)}x`}</Text>
            <Text style={styles.zoomHudSubText}>Zoom</Text>
          </View>
        )}
      </View>

      {/* Unified Screen Lock / Unlock Button on Left Edge (Single Fixed Position, No Text) */}
      {((showControls && !isScreenLocked) || (isScreenLocked && showLockedButton)) && (
        <TouchableOpacity
          style={[
            styles.singleLeftLockBtn,
            isScreenLocked && styles.singleLeftLockBtnLocked,
          ]}
          onPress={() => {
            if (isScreenLocked) {
              setIsScreenLocked(false);
              setShowLockedButton(false);
              setHudType('unlock');
              resetControlsTimer();
            } else {
              setIsScreenLocked(true);
              setShowControls(false);
              showLockedButtonTemporarily();
              setHudType('lock');
            }
            if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
            hudTimeoutRef.current = setTimeout(() => setHudType(null), 1500);
          }}
          activeOpacity={0.7}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
        >
          {isScreenLocked ? (
            <Lock size={22} color="#FF5252" />
          ) : (
            <Unlock size={22} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      )}

      {/* =========================================================================
          2. TOP CONTROL BAR (BACK, TITLE, SPEED, ROTATION, AUDIO, SUBTITLES)
          ========================================================================= */}
      {showControls && !isScreenLocked && (
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
          <TouchableOpacity
            style={styles.iconCircleBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
          >
            <ChevronLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.titleContainer}>
            <Text style={styles.videoTitleText} numberOfLines={1}>
              {currentFile?.name || 'Video Player'}
            </Text>
          </View>

          {/* Top Action Buttons */}
          <View style={styles.topRightActions}>
            {/* Playback Speed Button (0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x) */}
            <TouchableOpacity
              style={styles.speedPillBtn}
              onPress={() => setSpeedModalVisible(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.speedPillText}>{playbackSpeed}x</Text>
            </TouchableOpacity>

            {/* Rotation Toggle */}
            <TouchableOpacity
              style={styles.iconCircleBtn}
              onPress={toggleOrientation}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <RotateCw size={20} color={isLandscape ? '#69F0AE' : '#FFFFFF'} />
            </TouchableOpacity>

            {/* Audio Track Selector */}
            <TouchableOpacity
              style={styles.iconCircleBtn}
              onPress={() => setAudioModalVisible(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Volume2 size={20} color={selectedAudioTrack !== -1 ? '#69F0AE' : '#FFFFFF'} />
            </TouchableOpacity>

            {/* Subtitles (Language Select) */}
            <TouchableOpacity
              style={styles.iconCircleBtn}
              onPress={() => setSubtitleModalVisible(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Subtitles size={20} color={selectedSubtitleTrack !== -1 ? '#69F0AE' : '#FFFFFF'} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* =========================================================================
          3. CENTER CONTROLS (PREVIOUS, PLAY/PAUSE, NEXT) - ULTRA RESPONSIVE
          ========================================================================= */}
      {showControls && !isScreenLocked && (
        <View style={styles.centerControlsOverlay} pointerEvents="box-none">
          {/* Previous Video Button */}
          <TouchableOpacity
            style={styles.centerSecondaryBtn}
            onPress={handlePrevVideo}
            activeOpacity={0.6}
            hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}
          >
            <SkipBack size={36} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Main Play / Pause Button - Instant Nearest Touch */}
          <TouchableOpacity
            style={styles.centerMainPlayBtn}
            onPress={handleFastPlayPause}
            activeOpacity={0.6}
            hitSlop={{ top: 40, bottom: 40, left: 40, right: 40 }}
          >
            {isPlaying ? (
              <Pause size={52} color="#FFFFFF" fill="#FFFFFF" />
            ) : (
              <Play size={52} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 5 }} />
            )}
          </TouchableOpacity>

          {/* Next Video Button */}
          <TouchableOpacity
            style={styles.centerSecondaryBtn}
            onPress={handleNextVideo}
            activeOpacity={0.6}
            hitSlop={{ top: 30, bottom: 30, left: 30, right: 30 }}
          >
            <SkipForward size={36} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* =========================================================================
          4. BOTTOM CONTROL BAR (TIMESTAMPS & DRAGGABLE TIMELINE PROGRESS BAR)
          ========================================================================= */}
      {showControls && !isScreenLocked && (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.sm }]}>
          <View style={styles.timelineRow}>
            <Text style={styles.timeLabelText}>{formatDuration(currentTime)}</Text>

            {/* Draggable Progress Track with Buttery-Smooth Finger Scrubbing */}
            <View
              ref={trackContainerRef}
              style={styles.progressTrackContainer}
              collapsable={false}
              hitSlop={{ top: 20, bottom: 20, left: 10, right: 10 }}
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
              <View style={[styles.progressTrackBg, isScrubbing && { height: 6 }]} pointerEvents="none">
                <Animated.View
                  style={[
                    styles.progressTrackFill,
                    { width: progressWidthPercent },
                    isScrubbing && { backgroundColor: '#00E676' },
                  ]}
                  pointerEvents="none"
                />
              </View>

              {/* Scrubber Knob (Glides Smoothly at 60fps) */}
              <Animated.View
                style={[
                  styles.progressThumb,
                  { left: progressWidthPercent },
                  isScrubbing && styles.progressThumbActive,
                ]}
                pointerEvents="none"
              />
            </View>

            <Text style={styles.timeLabelText}>{formatDuration(duration)}</Text>
          </View>
        </View>
      )}

      {/* =========================================================================
          5. PLAYBACK SPEED SELECTOR MODAL (0.5x, 0.75x, 1x, 1.25x, 1.5x, 1.75x, 2x)
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
          <View style={styles.modalSheetBox}>
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
          6. SUBTITLE LANGUAGE MODAL
          ========================================================================= */}
      <Modal
        visible={subtitleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSubtitleModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setSubtitleModalVisible(false)}
        >
          <View style={styles.modalSheetBox}>
            <Text style={styles.modalTitle}>Subtitles / Closed Captions</Text>

            {/* Turn Off Option */}
            <TouchableOpacity
              style={[styles.modalItemRow, selectedSubtitleTrack === -1 && styles.activeModalRow]}
              onPress={() => {
                userExplicitlyTurnedOffSubtitlesRef.current = true;
                setSelectedSubtitleTrack(-1);
                setSelectedSubtitleLang('Off');
                setSubtitleModalVisible(false);
                ToastAndroid.show('Subtitles Off', ToastAndroid.SHORT);
              }}
            >
              <Text
                style={[
                  styles.modalItemText,
                  selectedSubtitleTrack === -1 && { color: '#69F0AE', fontWeight: '700' },
                ]}
              >
                Off (Turn Off Subtitles)
              </Text>
              {selectedSubtitleTrack === -1 && <Check size={18} color="#69F0AE" />}
            </TouchableOpacity>

            {/* Available Tracks if present */}
            {hasSubtitles && subtitleTracks.length > 0 ? (
              subtitleTracks.map((sub) => (
                <TouchableOpacity
                  key={sub.index}
                  style={[styles.modalItemRow, selectedSubtitleTrack === sub.index && styles.activeModalRow]}
                  onPress={() => {
                    userExplicitlyTurnedOffSubtitlesRef.current = false;
                    setSelectedSubtitleTrack(sub.index);
                    setSelectedSubtitleLang(sub.language);
                    setSubtitleModalVisible(false);
                    ToastAndroid.show(`Subtitle: ${sub.language}`, ToastAndroid.SHORT);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      selectedSubtitleTrack === sub.index && { color: '#69F0AE', fontWeight: '700' },
                    ]}
                  >
                    {sub.language}
                  </Text>
                  {selectedSubtitleTrack === sub.index && <Check size={18} color="#69F0AE" />}
                </TouchableOpacity>
              ))
            ) : (
              <View style={{ paddingVertical: 14 }}>
                <Text style={{ color: '#888888', fontSize: 13, textAlign: 'center' }}>
                  No subtitle tracks found in this video file.
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* =========================================================================
          7. AUDIO TRACK SELECTION MODAL
          ========================================================================= */}
      <Modal
        visible={audioModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAudioModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setAudioModalVisible(false)}
        >
          <View style={styles.modalSheetBox}>
            <Text style={styles.modalTitle}>Select Audio Track</Text>
            {audioTracks.length > 0 ? (
              audioTracks.map((tr) => (
                <TouchableOpacity
                  key={tr.index}
                  style={[styles.modalItemRow, selectedAudioTrack === tr.index && styles.activeModalRow]}
                  onPress={() => {
                    setSelectedAudioTrack(tr.index);
                    setAudioModalVisible(false);
                    ToastAndroid.show(`Audio: ${tr.language}`, ToastAndroid.SHORT);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      selectedAudioTrack === tr.index && { color: '#69F0AE', fontWeight: '700' },
                    ]}
                  >
                    {tr.language || `Audio Track ${tr.index + 1}`}
                  </Text>
                  {selectedAudioTrack === tr.index && <Check size={18} color="#69F0AE" />}
                </TouchableOpacity>
              ))
            ) : (
              [
                { index: 0, label: 'Track 1 (Default Stereo)' },
                { index: 1, label: 'Track 2 (Dual Audio / Hindi)' },
                { index: 2, label: 'Track 3 (English Surround)' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.index}
                  style={[
                    styles.modalItemRow,
                    (selectedAudioTrack === opt.index || (selectedAudioTrack === -1 && opt.index === 0)) &&
                      styles.activeModalRow,
                  ]}
                  onPress={() => {
                    setSelectedAudioTrack(opt.index);
                    setAudioModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalItemText,
                      (selectedAudioTrack === opt.index || (selectedAudioTrack === -1 && opt.index === 0)) && {
                        color: '#69F0AE',
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {(selectedAudioTrack === opt.index || (selectedAudioTrack === -1 && opt.index === 0)) && (
                    <Check size={18} color="#69F0AE" />
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  videoArea: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoScaleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nativeVideo: {
    width: '100%',
    height: '100%',
  },

  // Subtitles (Small font size & unobtrusive)
  subtitlesContainer: {
    position: 'absolute',
    bottom: 52,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  subtitlesBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
  },
  subtitlesText: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Double-tap Skip Ripples (Large 50% split)
  doubleTapOverlay: {
    position: 'absolute',
    top: '42%',
    alignItems: 'center',
    backgroundColor: 'transparent',
    width: 80,
    height: 80,
    justifyContent: 'center',
  },
  doubleTapText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // One-click fast play/pause ripple (shown only when controls hidden)
  centerFeedbackRipple: {
    position: 'absolute',
    top: '42%',
    alignSelf: 'center',
    width: 84,
    height: 84,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // HUD: Left Box (Volume + Boost)
  hudBoxLeft: {
    position: 'absolute',
    left: 24,
    top: '30%',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 10,
  },

  // HUD: Right Box (Brightness)
  hudBoxRight: {
    position: 'absolute',
    right: 24,
    top: '30%',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 10,
  },

  hudBarTrack: {
    width: 5,
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 2.5,
    marginVertical: 10,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  hudBarFill: {
    width: '100%',
    borderRadius: 2.5,
  },
  hudText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Horizontal Seek HUD
  seekHudBox: {
    position: 'absolute',
    top: '42%',
    alignSelf: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  seekHudDiffText: {
    color: '#69F0AE',
    fontSize: 28,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  seekHudTimeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Two-Finger Zoom HUD
  zoomHudBox: {
    position: 'absolute',
    top: '42%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomHudText: {
    color: '#69F0AE',
    fontSize: 26,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  zoomHudSubText: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },

  // Lock / Unlock Center HUD
  lockHudBox: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    paddingHorizontal: 26,
    paddingVertical: 18,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  lockHudText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
  },
  lockHudSubText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },

  // Unified Screen Lock / Unlock Button on Left Edge (No Text, Single Fixed Position)
  singleLeftLockBtn: {
    position: 'absolute',
    left: 20,
    top: '46%',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(20, 20, 26, 0.75)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  singleLeftLockBtnLocked: {
    backgroundColor: 'rgba(40, 10, 15, 0.85)',
    borderColor: '#FF5252',
    shadowColor: '#FF5252',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 8,
  },

  // Top Bar (100% Transparent)
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
    backgroundColor: 'transparent',
  },
  iconCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedPillBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  speedPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  titleContainer: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  videoTitleText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  topRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  // Center Controls (Previous, Play/Pause, Next)
  centerControlsOverlay: {
    position: 'absolute',
    top: '40%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 36,
  },
  centerMainPlayBtn: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerSecondaryBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Bottom Bar (100% Transparent)
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xs,
    backgroundColor: 'transparent',
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  timeLabelText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    width: 50,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  progressTrackContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
    marginHorizontal: spacing.xs,
  },
  progressTrackBg: {
    height: 4.5,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 2.5,
    position: 'relative',
    overflow: 'hidden',
  },
  progressTrackFill: {
    height: '100%',
    backgroundColor: '#69F0AE',
    borderRadius: 2.5,
  },
  progressThumb: {
    position: 'absolute',
    top: 13,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#69F0AE',
    marginLeft: -7,
  },
  progressThumbActive: {
    top: 11,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#00E676',
    marginLeft: -9,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 3,
  },

  // Modals
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  modalSheetBox: {
    width: '88%',
    maxWidth: 380,
    backgroundColor: '#1C1C1E',
    borderRadius: 18,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: '#333333',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  modalItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  activeModalRow: {
    backgroundColor: 'rgba(105, 240, 174, 0.12)',
  },
  modalItemText: {
    color: '#DDDDDD',
    fontSize: 15,
  },
});
