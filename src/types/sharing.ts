export interface SharingSession {
  id: string;
  mode: 'wifi_web' | 'qr_pair' | 'system_share';
  serverUrl?: string;
  port: number;
  pairCode: string;
  isServerRunning: boolean;
  connectedClients: number;
}

export interface TransferRecord {
  id: string;
  fileName: string;
  size: number;
  progress: number;
  speedMbps: number;
  status: 'transferring' | 'completed' | 'paused' | 'failed';
  timestamp: number;
  direction: 'send' | 'receive';
}

