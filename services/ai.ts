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

export async function analyzeContentWithAI(
    content: {
        type: 'url' | 'image' | 'video';
        url?: string;
        metadata?: any;
        imageBase64?: string;
    }
): Promise<AIAnalysisResult> {

    if (content.type === 'url') {
        return analyzeUrlContent(content.metadata);
    } else if (content.type === 'image') {
        return analyzeImageContent(content.imageBase64!);
    } else {
        return analyzeVideoContent(content.url!);
    }
}

async function analyzeUrlContent(metadata: any): Promise<AIAnalysisResult> {
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert content curator. Analyze the given content and provide a detailed description, relevant tags, and suggest folder categories. Return ONLY valid JSON.'
                    },
                    {
                        role: 'user',
                        content: `Analyze this content and provide:
1. An enhanced, detailed title (if the existing one needs improvement)
2. A comprehensive description (2-3 sentences)
3. 5-8 relevant tags
4. 2-3 suggested folder names (prefer from this list when relevant: ${PREFERRED_FOLDERS.join(', ')}, otherwise create a concise new one)
5. A main category (concise)

Content:
Title: ${metadata.title}
Description: ${metadata.description}
Domain: ${metadata.domain}

Return as JSON:
{
  "title": "enhanced title",
  "description": "detailed description",
  "tags": ["tag1", "tag2", ...],
  "suggestedFolders": ["folder1", "folder2"],
  "category": "main category"
}`
                    }
                ],
                temperature: 0.7,
                max_tokens: 500,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                }
            }
        );

        const result = JSON.parse(response.data.choices[0].message.content);
        return result;
    } catch (error) {
        console.error('AI analysis failed:', error);
        // Fallback to basic analysis
        return {
            title: metadata.title,
            description: metadata.description || 'No description available',
            tags: extractBasicTags(metadata),
            suggestedFolders: ['General', 'Web Content'],
            category: 'General',
        };
    }
}

async function analyzeImageContent(imageBase64: string): Promise<AIAnalysisResult> {
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `Analyze this image and provide: 1) A descriptive title, 2) A detailed description, 3) 5-8 relevant tags, 4) 2-3 suggested folder categories (prefer from: ${PREFERRED_FOLDERS.join(', ')}, otherwise create a concise new one), 5) Main category. Return ONLY valid JSON in format: {"title": "...", "description": "...", "tags": [...], "suggestedFolders": [...], "category": "..." }`
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${imageBase64}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 500,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                }
            }
        );

        const result = JSON.parse(response.data.choices[0].message.content);
        return result;
    } catch (error) {
        console.error('Image AI analysis failed:', error);
        return {
            title: 'Untitled Image',
            description: 'An image from your gallery',
            tags: ['image', 'gallery'],
            suggestedFolders: ['Images', 'Gallery'],
            category: 'Images',
        };
    }
}

async function analyzeVideoContent(videoUrl: string): Promise<AIAnalysisResult> {
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
