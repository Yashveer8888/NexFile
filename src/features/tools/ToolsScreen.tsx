import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FileText,
  FileCode,
  Archive,
  PieChart,
  Lock,
  PlayCircle,
  Package,
  Share2,
  Sparkles,
  ChevronRight,
} from 'lucide-react-native';
import { useThemeStore } from '../../app/store/useThemeStore';
import { typography } from '../../theme/typography';
import { spacing, borderRadius } from '../../theme/spacing';
import { Header } from '../../components/common/Header';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';

interface ToolItem {
  id: string;
  title: string;
  description: string;
  icon: any;
  color: string;
  route: string;
  badge?: string;
  badgeColor?: string;
}

export const ToolsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeStore();

  const tools: ToolItem[] = [
    {
      id: 'pdf-studio',
      title: 'PDF Studio',
      description: 'Document scanner, annotations, merge, split & convert',
      icon: FileText,
      color: '#E53935',
      route: 'PdfStudioScreen',
      badge: 'Full Suite',
    },
    {
      id: 'doc-converter',
      title: 'Document Converter',
      description: 'Convert between PDF, DOCX, XLSX, TXT, and images',
      icon: FileCode,
      color: '#1E88E5',
      route: 'DocumentConverterScreen',
    },
    {
      id: 'archive-mgr',
      title: 'Archive Manager',
      description: 'Create & extract ZIP, TAR, GZ, 7Z with encryption',
      icon: Archive,
      color: '#8D6E63',
      route: 'ArchiveManagerScreen',
    },
    {
      id: 'storage-analyzer',
      title: 'Storage Analyzer',
      description: 'Visual breakdown, duplicate finder & cleaner suggestions',
      icon: PieChart,
      color: '#FB8C00',
      route: 'StorageAnalyzerScreen',
      badge: 'Smart',
    },
    {
      id: 'vault',
      title: 'Private Vault',
      description: 'Hardware-backed AES-256-GCM encryption with biometric lock',
      icon: Lock,
      color: '#7E57C2',
      route: 'PrivateVaultScreen',
      badge: 'Encrypted',
    },
    {
      id: 'media-player',
      title: 'Built-in Media Player',
      description: 'HD video playback, music playlist & gesture controls',
      icon: PlayCircle,
      color: '#43A047',
      route: 'MediaPlayerScreen',
    },
    {
      id: 'app-manager',
      title: 'App & APK Manager',
      description: 'Inspect APK files, version details & share packages',
      icon: Package,
      color: '#00ACC1',
      route: 'AppManagerScreen',
    },
    {
      id: 'file-sharing',
      title: 'Local File Sharing',
      description: 'High-speed Wi-Fi direct transfer & QR code receiver',
      icon: Share2,
      color: '#3949AB',
      route: 'FileSharingScreen',
    },
    {
      id: 'ai-assistant',
      title: 'Local AI Assistant',
      description: 'Offline natural language queries, summaries & organization',
      icon: Sparkles,
      color: '#D81B60',
      route: 'AiAssistantScreen',
      badge: 'Offline AI',
    },
  ];

  const handleToolPress = (route: string) => {
    navigation.navigate(route);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Header title="Tools Studio" subtitle="Productivity & Utilities" showThemeToggle />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.toolsGrid}>
          {tools.map((tool) => {
            const IconComp = tool.icon;
            return (
              <Card
                key={tool.id}
                style={styles.toolCard}
                onPress={() => handleToolPress(tool.route)}
                elevated
              >
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: `${tool.color}18` }]}>
                    <IconComp size={24} color={tool.color} />
                  </View>
                  {tool.badge && (
                    <Badge
                      label={tool.badge}
                      color={tool.color}
                      backgroundColor={`${tool.color}20`}
                    />
                  )}
                </View>

                <Text style={[typography.h4, { color: colors.text, marginTop: spacing.md }]}>
                  {tool.title}
                </Text>

                <Text
                  style={[
                    typography.bodySmall,
                    { color: colors.textSecondary, marginTop: spacing.xs, flex: 1 },
                  ]}
                  numberOfLines={2}
                >
                  {tool.description}
                </Text>

                <View style={styles.cardFooter}>
                  <Text style={[typography.labelSmall, { color: tool.color }]}>Open Tool</Text>
                  <ChevronRight size={14} color={tool.color} />
                </View>
              </Card>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing.xxxl,
  },
  toolsGrid: {
    gap: spacing.md,
  },
  toolCard: {
    minHeight: 130,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
});

