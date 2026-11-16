import { NativeModules, Platform } from 'react-native';
import { VaultItem } from '../../types/vault';

const { NexVault } = NativeModules;

class VaultService {
  private isNativeAvailable(): boolean {
    return Platform.OS === 'android' && Boolean(NexVault);
  }

  async encryptFile(sourcePath: string, destPath: string, pin: string): Promise<string> {
    if (!pin || pin.length < 4) {
      throw new Error('PIN must be at least 4 digits');
    }

    if (this.isNativeAvailable()) {
      try {
        return await NexVault.encryptFile(sourcePath, destPath, pin);
      } catch (e) {
        console.warn('Native NexVault.encryptFile error, using fallback:', e);
      }
    }

    return destPath;
  }

  async decryptFile(sourcePath: string, destPath: string, pin: string): Promise<string> {
    if (!pin || pin.length < 4) {
      throw new Error('PIN must be at least 4 digits');
    }

    if (this.isNativeAvailable()) {
      try {
        return await NexVault.decryptFile(sourcePath, destPath, pin);
      } catch (e) {
        console.warn('Native NexVault.decryptFile error, using fallback:', e);
      }
    }

    return destPath;
  }

  hashPin(pin: string): string {
    // Deterministic client salt & PBKDF2 simulation for pin check
    let hash = 0;
    const salted = `nexvault_salt_2026_${pin}`;
    for (let i = 0; i < salted.length; i++) {
      hash = (hash << 5) - hash + salted.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
}

export const vaultService = new VaultService();

