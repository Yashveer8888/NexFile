import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { ShieldCheck, X, Fingerprint } from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';

interface SetVaultPinModalProps {
  visible: boolean;
  onPinSet: (pin: string) => Promise<void> | void;
  onCancel: () => void;
}

export const SetVaultPinModal: React.FC<SetVaultPinModalProps> = ({
  visible,
  onPinSet,
  onCancel,
}) => {
  const { colors } = useThemeStore();
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep('create');
    setPin('');
    setConfirmPin('');
    setError(null);
  };

  const handleKeyPress = (num: string) => {
    setError(null);
    if (step === 'create') {
      if (pin.length < 4) {
        const next = pin + num;
        setPin(next);
        if (next.length === 4) {
          setTimeout(() => setStep('confirm'), 200);
        }
      }
    } else {
      if (confirmPin.length < 4) {
        const next = confirmPin + num;
        setConfirmPin(next);
        if (next.length === 4) {
          if (next === pin) {
            onPinSet(next);
            reset();
          } else {
            setError('PIN does not match. Try again.');
            setTimeout(() => {
              setConfirmPin('');
              setPin('');
              setStep('create');
              setError(null);
            }, 900);
          }
        }
      }
    }
  };

  const handleDelete = () => {
    setError(null);
    if (step === 'create') {
      setPin((p) => p.slice(0, -1));
    } else {
      if (confirmPin.length > 0) {
        setConfirmPin((p) => p.slice(0, -1));
      } else {
        setStep('create');
      }
    }
  };

  const currentPin = step === 'create' ? pin : confirmPin;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        activeOpacity={1}
        onPress={onCancel}
      >
        <View
          style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onStartShouldSetResponder={() => true}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={[styles.iconCircle, { backgroundColor: 'rgba(105, 240, 174, 0.16)' }]}>
                <ShieldCheck size={22} color="#69F0AE" />
              </View>
              <Text style={[typography.h3, { color: colors.text, marginLeft: 10 }]}>
                {step === 'create' ? 'Set Private Passcode' : 'Confirm Passcode'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                reset();
                onCancel();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[typography.bodySmall, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
            {step === 'create'
              ? 'Enter a 4-digit PIN to secure your private files'
              : 'Re-enter your 4-digit PIN to confirm'}
          </Text>

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = currentPin.length > idx;
              return (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: isFilled
                        ? error
                          ? colors.error
                          : '#69F0AE'
                        : colors.surfaceVariant,
                      borderColor: error ? colors.error : colors.border,
                    },
                  ]}
                />
              );
            })}
          </View>

          {error && (
            <Text style={[typography.labelSmall, { color: colors.error, textAlign: 'center', marginTop: spacing.xs }]}>
              {error}
            </Text>
          )}

          {/* Numeric Keypad */}
          <View style={styles.keypad}>
            {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, rIdx) => (
              <View key={rIdx} style={styles.keypadRow}>
                {row.map((num) => (
                  <TouchableOpacity
                    key={num}
                    style={[styles.keyBtn, { backgroundColor: colors.surfaceVariant }]}
                    onPress={() => handleKeyPress(num)}
                    activeOpacity={0.7}
                  >
                    <Text style={[typography.h2, { color: colors.text }]}>{num}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <View style={styles.keypadRow}>
              <View style={styles.keyBtnEmpty} />
              <TouchableOpacity
                style={[styles.keyBtn, { backgroundColor: colors.surfaceVariant }]}
                onPress={() => handleKeyPress('0')}
                activeOpacity={0.7}
              >
                <Text style={[typography.h2, { color: colors.text }]}>0</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.keyBtn, { backgroundColor: colors.surfaceVariant }]}
                onPress={handleDelete}
                activeOpacity={0.7}
              >
                <Text style={[typography.labelMedium, { color: colors.text }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  container: {
    width: '100%',
    maxWidth: 360,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    ...elevation.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.base,
    marginVertical: spacing.lg,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  keypad: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  keyBtn: {
    flex: 1,
    height: 52,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBtnEmpty: {
    flex: 1,
    height: 52,
  },
});
