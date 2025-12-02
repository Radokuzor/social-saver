// app/(tabs)/add.tsx
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ArrowLeft, FolderPlus, Image as ImageIcon, Link2, Sparkles, Video, X } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    ToastAndroid,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useFolders } from '../../hooks/useFolders';
import { useContent } from '../../hooks/userContent';
import useFirebaseAuth from '../../hooks/useFirebaseAuth';
import { analyzeContentWithAI } from '../../services/ai';
import { extractUrlMetadata } from '../../services/metadata';
import { imageToBase64 } from '../../services/storage';
import { fetchUserProfile, getPlanLimits } from '../../services/userProfile';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';

const Colors = {
    primary: '#ec4899',
    primaryLight: '#f9a8d4',
    secondary: '#a855f7',
    background: '#ffffff',
    surface: '#fafafa',
    text: '#171717',
    textSecondary: '#737373',
    border: '#e5e5e5',
    success: '#10b981',
};

type ContentType = 'url' | 'image' | 'video' | null;

export default function AddScreen() {
    const { user, uid, getIdToken } = useFirebaseAuth();
    const router = useRouter();
    const { saveContent } = useContent();
    const { getFolders } = useFolders();
    const [contentType, setContentType] = useState<ContentType>(null);
    const [url, setUrl] = useState('');
    const [mediaUri, setMediaUri] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzed, setAnalyzed] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // AI-generated content
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [suggestedFolders, setSuggestedFolders] = useState<string[]>([]);
    const [aiCategory, setAiCategory] = useState<string | null>(null);
    const [metadataTitle, setMetadataTitle] = useState<string>('');
    const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [availableFolders, setAvailableFolders] = useState<string[]>([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [newTag, setNewTag] = useState('');
    const [clipboardPrefill, setClipboardPrefill] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const uniqueAvailableFolders = useMemo(() => Array.from(new Set(availableFolders)), [availableFolders]);
    const uniqueSuggestedFolders = useMemo(() => Array.from(new Set(suggestedFolders)), [suggestedFolders]);

    const refreshFolders = useCallback(async () => {
        try {
            const folders = await getFolders();
            setAvailableFolders(folders.map(f => f.name));
        } catch (err) {
            console.error('Load folders failed', err);
        }
    }, [getFolders]);

    useEffect(() => {
        void refreshFolders();
    }, [refreshFolders]);

    useFocusEffect(
        useCallback(() => {
            void refreshFolders();
        }, [refreshFolders])
    );

    useEffect(() => {
        return () => {
            if (toastTimer.current) {
                clearTimeout(toastTimer.current);
            }
        };
    }, []);

    const getOptionalToken = useCallback(async () => {
        if (!uid) return undefined;
        try {
            const token = await getIdToken();
            return token || undefined;
        } catch {
            return undefined;
        }
    }, [getIdToken, uid]);

    const showToast = (message: string) => {
        if (toastTimer.current) {
            clearTimeout(toastTimer.current);
        }
        setToastMessage(message);
        toastTimer.current = setTimeout(() => setToastMessage(''), 3000);
    };

    const showRemainingSavesToast = useCallback(async () => {
        try {
            if (!uid) {
                showToast('Free plan: 5 saves/day · 20/month. Sign in to save.');
                return;
            }
            const profile = await fetchUserProfile(uid);
            const planId = profile?.subscription?.planId || 'free';
            const limits = getPlanLimits(planId);
            const itemsSnap = await getDocs(query(collection(db, 'items'), where('userId', '==', uid)));
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            let dayCount = 0;
            let monthCount = 0;
            itemsSnap.forEach((docSnap) => {
                const data = docSnap.data() as any;
                const created = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt;
                if (created && created >= startOfDay) dayCount += 1;
                if (created && created >= startOfMonth) monthCount += 1;
            });
            const remainingDaily =
                limits.dailySaves && isFinite(limits.dailySaves)
                    ? Math.max(limits.dailySaves - dayCount, 0)
                    : null;
            const remainingMonthly =
                limits.monthlySaves && isFinite(limits.monthlySaves)
                    ? Math.max(limits.monthlySaves - monthCount, 0)
                    : null;
            if (remainingDaily === null && remainingMonthly === null) return;
            const parts: string[] = [];
            if (typeof remainingDaily === 'number') parts.push(`${remainingDaily} saves left today`);
            if (typeof remainingMonthly === 'number') parts.push(`${remainingMonthly} left this month`);
            showToast(parts.length ? parts.join(' · ') : 'Free plan active');
        } catch (err) {
            console.warn('Toast remaining saves failed', err);
        }
    }, [uid, showToast]);

    const handleSelectType = (type: ContentType) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setContentType(type);
        resetForm();
    };

    const handleBackToSelection = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        resetForm();
        setContentType(null);
    };

    const resetForm = () => {
        setUrl('');
        setMediaUri('');
        setAnalyzed(false);
        setTitle('');
        setDescription('');
        setTags([]);
        setSuggestedFolders([]);
        setSelectedFolder(null);
        setAiCategory(null);
        setMetadataTitle('');
        setShowNewFolderInput(false);
        setNewFolderName('');
        setNewTag('');
        setClipboardPrefill(false);
    };

    const tryPrefillFromClipboard = async () => {
        if (clipboardPrefill || url) return;
        try {
            const clip = await Clipboard.getStringAsync();
            const trimmed = clip.trim();
            const looksLikeUrl = /^https?:\/\//i.test(trimmed) || trimmed.includes('.');
            if (trimmed && looksLikeUrl) {
                setUrl(trimmed);
                setClipboardPrefill(true);
            }
        } catch (err) {
            console.warn('Clipboard prefill skipped', err);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setMediaUri(result.assets[0].uri);
        }
    };

    const pickVideo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setMediaUri(result.assets[0].uri);
        }
    };

    const analyzeContent = async () => {
        try {
            if (!contentType) {
                Alert.alert('Pick a type', 'Select URL, image, or video first.');
                return;
            }

            if (contentType === 'url' && !url) {
                Alert.alert('Add a URL', 'Please paste a URL to analyze.');
                return;
            }

            if ((contentType === 'image' || contentType === 'video') && !mediaUri) {
                Alert.alert('Add media', 'Please choose a file to analyze.');
                return;
            }

            setIsAnalyzing(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            let analysisResult;
            const clerkToken = await getOptionalToken();

            if (contentType === 'url') {
                const metadata = await extractUrlMetadata(url);
                setMetadataTitle(metadata.title || '');
                setTitle(metadata.title || title);
                setDescription(metadata.description || '');
                setTags(metadata.description ? metadata.description.split(' ').slice(0, 5) : []);
                setAnalyzed(true);
                void showRemainingSavesToast();
                setIsAnalyzing(false);
                return;
            } else if (contentType === 'image') {
                const base64 = await imageToBase64(mediaUri);
                analysisResult = await analyzeContentWithAI(
                    {
                        type: 'image',
                        imageBase64: base64,
                        preferredFolders: uniqueAvailableFolders,
                    },
                    clerkToken
                );
            } else {
                analysisResult = await analyzeContentWithAI(
                    {
                        type: 'video',
                        url: mediaUri,
                        preferredFolders: uniqueAvailableFolders,
                    },
                    clerkToken
                );
            }

            // Keep URL title from metadata; use AI title for media
            if (contentType === 'image' || contentType === 'video') {
                setTitle(analysisResult.title);
            }
            setDescription(analysisResult.description);
            setTags(analysisResult.tags || []);
            setAiCategory(analysisResult.category || null);

            const folders = analysisResult.suggestedFolders?.length
                ? analysisResult.suggestedFolders
                : [analysisResult.category || 'New Folder'];

            setSuggestedFolders(folders);
            setSelectedFolder(folders[0] || null);
            setAnalyzed(true);
            void showRemainingSavesToast();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.error('Analyze failed', error);
            Alert.alert('Analysis failed', 'We could not analyze this content. Please try again.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const runAiMagic = async () => {
        try {
            if (!contentType) {
                Alert.alert('Pick a type', 'Select URL, image, or video first.');
                return;
            }
            setAiLoading(true);
            let analysisResult;
            const clerkToken = await getOptionalToken();

            if (contentType === 'url') {
                const metadata = await extractUrlMetadata(url);
                analysisResult = await analyzeContentWithAI(
                    {
                        type: 'url',
                        metadata,
                        preferredFolders: uniqueAvailableFolders,
                    },
                    clerkToken
                );
            } else if (contentType === 'image') {
                const base64 = await imageToBase64(mediaUri);
                analysisResult = await analyzeContentWithAI(
                    {
                        type: 'image',
                        imageBase64: base64,
                        preferredFolders: uniqueAvailableFolders,
                    },
                    clerkToken
                );
            } else {
                analysisResult = await analyzeContentWithAI(
                    {
                        type: 'video',
                        url: mediaUri || url,
                        preferredFolders: uniqueAvailableFolders,
                    },
                    clerkToken
                );
            }

            // Prefer AI output, fall back to existing/metadata so UI updates consistently
            setTitle(analysisResult.title || metadataTitle || title);
            setDescription(analysisResult.description || description);
            setTags(analysisResult.tags?.length ? analysisResult.tags : tags);
            const folders = analysisResult.suggestedFolders?.length
                ? analysisResult.suggestedFolders
                : [analysisResult.category || 'New Folder'];
            setSuggestedFolders(folders);
            setSelectedFolder(folders[0] || selectedFolder);
            setAiCategory(analysisResult.category || aiCategory);
            setAnalyzed(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            console.error('AI clean failed', err);
            Alert.alert('AI clean failed', 'Please try again.');
        } finally {
            setAiLoading(false);
        }
    };

    const handleSave = async () => {
        if (!contentType) {
            Alert.alert('Pick a type', 'Please choose URL, image, or video first.');
            return;
        }

        if (!title || !selectedFolder) {
            Alert.alert('Missing Information', 'Please add a title and select a folder');
            return;
        }

        if (!uid) {
            Alert.alert(
                'Sign up to save',
                'Create a free account to save this item.',
                [
                    {
                        text: 'OK',
                        onPress: () => router.push('/(tabs)/profile'),
                    },
                ]
            );
            return;
        }

        try {
            setIsSaving(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            const saveResult = await saveContent({
                // returns remaining limits for toasts
                type: contentType,
                url: contentType === 'url' ? url : undefined,
                mediaUri: contentType !== 'url' ? mediaUri : undefined,
                // Always honor user-edited title; fall back to metadata only if empty
                title: title || metadataTitle,
                description,
                tags,
                folderName: selectedFolder || undefined,
                aiSuggestedFolders: suggestedFolders,
                aiCategory: aiCategory || undefined,
            });
            if (saveResult?.planId === 'free') {
                const parts: string[] = [];
                if (typeof saveResult.remainingDaily === 'number') {
                    parts.push(`${saveResult.remainingDaily} saves left today`);
                }
                if (typeof saveResult.remainingMonthly === 'number') {
                    parts.push(`${saveResult.remainingMonthly} left this month`);
                }
                const message = parts.length ? `Free plan: ${parts.join(' · ')}` : 'Saved on free plan.';
                showToast(message);
            }

            Alert.alert('Success!', 'Your content has been saved', [
                {
                    text: 'OK', onPress: () => {
                        resetForm();
                        router.replace('/(tabs)');
                    }
                }
            ]);
        } catch (error: any) {
            console.error('Save failed', error);
            const msg = error?.message || 'Could not save your content. Please try again.';
            const limitHit = msg.toLowerCase().includes('limit');
            if (limitHit) {
                Alert.alert(
                    'Upgrade required',
                    msg,
                    [
                        {
                            text: 'OK',
                            onPress: () => router.push('/pricing'),
                        },
                    ]
                );
            } else {
                Alert.alert('Save failed', msg);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const removeTag = (tagToRemove: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    return (
        <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                {contentType ? (
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleBackToSelection}
                        activeOpacity={0.7}
                    >
                        <ArrowLeft size={22} color={Colors.text} />
                        <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.headerSide} />
                )}

                <Text style={styles.headerTitle}>Add Content</Text>

                {/* Right side placeholder to keep title centered */}
                <View style={styles.headerSide} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {!contentType ? (
                    /* Type Selection */
                    <Animated.View entering={FadeIn} style={styles.typeSelection}>
                        <Text style={styles.sectionTitle}>What would you like to save?</Text>

                        <TouchableOpacity
                            style={styles.typeCard}
                            onPress={() => handleSelectType('url')}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.typeIcon, { backgroundColor: '#fdf2f8' }]}>
                                <Link2 size={28} color={Colors.primary} />
                            </View>
                            <Text style={styles.typeTitle}>URL Link</Text>
                            <Text style={styles.typeDescription}>Save articles, videos, or any web content</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.typeCard, styles.typeCardDisabled]}
                            activeOpacity={1}
                            disabled
                        >
                            <View style={[styles.typeIcon, { backgroundColor: '#f0f9ff' }]}>
                                <ImageIcon size={28} color="#9ca3af" />
                            </View>
                            <Text style={[styles.typeTitle, styles.typeDisabledText]}>Image (coming soon)</Text>
                            <Text style={[styles.typeDescription, styles.typeDisabledText]}>Upload photos from your gallery</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.typeCard, styles.typeCardDisabled]}
                            activeOpacity={1}
                            disabled
                        >
                            <View style={[styles.typeIcon, { backgroundColor: '#f5f3ff' }]}>
                                <Video size={28} color="#9ca3af" />
                            </View>
                            <Text style={[styles.typeTitle, styles.typeDisabledText]}>Video (coming soon)</Text>
                            <Text style={[styles.typeDescription, styles.typeDisabledText]}>Save videos for later viewing</Text>
                        </TouchableOpacity>
                    </Animated.View>
                ) : (
                    /* Content Input & Analysis */
                    <Animated.View entering={SlideInDown} style={styles.inputSection}>
                        {contentType === 'url' && !analyzed && (
                            <View>
                                <Text style={styles.sectionTitle}>Paste URL</Text>
                                <View style={styles.urlInputContainer}>
                                    <TextInput
                                        style={styles.urlInput}
                                        placeholder="https://example.com/article"
                                        placeholderTextColor={Colors.textSecondary}
                                        value={url}
                                        onChangeText={setUrl}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        keyboardType="url"
                                        onFocus={tryPrefillFromClipboard}
                                    />
                                </View>

                                <TouchableOpacity
                                    style={[styles.analyzeButton, !url && styles.analyzeButtonDisabled]}
                                    onPress={() => {
                                        Keyboard.dismiss();
                                        analyzeContent();
                                    }}
                                    disabled={!url || isAnalyzing}
                                >
                                    {isAnalyzing ? (
                                        <ActivityIndicator color="#ffffff" />
                                    ) : (
                                        <>
                                            <Sparkles size={20} color="#ffffff" />
                                            <Text style={styles.analyzeButtonText}>Analyze with AI</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        {(contentType === 'image' || contentType === 'video') && mediaUri && !analyzed && (
                            <View>
                                <Image source={{ uri: mediaUri }} style={styles.mediaPreview} />
                                <TouchableOpacity
                                    style={styles.analyzeButton}
                                    onPress={analyzeContent}
                                    disabled={isAnalyzing}
                                >
                                    {isAnalyzing ? (
                                        <ActivityIndicator color="#ffffff" />
                                    ) : (
                                        <>
                                            <Sparkles size={20} color="#ffffff" />
                                            <Text style={styles.analyzeButtonText}>Analyze with AI</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        {analyzed && (
                            <Animated.View entering={FadeIn}>
                                {/* Title */}
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Title</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        value={title}
                                        onChangeText={setTitle}
                                        multiline
                                    />
                                </View>

                                {/* Description */}
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Description</Text>
                                    <TextInput
                                        style={[styles.textInput, styles.textArea]}
                                        value={description}
                                        onChangeText={setDescription}
                                        multiline
                                        numberOfLines={4}
                                    />
                                </View>

                                {/* Tags */}
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Tags</Text>
                                    <View style={styles.tagsContainer}>
                                        {tags.map((tag) => (
                                            <View key={tag} style={styles.tag}>
                                                <Text style={styles.tagText}>{tag}</Text>
                                                <TouchableOpacity onPress={() => removeTag(tag)}>
                                                    <X size={14} color={Colors.primary} />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                        <View style={styles.newTagRow}>
                                            <TextInput
                                                style={styles.newTagInput}
                                                placeholder="Add tag"
                                                placeholderTextColor={Colors.textSecondary}
                                                value={newTag}
                                                onChangeText={setNewTag}
                                                onSubmitEditing={() => {
                                                    const tag = newTag.trim();
                                                    if (!tag) return;
                                                    setTags([...tags, tag]);
                                                    setNewTag('');
                                                }}
                                            />
                                            <TouchableOpacity
                                                style={styles.addTagButton}
                                                onPress={() => {
                                                    const tag = newTag.trim();
                                                    if (!tag) return;
                                                    setTags([...tags, tag]);
                                                    setNewTag('');
                                                }}
                                            >
                                                <Text style={styles.addTagButtonText}>Add</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>

                                {/* Folder Selection */}
                                <View style={styles.formGroup}>
                                    <Text style={styles.label}>Save to Folder</Text>

                                    {/* Suggested row */}
                                    {uniqueSuggestedFolders.length > 0 && (
                                        <View style={styles.folderRow}>
                                            <Text style={styles.folderRowLabel}>Suggested</Text>
                                            <ScrollView
                                                horizontal
                                                showsHorizontalScrollIndicator={false}
                                                contentContainerStyle={{ gap: 8 }}
                                            >
                                                {uniqueSuggestedFolders.map((folder) => (
                                                    <TouchableOpacity
                                                        key={`suggested-${folder}`}
                                                        style={[
                                                            styles.folderChip,
                                                            selectedFolder === folder && styles.folderChipSelected
                                                        ]}
                                                        onPress={() => {
                                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                            setSelectedFolder(folder);
                                                        }}
                                                    >
                                                        <Text style={[
                                                            styles.folderChipText,
                                                            selectedFolder === folder && styles.folderChipTextSelected
                                                        ]}>
                                                            {folder}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </View>
                                    )}

                                    {/* Available row */}
                                    <View style={styles.folderRow}>
                                        <Text style={styles.folderRowLabel}>Your folders</Text>
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={false}
                                            contentContainerStyle={{ gap: 8 }}
                                        >
                                            {uniqueAvailableFolders.map((folder) => (
                                                <TouchableOpacity
                                                    key={`avail-${folder}`}
                                                    style={[
                                                        styles.folderChip,
                                                        selectedFolder === folder && styles.folderChipSelected
                                                    ]}
                                                    onPress={() => {
                                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                        setSelectedFolder(folder);
                                                    }}
                                                >
                                                    <Text style={[
                                                        styles.folderChipText,
                                                        selectedFolder === folder && styles.folderChipTextSelected
                                                    ]}>
                                                        {folder}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}

                                            <TouchableOpacity
                                                style={styles.newFolderButton}
                                                onPress={() => {
                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                    setShowNewFolderInput(true);
                                                }}
                                            >
                                                <FolderPlus size={16} color={Colors.primary} />
                                                <Text style={styles.newFolderText}>New Folder</Text>
                                            </TouchableOpacity>
                                        </ScrollView>
                                    </View>

                                    {showNewFolderInput && (
                                        <View style={styles.newFolderInput}>
                                            <TextInput
                                                style={styles.newFolderTextInput}
                                                placeholder="Folder name"
                                                placeholderTextColor={Colors.textSecondary}
                                                value={newFolderName}
                                                onChangeText={setNewFolderName}
                                                onSubmitEditing={() => {
                                                    if (!newFolderName.trim()) return;
                                                    const name = newFolderName.trim();
                                                    setSuggestedFolders([name, ...suggestedFolders]);
                                                    setSelectedFolder(name);
                                                    setShowNewFolderInput(false);
                                                    setNewFolderName('');
                                                }}
                                            />
                                            <TouchableOpacity
                                                style={styles.addFolderButton}
                                                onPress={() => {
                                                    if (!newFolderName.trim()) return;
                                                    const name = newFolderName.trim();
                                                    setSuggestedFolders([name, ...suggestedFolders]);
                                                    setSelectedFolder(name);
                                                    setShowNewFolderInput(false);
                                                    setNewFolderName('');
                                                }}
                                            >
                                                <Text style={styles.addFolderButtonText}>Add</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>

                                {/* AI Organize + Save */}
                                <TouchableOpacity
                                    style={[styles.saveButton, styles.aiButton]}
                                    onPress={runAiMagic}
                                    disabled={aiLoading}
                                >
                                    {aiLoading ? (
                                        <ActivityIndicator color="#ffffff" />
                                    ) : (
                                        <Text style={styles.saveButtonText}>AI Organize</Text>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.saveButton}
                                    onPress={handleSave}
                                    disabled={isSaving}
                                >
                                    {isSaving ? (
                                        <ActivityIndicator color="#ffffff" />
                                    ) : (
                                        <Text style={styles.saveButtonText}>Save Content</Text>
                                    )}
                                </TouchableOpacity>

                            </Animated.View>
                        )}
                    </Animated.View>
                )}
            </ScrollView>
        {toastMessage ? (
            <View style={styles.toast}>
                <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
        ) : null}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: Colors.text,
        flex: 1,
        textAlign: 'center',
    },
    headerSide: {
        width: 70,
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 8,
    },
    backButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 20,
    },
    typeSelection: {
        gap: 16,
    },
    typeCard: {
        backgroundColor: Colors.surface,
        borderRadius: 20,
        padding: 24,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    typeIcon: {
        width: 60,
        height: 60,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    typeTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 6,
    },
    typeDisabledText: {
        color: Colors.textSecondary,
    },
    typeDescription: {
        fontSize: 14,
        color: Colors.textSecondary,
        lineHeight: 20,
    },
    typeCardDisabled: {
        opacity: 0.55,
    },
    inputSection: {
        gap: 20,
    },
    urlInputContainer: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 20,
    },
    urlInput: {
        fontSize: 16,
        color: Colors.text,
    },
    mediaPreview: {
        width: '100%',
        height: 300,
        borderRadius: 16,
        backgroundColor: Colors.surface,
        marginBottom: 20,
    },
    analyzeButton: {
        backgroundColor: Colors.primary,
        borderRadius: 16,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    analyzeButtonDisabled: {
        backgroundColor: Colors.border,
    },
    analyzeButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    formGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text,
        marginBottom: 12,
    },
    textInput: {
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        color: Colors.text,
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fdf2f8',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        gap: 6,
    },
    tagText: {
        fontSize: 14,
        color: Colors.primary,
        fontWeight: '600',
    },
    foldersContainer: {
        gap: 10,
    },
    folderRow: {
        marginTop: 8,
        gap: 6,
    },
    folderRowLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginLeft: 2,
    },
    folderChip: {
        backgroundColor: Colors.surface,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Colors.border,
    },
    folderChipSelected: {
        backgroundColor: '#fdf2f8',
        borderColor: Colors.primary,
    },
    folderChipText: {
        fontSize: 14,
        color: Colors.text,
        fontWeight: '600',
    },
    folderChipTextSelected: {
        color: Colors.primary,
    },
    newFolderButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: Colors.primary,
        borderStyle: 'dashed',
    },
    newFolderText: {
        fontSize: 14,
        color: Colors.primary,
        fontWeight: '600',
    },
    newFolderInput: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    newFolderTextInput: {
        flex: 1,
        backgroundColor: Colors.surface,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: Colors.border,
        color: Colors.text,
    },
    addFolderButton: {
        backgroundColor: Colors.primary,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    addFolderButtonText: {
        color: '#fff',
        fontWeight: '700',
    },
    saveButton: {
        backgroundColor: Colors.success,
        borderRadius: 16,
        padding: 18,
        alignItems: 'center',
        marginTop: 20,
    },
    aiButton: {
        backgroundColor: Colors.primary,
    },
    newTagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
        width: '100%',
    },
    newTagInput: {
        flex: 1,
        backgroundColor: Colors.surface,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: Colors.border,
        color: Colors.text,
    },
    addTagButton: {
        backgroundColor: Colors.primary,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    toast: {
        position: 'absolute',
        bottom: 30,
        alignSelf: 'center',
        backgroundColor: '#111827',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    toastText: {
        color: '#fff',
        fontWeight: '700',
        textAlign: 'center',
    },
    addTagButtonText: {
        color: '#fff',
        fontWeight: '700',
    },
    saveButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
});
