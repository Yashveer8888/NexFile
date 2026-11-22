export type DocumentFilterType =
  | 'original'
  | 'magic_color'
  | 'bw'
  | 'grayscale'
  | 'lighten'
  | 'color';

export type ScanningMode =
  | 'document'
  | 'idcard'
  | 'book'
  | 'whiteboard'
  | 'qrcode';

export type PageSize = 'A4' | 'LETTER' | 'LEGAL' | 'IDCARD';

export type CompressionQuality = 'high' | 'medium' | 'low';

export interface PageCropCoords {
  tlX: number;
  tlY: number;
  trX: number;
  trY: number;
  brX: number;
  brY: number;
  blX: number;
  blY: number;
}

export interface ScannedPage {
  id: string;
  uri: string;
  rotation: number; // 0, 90, 180, 270
  filter: DocumentFilterType;
  brightness?: number; // -100 to +100
  contrast?: number; // -100 to +100
  crop?: PageCropCoords;
  pageSize?: PageSize;
  ocrText?: string;
  width?: number;
  height?: number;
}

export interface PdfAdvancedOptions {
  pageSize?: PageSize;
  watermarkText?: string;
  signaturePath?: string;
  signaturePage?: number;
  quality?: number; // 10 to 100
}

export interface PdfDocumentInfo {
  path: string;
  name: string;
  pageCount: number;
  size: number;
  author?: string;
  title?: string;
  isEncrypted?: boolean;
}

export type AnnotationType =
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'text'
  | 'drawing'
  | 'signature'
  | 'watermark';

export interface PdfAnnotation {
  id: string;
  pageIndex: number;
  type: AnnotationType;
  color: string;
  text?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[]; // for freehand drawings
}

export type SupportedConversionFormat =
  | 'pdf'
  | 'docx'
  | 'txt'
  | 'xlsx'
  | 'csv'
  | 'html'
  | 'jpg'
  | 'png'
  | 'webp'
  | 'heic';

export interface ConversionTask {
  id: string;
  sourcePath: string;
  sourceName: string;
  sourceFormat: SupportedConversionFormat;
  targetFormat: SupportedConversionFormat;
  status: 'pending' | 'converting' | 'completed' | 'error';
  progress: number; // 0 to 1
  outputPath?: string;
  error?: string;
  timestamp: number;
  size?: number;
}
