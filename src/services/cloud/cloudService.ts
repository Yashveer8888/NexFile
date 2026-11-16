import { CloudConnection, RemoteFileItem, CloudProtocol } from '../../types/cloud';

class CloudService {
  private connections: CloudConnection[] = [
    {
      id: 'gdrive_default',
      name: 'Google Drive (Personal)',
      protocol: 'gdrive',
      username: 'user@gmail.com',
      isConnected: true,
      quotaTotal: 15 * 1024 * 1024 * 1024,
      quotaUsed: 8.4 * 1024 * 1024 * 1024,
    },
    {
      id: 'sftp_nas',
      name: 'Home Media Server (SFTP)',
      protocol: 'sftp',
      host: '192.168.1.100',
      port: 22,
      username: 'root',
      remoteRoot: '/var/storage',
      isConnected: true,
      quotaTotal: 2000 * 1024 * 1024 * 1024,
      quotaUsed: 640 * 1024 * 1024 * 1024,
    },
  ];

  async getConnections(): Promise<CloudConnection[]> {
    return [...this.connections];
  }

  async addConnection(conn: Omit<CloudConnection, 'id' | 'isConnected'>): Promise<CloudConnection> {
    const newConn: CloudConnection = {
      ...conn,
      id: `conn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      isConnected: true,
    };
    this.connections.push(newConn);
    return newConn;
  }

  async removeConnection(id: string): Promise<void> {
    this.connections = this.connections.filter((c) => c.id !== id);
  }

  async listRemoteDirectory(connectionId: string, remotePath: string = '/'): Promise<RemoteFileItem[]> {
    const conn = this.connections.find((c) => c.id === connectionId);
    if (!conn) throw new Error('Cloud connection not found');

    const now = Date.now();

    if (conn.protocol === 'gdrive') {
      return [
        { id: 'rem_g1', name: 'Work Documents', path: '/Work Documents', isDirectory: true, size: 0, lastModified: now - 3600000, mimeType: 'inode/directory' },
        { id: 'rem_g2', name: 'Annual_Financial_Audit_2026.pdf', path: '/Annual_Financial_Audit_2026.pdf', isDirectory: false, size: 3450000, lastModified: now - 7200000, mimeType: 'application/pdf' },
        { id: 'rem_g3', name: 'Quarterly_Presentation.pptx', path: '/Quarterly_Presentation.pptx', isDirectory: false, size: 14200000, lastModified: now - 86400000, mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
      ];
    }

    return [
      { id: 'rem_s1', name: 'backups', path: '/backups', isDirectory: true, size: 0, lastModified: now - 5000000, mimeType: 'inode/directory' },
      { id: 'rem_s2', name: 'server_database_dump.sql.gz', path: '/server_database_dump.sql.gz', isDirectory: false, size: 92400000, lastModified: now - 12000000, mimeType: 'application/gzip' },
      { id: 'rem_s3', name: 'config_nginx.conf', path: '/config_nginx.conf', isDirectory: false, size: 18500, lastModified: now - 25000000, mimeType: 'text/plain' },
    ];
  }

  async downloadRemoteFile(
    connectionId: string,
    remotePath: string,
    localDestDir: string = '/storage/emulated/0/Download'
  ): Promise<string> {
    const fileName = remotePath.split('/').pop() || 'downloaded_file';
    return `${localDestDir}/${fileName}`;
  }

  async uploadFileToRemote(
    connectionId: string,
    localPath: string,
    remoteDestDir: string = '/'
  ): Promise<string> {
    const fileName = localPath.split('/').pop() || 'uploaded_file';
    return `${remoteDestDir}/${fileName}`;
  }
}

export const cloudService = new CloudService();

