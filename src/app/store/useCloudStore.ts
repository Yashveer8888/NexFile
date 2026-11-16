import { create } from 'zustand';
import { CloudConnection, RemoteFileItem } from '../../types/cloud';
import { cloudService } from '../../services/cloud/cloudService';

interface CloudState {
  connections: CloudConnection[];
  activeConnection: CloudConnection | null;
  remoteFiles: RemoteFileItem[];
  isLoading: boolean;

  loadConnections: () => Promise<void>;
  addConnection: (conn: Omit<CloudConnection, 'id' | 'isConnected'>) => Promise<CloudConnection>;
  removeConnection: (id: string) => Promise<void>;
  browseConnection: (conn: CloudConnection, path?: string) => Promise<void>;
  downloadFile: (remotePath: string) => Promise<string>;
  uploadFile: (localPath: string) => Promise<string>;
}

export const useCloudStore = create<CloudState>((set, get) => ({
  connections: [],
  activeConnection: null,
  remoteFiles: [],
  isLoading: false,

  loadConnections: async () => {
    const list = await cloudService.getConnections();
    set({ connections: list });
  },

  addConnection: async (conn) => {
    const newConn = await cloudService.addConnection(conn);
    await get().loadConnections();
    return newConn;
  },

  removeConnection: async (id) => {
    await cloudService.removeConnection(id);
    await get().loadConnections();
  },

  browseConnection: async (conn, path = '/') => {
    set({ activeConnection: conn, isLoading: true });
    try {
      const files = await cloudService.listRemoteDirectory(conn.id, path);
      set({ remoteFiles: files, isLoading: false });
    } catch (e) {
      console.warn('Browse remote directory error:', e);
      set({ isLoading: false });
    }
  },

  downloadFile: async (remotePath) => {
    const { activeConnection } = get();
    if (!activeConnection) throw new Error('No active connection');
    return await cloudService.downloadRemoteFile(activeConnection.id, remotePath);
  },

  uploadFile: async (localPath) => {
    const { activeConnection } = get();
    if (!activeConnection) throw new Error('No active connection');
    return await cloudService.uploadFileToRemote(activeConnection.id, localPath);
  },
}));

