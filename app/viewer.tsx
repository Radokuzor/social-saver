import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView } from 'react-native-webview';

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
});
