// app/(tabs)/collections.tsx
import { useAuth } from '@clerk/clerk-expo';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Folder, MoreVertical, Plus } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFolders } from '../../hooks/useFolders';
import { useContent } from '../../hooks/userContent';

const { width } = Dimensions.get('window');
const CARD_MARGIN = 16;
const CARD_WIDTH = (width - (CARD_MARGIN * 3)) / 2;

const Colors = {
    primary: '#ec4899',
    secondary: '#a855f7',
    background: '#ffffff',
    surface: '#fafafa',
    text: '#171717',
    textSecondary: '#737373',
    border: '#e5e5e5',
};

// Predefined color palette for folders
const folderColors = [
    { bg: '#fdf2f8', border: '#fce7f3', icon: '#ec4899' }, // Pink
    { bg: '#faf5ff', border: '#f3e8ff', icon: '#a855f7' }, // Purple
    { bg: '#eff6ff', border: '#dbeafe', icon: '#3b82f6' }, // Blue
    { bg: '#f0fdfa', border: '#ccfbf1', icon: '#14b8a6' }, // Teal
    { bg: '#fef3c7', border: '#fde68a', icon: '#f59e0b' }, // Amber
    { bg: '#fee2e2', border: '#fecaca', icon: '#ef4444' }, // Red
];

export default function CollectionsScreen() {
    const { getFolders, createFolder } = useFolders();
    const { getContent } = useContent();
    const { isSignedIn } = useAuth();
    const router = useRouter();
    const [folders, setFolders] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [newFolder, setNewFolder] = useState('');
    const [hasLoaded, setHasLoaded] = useState(false);

    const loadFolders = useCallback(async () => {
        if (!isSignedIn) return;
        try {
            setLoading(true);
            const [folderData, items] = await Promise.all([
                getFolders(),
                getContent()
            ]);
            const counts = items.reduce((acc: Record<string, number>, item: any) => {
                if (item.folderId) {
                    acc[item.folderId] = (acc[item.folderId] || 0) + 1;
                }
                return acc;
            }, {});
            const merged = folderData.map(f => ({
                ...f,
                itemCount: counts[f.id] || 0
            }));
            setFolders(merged);
        } catch (err) {
            console.error('Load folders failed', err);
        } finally {
            setLoading(false);
        }
    }, [isSignedIn, getFolders]);

    useEffect(() => {
        if (isSignedIn && !hasLoaded) {
            loadFolders().finally(() => setHasLoaded(true));
        }
    }, [isSignedIn, hasLoaded, loadFolders]);

    const handleCreateFolder = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setCreating(true);
    };

    const handleAddFolder = async () => {
        if (!newFolder.trim()) {
            setCreating(false);
            return;
        }
        try {
            setLoading(true);
            const id = await createFolder(newFolder.trim());
            setFolders(prev => [{ id, name: newFolder.trim(), itemCount: 0 }, ...prev]);
            setHasLoaded(true); // cache remains valid; no refetch on return
        } catch (err) {
            console.error('Create folder failed', err);
        } finally {
            setCreating(false);
            setNewFolder('');
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Collections</Text>
                    <Text style={styles.subtitle}>{folders.length} folders</Text>
                </View>

                <TouchableOpacity
                    style={styles.createButton}
                    onPress={handleCreateFolder}
                >
                    <Plus size={24} color="#ffffff" />
                </TouchableOpacity>
            </View>

            {creating && (
                <View style={styles.newFolderRow}>
                    <TextInput
                        style={styles.newFolderInput}
                        placeholder="Folder name"
                        value={newFolder}
                        onChangeText={setNewFolder}
                        onSubmitEditing={handleAddFolder}
                    />
                    <TouchableOpacity style={styles.addFolderButton} onPress={handleAddFolder}>
                        <Text style={styles.addFolderText}>Add</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelFolderButton} onPress={() => { setCreating(false); setNewFolder(''); }}>
                        <Text style={styles.cancelFolderText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Folders Grid */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {loading ? (
                    <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} />
                ) : folders.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyStateText}>No folders yet</Text>
                        <Text style={styles.emptyStateSubtext}>Create your first folder to organize content</Text>
                    </View>
                ) : (
                    <View style={styles.grid}>
                        {folders.map((folder, index) => (
                            <Animated.View
                                key={folder.id}
                                entering={FadeInDown.delay(index * 100).springify()}
                            >
                                <FolderCard
                                    folder={folder}
                                    index={index}
                                    onPress={() => router.push({ pathname: '/folder/[id]', params: { id: folder.id, name: folder.name } })}
                                />
                            </Animated.View>
                        ))}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

function FolderCard({ folder, index, onPress }: { folder: any; index: number; onPress: () => void }) {
    // Use folder.colorIndex if it exists, otherwise generate one based on folder id/index
    const colorIndex = folder.colorIndex !== undefined
        ? folder.colorIndex
        : index % folderColors.length;

    const colors = folderColors[colorIndex];

    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.border }]}
            activeOpacity={0.8}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onPress();
            }}
        >
            {/* Folder Icon */}
            <View style={styles.cardHeader}>
                <View style={[styles.folderIcon, { backgroundColor: '#ffffff' }]}>
                    <Folder size={28} color={colors.icon} fill={colors.icon} />
                </View>
                <TouchableOpacity
                    style={styles.moreButton}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                >
                    <MoreVertical size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Folder Info */}
            <View style={styles.cardContent}>
                <Text style={styles.folderName} numberOfLines={2}>
                    {folder.name}
                </Text>
                <Text style={styles.itemCount}>
                    {folder.itemCount || 0} {folder.itemCount === 1 ? 'item' : 'items'}
                </Text>
            </View>

            {/* Preview Grid (placeholder) */}
            <View style={styles.previewGrid}>
                {[1, 2, 3, 4].map((i) => (
                    <View
                        key={i}
                        style={[styles.previewItem, { backgroundColor: colors.border }]}
                    />
                ))}
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 15,
        color: Colors.textSecondary,
    },
    createButton: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    newFolderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    newFolderInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: Colors.border,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    addFolderButton: {
        backgroundColor: Colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 10,
    },
    addFolderText: {
        color: '#fff',
        fontWeight: '700',
    },
    cancelFolderButton: {
        backgroundColor: Colors.surface,
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: Colors.border,
    },
    cancelFolderText: {
        color: Colors.text,
        fontWeight: '700',
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: CARD_MARGIN,
        paddingBottom: 100,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    card: {
        width: CARD_WIDTH,
        borderRadius: 20,
        marginBottom: CARD_MARGIN,
        padding: 16,
        borderWidth: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    folderIcon: {
        width: 56,
        height: 56,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 2,
    },
    moreButton: {
        padding: 4,
    },
    cardContent: {
        marginBottom: 16,
    },
    folderName: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 6,
        lineHeight: 22,
    },
    itemCount: {
        fontSize: 13,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    previewGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
    },
    previewItem: {
        width: (CARD_WIDTH - 40) / 2 - 2,
        height: 32,
        borderRadius: 6,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 80,
        paddingHorizontal: 40,
    },
    emptyStateText: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 8,
    },
    emptyStateSubtext: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: 'center',
    },
});
