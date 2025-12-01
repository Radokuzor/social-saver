import axios from 'axios';

interface AIAnalysisResult {
    title: string;
    description: string;
    tags: string[];
    suggestedFolders: string[];
    category: string;
}

const PREFERRED_FOLDERS = [
    'Podcasts',
    'Pranks',
    'Skits',
    'Funny',
    'Hair',
    'Nails',
    'Clothes',
    'Mental Health',
    'Beauty',
    'Makeup',
    'Fitness',
    'Travel',
    'Food',
    'Tech',
    'Gaming',
    'DIY',
    'Comedy',
    'Sports',
    'News',
    'ASMR'
];

const stripeMode = (process.env.EXPO_PUBLIC_STRIPE_MODE || 'test').toLowerCase();
const AI_SERVER_URL =
    (stripeMode === 'live'
        ? process.env.EXPO_PUBLIC_AI_SERVER_URL_LIVE
        : process.env.EXPO_PUBLIC_AI_SERVER_URL_TEST || process.env.EXPO_PUBLIC_AI_SERVER_URL) ||
    (stripeMode === 'live'
        ? process.env.EXPO_PUBLIC_STRIPE_SERVER_URL_LIVE
        : process.env.EXPO_PUBLIC_STRIPE_SERVER_URL_TEST || process.env.EXPO_PUBLIC_STRIPE_SERVER_URL);

export async function analyzeContentWithAI(
    content: {
        type: 'url' | 'image' | 'video';
        url?: string;
        metadata?: any;
        imageBase64?: string;
        preferredFolders?: string[];
    },
    clerkToken?: string | null
): Promise<AIAnalysisResult> {
    // Call your server to do the OpenAI work
    if (!AI_SERVER_URL) {
        console.warn('AI server URL not set; falling back to basic analysis.');
        return basicFallback(content);
    }

    try {
        const response = await axios.post(
            `${AI_SERVER_URL}/ai/analyze`,
            {
                type: content.type,
                url: content.url,
                metadata: content.metadata,
                imageBase64: content.imageBase64,
                preferredFolders: content.preferredFolders?.length
                    ? content.preferredFolders
                    : PREFERRED_FOLDERS,
            },
            {
                timeout: 20000,
                headers: clerkToken ? { Authorization: `Bearer ${clerkToken}` } : undefined,
            }
        );
        return response.data;
    } catch (error) {
        console.error('AI analysis failed:', error);
        return basicFallback(content);
    }
}

function basicFallback(content: { type: 'url' | 'image' | 'video'; url?: string; metadata?: any; imageBase64?: string; }): AIAnalysisResult {
    if (content.type === 'url' && content.metadata) {
        return {
            title: content.metadata.title,
            description: content.metadata.description || 'No description available',
            tags: extractBasicTags(content.metadata),
            suggestedFolders: ['General', 'Web Content'],
            category: 'General',
        };
    }

    if (content.type === 'image') {
        return {
            title: 'Untitled Image',
            description: 'An image from your gallery',
            tags: ['image', 'gallery'],
            suggestedFolders: ['Images', 'Gallery'],
            category: 'Images',
        };
    }

    return {
        title: 'Video Content',
        description: 'A video saved for later viewing',
        tags: ['video', 'media'],
        suggestedFolders: ['Videos', 'Funny', 'Skits'],
        category: 'Videos',
    };
}

function extractBasicTags(metadata: any): string[] {
    const tags: string[] = [];

    // Extract from domain
    if (metadata.domain) {
        const domainParts = metadata.domain.split('.');
        tags.push(domainParts[0]);
    }

    // Extract from title and description
    const text = `${metadata.title} ${metadata.description}`.toLowerCase();
    const commonKeywords = [
        'podcast',
        'prank',
        'skit',
        'funny',
        'hair',
        'nails',
        'clothes',
        'beauty',
        'makeup',
        'mental health',
        'fashion',
        'food',
        'travel',
        'tech',
        'design',
        'art',
        'music',
        'fitness',
        'health',
    ];

    commonKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
            tags.push(keyword);
        }
    });

    return tags.slice(0, 5);
}
