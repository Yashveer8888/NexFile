export type CloudProtocol =
  | 'gdrive'
  | 'onedrive'
  | 'dropbox'
  | 'webdav'
  | 'sftp'
  | 'ftp'
  | 'smb';

export interface CloudConnection {
  id: string;
  name: string;
  protocol: CloudProtocol;
  host?: string;
  port?: number;
  username?: string;
  remoteRoot?: string;
  isConnected: boolean;
  quotaTotal?: number;
  quotaUsed?: number;
}

export interface RemoteFileItem {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  lastModified: number;
  mimeType: string;
}

