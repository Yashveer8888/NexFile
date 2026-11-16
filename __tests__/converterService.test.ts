import { converterService } from '../src/services/converter/converterService';

describe('converterService', () => {
  test('returns appropriate target formats for each source format', () => {
    const pdfTargets = converterService.getSupportedTargetFormats('pdf');
    expect(pdfTargets).toContain('docx');
    expect(pdfTargets).toContain('txt');
    expect(pdfTargets).toContain('jpg');

    const xlsxTargets = converterService.getSupportedTargetFormats('xlsx');
    expect(xlsxTargets).toContain('csv');
    expect(xlsxTargets).toContain('pdf');

    const imageTargets = converterService.getSupportedTargetFormats('jpg');
    expect(imageTargets).toContain('pdf');
    expect(imageTargets).toContain('png');
  });

  test('converts document formats with progress tracking', async () => {
    let progressLogged = 0;
    const result = await converterService.convert(
      '/storage/emulated/0/Download/Project_Specification_2026.pdf',
      'pdf',
      'docx',
      '/storage/emulated/0/Documents/Converted',
      (p) => {
        progressLogged = p;
      }
    );

    expect(result).toBe('/storage/emulated/0/Documents/Converted/Project_Specification_2026.docx');
    expect(progressLogged).toBe(1.0);
  });

  test('converts images to PDF', async () => {
    const result = await converterService.convert(
      '/storage/emulated/0/DCIM/Camera/IMG_20261115_102045.jpg',
      'jpg',
      'pdf',
      '/storage/emulated/0/Documents/Converted'
    );

    expect(result).toContain('.pdf');
  });
});

