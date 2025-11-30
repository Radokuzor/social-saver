import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import {
    Bell,
    ChevronRight,
    FileText,
    HelpCircle,
    Lock,
    LogOut,
    Palette,
    Settings,
    Trash2,
    User,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    Linking,
} from 'react-native';
import { useAuth, useClerk, useUser } from '@clerk/clerk-expo';
import { useContent } from '../../hooks/userContent';
import { useFolders } from '../../hooks/useFolders';
import { useTheme } from '../../contexts/ThemeProvider';
import { db } from '../../services/firebase';
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';

const Colors = {
    primary: '#ec4899',
    background: '#ffffff',
    surface: '#fafafa',
    text: '#171717',
    textSecondary: '#737373',
    border: '#e5e5e5',
    danger: '#ef4444',
};

export default function ProfileScreen() {
    const router = useRouter();
    const { isSignedIn } = useAuth();
    const { user } = useUser();
    const { signOut } = useClerk();
    const { getContent } = useContent();
    const { getFolders } = useFolders();
    const { colors, setTheme, theme } = useTheme();
    const [itemCount, setItemCount] = useState<number | null>(null);
    const [collectionCount, setCollectionCount] = useState<number | null>(null);
    const [tagCount, setTagCount] = useState<number | null>(null);
    const [showAppearanceModal, setShowAppearanceModal] = useState(false);
    const [appearance, setAppearance] = useState<'pink' | 'grey' | 'purple'>(theme);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);
    const [handleInput, setHandleInput] = useState('');
    const [phoneInput, setPhoneInput] = useState('');
    const [firstNameInput, setFirstNameInput] = useState('');
    const [lastNameInput, setLastNameInput] = useState('');
    const [handleError, setHandleError] = useState<string | null>(null);
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileHandle, setProfileHandle] = useState<string | null>(null);
    const [profilePhone, setProfilePhone] = useState<string | null>(null);
    const [profileFirstName, setProfileFirstName] = useState<string | null>(null);
    const [profileLastName, setProfileLastName] = useState<string | null>(null);
    const [showSupportModal, setShowSupportModal] = useState(false);
    const ensureCountryCode = (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('+')) {
            return `+${trimmed.replace(/[^\d]/g, '')}`;
        }
        return `+1${trimmed.replace(/[^\d]/g, '')}`;
    };

    const loadStats = useCallback(async () => {
        if (!isSignedIn) {
            setItemCount(null);
            setCollectionCount(null);
            setTagCount(null);
            setProfileHandle(null);
            setProfilePhone(null);
            return;
        }
        try {
            console.log('[profile] loading stats');
            const [items, folders] = await Promise.all([
                getContent(),
                getFolders(),
            ]);
            console.log('[profile] items:', items.length, 'folders:', folders.length);
            setItemCount(items.length);
            setCollectionCount(folders.length);
            const tags = new Set<string>();
            items.forEach((i: any) => {
                if (Array.isArray(i.tags)) {
                    i.tags.forEach((t: string) => tags.add(t));
                }
            });
            setTagCount(tags.size);

            // Load profile info
            const docRef = doc(db, 'users', user?.id || '');
            const snap = await getDoc(docRef);
            if (snap.exists()) {
                const data = snap.data() as any;
                setProfileHandle(data.handle || null);
                setProfilePhone(data.phoneNumber || null);
                setProfileFirstName(data.firstName || null);
                setProfileLastName(data.lastName || null);
            } else {
                setProfileHandle(null);
                setProfilePhone(null);
                setProfileFirstName(null);
                setProfileLastName(null);
            }
        } catch (err) {
            console.error('Load stats failed', err);
            setItemCount(0);
            setCollectionCount(0);
            setTagCount(0);
        }
    }, [isSignedIn, getContent, getFolders, user?.id]);

    useEffect(() => {
        loadStats();
    }, [loadStats]);

    useFocusEffect(
        useCallback(() => {
            loadStats();
        }, [loadStats])
    );
    const handleLogout = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await signOut();
                            router.replace('/signup');
                        } catch (err) {
                            console.error('Clerk sign out failed', err);
                            Alert.alert('Logout failed', 'Please try again.');
                        }
                    }
                },
            ]
        );
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'This will permanently delete your account and all your saved content. This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        // TODO: Implement account deletion
                        console.log('Deleting account...');
                    }
                },
            ]
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* User Info Card */}
                <View style={[styles.userCard, { backgroundColor: colors.surface }]}>
                    <View style={[styles.avatar, { backgroundColor: colors.primaryLight }]}>
                        <User size={32} color={Colors.primary} />
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>
                            {isSignedIn
                                ? `${(profileFirstName || user?.firstName || '')} ${(profileLastName || user?.lastName || '')}`.trim() || 'Your name'
                                : 'Guest User'}
                        </Text>
                        {profileHandle ? (
                            <Text style={[styles.handle, { color: colors.primary }]}>@{profileHandle}</Text>
                        ) : null}
                        <Text style={[styles.userEmail, { color: colors.textSecondary }]}>
                            {isSignedIn ? (user?.primaryEmailAddress?.emailAddress || 'email not set') : 'Not signed in'}
                        </Text>
                        {profilePhone ? (
                            <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{profilePhone}</Text>
                        ) : null}
                    </View>
                    {isSignedIn && (
                        <TouchableOpacity
                            style={styles.editButton}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setHandleInput(profileHandle ? `@${profileHandle}` : '');
                                setPhoneInput(profilePhone || '');
                                setHandleError(null);
                                setFirstNameInput(profileFirstName || user?.firstName || '');
                                setLastNameInput(profileLastName || user?.lastName || '');
                                setShowProfileModal(true);
                            }}
                        >
                            <Text style={styles.editButtonText}>Edit</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Stats */}
                <View style={[styles.statsContainer, { backgroundColor: colors.surface }]}>
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.text }]}>{itemCount ?? '—'}</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Items Saved</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.text }]}>{collectionCount ?? '—'}</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Collections</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.text }]}>{tagCount ?? '—'}</Text>
                        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Tags</Text>
                    </View>
                </View>

                {/* Settings Sections */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Preferences</Text>
                    <SettingItem
                        icon={Palette}
                        label="Appearance"
                        subtitle="Customize your experience"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowAppearanceModal(true);
                        }}
                        colors={colors}
                    />
                    {/* Notifications will be used later */}
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Account</Text>
                    {/* Privacy & Security temporarily hidden */}
                    <SettingItem
                        icon={Settings}
                        label="Account Settings"
                        subtitle="Update your account details"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push('/pricing');
                        }}
                        colors={colors}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Support</Text>
                    <SettingItem
                        icon={HelpCircle}
                        label="Help & Support"
                        subtitle="Get help with the app"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowSupportModal(true);
                        }}
                        colors={colors}
                    />
                    <SettingItem
                        icon={FileText}
                        label="Terms & Privacy"
                        subtitle="Read our policies"
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowPrivacyModal(true);
                        }}
                        colors={colors}
                    />
                </View>

                {/* Danger Zone */}
                <View style={styles.section}>
                    <SettingItem
                        icon={LogOut}
                        label="Log Out"
                        iconColor={Colors.danger}
                        labelColor={Colors.danger}
                        onPress={handleLogout}
                        showChevron={false}
                        colors={colors}
                    />
                    <SettingItem
                        icon={Trash2}
                        label="Delete Account"
                        iconColor={Colors.danger}
                        labelColor={Colors.danger}
                        onPress={handleDeleteAccount}
                        showChevron={false}
                        colors={colors}
                    />
                </View>

                <Text style={styles.version}>Version 1.0.0 (Beta)</Text>
            </ScrollView>

            {!isSignedIn && (
                <View style={styles.overlay}>
                    <View style={styles.overlayBox}>
                        <Text style={styles.overlayTitle}>Join Social Saver</Text>
                        <Text style={styles.overlaySubtitle}>Sign up or sign in to sync your profile and saved content.</Text>
                        <TouchableOpacity
                            style={styles.overlayButton}
                            onPress={() => router.push('/signup')}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.overlayButtonText}>Sign up / Sign in</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Appearance Modal */}
            <Modal
                visible={showAppearanceModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowAppearanceModal(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
                        <Text style={styles.modalTitle}>Choose appearance</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>Pick a palette that suits you.</Text>

                        <View style={styles.appearanceList}>
                            <AppearanceOption
                                label="Light & Pink"
                                description="Current look"
                                colors={['#fdf2f8', '#ec4899', '#ffffff']}
                                selected={appearance === 'pink'}
                                onSelect={() => { setAppearance('pink'); setTheme('pink'); }}
                            />
                            <AppearanceOption
                                label="Dark & Grey"
                                description="Low contrast, night friendly"
                                colors={['#111827', '#1f2937', '#4b5563']}
                                selected={appearance === 'grey'}
                                onSelect={() => { setAppearance('grey'); setTheme('grey'); }}
                            />
                            <AppearanceOption
                                label="Purple & Blue"
                                description="Cool gradient vibes"
                                colors={['#312e81', '#4338ca', '#2563eb']}
                                selected={appearance === 'purple'}
                                onSelect={() => { setAppearance('purple'); setTheme('purple'); }}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.modalClose, { backgroundColor: colors.primary }]}
                            onPress={() => setShowAppearanceModal(false)}
                        >
                            <Text style={styles.modalCloseText}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Profile edit modal */}
            <Modal
                visible={showProfileModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowProfileModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                >
                    <TouchableOpacity
                        style={styles.modalBackdrop}
                        activeOpacity={1}
                        onPress={() => setShowProfileModal(false)}
                    >
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={(e) => e.stopPropagation()}
                            style={{ width: '100%', maxHeight: '85%' }}
                        >
                            <ScrollView
                                style={[styles.modalCard, { backgroundColor: colors.background }]}
                                contentContainerStyle={{ paddingBottom: 20 }}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                            >
                                <Text style={styles.modalTitle}>Edit profile</Text>
                                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                                    Set a name, unique @handle, and optional phone number.
                                </Text>

                                <Text style={styles.fieldLabel}>First name</Text>
                                <TextInput
                                    style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                                    placeholder="First name"
                                    placeholderTextColor={colors.textSecondary}
                                    value={firstNameInput}
                                    onChangeText={setFirstNameInput}
                                    autoCapitalize="words"
                                />

                                <Text style={styles.fieldLabel}>Last name</Text>
                                <TextInput
                                    style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                                    placeholder="Last name"
                                    placeholderTextColor={colors.textSecondary}
                                    value={lastNameInput}
                                    onChangeText={setLastNameInput}
                                    autoCapitalize="words"
                                />

                                <Text style={styles.fieldLabel}>@ Handle</Text>
                                <TextInput
                                    style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                                    placeholder="@yourhandle"
                                    placeholderTextColor={colors.textSecondary}
                                    value={handleInput}
                                    onChangeText={(t) => {
                                        setHandleInput(t);
                                        setHandleError(null);
                                    }}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />
                                {handleError ? <Text style={styles.errorText}>{handleError}</Text> : null}

                                <Text style={styles.fieldLabel}>Phone number</Text>
                                <TextInput
                                    style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                                    placeholder="+1 555 555 5555"
                                    placeholderTextColor={colors.textSecondary}
                                    value={phoneInput}
                                    onChangeText={setPhoneInput}
                                    keyboardType="phone-pad"
                                />

                                <View style={styles.modalActions}>
                                    <TouchableOpacity
                                        style={[styles.modalButton, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                                        onPress={() => setShowProfileModal(false)}
                                    >
                                        <Text style={[styles.modalButtonText, { color: colors.text }]}>Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.modalButton, { backgroundColor: colors.primary }]}
                                        onPress={async () => {
                                            if (!user?.id) return;
                                            const trimmed = handleInput.trim().replace(/^@/, '');
                                            if (!trimmed) {
                                                setHandleError('Handle is required');
                                                return;
                                            }
                                            const canonical = trimmed.toLowerCase();
                                            setSavingProfile(true);
                                            try {
                                                // Ensure handle is unique
                                        const handlesRef = collection(db, 'users');
                                        const q = query(handlesRef, where('handleLower', '==', canonical));
                                        const snap = await getDocs(q);
                                        const taken = snap.docs.some(d => d.id !== user.id);
                                                if (taken) {
                                                    setHandleError('Handle already taken. Choose another.');
                                                    setSavingProfile(false);
                                                    return;
                                                }
                                                const normalizedPhone = phoneInput ? ensureCountryCode(phoneInput) : '';
                                            await setDoc(doc(db, 'users', user.id), {
                                                userId: user.id,
                                                handle: trimmed,
                                                handleLower: canonical,
                                                phoneNumber: normalizedPhone,
                                                firstName: firstNameInput || '',
                                                lastName: lastNameInput || '',
                                                updatedAt: new Date(),
                                            }, { merge: true });
                                            setProfileHandle(trimmed);
                                            setProfilePhone(normalizedPhone || null);
                                            setProfileFirstName(firstNameInput || null);
                                            setProfileLastName(lastNameInput || null);
                                            // Update Clerk user metadata for display (optional)
                                            if (user) {
                                                await user.update?.({
                                                    firstName: firstNameInput || undefined,
                                                    lastName: lastNameInput || undefined,
                                                    } as any);
                                                }
                                                setShowProfileModal(false);
                                            } catch (err) {
                                                console.error('Save profile failed', err);
                                                setHandleError('Could not save. Please try again.');
                                            } finally {
                                                setSavingProfile(false);
                                            }
                                        }}
                                        disabled={savingProfile}
                                    >
                                        <Text style={[styles.modalButtonText, { color: '#fff' }]}>{savingProfile ? 'Saving...' : 'Save'}</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            </Modal>

            {/* Privacy & Security modal */}
            <Modal
                visible={showPrivacyModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowPrivacyModal(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { backgroundColor: colors.background, maxHeight: '80%' }]}>
                        <Text style={styles.modalTitle}>Privacy & Security</Text>
                        <ScrollView style={{ maxHeight: '70%' }} contentContainerStyle={{ paddingVertical: 8, gap: 8 }}>
                            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                                We take your privacy seriously. Our pledge is to handle your data responsibly, transparently, and with respect for your control.
                            </Text>
                            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                                • Data ownership: You own your content. We only use it to provide the service you expect, like saving, organizing, and syncing your items across devices.
                            </Text>
                            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                                • Limited collection: We collect only what is needed to operate the app (account info, saved items, and basic usage diagnostics). We do not sell your data.
                            </Text>
                            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                                • Security: We use industry-standard encryption in transit. Sensitive tokens are stored securely. Access is restricted and audited.
                            </Text>
                            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                                • Sharing: We do not share your personal data with third parties except for essential service providers (e.g., storage, auth) under strict agreements.
                            </Text>
                            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                                • Control: You can update your profile, remove content, or request account deletion at any time. We respect do-not-track signals within the app.
                            </Text>
                            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                                • Transparency: We’ll notify you about any material changes to our practices and provide clear options to manage your preferences.
                            </Text>
                            <Text style={[styles.modalBody, { color: colors.textSecondary }]}>
                                This summary is for convenience; please review our full policy for details. By continuing, you acknowledge and agree to these practices.
                            </Text>
                        </ScrollView>
                        <TouchableOpacity
                            style={[styles.modalClose, { backgroundColor: colors.primary, alignSelf: 'flex-end', marginTop: 10 }]}
                            onPress={() => setShowPrivacyModal(false)}
                        >
                            <Text style={[styles.modalCloseText, { color: '#fff' }]}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Support modal */}
            <Modal
                visible={showSupportModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowSupportModal(false)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { backgroundColor: colors.background, maxHeight: '60%' }]}>
                        <Text style={styles.modalTitle}>Help & Support</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                            Have a question or need assistance? Reach out to us:
                        </Text>
                        <TouchableOpacity
                            style={[styles.contactRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
                            onPress={() => Linking.openURL('mailto:admin@fourthwatchtech.com')}
                        >
                            <Text style={[styles.contactLabel, { color: colors.text }]}>Email</Text>
                            <Text style={[styles.contactValue, { color: colors.primary }]}>admin@fourthwatchtech.com</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.contactRow, { borderColor: colors.border, backgroundColor: colors.surface }]}
                            onPress={() => Linking.openURL('tel:+15127666445')}
                        >
                            <Text style={[styles.contactLabel, { color: colors.text }]}>Phone</Text>
                            <Text style={[styles.contactValue, { color: colors.primary }]}>+1 (512) 766-6445</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalClose, { backgroundColor: colors.primary, alignSelf: 'flex-end' }]}
                            onPress={() => setShowSupportModal(false)}
                        >
                            <Text style={[styles.modalCloseText, { color: '#fff' }]}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function AppearanceOption({
    label,
    description,
    colors,
    selected,
    onSelect,
}: {
    label: string;
    description: string;
    colors: string[];
    selected: boolean;
    onSelect: () => void;
}) {
    return (
        <TouchableOpacity
            style={[styles.appearanceOption, selected && styles.appearanceOptionSelected]}
            onPress={onSelect}
            activeOpacity={0.75}
        >
            <View style={styles.appearanceSwatches}>
                {colors.map((c) => (
                    <View key={c} style={[styles.swatch, { backgroundColor: c }]} />
                ))}
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.appearanceLabel}>{label}</Text>
                <Text style={styles.appearanceDescription}>{description}</Text>
            </View>
            {selected && <Text style={styles.appearanceSelectedText}>Selected</Text>}
        </TouchableOpacity>
    );
}

interface SettingItemProps {
    icon: any;
    label: string;
    subtitle?: string;
    iconColor?: string;
    labelColor?: string;
    showChevron?: boolean;
    onPress: () => void;
    colors: ReturnType<typeof useTheme>['colors'];
}

function SettingItem({
    icon: Icon,
    label,
    subtitle,
    iconColor,
    labelColor,
    showChevron = true,
    onPress,
    colors,
}: SettingItemProps) {
    const resolvedIconColor = iconColor || colors.text;
    const resolvedLabelColor = labelColor || colors.text;
    return (
        <TouchableOpacity
            style={styles.settingItem}
            onPress={onPress}
            activeOpacity={0.6}
        >
            <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: `${resolvedIconColor}15` }]}>
                    <Icon size={20} color={resolvedIconColor} />
                </View>
                <View style={styles.settingText}>
                    <Text style={[styles.settingLabel, { color: resolvedLabelColor }]}>{label}</Text>
                    {subtitle && <Text style={[styles.settingSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>}
                </View>
            </View>
            {showChevron && <ChevronRight size={20} color={colors.textSecondary} />}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 20,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: Colors.text,
    },
    scrollView: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 20,
        paddingBottom: 100,
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
    },
    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#fdf2f8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    userInfo: {
        flex: 1,
        marginLeft: 16,
    },
    userName: {
        fontSize: 18,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 4,
    },
    userEmail: {
        fontSize: 14,
        color: Colors.textSecondary,
    },
    editButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: Colors.primary,
    },
    editButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ffffff',
    },
    statsContainer: {
        flexDirection: 'row',
        backgroundColor: Colors.surface,
        borderRadius: 20,
        padding: 20,
        marginBottom: 32,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: Colors.textSecondary,
        fontWeight: '600',
    },
    statDivider: {
        width: 1,
        backgroundColor: Colors.border,
        marginHorizontal: 16,
    },
    section: {
        marginBottom: 32,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 8,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    settingIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingText: {
        marginLeft: 12,
        flex: 1,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    settingSubtitle: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    version: {
        textAlign: 'center',
        fontSize: 13,
        color: Colors.textSecondary,
        marginTop: 20,
        marginBottom: 20,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(240, 240, 240, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    overlayBox: {
        backgroundColor: '#ffffff',
        padding: 20,
        borderRadius: 16,
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
    },
    overlayTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.text,
        marginBottom: 8,
    },
    overlaySubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 20,
    },
    overlayButton: {
        backgroundColor: Colors.primary,
        borderRadius: 12,
        paddingVertical: 14,
        paddingHorizontal: 20,
        width: '100%',
        alignItems: 'center',
    },
    overlayButtonText: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    modalCard: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: Colors.text,
    },
    modalSubtitle: {
        fontSize: 14,
        color: Colors.textSecondary,
        marginBottom: 6,
    },
    modalBody: {
        fontSize: 14,
        lineHeight: 20,
    },
    contactRow: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        marginTop: 8,
    },
    contactLabel: {
        fontSize: 13,
        fontWeight: '700',
    },
    contactValue: {
        fontSize: 15,
        fontWeight: '700',
        marginTop: 4,
    },
    appearanceList: {
        gap: 10,
    },
    appearanceOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: Colors.border,
        backgroundColor: Colors.surface,
    },
    appearanceOptionSelected: {
        borderColor: Colors.primary,
        backgroundColor: '#fdf2f8',
    },
    appearanceSwatches: {
        flexDirection: 'row',
        gap: 4,
    },
    swatch: {
        width: 18,
        height: 18,
        borderRadius: 4,
    },
    appearanceLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.text,
    },
    appearanceDescription: {
        fontSize: 13,
        color: Colors.textSecondary,
    },
    appearanceSelectedText: {
        fontSize: 12,
        color: Colors.primary,
        fontWeight: '700',
    },
    modalClose: {
        marginTop: 6,
        alignSelf: 'flex-end',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: Colors.primary,
    },
    modalCloseText: {
        color: '#fff',
        fontWeight: '700',
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: Colors.text,
        marginTop: 6,
    },
    input: {
        marginTop: 4,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        fontSize: 15,
        borderWidth: 1,
    },
    errorText: {
        color: Colors.danger,
        fontSize: 12,
        marginTop: 4,
    },
    handle: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    modalActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        marginTop: 12,
    },
    modalButton: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 12,
    },
    modalButtonText: {
        fontSize: 15,
        fontWeight: '700',
    },
});
