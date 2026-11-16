import { formatBytes, formatDate, truncateMiddle, extractParentFolder } from '../src/utils/formatters';
import { getCategoryFromExtension, getCategoryTitle } from '../src/utils/fileTypes';

describe('formatters', () => {
  test('formatBytes handles zero and negative numbers', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(-10)).toBe('--');
    expect(formatBytes(NaN)).toBe('--');
  });

  test('formatBytes formats KB, MB, GB properly', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
    expect(formatBytes(10 * 1024 * 1024 * 1024)).toBe('10 GB');
  });

  test('truncateMiddle shortens long filenames with extension preserved', () => {
    const longName = 'A_Very_Long_Document_Name_With_Multiple_Words_2026.pdf';
    const truncated = truncateMiddle(longName, 25);
    expect(truncated).toContain('.pdf');
    expect(truncated.length).toBeLessThanOrEqual(25);
    expect(truncated).toContain('...');
  });

  test('formatDate returns valid readable date', () => {
    const now = Date.now();
    expect(formatDate(now)).toContain('Today');
    expect(formatDate(0)).toBe('--');
  });

  test('extractParentFolder returns only the immediate last folder name', () => {
    expect(extractParentFolder('/storage/emulated/0/DCIM/Camera/IMG_2026.jpg')).toBe('Camera');
    expect(extractParentFolder('/storage/emulated/0/Download/Telegram/document.pdf')).toBe('Telegram');
    expect(extractParentFolder('/storage/emulated/0/Download/invoice.pdf')).toBe('Download');
    expect(extractParentFolder('/storage/emulated/0/WhatsApp/Media/WhatsApp Documents/report.pdf')).toBe('WhatsApp Documents');
    expect(extractParentFolder('/storage/emulated/0/test.txt')).toBe('Internal Storage');
    expect(extractParentFolder('')).toBe('');
  });
});

describe('fileTypes', () => {
  test('correctly identifies file categories', () => {
    expect(getCategoryFromExtension('pdf')).toBe('documents');
    expect(getCategoryFromExtension('DOCX')).toBe('documents');
    expect(getCategoryFromExtension('png')).toBe('images');
    expect(getCategoryFromExtension('JPG')).toBe('images');
    expect(getCategoryFromExtension('mp4')).toBe('videos');
    expect(getCategoryFromExtension('mp3')).toBe('audio');
    expect(getCategoryFromExtension('zip')).toBe('archives');
    expect(getCategoryFromExtension('apk')).toBe('apks');
  });

  test('returns friendly category titles', () => {
    expect(getCategoryTitle('images')).toBe('Images');
    expect(getCategoryTitle('documents')).toBe('Documents');
    expect(getCategoryTitle('apks')).toBe('APKs');
    expect(getCategoryTitle('all')).toBe('All Files');
  });
});

