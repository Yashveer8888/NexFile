import { FileItem } from './file';

export type RootTabParamList = {
  RecentTab: undefined;
  FoldersTab: undefined;
  CloudTab: undefined;
  ToolsTab: undefined;
  SettingsTab: undefined;
};

export type RootStackParamList = {
  MainTabs: undefined;
  ImagesGalleryScreen: undefined;
  SearchScreen: { initialQuery?: string; category?: string } | undefined;
  FileDetailsModal: { file: FileItem };
  ChecksumModal: { file: FileItem };
  StorageAnalyzerScreen: undefined;
  PdfStudioScreen: { filePath?: string } | undefined;
  DocumentConverterScreen: { initialFile?: FileItem } | undefined;
  ArchiveManagerScreen: { archivePath?: string } | undefined;
  PrivateVaultScreen: undefined;
  MediaPlayerScreen: { file: FileItem; playlist?: FileItem[] };
  AppManagerScreen: undefined;
  FileSharingScreen: { selectedFiles?: FileItem[] } | undefined;
  AiAssistantScreen: undefined;
  ImageViewerScreen: { images: FileItem[]; initialIndex?: number };
};

