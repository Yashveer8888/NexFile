import { create } from 'zustand';
import {
  ScannedPage,
  PdfDocumentInfo,
  PdfAnnotation,
  DocumentFilterType,
  PageCropCoords,
  PageSize,
  PdfAdvancedOptions,
} from '../../types/pdf';
import { pdfService } from '../../services/pdf/pdfService';
import { fileService } from '../../services/filesystem/fileService';

interface SavePdfOptions {
  quality?: number;
  pageSize?: PageSize;
  watermarkText?: string;
  signaturePath?: string;
  signaturePage?: number;
  targetDirectory?: string;
  format?: 'pdf' | 'images' | 'txt';
}

interface PdfState {
  // Scanner
  scannedPages: ScannedPage[];
  activePageIndex: number;
  addScannedPage: (uri: string) => void;
  addScannedPages: (uris: string[]) => void;
  removeScannedPage: (id: string) => void;
  rotateScannedPage: (id: string, degrees?: number) => void;
  setPageFilter: (id: string, filter: DocumentFilterType) => void;
  setPageAdjustments: (id: string, brightness: number, contrast: number) => void;
  setPageCrop: (id: string, crop: PageCropCoords) => void;
  setPageSize: (id: string, pageSize: PageSize) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  clearScanner: () => void;
  saveScannedPdf: (title: string, options?: SavePdfOptions | number, targetDirFallback?: string) => Promise<string>;
  combineIdCardPages: (frontIndex: number, backIndex: number) => Promise<string>;

  // Viewer & Editor
  currentDoc: PdfDocumentInfo | null;
  currentPage: number;
  totalPages: number;
  annotations: PdfAnnotation[];
  zoomLevel: number;
  watermarkText: string;
  loadDocument: (path: string) => Promise<void>;
  setCurrentPage: (page: number) => void;
  setZoomLevel: (zoom: number) => void;
  addAnnotation: (annotation: Omit<PdfAnnotation, 'id'>) => void;
  removeAnnotation: (id: string) => void;
  setWatermarkText: (text: string) => void;

  // Merge & Split Utilities
  mergeList: string[];
  addToMerge: (path: string) => void;
  removeFromMerge: (path: string) => void;
  clearMerge: () => void;
}

export const usePdfStore = create<PdfState>((set, get) => ({
  scannedPages: [],
  activePageIndex: 0,

  addScannedPage: (uri: string) => {
    const newPage: ScannedPage = {
      id: `page_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      uri,
      rotation: 0,
      filter: 'magic_color',
      brightness: 0,
      contrast: 0,
      pageSize: 'A4',
    };
    set((state) => ({
      scannedPages: [...state.scannedPages, newPage],
      activePageIndex: state.scannedPages.length,
    }));
  },

  addScannedPages: (uris: string[]) => {
    if (!uris || uris.length === 0) return;
    const newPages: ScannedPage[] = uris.map((uri, idx) => ({
      id: `page_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      uri,
      rotation: 0,
      filter: 'magic_color',
      brightness: 0,
      contrast: 0,
      pageSize: 'A4',
    }));
    set((state) => ({
      scannedPages: [...state.scannedPages, ...newPages],
      activePageIndex: state.scannedPages.length + newPages.length - 1,
    }));
  },

  removeScannedPage: (id: string) => {
    set((state) => {
      const filtered = state.scannedPages.filter((p) => p.id !== id);
      const nextIndex = Math.min(state.activePageIndex, Math.max(0, filtered.length - 1));
      return { scannedPages: filtered, activePageIndex: nextIndex };
    });
  },

  rotateScannedPage: (id: string, degrees?: number) => {
    const deg = degrees !== undefined ? degrees : 90;
    set((state) => ({
      scannedPages: state.scannedPages.map((p) =>
        p.id === id ? { ...p, rotation: (p.rotation + deg + 360) % 360 } : p
      ),
    }));
  },

  setPageFilter: (id: string, filter: DocumentFilterType) => {
    set((state) => ({
      scannedPages: state.scannedPages.map((p) =>
        p.id === id ? { ...p, filter } : p
      ),
    }));
  },

  setPageAdjustments: (id: string, brightness: number, contrast: number) => {
    set((state) => ({
      scannedPages: state.scannedPages.map((p) =>
        p.id === id ? { ...p, brightness, contrast } : p
      ),
    }));
  },

  setPageCrop: (id: string, crop: PageCropCoords) => {
    set((state) => ({
      scannedPages: state.scannedPages.map((p) =>
        p.id === id ? { ...p, crop } : p
      ),
    }));
  },

  setPageSize: (id: string, pageSize: PageSize) => {
    set((state) => ({
      scannedPages: state.scannedPages.map((p) =>
        p.id === id ? { ...p, pageSize } : p
      ),
    }));
  },

  reorderPages: (fromIndex: number, toIndex: number) => {
    set((state) => {
      const updated = [...state.scannedPages];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return { scannedPages: updated };
    });
  },

  clearScanner: () => {
    set({ scannedPages: [], activePageIndex: 0 });
  },

  combineIdCardPages: async (frontIndex: number, backIndex: number) => {
    const { scannedPages } = get();
    const front = scannedPages[frontIndex];
    const back = scannedPages[backIndex];
    if (!front || !back) throw new Error('Both Front and Back pages are required for ID Card mode');

    const destPath = `/storage/emulated/0/.temp/idcard_combined_${Date.now()}.jpg`;
    const combinedPath = await pdfService.combineIdCardSides(front.uri, back.uri, destPath);

    // Replace the two pages with the combined single page
    const combinedPage: ScannedPage = {
      id: `idcard_${Date.now()}`,
      uri: combinedPath,
      rotation: 0,
      filter: 'original',
      pageSize: 'A4',
    };

    set((state) => {
      const remaining = state.scannedPages.filter((_, idx) => idx !== frontIndex && idx !== backIndex);
      return {
        scannedPages: [combinedPage, ...remaining],
        activePageIndex: 0,
      };
    });

    return combinedPath;
  },

  saveScannedPdf: async (
    title: string,
    optionsOrQuality?: SavePdfOptions | number,
    targetDirFallback?: string
  ) => {
    const { scannedPages } = get();
    if (scannedPages.length === 0) throw new Error('No pages to save');

    const options: SavePdfOptions =
      typeof optionsOrQuality === 'object' && optionsOrQuality !== null
        ? optionsOrQuality
        : {
            quality: typeof optionsOrQuality === 'number' ? optionsOrQuality : 85,
            targetDirectory: targetDirFallback,
          };

    const cleanTitle = title.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'Scanned_Doc';
    const folder = options.targetDirectory || '/storage/emulated/0/google drive files';
    const exportFormat = options.format || 'pdf';

    // 1. Process all pages with their individual filters, rotation & perspective crops
    const processedPaths: string[] = [];
    for (let i = 0; i < scannedPages.length; i++) {
      const page = scannedPages[i];
      const pageDest = `/storage/emulated/0/.temp/proc_page_${i}_${Date.now()}.jpg`;
      const finalImg = await pdfService.processDocumentImage(page.uri, pageDest, {
        filter: page.filter,
        brightness: page.brightness || 0,
        contrast: page.contrast || 0,
        rotation: page.rotation || 0,
        crop: page.crop,
        pageSize: page.pageSize || options.pageSize || 'A4',
        quality: options.quality || 90,
      });
      processedPaths.push(finalImg);
    }

    // 2. Export based on format:
    if (exportFormat === 'images') {
      // Export each page as standalone image in target folder
      for (let i = 0; i < processedPaths.length; i++) {
        const destImg = `${folder}/${cleanTitle}_page_${i + 1}.jpg`;
        await fileService.copy(processedPaths[i], folder);
      }
      get().clearScanner();
      return `${folder}/${cleanTitle}_page_1.jpg`;
    }

    if (exportFormat === 'txt') {
      // Extract OCR text from all pages and save as TXT
      let fullText = `DOCUMENT: ${cleanTitle}\nDATE: ${new Date().toLocaleString()}\n=====================================\n\n`;
      for (let i = 0; i < processedPaths.length; i++) {
        const pageText = await pdfService.extractTextFromImage(processedPaths[i]);
        fullText += `--- PAGE ${i + 1} ---\n${pageText}\n\n`;
      }
      const txtPath = `${folder}/${cleanTitle}.txt`;
      await fileService.createFile(folder, `${cleanTitle}.txt`, fullText);
      get().clearScanner();
      return txtPath;
    }

    // 3. Default: Export as PDF with watermark, signature, and page size
    const destPdfPath = `${folder}/${cleanTitle}_${Date.now()}.pdf`;
    const resultPdf = await pdfService.createPdfWithAdvancedOptions(processedPaths, destPdfPath, {
      pageSize: options.pageSize || 'A4',
      watermarkText: options.watermarkText,
      signaturePath: options.signaturePath,
      signaturePage: options.signaturePage ?? 0,
      quality: options.quality || 90,
    });

    get().clearScanner();
    return resultPdf;
  },

  currentDoc: null,
  currentPage: 1,
  totalPages: 1,
  annotations: [],
  zoomLevel: 1.0,
  watermarkText: '',

  loadDocument: async (path: string) => {
    const fileName = path.split('/').pop() || 'document.pdf';
    const pageCount = await pdfService.getPdfPageCount(path);

    set({
      currentDoc: {
        path,
        name: fileName,
        pageCount,
        size: 2450000,
        title: fileName.replace('.pdf', ''),
      },
      currentPage: 1,
      totalPages: pageCount,
      annotations: [],
      zoomLevel: 1.0,
    });
  },

  setCurrentPage: (page: number) => {
    const clamped = Math.max(1, Math.min(get().totalPages, page));
    set({ currentPage: clamped });
  },

  setZoomLevel: (zoom: number) => {
    const clamped = Math.max(0.5, Math.min(3.0, zoom));
    set({ zoomLevel: clamped });
  },

  addAnnotation: (annotation: Omit<PdfAnnotation, 'id'>) => {
    const newAnnotation: PdfAnnotation = {
      ...annotation,
      id: `annot_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    };
    set((state) => ({ annotations: [...state.annotations, newAnnotation] }));
  },

  removeAnnotation: (id: string) => {
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
    }));
  },

  setWatermarkText: (watermarkText: string) => {
    set({ watermarkText });
  },

  mergeList: [],
  addToMerge: (path: string) => {
    set((state) => ({ mergeList: [...state.mergeList, path] }));
  },
  removeFromMerge: (path: string) => {
    set((state) => ({ mergeList: state.mergeList.filter((p) => p !== path) }));
  },
  clearMerge: () => {
    set({ mergeList: [] });
  },
}));
