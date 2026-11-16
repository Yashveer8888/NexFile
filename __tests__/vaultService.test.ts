import { vaultService } from '../src/services/encryption/vaultService';
import { useVaultStore } from '../src/app/store/useVaultStore';

describe('vaultService and useVaultStore', () => {
  test('hashes pin deterministically', () => {
    const hash1 = vaultService.hashPin('1234');
    const hash2 = vaultService.hashPin('1234');
    const hash3 = vaultService.hashPin('9999');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
  });

  test('encrypts and decrypts files with valid PIN', async () => {
    const source = '/storage/emulated/0/DCIM/Camera/Passport_Scan.jpg';
    const encryptedDest = '/storage/emulated/0/.vault/nvlt_passport.nvlt';
    const pin = '1234';

    const encResult = await vaultService.encryptFile(source, encryptedDest, pin);
    expect(encResult).toBe(encryptedDest);

    const decryptedDest = '/storage/emulated/0/Documents/Passport_Decrypted.jpg';
    const decResult = await vaultService.decryptFile(encryptedDest, decryptedDest, pin);
    expect(decResult).toBe(decryptedDest);
  });

  test('validates vault unlocking and auto-lock state', () => {
    const store = useVaultStore.getState();
    store.lockVault();
    expect(useVaultStore.getState().isUnlocked).toBe(false);

    const invalid = store.unlockWithPin('0000');
    expect(invalid).toBe(false);
    expect(useVaultStore.getState().isUnlocked).toBe(false);

    const valid = store.unlockWithPin('1234');
    expect(valid).toBe(true);
    expect(useVaultStore.getState().isUnlocked).toBe(true);
  });

  test('imports and exports vault items', async () => {
    const store = useVaultStore.getState();
    const item = await store.importFileToVault('/storage/emulated/0/Download/Financial_Summary_2026.xlsx', '1234');
    expect(item).toBeDefined();
    expect(item.name).toBe('Financial_Summary_2026.xlsx');

    const exported = await store.exportFileFromVault(item.id, '/storage/emulated/0/Documents', '1234');
    expect(exported).toContain('Financial_Summary_2026.xlsx');
  });
});

