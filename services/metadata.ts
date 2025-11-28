// services/metadata.ts
import axios from 'axios';

export interface UrlMetadata {
    title: string;
    description: string;
    image: string;
    domain: string;
    url: string;
}

export async function extractUrlMetadata(url: string): Promise<UrlMetadata> {
    console.log('[metadata] extracting url', url);
    const hostname = (() => {
        try {
            return new URL(url).hostname;
        } catch {
            return '';
        }
    })();
    const isYouTube = hostname.includes('youtube.com') || hostname.includes('youtu.be');
    const isInstagram = hostname.includes('instagram.com');
    const isTikTok = hostname.includes('tiktok.com');

    // Prefer oEmbed/JsonLink for YouTube, JsonLink for Instagram, TikTok oEmbed
    if (isYouTube || isInstagram) {
        if (isYouTube) {
            try {
                const oembed = await axios.get('https://www.youtube.com/oembed', {
                    params: {
                        url,
                        format: 'json',
                    }
                });
                const oe = oembed.data;
                console.log('[metadata] youtube oembed success', {
                    title: oe.title,
                    author: oe.author_name,
                    thumbnail: oe.thumbnail_url,
                });
                return {
                    title: oe.title || 'Untitled',
                    description: oe.author_name || '',
                    image: oe.thumbnail_url || '',
                    domain: hostname || new URL(url).hostname,
                    url,
                };
            } catch (oErr) {
                console.log('[metadata] youtube oembed failed, falling back', {
                    message: oErr instanceof Error ? oErr.message : String(oErr),
                    status: (oErr as any)?.response?.status,
                });
            }
        }
        try {
            const jsonLinkRes = await axios.get('https://jsonlink.io/api/extract', {
                params: { url }
            });
            const jl = jsonLinkRes.data;
            if (jl && (jl.title || jl.description || jl.images?.length)) {
                console.log('[metadata] jsonlink success (yt/ig)', {
                    title: jl.title,
                    hasDescription: !!jl.description,
                    hasImages: !!jl.images?.length,
                });
                return {
                    title: jl.title || 'Untitled',
                    description: jl.description || '',
                    image: jl.images?.[0] || '',
                    domain: hostname || new URL(url).hostname,
                    url,
                };
            }
        } catch (jsonErr) {
            console.log('[metadata] jsonlink failed (yt/ig), falling back', {
                message: jsonErr instanceof Error ? jsonErr.message : String(jsonErr),
                status: (jsonErr as any)?.response?.status,
            });
        }
    }
    if (isTikTok) {
        try {
            const oembed = await axios.get('https://www.tiktok.com/oembed', {
                params: { url },
            });
            const oe = oembed.data;
            console.log('[metadata] tiktok oembed success', {
                title: oe.title,
                author: oe.author_name,
                thumbnail: oe.thumbnail_url,
            });
            return {
                title: oe.title || 'Untitled',
                description: oe.author_name || '',
                image: oe.thumbnail_url || '',
                domain: hostname || new URL(url).hostname,
                url,
            };
        } catch (oErr) {
            console.log('[metadata] tiktok oembed failed, falling back', {
                message: oErr instanceof Error ? oErr.message : String(oErr),
                status: (oErr as any)?.response?.status,
            });
        }
    }

    try {
        // Primary: Microlink API (good for TikTok)
        const microlinkResponse = await axios.get('https://api.microlink.io', {
            params: {
                url: url,
                screenshot: false,
                video: false,
            }
        });

        const { data } = microlinkResponse.data;
        console.log('[metadata] microlink success', {
            title: data.title,
            hasDescription: !!data.description,
            hasImage: !!data.image?.url,
            hasLogo: !!data.logo?.url,
            type: data.type,
        });

        return {
            title: data.title || 'Untitled',
            description: data.description || '',
            image: data.image?.url || data.logo?.url || '',
            domain: new URL(url).hostname,
            url: url,
        };
    } catch (error) {
        console.error('[metadata] microlink failed, trying LinkPreview', {
            message: error instanceof Error ? error.message : String(error),
            status: (error as any)?.response?.status,
            data: (error as any)?.response?.data,
        });

        try {
            // Fallback: LinkPreview API or JsonLink if not yet tried
            const linkPreviewResponse = await axios.post(
                'https://api.linkpreview.net',
                { q: url },
                {
                    headers: {
                        'X-Linkpreview-Api-Key': process.env.EXPO_PUBLIC_LINKPREVIEW_KEY || '',
                    }
                }
            );

            console.log('[metadata] linkpreview success', {
                title: linkPreviewResponse.data.title,
                hasDescription: !!linkPreviewResponse.data.description,
                hasImage: !!linkPreviewResponse.data.image,
            });

            return {
                title: linkPreviewResponse.data.title || 'Untitled',
                description: linkPreviewResponse.data.description || '',
                image: linkPreviewResponse.data.image || '',
                domain: new URL(url).hostname,
                url: url,
            };
        } catch (fallbackError) {
            console.error('[metadata] all extraction failed', {
                message: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
                status: (fallbackError as any)?.response?.status,
                data: (fallbackError as any)?.response?.data,
            });

            // Last resort: return basic info
            return {
                title: 'Untitled',
                description: 'No description available',
                image: '',
                domain: new URL(url).hostname,
                url: url,
            };
        }
    }
}

// Helper function to validate URL
export function isValidUrl(urlString: string): boolean {
    try {
        new URL(urlString);
        return true;
    } catch (e) {
        return false;
    }
}
