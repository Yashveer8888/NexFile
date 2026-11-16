import { analyzerService } from '../src/services/analyzer/analyzerService';

describe('analyzerService', () => {
  test('runs full storage analysis with volume metrics and category breakdown', async () => {
    const report = await analyzerService.runFullAnalysis();

    expect(report.totalBytes).toBeGreaterThan(0);
    expect(report.usedBytes).toBeGreaterThan(0);
    expect(report.freeBytes).toBeGreaterThan(0);
    expect(report.totalBytes).toBeGreaterThanOrEqual(report.usedBytes);

    expect(report.categories.length).toBeGreaterThan(0);
    report.categories.forEach((cat) => {
      expect(cat.name).toBeDefined();
      expect(cat.color).toBeDefined();
      expect(cat.fileCount).toBeGreaterThanOrEqual(0);
      expect(cat.percentage).toBeGreaterThanOrEqual(0);
      expect(cat.percentage).toBeLessThanOrEqual(100);
    });
  });

  test('identifies large files matching threshold', async () => {
    const customThreshold = 10 * 1024 * 1024; // 10MB
    const report = await analyzerService.runFullAnalysis(customThreshold);

    expect(report.largeFiles).toBeDefined();
    expect(report.largeFiles.length).toBeGreaterThan(0);

    // Verify files are sorted descending by size
    for (let i = 0; i < report.largeFiles.length - 1; i++) {
      expect(report.largeFiles[i].size).toBeGreaterThanOrEqual(report.largeFiles[i + 1].size);
    }
  });

  test('identifies duplicate file groups and calculates reclaimable bytes', async () => {
    const report = await analyzerService.runFullAnalysis();

    expect(report.duplicateGroups.length).toBeGreaterThan(0);
    report.duplicateGroups.forEach((group) => {
      expect(group.hash).toBeDefined();
      expect(group.originalFile).toBeDefined();
      expect(group.duplicateFiles.length).toBeGreaterThan(0);
      expect(group.reclaimableBytes).toBeGreaterThan(0);
    });
  });

  test('discovers empty folders and old downloads', async () => {
    const report = await analyzerService.runFullAnalysis();

    expect(report.emptyFolders).toBeDefined();
    report.emptyFolders.forEach((folder) => {
      expect(folder.isDirectory).toBe(true);
      expect(folder.size).toBe(0);
    });

    expect(report.oldDownloads).toBeDefined();
    expect(report.totalReclaimableBytes).toBeGreaterThan(0);
  });
});

