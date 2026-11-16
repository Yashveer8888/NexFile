import { cloudService } from '../src/services/cloud/cloudService';

describe('cloudService', () => {
  test('returns initial active connections', async () => {
    const list = await cloudService.getConnections();
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((c) => c.protocol === 'gdrive')).toBe(true);
  });

  test('adds and removes remote connections', async () => {
    const newConn = await cloudService.addConnection({
      name: 'Nextcloud Work',
      protocol: 'webdav',
      host: 'https://cloud.company.com/remote.php/webdav',
      username: 'analyst',
    });

    expect(newConn.id).toBeDefined();
    expect(newConn.isConnected).toBe(true);

    const listAfter = await cloudService.getConnections();
    expect(listAfter.some((c) => c.id === newConn.id)).toBe(true);

    await cloudService.removeConnection(newConn.id);
    const listFinal = await cloudService.getConnections();
    expect(listFinal.some((c) => c.id === newConn.id)).toBe(false);
  });

  test('lists remote directory files and handles download', async () => {
    const connections = await cloudService.getConnections();
    const gdrive = connections.find((c) => c.protocol === 'gdrive');
    expect(gdrive).toBeDefined();

    if (gdrive) {
      const files = await cloudService.listRemoteDirectory(gdrive.id, '/');
      expect(files.length).toBeGreaterThan(0);

      const downloaded = await cloudService.downloadRemoteFile(gdrive.id, files[1].path, '/storage/emulated/0/Download');
      expect(downloaded).toContain('/Download/');
    }
  });
});

