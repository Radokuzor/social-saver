import { ResizeMode, Video } from 'expo-av';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Menu, Repeat, Repeat1, Shuffle } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import useFirebaseAuth from '../hooks/useFirebaseAuth';
import { useContent } from '../hooks/userContent';
import { db } from '../services/firebase';
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
  const { url, title, itemId, folderId, publicFolderId } = useLocalSearchParams();
  const [webViewError, setWebViewError] = useState(false);
  const router = useRouter();
  const { uid, getIdToken } = useFirebaseAuth();
  const { getContent, deleteContent } = useContent();

  const [localDownload, setLocalDownload] = useState<Awaited<ReturnType<typeof getLocalDownload>>>(null);
  const [checkingLocal, setCheckingLocal] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [preferWeb, setPreferWeb] = useState(false);

  const [playlistItems, setPlaylistItems] = useState<any[] | null>(null);
  const [playlistIndex, setPlaylistIndex] = useState<number>(-1);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [actionBarHeight, setActionBarHeight] = useState<number>(0);
  const [playlistMode, setPlaylistMode] = useState<'sequential' | 'repeat-one' | 'shuffle'>('sequential');
  const shuffledIndicesRef = useRef<number[]>([]);

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

  const normalizedItemId = useMemo(() => {
    const asString = Array.isArray(itemId) ? itemId[0] : itemId;
    return asString ? String(asString) : null;
  }, [itemId]);

  const normalizedFolderId = useMemo(() => {
    const asString = Array.isArray(folderId) ? folderId[0] : folderId;
    return asString ? String(asString) : null;
  }, [folderId]);

  const normalizedPublicFolderId = useMemo(() => {
    const asString = Array.isArray(publicFolderId) ? publicFolderId[0] : publicFolderId;
    return asString ? String(asString) : null;
  }, [publicFolderId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!normalizedItemId) {
        setPlaylistItems(null);
        setPlaylistIndex(-1);
        return;
      }

      if (normalizedPublicFolderId) {
        setPlaylistLoading(true);
        try {
          const snap = await getDocs(
            query(
              collection(db, 'publicFolders', normalizedPublicFolderId, 'items'),
              orderBy('createdAt', 'desc'),
              limit(200),
            ),
          );
          const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
          if (!mounted) return;
          setPlaylistItems(items);
          const idx = items.findIndex((it: any) => String(it?.id) === normalizedItemId);
          setPlaylistIndex(idx >= 0 ? idx : 0);
        } catch (err) {
          console.warn('[viewer] public playlist load failed', err);
          if (mounted) {
            setPlaylistItems(null);
            setPlaylistIndex(-1);
          }
        } finally {
          if (mounted) setPlaylistLoading(false);
        }
        return;
      }

      if (!uid) {
        setPlaylistItems(null);
        setPlaylistIndex(-1);
        return;
      }
      setPlaylistLoading(true);
      try {
        const items = await getContent(normalizedFolderId || undefined);
        if (!mounted) return;
        setPlaylistItems(items);
        const idx = items.findIndex((it: any) => String(it?.id) === normalizedItemId);
        setPlaylistIndex(idx >= 0 ? idx : 0);
      } catch (err) {
        console.warn('[viewer] playlist load failed', err);
        if (mounted) {
          setPlaylistItems(null);
          setPlaylistIndex(-1);
        }
      } finally {
        if (mounted) setPlaylistLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [getContent, normalizedFolderId, normalizedItemId, normalizedPublicFolderId, uid]);

  const showPlaylist = !!playlistItems && playlistItems.length > 1;

  const activeItem = useMemo(() => {
    if (!playlistItems || playlistIndex < 0 || playlistIndex >= playlistItems.length) return null;
    return playlistItems[playlistIndex];
  }, [playlistItems, playlistIndex]);

  const currentUrl = useMemo(() => {
    const fromItem = activeItem?.url || activeItem?.mediaUrl || '';
    return (fromItem || normalizedUrl || '').trim() || null;
  }, [activeItem, normalizedUrl]);

  const currentTitle = useMemo(() => {
    const fromItem = activeItem?.title;
    const fromParam = Array.isArray(title) ? title[0] : title;
    return (fromItem || fromParam || 'Viewer') as string;
  }, [activeItem, title]);

  const platform = useMemo<PlatformData>(() => {
    return currentUrl ? detectPlatform(currentUrl) : { type: 'generic', html: undefined };
  }, [currentUrl]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!currentUrl) {
        if (mounted) setLocalDownload(null);
        return;
      }
      setCheckingLocal(true);
      try {
        const record = await getLocalDownload(currentUrl);
        if (mounted) {
          setLocalDownload(record);
          setPreferWeb(false);
          setWebViewError(false);
        }
      } finally {
        if (mounted) setCheckingLocal(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [currentUrl]);

  const goToIndex = useCallback(
    (nextIndex: number) => {
      if (!playlistItems) return;
      if (nextIndex < 0 || nextIndex >= playlistItems.length) return;
      setPlaylistIndex(nextIndex);
      setPreferWeb(false);
      setWebViewError(false);
      setMoreOpen(false);
      setOptionsOpen(false);
    },
    [playlistItems],
  );

  const goPrev = useCallback(() => {
    if (!playlistItems) return;
    goToIndex(playlistIndex - 1);
  }, [goToIndex, playlistIndex, playlistItems]);

  const goNext = useCallback(() => {
    if (!playlistItems) return;

    if (playlistMode === 'repeat-one') {
      // Replay the current video
      setPreferWeb(false);
      setWebViewError(false);
      return;
    }

    if (playlistMode === 'shuffle') {
      // Generate shuffled indices if not already done
      if (shuffledIndicesRef.current.length === 0) {
        const indices = Array.from({ length: playlistItems.length }, (_, i) => i);
        // Fisher-Yates shuffle
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        shuffledIndicesRef.current = indices;
      }

      // Find current position in shuffled array
      const currentShuffledPos = shuffledIndicesRef.current.indexOf(playlistIndex);
      const nextShuffledPos = (currentShuffledPos + 1) % shuffledIndicesRef.current.length;

      // If we've completed the shuffle cycle, reshuffle
      if (nextShuffledPos === 0) {
        const indices = Array.from({ length: playlistItems.length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        shuffledIndicesRef.current = indices;
      }

      goToIndex(shuffledIndicesRef.current[nextShuffledPos]);
      return;
    }

    // Sequential mode
    if (playlistIndex < playlistItems.length - 1) {
      goToIndex(playlistIndex + 1);
    }
  }, [goToIndex, playlistIndex, playlistItems, playlistMode]);

  const handleDownload = useCallback(async () => {
    if (!currentUrl) return;
    try {
      setDownloading(true);
      setDownloadProgress(0);

      const token = uid ? await getIdToken() : null;
      const result = await downloadForOffline({
        sourceUrl: currentUrl,
        firebaseIdToken: token || undefined,
        onProgress: (p) => setDownloadProgress(p),
      });

      setLocalDownload({
        sourceUrl: currentUrl,
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
  }, [currentUrl, getIdToken, uid]);

  const handleDeleteDownload = useCallback(async () => {
    if (!currentUrl) return;
    try {
      await removeLocalDownload(currentUrl);
      setLocalDownload(null);
      setPreferWeb(true);
    } catch (err: any) {
      Alert.alert('Remove failed', err?.message || 'Could not remove this download.');
    }
  }, [currentUrl]);

  const handleOpenBrowser = useCallback(async () => {
    if (!currentUrl) return;
    Linking.openURL(currentUrl).catch(async (err) => {
      console.error('Failed to open URL natively, falling back to WebBrowser:', err);
      await WebBrowser.openBrowserAsync(currentUrl, {
        controlsColor: Colors.primary,
        toolbarColor: Colors.background,
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
    });
  }, [currentUrl]);

  const actionNav = showPlaylist ? (
    <View style={styles.navButtons}>
      <TouchableOpacity
        style={[styles.navButton, playlistIndex <= 0 ? styles.buttonDisabled : null]}
        onPress={goPrev}
        disabled={playlistIndex <= 0}
      >
        <View pointerEvents="none">
          <ChevronLeft size={18} color={Colors.text} />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.navButton, playlistIndex >= (playlistItems!.length - 1) ? styles.buttonDisabled : null]}
        onPress={goNext}
        disabled={playlistIndex >= (playlistItems!.length - 1)}
      >
        <View pointerEvents="none">
          <ChevronRight size={18} color={Colors.text} />
        </View>
      </TouchableOpacity>
    </View>
  ) : null;

  const closeMenus = useCallback(() => {
    setMoreOpen(false);
    setOptionsOpen(false);
  }, []);

  const toggleMore = useCallback(() => {
    setOptionsOpen(false);
    setMoreOpen((v) => !v);
  }, []);

  const togglePlaylistMode = useCallback(() => {
    setPlaylistMode((current) => {
      if (current === 'sequential') return 'repeat-one';
      if (current === 'repeat-one') return 'shuffle';
      return 'sequential';
    });
    // Reset shuffle indices when changing modes
    if (playlistMode === 'shuffle') {
      shuffledIndicesRef.current = [];
    }
  }, [playlistMode]);

  const handleDeleteCurrentContent = useCallback(() => {
    const idToDelete = String(activeItem?.id || normalizedItemId || '');
    if (!idToDelete) return;

    Alert.alert('Delete content', 'This will permanently delete this item from your account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteContent(idToDelete);
            if (currentUrl) {
              await removeLocalDownload(currentUrl).catch(() => {});
            }

            setLocalDownload(null);
            setPreferWeb(true);

            if (playlistItems && playlistItems.length) {
              const nextItems = playlistItems.filter((it: any) => String(it?.id) !== idToDelete);
              setPlaylistItems(nextItems);
              if (nextItems.length === 0) {
                router.back();
                return;
              }
              setPlaylistIndex(Math.min(playlistIndex, nextItems.length - 1));
              return;
            }

            router.back();
          } catch (err: any) {
            Alert.alert('Delete failed', err?.message || 'Could not delete this content.');
          }
        },
      },
    ]);
  }, [activeItem?.id, currentUrl, deleteContent, normalizedItemId, playlistIndex, playlistItems, router]);

  const renderContent = () => {
    if (!currentUrl) {
      return (
        <View style={styles.loader}>
          <Text style={styles.errorText}>No URL provided</Text>
        </View>
      );
    }

    const canPlayLocal = !!localDownload?.localUri && (localDownload.mediaType === 'video' || localDownload.mediaType === 'image');
    const shouldShowDownload = currentUrl.startsWith('http') && !localDownload && !checkingLocal;

    const activeType: 'url' | 'image' | 'video' | null = activeItem?.type || null;
    const canPlayNativeVideo = !canPlayLocal && activeType === 'video' && !!activeItem?.mediaUrl && !preferWeb;
    const canShowNativeImage = !canPlayLocal && activeType === 'image' && !!activeItem?.mediaUrl && !preferWeb;

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
          <View style={styles.actionBar} onLayout={(e) => setActionBarHeight(e.nativeEvent.layout.height)}>
            {actionNav}
            <View style={styles.actionSpacer} />
            {showPlaylist ? (
              <TouchableOpacity style={styles.viewMoreButton} onPress={toggleMore} activeOpacity={0.85}>
                <Text style={styles.viewMoreText}>{moreOpen ? 'Hide' : 'View more'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {localDownload?.mediaType === 'video' ? (
            <Video
              key={String(activeItem?.id || currentUrl)}
              source={{ uri: localDownload.localUri }}
              style={{ flex: 1, backgroundColor: '#000' }}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay
              onPlaybackStatusUpdate={(status) => {
                if ((status as any)?.didJustFinish) goNext();
              }}
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: '#000' }}>
              <Image source={{ uri: localDownload!.localUri }} style={{ flex: 1 }} resizeMode="contain" />
            </View>
          )}
        </View>
      );
    }

    if (canPlayNativeVideo) {
      return (
        <View style={{ flex: 1 }}>
          <View style={styles.actionBar} onLayout={(e) => setActionBarHeight(e.nativeEvent.layout.height)}>
            {actionNav}
            <View style={styles.actionSpacer} />
            {showPlaylist ? (
              <TouchableOpacity style={styles.viewMoreButton} onPress={toggleMore} activeOpacity={0.85}>
                <Text style={styles.viewMoreText}>{moreOpen ? 'Hide' : 'View more'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <Video
            key={String(activeItem?.id || currentUrl)}
            source={{ uri: activeItem.mediaUrl }}
            style={{ flex: 1, backgroundColor: '#000' }}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            shouldPlay
            onPlaybackStatusUpdate={(status) => {
              if ((status as any)?.didJustFinish) goNext();
            }}
          />
        </View>
      );
    }

    if (canShowNativeImage) {
      return (
        <View style={{ flex: 1 }}>
          <View style={styles.actionBar} onLayout={(e) => setActionBarHeight(e.nativeEvent.layout.height)}>
            {actionNav}
            <View style={styles.actionSpacer} />
            {showPlaylist ? (
              <TouchableOpacity style={styles.viewMoreButton} onPress={toggleMore} activeOpacity={0.85}>
                <Text style={styles.viewMoreText}>{moreOpen ? 'Hide' : 'View more'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={{ flex: 1, backgroundColor: '#000' }}>
            <Image source={{ uri: activeItem.mediaUrl }} style={{ flex: 1 }} resizeMode="contain" />
          </View>
        </View>
      );
    }

    const source = platform.html
      ? { html: platform.html, baseUrl: platform.type === 'tiktok' ? 'https://www.tiktok.com' : 'https://www.instagram.com' }
      : { uri: currentUrl };

    return (
      <View style={{ flex: 1 }}>
        {showPlaylist || shouldShowDownload || canPlayLocal ? (
          <View style={styles.actionBar} onLayout={(e) => setActionBarHeight(e.nativeEvent.layout.height)}>
            {actionNav}
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
            <View style={styles.actionSpacer} />
            {showPlaylist ? (
              <TouchableOpacity style={styles.viewMoreButton} onPress={toggleMore} activeOpacity={0.85}>
                <Text style={styles.viewMoreText}>{moreOpen ? 'Hide' : 'View more'}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        <WebView
          key={String(activeItem?.id || currentUrl)}
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

  const { width } = Dimensions.get('window');
  const moreWidth = Math.max(280, Math.floor(width * 0.7));

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: currentTitle,
          headerBackTitle: 'Back',
          headerTintColor: Colors.primary,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => {
                setMoreOpen(false);
                setOptionsOpen((v) => !v);
              }}
              style={styles.headerOptionsButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              activeOpacity={0.85}
            >
              <View pointerEvents="none">
                <Menu size={20} color="#fff" />
              </View>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={{ flex: 1 }}>
        {renderContent()}

        {(moreOpen || optionsOpen) ? (
          <PressableOverlay onClose={closeMenus} topInset={moreOpen ? actionBarHeight : 0}>
            {optionsOpen ? (
              <View style={styles.optionsMenu}>
                <TouchableOpacity
                  style={styles.optionsItem}
                  onPress={() => {
                    setPreferWeb(true);
                    closeMenus();
                  }}
                >
                  <Text style={styles.optionsText}>Open Web</Text>
                </TouchableOpacity>
                {localDownload ? (
                  <TouchableOpacity
                    style={styles.optionsItem}
                    onPress={async () => {
                      closeMenus();
                      await handleDeleteDownload();
                    }}
                  >
                    <Text style={[styles.optionsText, styles.optionsDangerText]}>Remove Download</Text>
                  </TouchableOpacity>
                ) : null}
                {uid && !normalizedPublicFolderId && (activeItem?.id || normalizedItemId) ? (
                  <TouchableOpacity
                    style={styles.optionsItem}
                    onPress={() => {
                      closeMenus();
                      handleDeleteCurrentContent();
                    }}
                  >
                    <Text style={[styles.optionsText, styles.optionsDangerText]}>Delete Content</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}

            {moreOpen && showPlaylist ? (
              <View style={[styles.morePanel, { width: moreWidth, top: actionBarHeight + 6 }]}>
                <View style={styles.moreHeader}>
                  <Text style={styles.moreTitle}>{normalizedFolderId ? 'More in this folder' : 'More content'}</Text>
                  <View style={styles.moreHeaderRight}>
                    <TouchableOpacity
                      style={styles.playlistModeButton}
                      onPress={togglePlaylistMode}
                      activeOpacity={0.85}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {playlistMode === 'sequential' ? (
                        <Repeat size={18} color={Colors.text} />
                      ) : playlistMode === 'repeat-one' ? (
                        <Repeat1 size={18} color={Colors.primary} />
                      ) : (
                        <Shuffle size={18} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                    {playlistLoading ? <ActivityIndicator size="small" color={Colors.primary} /> : null}
                  </View>
                </View>
                <ScrollView contentContainerStyle={styles.moreList} showsVerticalScrollIndicator={false}>
                  {playlistItems!.map((it: any, idx: number) => {
                    const thumb = it?.thumbnail || it?.metadata?.image || it?.mediaUrl || '';
                    const isActive = idx === playlistIndex;
                    return (
                      <TouchableOpacity
                        key={String(it?.id || idx)}
                        style={[styles.moreItem, isActive ? styles.moreItemActive : null]}
                        onPress={() => {
                          goToIndex(idx);
                          closeMenus();
                        }}
                        activeOpacity={0.85}
                      >
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={styles.moreThumb} />
                        ) : (
                          <View style={[styles.moreThumb, styles.moreThumbPlaceholder]} />
                        )}
                        <Text style={[styles.moreItemText, isActive ? styles.moreItemTextActive : null]} numberOfLines={2}>
                          {it?.title || 'Untitled'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}
          </PressableOverlay>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function PressableOverlay({ onClose, children, topInset = 0 }: { onClose: () => void; children: ReactNode; topInset?: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableOpacity style={[StyleSheet.absoluteFill, { top: topInset }]} activeOpacity={1} onPress={onClose} />
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {children}
      </View>
    </View>
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
    alignItems: 'center',
  },
  navButtons: { flexDirection: 'row', gap: 8, marginRight: 4 },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSpacer: { flex: 1 },
  viewMoreButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewMoreText: { color: Colors.text, fontWeight: '800', fontSize: 13 },
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
  headerOptionsButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  headerOptionsText: { color: '#fff', fontWeight: '800' },
  optionsMenu: {
    position: 'absolute',
    top: 8,
    right: 12,
    minWidth: 200,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 14,
    overflow: 'hidden',
  },
  optionsItem: { paddingHorizontal: 14, paddingVertical: 12 },
  optionsText: { color: Colors.text, fontWeight: '800' },
  optionsDangerText: { color: '#dc2626' },
  morePanel: {
    position: 'absolute',
    right: 12,
    maxHeight: '72%',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  moreHeader: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moreTitle: { fontSize: 13, fontWeight: '900', color: Colors.text },
  moreHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playlistModeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreList: { padding: 10, gap: 10 },
  moreItem: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  moreItemActive: { borderColor: Colors.primary, backgroundColor: '#fdf2f8' },
  moreThumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.border },
  moreThumbPlaceholder: { backgroundColor: Colors.border },
  moreItemText: { flex: 1, fontSize: 12, fontWeight: '800', color: Colors.text },
  moreItemTextActive: { color: Colors.primary },
});
