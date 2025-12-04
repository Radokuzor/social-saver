import { ResizeMode, Video } from 'expo-av';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { fetchTikTokMp4, TikTokVideoResponse } from '../services/video';

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
  const [tiktokVideo, setTikTokVideo] = useState<TikTokVideoResponse | null>(null);
  const [tiktokLoading, setTikTokLoading] = useState(false);
  const [tiktokError, setTikTokError] = useState<string | null>(null);

  const decodedUrl = useMemo(() => {
    const asString = Array.isArray(url) ? url[0] : url;
    if (!asString) return null;
    try {
      return decodeURIComponent(asString as string);
    } catch {
      return asString as string;
    }
  }, [url]);

  const platform = useMemo<PlatformData>(() => {
    return decodedUrl ? detectPlatform(decodedUrl) : { type: 'generic', html: undefined };
  }, [decodedUrl]);

  useEffect(() => {
    setWebViewError(false);
  }, [decodedUrl]);

  useEffect(() => {
    let cancelled = false;
    if (platform.type !== 'tiktok' || !decodedUrl) {
      setTikTokVideo(null);
      setTikTokError(null);
      setTikTokLoading(false);
      return;
    }

    const loadMp4 = async () => {
      try {
        setTikTokLoading(true);
        setTikTokError(null);
        const data = await fetchTikTokMp4(decodedUrl);
        if (!cancelled) {
          setTikTokVideo(data);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('TikTok MP4 fetch failed', err);
          setTikTokVideo(null);
          setTikTokError(err instanceof Error ? err.message : 'Unable to load video');
        }
      } finally {
        if (!cancelled) {
          setTikTokLoading(false);
        }
      }
    };

    loadMp4();

    return () => {
      cancelled = true;
    };
  }, [platform.type, decodedUrl]);

  const handleOpenBrowser = async () => {
    if (!decodedUrl) return;
    Linking.openURL(decodedUrl).catch(async (err) => {
      console.error('Failed to open URL natively, falling back to WebBrowser:', err);
      await WebBrowser.openBrowserAsync(decodedUrl, {
        controlsColor: Colors.primary,
        toolbarColor: Colors.background,
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
    });
  };

  const renderContent = () => {
    if (!decodedUrl) {
      return (
        <View style={styles.loader}>
          <Text style={styles.errorText}>No URL provided</Text>
        </View>
      );
    }

    if (platform.type === 'tiktok' && tiktokLoading) {
      return (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.primary} />
          <Text style={styles.loadingText}>Fetching video...</Text>
        </View>
      );
    }

    if (platform.type === 'tiktok' && tiktokVideo?.mp4) {
      const posterProps = tiktokVideo.thumbnail ? { posterSource: { uri: tiktokVideo.thumbnail }, usePoster: true } : {};
      return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <Video
            source={{ uri: tiktokVideo.mp4 }}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay
            useNativeControls
            {...posterProps}
            posterStyle={styles.videoPoster}
            onError={() => {
              setTikTokVideo(null);
              setTikTokError('Unable to play video directly. Falling back to web view.');
            }}
          />
          <View style={styles.footer}>
            <TouchableOpacity style={styles.footerButton} onPress={handleOpenBrowser} activeOpacity={0.85}>
              <Text style={styles.footerButtonText}>Open in TikTok App</Text>
            </TouchableOpacity>
            {tiktokVideo.title ? <Text style={styles.videoTitle}>{tiktokVideo.title}</Text> : null}
          </View>
        </View>
      );
    }

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

    const source = platform.html
      ? { html: platform.html, baseUrl: platform.type === 'tiktok' ? 'https://www.tiktok.com' : 'https://www.instagram.com' }
      : { uri: decodedUrl };

    return (
      <View style={{ flex: 1 }}>
        {platform.type === 'tiktok' && tiktokError ? (
          <View style={styles.fallbackNotice}>
            <Text style={styles.fallbackText}>Direct video playback failed. Showing web view.</Text>
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

        {(platform.type === 'tiktok' || platform.type === 'instagram') && (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.footerButton} onPress={handleOpenBrowser} activeOpacity={0.85}>
              <Text style={styles.footerButtonText}>
                Open in {platform.type === 'tiktok' ? 'TikTok' : 'Instagram'} App
              </Text>
            </TouchableOpacity>
          </View>
        )}
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
  video: { flex: 1 },
  videoPoster: { width: '100%', height: '100%', resizeMode: 'cover', backgroundColor: '#000' },
  videoTitle: { marginTop: 8, color: Colors.textSecondary, textAlign: 'center' },
  fallbackNotice: { padding: 12, backgroundColor: '#fef2f2', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  fallbackText: { color: '#b91c1c', textAlign: 'center', fontSize: 13 },
  footer: { backgroundColor: Colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, padding: 12 },
  footerButton: { backgroundColor: Colors.primary, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  footerButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
