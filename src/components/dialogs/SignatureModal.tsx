import React, { useState, useRef, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Dimensions,
  ToastAndroid,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { X, Check, RotateCcw, PenTool } from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { fileService } from '../../services/filesystem/fileService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - 48;
const CANVAS_HEIGHT = 220;

interface SignatureModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (signatureData: { paths: string[]; color: string; strokeWidth: number; localFilePath?: string }) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  visible,
  onClose,
  onSave,
}) => {
  const { colors } = useThemeStore();
  const [paths, setPaths] = useState<string[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('#1E293B'); // Ink Black
  const [strokeWidth, setStrokeWidth] = useState<number>(3.5);

  const colorsList = ['#1E293B', '#2563EB', '#0D9488', '#DC2626'];

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          setCurrentPath(`M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`);
        },
        onPanResponderMove: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          setCurrentPath((prev) => `${prev} L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`);
        },
        onPanResponderRelease: () => {
          if (currentPath) {
            setPaths((prev) => [...prev, currentPath]);
            setCurrentPath('');
          }
        },
      }),
    [currentPath]
  );

  const handleClear = () => {
    setPaths([]);
    setCurrentPath('');
  };

  const handleDone = async () => {
    const allPaths = currentPath ? [...paths, currentPath] : paths;
    if (allPaths.length === 0) {
      ToastAndroid.show('Please sign on the pad first', ToastAndroid.SHORT);
      return;
    }

    onSave({
      paths: allPaths,
      color: selectedColor,
      strokeWidth,
    });
    handleClear();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <PenTool size={20} color={colors.primary} />
              <Text style={[typography.h4, { color: colors.text, marginLeft: 8 }]}>
                Digital E-Signature
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.md }]}>
            Draw your signature with your finger on the pad below:
          </Text>

          {/* Touch Drawing Canvas */}
          <View
            style={[styles.canvasWrapper, { backgroundColor: '#FFFFFF', borderColor: colors.border }]}
            {...panResponder.panHandlers}
          >
            <Svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={StyleSheet.absoluteFill}>
              {paths.map((d, index) => (
                <Path
                  key={`path_${index}`}
                  d={d}
                  stroke={selectedColor}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {currentPath ? (
                <Path
                  d={currentPath}
                  stroke={selectedColor}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
            </Svg>

            {/* Signature Guideline */}
            <View style={styles.guidelineRow}>
              <Text style={styles.guidelineX}>X</Text>
              <View style={styles.guidelineLine} />
            </View>
          </View>

          {/* Color & Stroke Selector Bar */}
          <View style={styles.controlsBar}>
            <View style={styles.colorRow}>
              {colorsList.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    selectedColor === c && styles.colorDotActive,
                  ]}
                  onPress={() => setSelectedColor(c)}
                />
              ))}
            </View>

            <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
              <RotateCcw size={16} color={colors.textSecondary} />
              <Text style={[typography.labelSmall, { color: colors.textSecondary, marginLeft: 4 }]}>
                Clear
              </Text>
            </TouchableOpacity>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: colors.border, borderWidth: 1 }]}
              onPress={onClose}
            >
              <Text style={[typography.labelMedium, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
              onPress={handleDone}
            >
              <Check size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={[typography.labelMedium, { color: '#FFFFFF', fontWeight: 'bold' }]}>
                Apply Signature
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  container: {
    width: '100%',
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.base,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeBtn: {
    padding: spacing.xs,
  },
  canvasWrapper: {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
  },
  guidelineRow: {
    position: 'absolute',
    bottom: 35,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  guidelineX: {
    fontSize: 16,
    color: '#CBD5E1',
    fontWeight: 'bold',
    marginRight: 8,
  },
  guidelineLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  colorDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: '#3B82F6',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
