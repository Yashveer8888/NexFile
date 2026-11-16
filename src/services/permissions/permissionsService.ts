import { PermissionsAndroid, Platform, Linking } from 'react-native';
import { NativeBridgeService } from '../filesystem/nativeBridge';

export interface StoragePermissionStatus {
  hasStoragePermission: boolean;
  canManageExternalStorage: boolean;
  needsExplanation: boolean;
}

export async function checkAllFilesPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return await NativeBridgeService.checkAllFilesPermission();
}

export async function requestAllFilesPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return await NativeBridgeService.requestAllFilesPermission();
}

export async function requestStoragePermissions(): Promise<StoragePermissionStatus> {
  if (Platform.OS !== 'android') {
    return {
      hasStoragePermission: true,
      canManageExternalStorage: true,
      needsExplanation: false,
    };
  }

  const apiLevel = (Platform.Version as number) || 30;

  try {
    const hasAllFiles = await NativeBridgeService.checkAllFilesPermission();
    if (hasAllFiles) {
      return {
        hasStoragePermission: true,
        canManageExternalStorage: true,
        needsExplanation: false,
      };
    }

    if (apiLevel >= 33) {
      // Android 13+ granular media permissions
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
      ]);

      const hasImages = granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES] === PermissionsAndroid.RESULTS.GRANTED;
      const hasVideo = granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO] === PermissionsAndroid.RESULTS.GRANTED;
      const hasAudio = granted[PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO] === PermissionsAndroid.RESULTS.GRANTED;
      const hasMedia = hasImages || hasVideo || hasAudio;

      const afterCheck = await NativeBridgeService.checkAllFilesPermission();

      return {
        hasStoragePermission: hasMedia || afterCheck,
        canManageExternalStorage: afterCheck,
        needsExplanation: !afterCheck,
      };
    } else {
      // Android 12 and below
      const readGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        {
          title: 'Storage Access Needed',
          message: 'NexFile requires permission to browse and manage files on your device.',
          buttonPositive: 'Grant Permission',
          buttonNegative: 'Cancel',
        }
      );

      const writeGranted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
      );

      const hasPerm =
        readGranted === PermissionsAndroid.RESULTS.GRANTED &&
        writeGranted === PermissionsAndroid.RESULTS.GRANTED;

      const afterCheck = await NativeBridgeService.checkAllFilesPermission();

      return {
        hasStoragePermission: hasPerm || afterCheck,
        canManageExternalStorage: afterCheck || hasPerm,
        needsExplanation: !afterCheck && !hasPerm,
      };
    }
  } catch (error) {
    console.warn('Error requesting storage permissions:', error);
    return {
      hasStoragePermission: false,
      canManageExternalStorage: false,
      needsExplanation: true,
    };
  }
}

export async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Access Needed',
        message: 'NexFile PDF Scanner requires camera access to scan documents.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err) {
    console.warn('Error requesting camera permission:', err);
    return false;
  }
}

export function openAppSettings() {
  Linking.openSettings();
}

