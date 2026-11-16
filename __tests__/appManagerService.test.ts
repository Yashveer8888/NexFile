import { appManagerService } from '../src/services/app-manager/appManagerService';

describe('appManagerService', () => {
  test('returns installed applications with metadata', async () => {
    const apps = await appManagerService.getInstalledApps(false);
    expect(apps.length).toBeGreaterThan(0);

    const first = apps[0];
    expect(first.packageName).toBeDefined();
    expect(first.appName).toBeDefined();
    expect(first.versionName).toBeDefined();
    expect(first.size).toBeGreaterThan(0);
  });

  test('inspects standalone APK package', async () => {
    const apk = await appManagerService.inspectApk('/storage/emulated/0/Download/NexFile_Alpha_v1.0.apk');
    expect(apk.packageName).toBeDefined();
    expect(apk.targetSdkVersion).toBeGreaterThanOrEqual(30);
    expect(apk.permissions.length).toBeGreaterThan(0);
    expect(apk.size).toBeGreaterThan(0);
  });

  test('launches app and creates app backup', async () => {
    const launchResult = await appManagerService.launchApp('com.nexfile');
    expect(launchResult).toBe(true);

    const backupPath = await appManagerService.backupApp('com.nexfile', '/storage/emulated/0/Download/App_Backups');
    expect(backupPath).toContain('.apk');
    expect(backupPath).toContain('App_Backups');
  });
});

