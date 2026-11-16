export type DocumentFilterType = 'original' | 'grayscale' | 'bw' | 'color';

export interface ScannedPage {
  id: string;
  uri: string;
  rotation: number; // 0, 90, 180, 270
  filter: DocumentFilterType;
  width?: number;
  height?: number;
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

