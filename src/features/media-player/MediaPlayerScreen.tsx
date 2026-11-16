import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Volume2,
  Lock,
  Unlock,
  RotateCw,
  Info,
  Maximize2,
  Subtitles,
  Music,
  Video,
  Image as ImageIcon,
  ChevronLeft,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { usePlayerStore } from '../../app/store/usePlayerStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { ProgressBar } from '../../components/common/ProgressBar';
import { Badge } from '../../components/common/Badge';
import { formatBytes } from '../../utils/formatters';

const { width } = Dimensions.get('window');

export const MediaPlayerScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const {
    currentTrack,
    queue,
    playbackState,
    position,
    duration,
    isShuffle,
    repeatMode,
    playTrack,
    togglePlayPause,
    nextTrack,
    prevTrack,
    toggleShuffle,
    toggleRepeat,
    activeVideo,
    videoConfig,
    isVideoPlaying,
    isScreenLocked,
    toggleVideoPlay,
    setPlaybackSpeed,
    toggleScreenLock,
    toggleSubtitles,
    activeImage,
    imageRotation,
    slideshowActive,
    rotateImage,
    toggleSlideshow,
  } = usePlayerStore();

  const [activeMediaTab, setActiveMediaTab] = useState<'video' | 'audio' | 'image'>('audio');
  const [exifModalVisible, setExifModalVisible] = useState(false);

  const activeAudioTrack = currentTrack || queue[0];

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Header
        title="Built-in Media Player"
        subtitle={activeMediaTab.toUpperCase()}
        showBack
        onBack={() => navigation.goBack()}
        showThemeToggle
      />

      {/* Media Type Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeMediaTab === 'audio' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveMediaTab('audio')}
        >
          <Music size={18} color={activeMediaTab === 'audio' ? colors.primary : colors.textMuted} />
          <Text style={[typography.labelMedium, { color: activeMediaTab === 'audio' ? colors.primary : colors.textMuted, marginLeft: 6 }]}>
            Audio
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeMediaTab === 'video' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveMediaTab('video')}
        >
          <Video size={18} color={activeMediaTab === 'video' ? colors.primary : colors.textMuted} />
          <Text style={[typography.labelMedium, { color: activeMediaTab === 'video' ? colors.primary : colors.textMuted, marginLeft: 6 }]}>
            Video
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeMediaTab === 'image' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveMediaTab('image')}
        >
          <ImageIcon size={18} color={activeMediaTab === 'image' ? colors.primary : colors.textMuted} />
          <Text style={[typography.labelMedium, { color: activeMediaTab === 'image' ? colors.primary : colors.textMuted, marginLeft: 6 }]}>
            Image
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeMediaTab === 'audio' ? (
          /* Audio Music Player */
          <View style={styles.audioContainer}>
            <View style={[styles.albumDisk, { backgroundColor: colors.card, borderColor: colors.primary }]}>
              <View style={[styles.albumInner, { backgroundColor: colors.primaryLight }]}>
                <Music size={54} color={colors.primary} />
              </View>
            </View>

            <Text style={[typography.h2, { color: colors.text, marginTop: spacing.xl, textAlign: 'center' }]} numberOfLines={1}>
              {activeAudioTrack.title}
            </Text>
            <Text style={[typography.bodyMedium, { color: colors.textSecondary, marginTop: 4, textAlign: 'center' }]}>
              {activeAudioTrack.artist} • {activeAudioTrack.album}
            </Text>

            {/* Seek Bar */}
            <View style={styles.seekRow}>
              <ProgressBar progress={duration > 0 ? position / duration : 0.3} color={colors.primary} />
              <View style={styles.timeLabels}>
                <Text style={[typography.labelSmall, { color: colors.textMuted }]}>{formatTime(position)}</Text>
                <Text style={[typography.labelSmall, { color: colors.textMuted }]}>{formatTime(duration)}</Text>
              </View>
            </View>

            {/* Playback Controls */}
            <View style={styles.audioControlsRow}>
              <TouchableOpacity onPress={toggleShuffle} style={styles.controlSubBtn}>
                <Shuffle size={20} color={isShuffle ? colors.primary : colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity onPress={prevTrack} style={styles.controlSkipBtn}>
                <SkipBack size={26} color={colors.text} />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={togglePlayPause}
                style={[styles.mainPlayBtn, { backgroundColor: colors.primary }]}
              >
                {playbackState === 'playing' ? (
                  <Pause size={30} color="#FFFFFF" fill="#FFFFFF" />
                ) : (
                  <Play size={30} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 3 }} />
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={nextTrack} style={styles.controlSkipBtn}>
                <SkipForward size={26} color={colors.text} />
              </TouchableOpacity>

              <TouchableOpacity onPress={toggleRepeat} style={styles.controlSubBtn}>
                <Repeat size={20} color={repeatMode !== 'off' ? colors.primary : colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Playlist Queue */}
            <Text style={[typography.h3, { color: colors.text, marginTop: spacing.xxl, marginBottom: spacing.md }]}>
              Music Queue ({queue.length})
            </Text>
            {queue.map((track) => (
              <TouchableOpacity
                key={track.id}
                style={[
                  styles.trackRow,
                  {
                    backgroundColor: activeAudioTrack.id === track.id ? colors.primaryLight : colors.card,
                    borderColor: colors.cardBorder,
                  },
                ]}
                onPress={() => playTrack(track)}
              >
                <Music size={18} color={activeAudioTrack.id === track.id ? colors.primary : colors.textMuted} />
                <View style={styles.trackDetails}>
                  <Text style={[typography.labelMedium, { color: colors.text }]}>{track.title}</Text>
                  <Text style={[typography.labelSmall, { color: colors.textMuted }]}>{track.artist}</Text>
                </View>
                <Text style={[typography.labelSmall, { color: colors.textMuted }]}>
                  {formatTime(track.duration)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : activeMediaTab === 'video' ? (
          /* Video Player View */
          <View style={styles.videoContainer}>
            <View style={[styles.videoViewport, { backgroundColor: '#000000' }]}>
              <View style={styles.mockVideoGraphic}>
                <Video size={48} color="#FFFFFF" style={{ opacity: 0.8 }} />
                <Text style={[typography.labelMedium, { color: '#FFFFFF', marginTop: 8 }]}>
                  1080p 60fps • Hardware Decoded
                </Text>
              </View>

              {/* Video Overlay Controls */}
              <View style={styles.videoOverlay}>
                <View style={styles.videoTopRow}>
                  <TouchableOpacity onPress={toggleScreenLock} style={styles.videoOverlayBtn}>
                    {isScreenLocked ? <Lock size={18} color="#FF5252" /> : <Unlock size={18} color="#FFFFFF" />}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={toggleSubtitles} style={styles.videoOverlayBtn}>
                    <Subtitles size={18} color={videoConfig.showSubtitles ? '#69F0AE' : '#FFFFFF'} />
                  </TouchableOpacity>
                </View>

                {!isScreenLocked && (
                  <TouchableOpacity onPress={toggleVideoPlay} style={styles.videoCenterPlay}>
                    {isVideoPlaying ? (
                      <Pause size={36} color="#FFFFFF" />
                    ) : (
                      <Play size={36} color="#FFFFFF" fill="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                )}

                <View style={styles.videoBottomRow}>
                  <ProgressBar progress={0.45} color={colors.primary} />
                </View>
              </View>
            </View>

            {/* Video Settings */}
            <View style={styles.speedRow}>
              <Text style={[typography.labelMedium, { color: colors.text }]}>Playback Speed:</Text>
              {[0.5, 1.0, 1.25, 1.5, 2.0].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.speedPill,
                    {
                      backgroundColor: videoConfig.playbackSpeed === s ? colors.primary : colors.surfaceVariant,
                    },
                  ]}
                  onPress={() => setPlaybackSpeed(s)}
                >
                  <Text style={[typography.labelSmall, { color: videoConfig.playbackSpeed === s ? '#FFFFFF' : colors.text }]}>
                    {s}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          /* Image Viewer */
          <View style={styles.imageContainer}>
            <View style={[styles.imageViewArea, { backgroundColor: colors.card }]}>
              <View
                style={[
                  styles.imageMockBox,
                  {
                    backgroundColor: colors.surfaceVariant,
                    transform: [{ rotate: `${imageRotation}deg` }],
                  },
                ]}
              >
                <ImageIcon size={64} color={colors.imageColor} />
                <Text style={[typography.labelMedium, { color: colors.text, marginTop: 8 }]}>
                  IMG_20261115_102045.jpg
                </Text>
                <Text style={[typography.labelSmall, { color: colors.textMuted }]}>
                  4032 x 3024 • 12 MP
                </Text>
              </View>
            </View>

            {/* Image Toolbar */}
            <View style={styles.imageToolbar}>
              <Button
                title="Rotate 90°"
                variant="outline"
                icon={<RotateCw size={16} color={colors.text} />}
                onPress={rotateImage}
                style={{ flex: 1 }}
              />
              <Button
                title={slideshowActive ? 'Stop Slideshow' : 'Start Slideshow'}
                variant={slideshowActive ? 'danger' : 'primary'}
                onPress={toggleSlideshow}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    height: 48,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing.xxxl,
  },
  audioContainer: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  albumDisk: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.lg,
  },
  albumInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekRow: {
    width: '100%',
    marginTop: spacing.xl,
  },
  timeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  audioControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '85%',
    marginTop: spacing.xl,
  },
  controlSubBtn: {
    padding: spacing.sm,
  },
  controlSkipBtn: {
    padding: spacing.sm,
  },
  mainPlayBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.md,
  },
  trackRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  trackDetails: {
    flex: 1,
    marginLeft: spacing.md,
  },
  videoContainer: {
    alignItems: 'center',
  },
  videoViewport: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockVideoGraphic: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  videoTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  videoOverlayBtn: {
    padding: spacing.xs,
  },
  videoCenterPlay: {
    alignSelf: 'center',
  },
  videoBottomRow: {
    width: '100%',
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    width: '100%',
  },
  speedPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  imageContainer: {
    alignItems: 'center',
  },
  imageViewArea: {
    width: '100%',
    height: 380,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageMockBox: {
    width: '85%',
    height: '85%',
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageToolbar: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.base,
    width: '100%',
  },
});
