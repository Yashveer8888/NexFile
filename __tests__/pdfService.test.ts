import { pdfService } from '../src/services/pdf/pdfService';

describe('pdfService', () => {
  test('returns PDF page count', async () => {
    const pageCount = await pdfService.getPdfPageCount('/storage/emulated/0/Download/Project_Specification_2026.pdf');
    expect(pageCount).toBeGreaterThan(0);
    expect(typeof pageCount).toBe('number');
  });

  test('creates PDF from images', async () => {
    const sampleImages = [
      '/storage/emulated/0/DCIM/Camera/IMG_20261115_102045.jpg',
      '/storage/emulated/0/DCIM/Camera/IMG_20261115_091530.jpg',
    ];
    const dest = '/storage/emulated/0/Documents/Output_Jest_Doc.pdf';
    const result = await pdfService.createPdfFromImages(sampleImages, dest, 90);
    expect(result).toBe(dest);
  });

  test('adds watermark to PDF', async () => {
    const source = '/storage/emulated/0/Download/Project_Specification_2026.pdf';
    const dest = '/storage/emulated/0/Documents/Watermarked.pdf';
    const result = await pdfService.addWatermark(source, dest, 'CONFIDENTIAL');
    expect(result).toBe(dest);
  });

  test('merges multiple PDF files', async () => {
    const sources = [
      '/storage/emulated/0/Download/Project_Specification_2026.pdf',
      '/storage/emulated/0/Documents/Contract_Agreement_Signed.pdf',
    ];
    const dest = '/storage/emulated/0/Documents/Merged_Document.pdf';
    const result = await pdfService.mergePdfs(sources, dest);
    expect(result).toBe(dest);
  });

  test('splits PDF into specified page ranges', async () => {
    const source = '/storage/emulated/0/Download/Project_Specification_2026.pdf';
    const ranges = [
      { from: 1, to: 2 },
      { from: 3, to: 4 },
    ];
    const results = await pdfService.splitPdf(source, '/storage/emulated/0/Documents', ranges);
    expect(results.length).toBe(2);
    expect(results[0]).toContain('part_1');
    expect(results[1]).toContain('part_2');
  });

  test('compresses PDF and returns saved percentage', async () => {
    const source = '/storage/emulated/0/Download/Project_Specification_2026.pdf';
    const dest = '/storage/emulated/0/Documents/Compressed.pdf';
    const stats = await pdfService.compressPdf(source, dest, 'medium');

    expect(stats.path).toBe(dest);
    expect(stats.originalSize).toBeGreaterThan(stats.newSize);
    expect(stats.savedPercent).toBeGreaterThan(0);
  });

  test('extracts text using local OCR engine', async () => {
    const ocrText = await pdfService.extractTextOcr('/storage/emulated/0/Download/Project_Specification_2026.pdf', 0);
    expect(ocrText).toContain('OCR');
    expect(ocrText.length).toBeGreaterThan(20);
  });
});

