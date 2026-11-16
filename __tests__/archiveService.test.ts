import { archiveService } from '../src/services/archive/archiveService';

describe('archiveService', () => {
  test('lists archive contents and calculates compression ratio', async () => {
    const info = await archiveService.listContents('/storage/emulated/0/Download/Dataset_Archive_Q4.zip');
    expect(info.name).toBe('Dataset_Archive_Q4.zip');
    expect(info.totalFiles).toBeGreaterThan(0);
    expect(info.uncompressedSize).toBeGreaterThan(0);
    expect(info.compressedSize).toBeGreaterThan(0);
    expect(info.compressionRatio).toBeGreaterThanOrEqual(0);
  });

  test('creates a ZIP archive from source files', async () => {
    const sources = [
      '/storage/emulated/0/Documents/Contract_Agreement_Signed.pdf',
      '/storage/emulated/0/Documents/Meeting_Notes.txt',
    ];
    const dest = '/storage/emulated/0/Download/Test_Created.zip';
    const result = await archiveService.createArchive(sources, dest, 6);
    expect(result).toBe(dest);
  });

  test('extracts archive with selective entries filter', async () => {
    const archivePath = '/storage/emulated/0/Download/Dataset_Archive_Q4.zip';
    const dest = '/storage/emulated/0/Download/Extracted_Output';
    const selected = ['Documentation/README.md'];

    const extracted = await archiveService.extractArchive(archivePath, dest, selected);
    expect(extracted.length).toBe(1);
    expect(extracted[0]).toContain('README.md');
  });
});

