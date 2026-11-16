import { usePlayerStore } from '../src/app/store/usePlayerStore';

describe('usePlayerStore', () => {
  test('controls audio playback and queue navigation', () => {
    const store = usePlayerStore.getState();
    const firstTrack = store.queue[0];
    expect(firstTrack).toBeDefined();

    store.playTrack(firstTrack);
    expect(usePlayerStore.getState().playbackState).toBe('playing');
    expect(usePlayerStore.getState().currentTrack?.id).toBe(firstTrack.id);

    store.togglePlayPause();
    expect(usePlayerStore.getState().playbackState).toBe('paused');

    store.nextTrack();
    expect(usePlayerStore.getState().currentTrack?.id).toBe(store.queue[1].id);
  });

  test('toggles shuffle and cycles repeat modes', () => {
    const store = usePlayerStore.getState();
    expect(store.isShuffle).toBe(false);

    store.toggleShuffle();
    expect(usePlayerStore.getState().isShuffle).toBe(true);

    expect(store.repeatMode).toBe('off');
    store.toggleRepeat();
    expect(usePlayerStore.getState().repeatMode).toBe('all');
    store.toggleRepeat();
    expect(usePlayerStore.getState().repeatMode).toBe('one');
    store.toggleRepeat();
    expect(usePlayerStore.getState().repeatMode).toBe('off');
  });

  test('controls video playback speed and lock state', () => {
    const store = usePlayerStore.getState();
    store.setPlaybackSpeed(1.5);
    expect(usePlayerStore.getState().videoConfig.playbackSpeed).toBe(1.5);

    expect(store.isScreenLocked).toBe(false);
    store.toggleScreenLock();
    expect(usePlayerStore.getState().isScreenLocked).toBe(true);
  });

  test('rotates image and toggles slideshow', () => {
    const store = usePlayerStore.getState();
    expect(store.imageRotation).toBe(0);

    store.rotateImage();
    expect(usePlayerStore.getState().imageRotation).toBe(90);

    expect(store.slideshowActive).toBe(false);
    store.toggleSlideshow();
    expect(usePlayerStore.getState().slideshowActive).toBe(true);
  });
});

