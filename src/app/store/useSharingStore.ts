import { create } from 'zustand';
import { SharingSession, TransferRecord } from '../../types/sharing';
import { sharingService } from '../../services/transfer/sharingService';

interface SharingState {
  session: SharingSession | null;
  history: TransferRecord[];
  isServerActive: boolean;

  startServer: (port?: number) => void;
  stopServer: () => void;
  loadHistory: () => void;
  shareViaSystem: (filePath: string, title?: string) => Promise<boolean>;
}

export const useSharingStore = create<SharingState>((set, get) => ({
  session: null,
  history: sharingService.getTransferHistory(),
  isServerActive: false,

  startServer: (port = 8080) => {
    const session = sharingService.startWifiServer(port);
    set({ session, isServerActive: true });
  },

  stopServer: () => {
    sharingService.stopWifiServer();
    set({ session: null, isServerActive: false });
  },

  loadHistory: () => {
    set({ history: sharingService.getTransferHistory() });
  },

  shareViaSystem: async (filePath, title) => {
    return await sharingService.shareViaSystem(filePath, title);
  },
}));

