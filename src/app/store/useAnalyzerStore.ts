import { create } from 'zustand';
import { StorageAnalysisReport } from '../../types/analyzer';
import { analyzerService } from '../../services/analyzer/analyzerService';
import { fileService } from '../../services/filesystem/fileService';

interface AnalyzerState {
  report: StorageAnalysisReport | null;
  isLoading: boolean;
  selectedLargeThresholdMb: number;

  runAnalysis: () => Promise<void>;
  cleanDuplicates: (groupId: string) => Promise<void>;
  cleanOldDownloads: () => Promise<void>;
  deleteEmptyFolder: (path: string) => Promise<void>;
}

export const useAnalyzerStore = create<AnalyzerState>((set, get) => ({
  report: null,
  isLoading: false,
  selectedLargeThresholdMb: 50,

  runAnalysis: async () => {
    set({ isLoading: true });
    try {
      const rep = await analyzerService.runFullAnalysis(get().selectedLargeThresholdMb * 1024 * 1024);
      set({ report: rep, isLoading: false });
    } catch (e) {
      console.warn('Storage analysis error:', e);
      set({ isLoading: false });
    }
  },

  cleanDuplicates: async (groupId: string) => {
    const { report } = get();
    if (!report) return;

    const group = report.duplicateGroups.find((g) => g.id === groupId);
    if (!group) return;

    for (const dup of group.duplicateFiles) {
      await fileService.delete(dup.path, true);
    }

    await get().runAnalysis();
  },

  cleanOldDownloads: async () => {
    const { report } = get();
    if (!report) return;

    for (const f of report.oldDownloads) {
      await fileService.delete(f.path, true);
    }

    await get().runAnalysis();
  },

  deleteEmptyFolder: async (path: string) => {
    await fileService.delete(path, false);
    await get().runAnalysis();
  },
}));

