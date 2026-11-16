import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Share2,
  Wifi,
  QrCode,
  Laptop,
  Smartphone,
  Copy,
  Check,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { useSharingStore } from '../../app/store/useSharingStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius, elevation } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { formatBytes, formatDate } from '../../utils/formatters';

export const FileSharingScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();
  const {
    session,
    history,
    isServerActive,
    startServer,
    stopServer,
    shareViaSystem,
  } = useSharingStore();

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [activeTab, setActiveTab] = useState<'pc_transfer' | 'qr_pair' | 'history'>('pc_transfer');

  const handleToggleServer = () => {
    if (isServerActive) {
      stopServer();
    } else {
      startServer(8080);
    }
  };

  const handleCopyUrl = () => {
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleSystemShare = () => {
    shareViaSystem('/storage/emulated/0/Download/Project_Specification_2026.pdf');
  };

  const serverUrl = session?.serverUrl || 'http://192.168.1.105:8080';
  const pairCode = session?.pairCode || '4821';

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Header
        title="Local File Sharing"
        subtitle={isServerActive ? 'Wi-Fi Server Active' : 'Offline Direct Transfer'}
        showBack
        onBack={() => navigation.goBack()}
        showThemeToggle
      />

      {/* Sharing Mode Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'pc_transfer' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('pc_transfer')}
        >
          <Laptop size={18} color={activeTab === 'pc_transfer' ? colors.primary : colors.textMuted} />
          <Text style={[typography.labelMedium, { color: activeTab === 'pc_transfer' ? colors.primary : colors.textMuted, marginLeft: 6 }]}>
            Phone to PC
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'qr_pair' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('qr_pair')}
        >
          <QrCode size={18} color={activeTab === 'qr_pair' ? colors.primary : colors.textMuted} />
          <Text style={[typography.labelMedium, { color: activeTab === 'qr_pair' ? colors.primary : colors.textMuted, marginLeft: 6 }]}>
            QR Pairing
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'history' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab('history')}
        >
          <Share2 size={18} color={activeTab === 'history' ? colors.primary : colors.textMuted} />
          <Text style={[typography.labelMedium, { color: activeTab === 'history' ? colors.primary : colors.textMuted, marginLeft: 6 }]}>
            Transfers ({history.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'pc_transfer' ? (
          /* Phone-to-PC Web Server */
          <View>
            <Card style={styles.serverStatusCard} elevated>
              <View style={styles.serverRow}>
                <View style={[styles.wifiCircle, { backgroundColor: isServerActive ? colors.successBackground : colors.surfaceVariant }]}>
                  <Wifi size={28} color={isServerActive ? colors.success : colors.textMuted} />
                </View>

                <View style={styles.serverTextGroup}>
                  <Text style={[typography.h3, { color: colors.text }]}>Web Transfer Server</Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                    {isServerActive ? 'Broadcasting on local network' : 'Server is stopped'}
                  </Text>
                </View>

                <Switch
                  value={isServerActive}
                  onValueChange={handleToggleServer}
                  thumbColor={isServerActive ? colors.primary : colors.surfaceVariant}
                  trackColor={{ false: colors.surfaceVariant, true: colors.primaryLight }}
                />
              </View>

              {isServerActive && (
                <View style={[styles.urlBanner, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[typography.labelSmall, { color: colors.textMuted }]}>
                      OPEN THIS URL IN ANY PC BROWSER
                    </Text>
                    <Text style={[typography.mono, { color: colors.primary, fontWeight: '700', fontSize: 16, marginTop: 4 }]} selectable>
                      {serverUrl}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4 }]}>
                      PIN Code: <Text style={{ fontWeight: '700', color: colors.text }}>{pairCode}</Text>
                    </Text>
                  </View>

                  <TouchableOpacity onPress={handleCopyUrl} style={styles.copyBtn}>
                    {copiedUrl ? <Check size={18} color={colors.success} /> : <Copy size={18} color={colors.primary} />}
                  </TouchableOpacity>
                </View>
              )}
            </Card>

            <Card style={[styles.infoCard, { marginTop: spacing.md }]}>
              <Text style={[typography.labelMedium, { color: colors.textMuted }]}>HOW IT WORKS</Text>
              <Text style={[typography.bodySmall, { color: colors.text, marginTop: spacing.xs, lineHeight: 20 }]}>
                1. Connect your PC and phone to the same Wi-Fi router.{"\n"}
                2. Open the URL shown above in Chrome, Edge, Safari, or Firefox.{"\n"}
                3. Drag and drop files to download or upload directly without USB cables!
              </Text>
            </Card>

            <Button
              title="Open Android Share Sheet"
              variant="outline"
              icon={<ExternalLink size={16} color={colors.text} />}
              onPress={handleSystemShare}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        ) : activeTab === 'qr_pair' ? (
          /* QR Code Pairing */
          <Card style={styles.qrCard} elevated>
            <View style={[styles.qrMockBox, { backgroundColor: '#FFFFFF', borderColor: colors.border }]}>
              {/* QR Pattern Representation */}
              <View style={styles.qrCornerBox} />
              <View style={[styles.qrCornerBox, { right: 16, left: undefined }]} />
              <View style={[styles.qrCornerBox, { bottom: 16, top: undefined }]} />
              <QrCode size={120} color="#000000" />
            </View>

            <Text style={[typography.h3, { color: colors.text, marginTop: spacing.lg, textAlign: 'center' }]}>
              Scan with Another Device
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 4, textAlign: 'center' }]}>
              Point camera at this QR code to connect directly.
            </Text>

            <View style={[styles.qrCodeBadge, { backgroundColor: colors.surfaceVariant, marginTop: spacing.md }]}>
              <Text style={[typography.labelMedium, { color: colors.primary }]}>Pair Code: {pairCode}</Text>
            </View>
          </Card>
        ) : (
          /* Transfer History */
          <View>
            <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>
              Transfer Records
            </Text>

            {history.map((record) => (
              <Card key={record.id} style={styles.historyCard}>
                <View style={styles.historyRow}>
                  <View style={[styles.dirIconCircle, { backgroundColor: colors.primaryLight }]}>
                    {record.direction === 'send' ? (
                      <ArrowUpRight size={20} color={colors.primary} />
                    ) : (
                      <ArrowDownLeft size={20} color={colors.success} />
                    )}
                  </View>

                  <View style={styles.historyInfo}>
                    <Text style={[typography.labelLarge, { color: colors.text }]} numberOfLines={1}>
                      {record.fileName}
                    </Text>
                    <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
                      {formatBytes(record.size)} • {record.speedMbps} MB/s • {formatDate(record.timestamp)}
                    </Text>
                  </View>

                  <Badge label="Complete" color={colors.success} backgroundColor={colors.successBackground} />
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    height: 48,
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing.xxxl,
  },
  serverStatusCard: {
    padding: spacing.base,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  wifiCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serverTextGroup: {
    flex: 1,
    marginLeft: spacing.md,
  },
  urlBanner: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyBtn: {
    padding: spacing.sm,
  },
  infoCard: {
    padding: spacing.base,
  },
  qrCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  qrMockBox: {
    width: 220,
    height: 220,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    ...elevation.md,
  },
  qrCornerBox: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 28,
    height: 28,
    borderWidth: 4,
    borderColor: '#000000',
  },
  qrCodeBadge: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  historyCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dirIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
});
