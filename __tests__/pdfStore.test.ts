import { usePdfStore } from '../src/app/store/usePdfStore';

describe('usePdfStore', () => {
  beforeEach(() => {
    usePdfStore.getState().clearScanner();
  });

  test('adds, rotates, and filters scanned pages', () => {
    const store = usePdfStore.getState();
    store.addScannedPage('file:///storage/emulated/0/DCIM/Camera/IMG_01.jpg');

    let pages = usePdfStore.getState().scannedPages;
    expect(pages.length).toBe(1);
    expect(pages[0].rotation).toBe(0);
    expect(pages[0].filter).toBe('original');

    store.rotateScannedPage(pages[0].id);
    pages = usePdfStore.getState().scannedPages;
    expect(pages[0].rotation).toBe(90);

    store.setPageFilter(pages[0].id, 'grayscale');
    pages = usePdfStore.getState().scannedPages;
    expect(pages[0].filter).toBe('grayscale');
  });

  test('reorders and removes scanned pages', () => {
    const store = usePdfStore.getState();
    store.addScannedPage('file:///page1.jpg');
    store.addScannedPage('file:///page2.jpg');

    let pages = usePdfStore.getState().scannedPages;
    expect(pages.length).toBe(2);

    store.reorderPages(0, 1);
    pages = usePdfStore.getState().scannedPages;
    expect(pages[0].uri).toBe('file:///page2.jpg');
    expect(pages[1].uri).toBe('file:///page1.jpg');

    store.removeScannedPage(pages[0].id);
    pages = usePdfStore.getState().scannedPages;
    expect(pages.length).toBe(1);
    expect(pages[0].uri).toBe('file:///page1.jpg');
  });

  test('manages PDF annotations and watermark', () => {
    const store = usePdfStore.getState();
    store.addAnnotation({
      pageIndex: 0,
      type: 'highlight',
      color: '#FFEB3B',
      x: 10,
      y: 20,
    });

    let annots = usePdfStore.getState().annotations;
    expect(annots.length).toBe(1);
    expect(annots[0].type).toBe('highlight');

    store.setWatermarkText('TEST_WATERMARK');
    expect(usePdfStore.getState().watermarkText).toBe('TEST_WATERMARK');
  });
});

