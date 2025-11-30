import { getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Validate config early to avoid silent failures
const requiredKeys: (keyof typeof firebaseConfig)[] = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'appId'];
const missingKeys = requiredKeys.filter((key) => !firebaseConfig[key]);
if (missingKeys.length > 0) {
    console.error(`Missing Firebase config keys: ${missingKeys.join(', ')}`);
    throw new Error(`Missing Firebase config: ${missingKeys.join(', ')}`);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: true,
});

export const auth = getAuth(app);
export const storage = getStorage(app);
export default app;

// ============================================
// services/metadata.ts - URL Metadata Extraction
import axios from 'axios';

interface UrlMetadata {
    title: string;
    description: string;
    image: string;
    domain: string;
    url: string;
}

export async function extractUrlMetadata(url: string): Promise<UrlMetadata> {
    try {
        // Primary: Microlink API
        const microlinkResponse = await axios.get('https://api.microlink.io', {
            params: {
                url: url,
                screenshot: false,
                video: false,
            }
        });

        const { data } = microlinkResponse.data;

        return {
            title: data.title || 'Untitled',
            description: data.description || '',
            image: data.image?.url || data.logo?.url || '',
            domain: new URL(url).hostname,
            url: url,
        };
    } catch (error) {
        console.error('Microlink failed, trying LinkPreview:', error);

        try {
            // Fallback: LinkPreview API
            const linkPreviewResponse = await axios.post(
                'https://api.linkpreview.net',
                { q: url },
                {
                    headers: {
                        'X-Linkpreview-Api-Key': process.env.EXPO_PUBLIC_LINKPREVIEW_KEY,
                    }
                }
            );

            return {
                title: linkPreviewResponse.data.title || 'Untitled',
                description: linkPreviewResponse.data.description || '',
                image: linkPreviewResponse.data.image || '',
                domain: new URL(url).hostname,
                url: url,
            };
        } catch (fallbackError) {
            console.error('All metadata extraction failed:', fallbackError);
            throw new Error('Could not extract URL metadata');
        }
    }
}
