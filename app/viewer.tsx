import { Stack, useLocalSearchParams } from 'expo-router';
import { ResizeMode, Video } from 'expo-av';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import useFirebaseAuth from '../hooks/useFirebaseAuth';
import { getLocalDownload, removeLocalDownload } from '../services/localDownloads';
import { downloadForOffline } from '../services/offlineDownloader';

const Colors = {
  primary: '#ec4899',
  background: '#ffffff',
  surface: '#fafafa',
  text: '#171717',
  textSecondary: '#737373',
  border: '#e5e5e5',
};

// Desktop Safari UA to avoid mobile app redirects
const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15';

type PlatformType = 'tiktok' | 'instagram' | 'generic';

interface PlatformData {
  type: PlatformType;
  html?: string;
}

function extractTikTokData(url: string): { videoId: string; username: string } | null {
  const match = url.match(/tiktok\.com\/@([^/]+)\/video\/(\d+)/);
  if (match) {
    return { username: match[1], videoId: match[2] };
  }
  return null;
}

function buildTikTokHtml(videoId: string) {
  const embedUri = `https://www.tiktok.com/embed/v2/${videoId}?embed_type=iframe`;
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          html, body {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
            background-color: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
          }
          #container {
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          iframe {
            width: 100%;
            max-width: 605px;
            height: 100%;
            min-height: 500px;
            border: none;
          }
        </style>
      </head>
      <body>
        <div id="container">
          <iframe
            src="${embedUri}"
            allowfullscreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            sandbox="allow-same-origin allow-scripts allow-presentation"
          ></iframe>
        </div>
        <script>
          window.open = function() { return null; };
          document.addEventListener('click', function(e) {
            const target = e.target.closest('a');
            if (target && target.href) { e.preventDefault(); e.stopPropagation(); return false; }
          }, true);
        </script>
      </body>
    </html>
  `;
}

function extractInstagramCode(url: string): string | null {
  const patterns = [/\/p\/([A-Za-z0-9_-]+)/, /\/reel\/([A-Za-z0-9_-]+)/, /\/tv\/([A-Za-z0-9_-]+)/];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function buildInstagramHtml(code: string) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #fafafa;
            -webkit-tap-highlight-color: transparent;
          }
          #container {
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          iframe {
            width: 100%;
            max-width: 540px;
            height: 100%;
            border: none;
          }
        </style>
      </head>
      <body>
        <div id="container">
          <iframe
            src="https://www.instagram.com/p/${code}/embed/captioned"
            allowfullscreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            sandbox="allow-same-origin allow-scripts allow-presentation"
            scrolling="no"
          ></iframe>
        </div>
        <script>
          window.open = function() { return null; };
          document.addEventListener('click', function(e) {
            const target = e.target.closest('a');
            if (target && target.href) {
              e.preventDefault();
              e.stopPropagation();
              return false;
            }
          }, true);
        </script>
      </body>
    </html>
  `;
}

function detectPlatform(url: string): PlatformData {
  const lower = url.toLowerCase();
  if (lower.includes('tiktok.com')) {
    const data = extractTikTokData(url);
    if (data) {
      return { type: 'tiktok', html: buildTikTokHtml(data.videoId) };
    }
    return {
      type: 'tiktok',
      html: `<iframe src="${url}" style="width:100%;height:100vh;border:none;"></iframe>`,
    };
  }
  if (lower.includes('instagram.com')) {
    const code = extractInstagramCode(url);
    if (code) {
      return { type: 'instagram', html: buildInstagramHtml(code) };
    }
  }
  return { type: 'generic', html: undefined };
}

export default function ViewerScreen() {
  const { url, title } = useLocalSearchParams();
  const [webViewError, setWebViewError] = useState(false);
  const { uid, getIdToken } = useFirebaseAuth();
  const [localDownload, setLocalDownload] = useState<Awaited<ReturnType<typeof getLocalDownload>>>(null);
  const [checkingLocal, setCheckingLocal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [preferWeb, setPreferWeb] = useState(false);

  const decodedUrl = useMemo(() => {
    const asString = Array.isArray(url) ? url[0] : url;
    if (!asString) return null;
    try {
      return decodeURIComponent(asString as string);
    } catch {
      return asString as string;
    }
  }, [url]);

  const normalizedUrl = useMemo(() => decodedUrl?.trim() || null, [decodedUrl]);

  const platform = useMemo<PlatformData>(() => {
    return normalizedUrl ? detectPlatform(normalizedUrl) : { type: 'generic', html: undefined };
  }, [normalizedUrl]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!normalizedUrl) {
        if (mounted) setLocalDownload(null);
        return;
      }
      setCheckingLocal(true);
      try {
        const record = await getLocalDownload(normalizedUrl);
        if (mounted) {
          setLocalDownload(record);
          setPreferWeb(false);
        }
      } finally {
        if (mounted) setCheckingLocal(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [normalizedUrl]);

  const handleDownload = useCallback(async () => {
    if (!normalizedUrl) return;
    try {
      setDownloading(true);
      setDownloadProgress(0);

      const token = uid ? await getIdToken() : null;
      const result = await downloadForOffline({
        sourceUrl: normalizedUrl,
        firebaseIdToken: token || undefined,
        onProgress: (p) => setDownloadProgress(p),
      });

      setLocalDownload({
        sourceUrl: normalizedUrl,
        localUri: result.localUri,
        mediaType: result.mediaType,
        createdAt: Date.now(),
      });
      setPreferWeb(false);
      Alert.alert('Downloaded', 'Saved for offline playback in the app.');
    } catch (err: any) {
      Alert.alert('Download failed', err?.message || 'Could not download this content.');
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  }, [getIdToken, normalizedUrl, uid]);

  const handleDeleteDownload = useCallback(async () => {
    if (!normalizedUrl) return;
    try {
      await removeLocalDownload(normalizedUrl);
      setLocalDownload(null);
      setPreferWeb(true);
    } catch (err: any) {
      Alert.alert('Remove failed', err?.message || 'Could not remove this download.');
    }
  }, [normalizedUrl]);

  const handleOpenBrowser = async () => {
    if (!normalizedUrl) return;
    Linking.openURL(normalizedUrl).catch(async (err) => {
      console.error('Failed to open URL natively, falling back to WebBrowser:', err);
      await WebBrowser.openBrowserAsync(normalizedUrl, {
        controlsColor: Colors.primary,
        toolbarColor: Colors.background,
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
    });
  };

  const renderContent = () => {
    if (!normalizedUrl) {
      return (
        <View style={styles.loader}>
          <Text style={styles.errorText}>No URL provided</Text>
        </View>
      );
    }

    const canPlayLocal = !!localDownload?.localUri && (localDownload.mediaType === 'video' || localDownload.mediaType === 'image');
    const shouldShowDownload = normalizedUrl.startsWith('http') && !localDownload && !checkingLocal;

    if (webViewError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to load content</Text>
          <Text style={styles.errorText}>You can try opening it in the native app or browser.</Text>
          <TouchableOpacity style={styles.openButton} onPress={handleOpenBrowser} activeOpacity={0.85}>
            <Text style={styles.openButtonText}>
              Open in {platform.type === 'tiktok' ? 'TikTok' : platform.type === 'instagram' ? 'Instagram' : 'Browser'}
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (canPlayLocal && !preferWeb) {
      return (
        <View style={{ flex: 1 }}>
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={[styles.secondaryButton, downloading ? styles.buttonDisabled : null]}
              onPress={() => setPreferWeb(true)}
              disabled={downloading}
            >
              <Text style={styles.secondaryButtonText}>Open Web</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, downloading ? styles.buttonDisabled : null]}
              onPress={handleDeleteDownload}
              disabled={downloading}
            >
              <Text style={styles.secondaryButtonText}>Remove Download</Text>
            </TouchableOpacity>
          </View>
          {localDownload?.mediaType === 'video' ? (
            <Video
              source={{ uri: localDownload.localUri }}
              style={{ flex: 1, backgroundColor: '#000' }}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: '#000' }}>
              <Image source={{ uri: localDownload!.localUri }} style={{ flex: 1 }} resizeMode="contain" />
            </View>
          )}
        </View>
      );
    }

    const source = platform.html
      ? { html: platform.html, baseUrl: platform.type === 'tiktok' ? 'https://www.tiktok.com' : 'https://www.instagram.com' }
      : { uri: normalizedUrl };

    return (
      <View style={{ flex: 1 }}>
        {(shouldShowDownload || canPlayLocal) && !webViewError ? (
          <View style={styles.actionBar}>
            {shouldShowDownload ? (
              <TouchableOpacity
                style={[styles.secondaryButton, (downloading || checkingLocal || !!localDownload) ? styles.buttonDisabled : null]}
                onPress={handleDownload}
                disabled={downloading || checkingLocal || !!localDownload}
              >
                <Text style={styles.secondaryButtonText}>
                  {downloading
                    ? `Downloading${downloadProgress !== null ? ` (${Math.round(downloadProgress * 100)}%)` : ''}…`
                    : checkingLocal
                      ? 'Checking…'
                      : localDownload
                        ? 'Downloaded'
                        : 'Download'}
                </Text>
              </TouchableOpacity>
            ) : null}
            {canPlayLocal ? (
              <TouchableOpacity
                style={[styles.secondaryButton, downloading ? styles.buttonDisabled : null]}
                onPress={() => setPreferWeb(false)}
                disabled={downloading}
              >
                <Text style={styles.secondaryButtonText}>Play Local</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        <WebView
          source={source}
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loader}>
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.loadingText}>Loading {platform.type}...</Text>
            </View>
          )}
          onError={() => setWebViewError(true)}
          onHttpError={() => setWebViewError(true)}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled
          domStorageEnabled
          allowsFullscreenVideo
          scalesPageToFit={false}
          originWhitelist={['*']}
          mixedContentMode="always"
          userAgent={DESKTOP_UA}
        />

      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: (Array.isArray(title) ? title[0] : title) || 'Viewer',
          headerBackTitle: 'Back',
          headerTintColor: Colors.primary,
        }}
      />
      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  errorText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  openButton: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  openButtonText: { color: '#fff', fontWeight: '700' },
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  secondaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  buttonDisabled: { opacity: 0.6 },
});
