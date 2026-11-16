import { Share } from 'react-native';
import { sharingService } from '../src/services/transfer/sharingService';

describe('sharingService', () => {
  test('starts and stops Wi-Fi web transfer server', () => {
    expect(sharingService.getActiveSession()).toBeNull();

    const session = sharingService.startWifiServer(8080);
    expect(session.isServerRunning).toBe(true);
    expect(session.serverUrl).toContain('8080');
    expect(session.pairCode.length).toBe(4);

    expect(sharingService.getActiveSession()).toBeDefined();

    sharingService.stopWifiServer();
    expect(sharingService.getActiveSession()).toBeNull();
  });

  test('returns transfer records history', () => {
    const history = sharingService.getTransferHistory();
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].speedMbps).toBeGreaterThan(0);
    expect(history[0].status).toBe('completed');
  });

  test('triggers system sharing', async () => {
    jest.spyOn(Share, 'share').mockResolvedValueOnce({ action: Share.sharedAction, activityType: undefined });
    const result = await sharingService.shareViaSystem('/storage/emulated/0/Download/Project_Specification_2026.pdf');
    expect(result).toBe(true);
  });
});
