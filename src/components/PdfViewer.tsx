import React, { useState } from 'react';
import { View, Text, Pressable, Platform, Linking, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ExternalLink, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react-native';
import { useThemeColors } from '@/lib/theme';
import { WebView } from 'react-native-webview';

interface PdfViewerProps {
  uri: string;
  fileName?: string;
  onClose: () => void;
}

export function PdfViewer({ uri, fileName, onClose }: PdfViewerProps) {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(1);

  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  // Handle opening PDF in external browser
  const handleOpenInBrowser = async () => {
    try {
      const supported = await Linking.canOpenURL(uri);
      if (supported) {
        await Linking.openURL(uri);
      } else {
        // Try Google Docs viewer as fallback for remote URLs
        if (uri.startsWith('http')) {
          const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(uri)}&embedded=true`;
          await Linking.openURL(googleDocsUrl);
        }
      }
    } catch (err) {
      console.error('Error opening PDF:', err);
    }
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  // Create Google Docs viewer URL for remote PDFs
  const getViewerUrl = () => {
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      // Use Google Docs viewer for remote PDFs
      return `https://docs.google.com/viewer?url=${encodeURIComponent(uri)}&embedded=true`;
    }
    // For local files, we'll show error and fallback option
    return uri;
  };

  const isRemoteUrl = uri.startsWith('http://') || uri.startsWith('https://');
  const viewerUrl = getViewerUrl();

  // Extract filename from URI if not provided
  const displayFileName = fileName || uri.split('/').pop()?.split('?')[0] || 'Document.pdf';

  return (
    <View className="flex-1" style={{ backgroundColor: colors.bg.primary }}>
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View
          className="flex-row items-center px-4 py-3"
          style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}
        >
          <Pressable
            onPress={onClose}
            className="w-10 h-10 rounded-full items-center justify-center mr-3 active:opacity-70"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <X size={20} color={colors.text.primary} strokeWidth={2} />
          </Pressable>

          <View className="flex-1 mr-3">
            <Text
              style={{ color: colors.text.primary }}
              className="font-semibold text-base"
              numberOfLines={1}
            >
              {displayFileName}
            </Text>
            <Text style={{ color: colors.text.muted }} className="text-xs">
              PDF Document
            </Text>
          </View>

          <Pressable
            onPress={handleOpenInBrowser}
            className="w-10 h-10 rounded-full items-center justify-center active:opacity-70"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <ExternalLink size={18} color={colors.text.primary} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Zoom Controls */}
        <View
          className="flex-row items-center justify-center py-2 gap-4"
          style={{ borderBottomWidth: 1, borderBottomColor: colors.border.light }}
        >
          <Pressable
            onPress={handleZoomOut}
            className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <ZoomOut size={16} color={colors.text.primary} strokeWidth={2} />
          </Pressable>

          <Pressable
            onPress={handleResetZoom}
            className="px-3 py-1.5 rounded-lg active:opacity-70"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <Text style={{ color: colors.text.primary }} className="text-sm font-medium">
              {Math.round(zoom * 100)}%
            </Text>
          </Pressable>

          <Pressable
            onPress={handleZoomIn}
            className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <ZoomIn size={16} color={colors.text.primary} strokeWidth={2} />
          </Pressable>

          <Pressable
            onPress={handleResetZoom}
            className="w-9 h-9 rounded-full items-center justify-center active:opacity-70"
            style={{ backgroundColor: colors.bg.secondary }}
          >
            <RotateCcw size={16} color={colors.text.tertiary} strokeWidth={2} />
          </Pressable>
        </View>

        {/* PDF Content */}
        <View className="flex-1">
          {isRemoteUrl ? (
            <>
              {loading && (
                <View className="absolute inset-0 items-center justify-center z-10">
                  <ActivityIndicator size="large" color={colors.text.primary} />
                  <Text style={{ color: colors.text.muted }} className="text-sm mt-3">
                    Loading PDF...
                  </Text>
                </View>
              )}

              {error ? (
                <View className="flex-1 items-center justify-center px-6">
                  <View
                    className="w-16 h-16 rounded-full items-center justify-center mb-4"
                    style={{ backgroundColor: colors.bg.secondary }}
                  >
                    <X size={32} color={colors.text.tertiary} strokeWidth={1.5} />
                  </View>
                  <Text
                    style={{ color: colors.text.primary }}
                    className="text-lg font-semibold text-center mb-2"
                  >
                    Unable to display PDF
                  </Text>
                  <Text
                    style={{ color: colors.text.muted }}
                    className="text-sm text-center mb-6"
                  >
                    The PDF could not be rendered in-app. You can open it in your browser instead.
                  </Text>
                  <Pressable
                    onPress={handleOpenInBrowser}
                    className="flex-row items-center px-5 py-3 rounded-xl active:opacity-80"
                    style={{ backgroundColor: '#111111' }}
                  >
                    <ExternalLink size={18} color="#FFFFFF" strokeWidth={2} />
                    <Text className="text-white font-semibold ml-2">Open in Browser</Text>
                  </Pressable>
                </View>
              ) : (
                <WebView
                  source={{ uri: viewerUrl }}
                  style={{
                    flex: 1,
                    transform: [{ scale: zoom }],
                    width: screenWidth,
                    height: screenHeight - 180,
                  }}
                  onLoadStart={() => setLoading(true)}
                  onLoadEnd={() => setLoading(false)}
                  onError={() => {
                    setLoading(false);
                    setError(true);
                  }}
                  onHttpError={() => {
                    setLoading(false);
                    setError(true);
                  }}
                  scrollEnabled={true}
                  scalesPageToFit={true}
                  bounces={false}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  startInLoadingState={false}
                  allowsInlineMediaPlayback={true}
                  mediaPlaybackRequiresUserAction={false}
                />
              )}
            </>
          ) : (
            // Local file fallback - show message and open in browser option
            <View className="flex-1 items-center justify-center px-6">
              <View
                className="w-16 h-16 rounded-full items-center justify-center mb-4"
                style={{ backgroundColor: colors.bg.secondary }}
              >
                <ExternalLink size={32} color={colors.text.tertiary} strokeWidth={1.5} />
              </View>
              <Text
                style={{ color: colors.text.primary }}
                className="text-lg font-semibold text-center mb-2"
              >
                Local PDF File
              </Text>
              <Text
                style={{ color: colors.text.muted }}
                className="text-sm text-center mb-6"
              >
                This PDF is stored locally. Tap below to open it with your device's default PDF viewer.
              </Text>
              <Pressable
                onPress={handleOpenInBrowser}
                className="flex-row items-center px-5 py-3 rounded-xl active:opacity-80"
                style={{ backgroundColor: '#111111' }}
              >
                <ExternalLink size={18} color="#FFFFFF" strokeWidth={2} />
                <Text className="text-white font-semibold ml-2">Open PDF</Text>
              </Pressable>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
