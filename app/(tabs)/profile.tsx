import * as Haptics from 'expo-haptics';
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
import React from 'react';
import {
    Alert,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth, useClerk, useUser } from '@clerk/clerk-expo';

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
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="dark-content" />

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Profile</Text>
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* User Info Card */}
                <View style={styles.userCard}>
                    <View style={styles.avatar}>
                        <User size={32} color={Colors.primary} />
                    </View>
                    <View style={styles.userInfo}>
                        <Text style={styles.userName}>
                            {isSignedIn
                                ? `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Your name'
                                : 'Guest User'}
                        </Text>
                        <Text style={styles.userEmail}>
                            {isSignedIn ? (user?.primaryEmailAddress?.emailAddress || 'email not set') : 'Not signed in'}
                        </Text>
                    </View>
                    {isSignedIn && (
                        <TouchableOpacity
                            style={styles.editButton}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                Alert.alert('Edit profile', 'Profile editing coming soon.');
                            }}
                        >
                            <Text style={styles.editButtonText}>Edit</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Stats */}
                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>127</Text>
                        <Text style={styles.statLabel}>Items Saved</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>12</Text>
                        <Text style={styles.statLabel}>Collections</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>48</Text>
                        <Text style={styles.statLabel}>Tags</Text>
                    </View>
                </View>

                {/* Settings Sections */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferences</Text>
                    <SettingItem
                        icon={Palette}
                        label="Appearance"
                        subtitle="Customize your experience"
                        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                    />
                    <SettingItem
                        icon={Bell}
                        label="Notifications"
                        subtitle="Manage your notifications"
                        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Account</Text>
                    <SettingItem
                        icon={Lock}
                        label="Privacy & Security"
                        subtitle="Manage your privacy settings"
                        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                    />
                    <SettingItem
                        icon={Settings}
                        label="Account Settings"
                        subtitle="Update your account details"
                        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                    />
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Support</Text>
                    <SettingItem
                        icon={HelpCircle}
                        label="Help & Support"
                        subtitle="Get help with the app"
                        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
                    />
                    <SettingItem
                        icon={FileText}
                        label="Terms & Privacy"
                        subtitle="Read our policies"
                        onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
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
                    />
                    <SettingItem
                        icon={Trash2}
                        label="Delete Account"
                        iconColor={Colors.danger}
                        labelColor={Colors.danger}
                        onPress={handleDeleteAccount}
                        showChevron={false}
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
        </SafeAreaView>
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
}

function SettingItem({
    icon: Icon,
    label,
    subtitle,
    iconColor = Colors.text,
    labelColor = Colors.text,
    showChevron = true,
    onPress,
}: SettingItemProps) {
    return (
        <TouchableOpacity
            style={styles.settingItem}
            onPress={onPress}
            activeOpacity={0.6}
        >
            <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: `${iconColor}15` }]}>
                    <Icon size={20} color={iconColor} />
                </View>
                <View style={styles.settingText}>
                    <Text style={[styles.settingLabel, { color: labelColor }]}>{label}</Text>
                    {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
                </View>
            </View>
            {showChevron && <ChevronRight size={20} color={Colors.textSecondary} />}
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
});
