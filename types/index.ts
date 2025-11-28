// types/index.ts

export type ContentType = 'url' | 'image' | 'video';

export interface ContentItem {
    id: string;
    userId: string;
    type: ContentType;
    url?: string;
    mediaUrl?: string;
    title: string;
    description: string;
    thumbnail: string;
    tags: string[];
    folderId?: string;
    metadata?: {
        domain?: string;
        author?: string;
        publishedDate?: Date;
    };
    aiGenerated?: {
        description: string;
        tags: string[];
        suggestedFolders: string[];
    };
    createdAt: Date;
    updatedAt: Date;
}

export interface Folder {
    id: string;
    userId: string;
    name: string;
    color: string;
    icon: string;
    itemCount: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface User {
    id: string;
    email: string;
    name: string;
    photoUrl?: string;
    createdAt: Date;
    preferences?: {
        theme?: 'light' | 'dark';
        defaultView?: 'grid' | 'list';
    };
}

export interface UrlMetadata {
    title: string;
    description: string;
    image: string;
    domain: string;
    url: string;
    author?: string;
    publishedDate?: string;
}

export interface AIAnalysisResult {
    title: string;
    description: string;
    tags: string[];
    suggestedFolders: string[];
    category: string;
}