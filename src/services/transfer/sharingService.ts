import { Share, Platform } from 'react-native';
import { SharingSession, TransferRecord } from '../../types/sharing';

class SharingService {
  private activeSession: SharingSession | null = null;
  private transferHistory: TransferRecord[] = [
    {
      id: 'tx_1',
      fileName: 'Project_Specification_2026.pdf',
      size: 2450000,
      progress: 1.0,
      speedMbps: 48.5,
      status: 'completed',
      timestamp: Date.now() - 1800000,
      direction: 'send',
    },
    {
      id: 'tx_2',
      fileName: 'IMG_20261115_102045.jpg',
      size: 4890000,
      progress: 1.0,
      speedMbps: 52.1,
      status: 'completed',
      timestamp: Date.now() - 3600000,
      direction: 'send',
    },
  ];

  startWifiServer(port: number = 8080): SharingSession {
    const pairCode = Math.floor(1000 + Math.random() * 9000).toString();
    const session: SharingSession = {
      id: `share_${Date.now()}`,
      mode: 'wifi_web',
      serverUrl: `http://192.168.1.105:${port}`,
      port,
      pairCode,
      isServerRunning: true,
      connectedClients: 1,
    };
    this.activeSession = session;
    return session;
  }

  stopWifiServer(): void {
    if (this.activeSession) {
      this.activeSession.isServerRunning = false;
      this.activeSession = null;
    }
  }

  getActiveSession(): SharingSession | null {
    return this.activeSession;
  }

  getTransferHistory(): TransferRecord[] {
    return [...this.transferHistory];
  }

  async shareViaSystem(filePath: string, title?: string): Promise<boolean> {
    try {
      await Share.share({
        title: title || 'Share via NexFile',
        url: `file://${filePath}`,
        message: `Sharing ${filePath.split('/').pop()} via NexFile Smart Manager`,
      });
      return true;
    } catch (e) {
      console.warn('Share error:', e);
      return false;
    }
  }
}

export const sharingService = new SharingService();

