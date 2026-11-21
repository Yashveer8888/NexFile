import { create } from 'zustand';
import {
  ScannedPage,
  PdfDocumentInfo,
  PdfAnnotation,
  DocumentFilterType,
} from '../../types/pdf';
import { pdfService } from '../../services/pdf/pdfService';

interface PdfState {
  // Scanner
  scannedPages: ScannedPage[];
  activePageIndex: number;
  addScannedPage: (uri: string) => void;
  removeScannedPage: (id: string) => void;
  rotateScannedPage: (id: string) => void;
  setPageFilter: (id: string, filter: DocumentFilterType) => void;
  reorderPages: (fromIndex: number, toIndex: number) => void;
  clearScanner: () => void;
  saveScannedPdf: (title: string, quality?: number, targetDirectory?: string) => Promise<string>;

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
      filter: 'original',
    };
    set((state) => ({
      scannedPages: [...state.scannedPages, newPage],
      activePageIndex: state.scannedPages.length,
    }));
  },

  removeScannedPage: (id: string) => {
    set((state) => {
      const filtered = state.scannedPages.filter((p) => p.id !== id);
      const nextIndex = Math.min(state.activePageIndex, Math.max(0, filtered.length - 1));
      return { scannedPages: filtered, activePageIndex: nextIndex };
    });
  },

  rotateScannedPage: (id: string) => {
    set((state) => ({
      scannedPages: state.scannedPages.map((p) =>
        p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p
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

  saveScannedPdf: async (title: string, quality: number = 85, targetDirectory?: string) => {
    const { scannedPages } = get();
    if (scannedPages.length === 0) throw new Error('No pages to save');

    const cleanTitle = title.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'Scanned_Doc';
    const folder = targetDirectory || '/storage/emulated/0/google drive files';
    const destPath = `${folder}/${cleanTitle}_${Date.now()}.pdf`;
    const imageUris = scannedPages.map((p) => p.uri);

    const resultPath = await pdfService.createPdfFromImages(imageUris, destPath, quality);
    get().clearScanner();
    return resultPath;
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
    if (!get().mergeList.includes(path)) {
      set((state) => ({ mergeList: [...state.mergeList, path] }));
    }
  },

  removeFromMerge: (path: string) => {
    set((state) => ({ mergeList: state.mergeList.filter((p) => p !== path) }));
  },

  clearMerge: () => {
    set({ mergeList: [] });
  },
}));

