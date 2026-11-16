import { FileItem } from './file';

export type AiIntentType =
  | 'find_files'
  | 'find_duplicates'
  | 'find_large_files'
  | 'organize_folder'
  | 'summarize_document'
  | 'extract_text'
  | 'storage_health'
  | 'unknown';

export interface AiActionRequest {
  id: string;
  type: 'organize' | 'cleanup' | 'move';
  title: string;
  description: string;
  affectedFiles: FileItem[];
  requiresConfirmation: boolean;
  isExecuted?: boolean;
}

export interface AiChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: number;
  intent?: AiIntentType;
  matchedFiles?: FileItem[];
  actionRequest?: AiActionRequest;
  auditLog?: string;
}

