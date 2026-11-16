import { Vibration, Platform } from 'react-native';

export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'selection' = 'light') {
  if (Platform.OS === 'android') {
    switch (type) {
      case 'light':
      case 'selection':
        Vibration.vibrate(10);
        break;
      case 'medium':
        Vibration.vibrate(25);
        break;
      case 'heavy':
        Vibration.vibrate(40);
        break;
    }
  }
}

