import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Image, Text } from 'react-native';
import {
  Folder,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  Package,
  FileCode,
  FileQuestion,
  FileSpreadsheet,
  Play,
} from 'lucide-react-native';
import { FileItem } from '../../types/file';
import { useThemeStore } from '../../app/store/useThemeStore';
import { borderRadius } from '../../theme/spacing';
import { thumbnailService } from '../../services/thumbnail/thumbnailService';

interface FileIconProps {
  item: FileItem;
  size?: number;
  iconSize?: number;
}

export const FileIcon: React.FC<FileIconProps> = ({
  item,
  size = 44,
  iconSize = 22,
}) => {
  const { colors } = useThemeStore();
  const [thumbUri, setThumbUri] = useState<string | null>(item.thumbnailUri || null);
  const [loadError, setLoadError] = useState(false);

  const ext = (item.extension || '').toLowerCase();
  const isVideo = ['mp4', 'mkv', 'mov', 'webm', 'avi', '3gp'].includes(ext);
  const isPdf = ext === 'pdf';
  const isApk = ext === 'apk';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'bmp'].includes(ext);

  useEffect(() => {
    setLoadError(false);
    if (isImage) {
      setThumbUri(item.path.startsWith('file://') ? item.path : `file://${item.path}`);
      return;
    }
    if (item.thumbnailUri) {
      setThumbUri(item.thumbnailUri);
      return;
    }
    if (isVideo || isPdf || isApk) {
      thumbnailService.getThumbnail(item.path, ext).then((uri) => {
        if (uri) setThumbUri(uri);
      });
    }
  }, [item.path, item.extension, item.thumbnailUri, isImage, isVideo, isPdf, isApk, ext]);

  if (item.isDirectory) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            backgroundColor: `${colors.folderColor}20`,
            borderRadius: borderRadius.md,
          },
        ]}
      >
        <Folder size={iconSize} color={colors.folderColor} fill={colors.folderColor} />
      </View>
    );
  }

  // Display real preview thumbnail if available
  if (thumbUri && !loadError) {
    return (
      <View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            borderRadius: borderRadius.md,
            overflow: 'hidden',
            backgroundColor: colors.surfaceVariant,
          },
        ]}
      >
        <Image
          source={{ uri: thumbUri }}
          style={{ width: size, height: size }}
          resizeMode="cover"
          onError={() => setLoadError(true)}
        />
        {/* If video: center semi-transparent play icon */}
        {isVideo && (
          <View style={styles.videoOverlay}>
            <View
              style={[
                styles.playCircle,
                { width: size * 0.44, height: size * 0.44, borderRadius: (size * 0.44) / 2 },
              ]}
            >
              <Play size={size * 0.22} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          </View>
        )}
        {/* If PDF: small badge in bottom-right */}
        {isPdf && (
          <View style={styles.pdfBadge}>
            <Text style={styles.pdfBadgeText}>PDF</Text>
          </View>
        )}
      </View>
    );
  }

  // Fallback to stylized category icon
  let iconColor = colors.textMuted;
  let bgColor = colors.surfaceVariant;
  let IconComponent = FileQuestion;

  if (item.category === 'images' || isImage) {
    iconColor = colors.imageColor;
    bgColor = `${colors.imageColor}20`;
    IconComponent = ImageIcon;
  } else if (item.category === 'videos' || isVideo) {
    iconColor = colors.videoColor;
    bgColor = `${colors.videoColor}20`;
    IconComponent = Video;
  } else if (item.category === 'audio' || ['mp3', 'wav', 'aac', 'flac', 'ogg'].includes(ext)) {
    iconColor = colors.audioColor;
    bgColor = `${colors.audioColor}20`;
    IconComponent = Music;
  } else if (item.category === 'apks' || isApk) {
    iconColor = colors.apkColor;
    bgColor = `${colors.apkColor}20`;
    IconComponent = Package;
  } else if (item.category === 'archives' || ['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    iconColor = colors.archiveColor;
    bgColor = `${colors.archiveColor}20`;
    IconComponent = Archive;
  } else if (isPdf) {
    iconColor = '#E53935';
    bgColor = '#FFEBEE';
    IconComponent = FileText;
  } else if (['xls', 'xlsx', 'csv'].includes(ext)) {
    iconColor = '#2E7D32';
    bgColor = '#E8F5E9';
    IconComponent = FileSpreadsheet;
  } else if (['js', 'ts', 'tsx', 'jsx', 'json', 'py', 'java', 'kt', 'html', 'htm', 'xml', 'css'].includes(ext)) {
    iconColor = '#0288D1';
    bgColor = '#E1F5FE';
    IconComponent = FileCode;
  } else {
    iconColor = colors.documentColor;
    bgColor = `${colors.documentColor}20`;
    IconComponent = FileText;
  }

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          backgroundColor: bgColor,
          borderRadius: borderRadius.md,
        },
      ]}
    >
      <IconComponent size={iconSize} color={iconColor} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
  },
  playCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  pdfBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: '#E53935',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  pdfBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
});
