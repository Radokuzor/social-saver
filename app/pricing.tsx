// app/pricing.tsx
import useFirebaseAuth from '../hooks/useFirebaseAuth';
import { useNavigation } from 'expo-router';
import { useStripe } from '@stripe/stripe-react-native';
import { Check } from 'lucide-react-native';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useTheme } from '../contexts/ThemeProvider';
import useSubscription from '../hooks/useSubscription';
import stripeClient from '../services/stripeClient';

const { width } = Dimensions.get('window');

type BillingCycle = 'monthly' | 'yearly';

type Plan = {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  popular?: boolean;
  itemLimit?: string;
  aiLimit?: string;
};

const plans: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    itemLimit: '20 saves per day',
    aiLimit: '10 AI auto-tags / month',
    features: [
      '20 saves per day',
      '10 AI auto-tags per month',
      'Regular search',
      'Mobile & web access',
    ],
  },
  {
    id: 'plus',
    name: 'Basic',
    monthlyPrice: 9.99,
    yearlyPrice: 9.99 * 12 * 0.9,
    itemLimit: '100 items/mo',
    aiLimit: '25 AI auto-tags',
    features: [
      'Up to 100 items saved each month',
      '25 AI auto-tags & titles',
      'Advanced search',
      'Priority support',
    ],
  },
  {
    id: 'pro',
    name: 'Better',
    monthlyPrice: 19.99,
    yearlyPrice: 19.99 * 12 * 0.9,
    itemLimit: 'Unlimited items',
    aiLimit: 'Unlimited AI tags & titles',
    popular: true,
    features: [
      'Unlimited saves',
      'Unlimited AI tagging and titles',
      'Analytics & insights',
      'Team collaboration',
      'API access',
      'Premium support',
    ],
  },
  {
    id: 'business',
    name: 'Best',
    monthlyPrice: 29.99,
    yearlyPrice: 29.99 * 12 * 0.9,
    itemLimit: 'Unlimited items',
    aiLimit: 'Unlimited AI',
    features: [
      'Everything in Pro',
      'Dedicated account manager',
      'Custom integrations',
      'Advanced security & SLA',
      'White-label options',
    ],
  },
];

export default function PricingScreen() {
  const navigation = useNavigation();
  const { getIdToken } = useFirebaseAuth();
  const { subscription, isLoading: subscriptionLoading } = useSubscription();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollViewRef = useRef<ScrollView>(null);

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [isProcessing, setIsProcessing] = useState(false);

  // Style the native header back button and title
  useLayoutEffect(() => {
    navigation.setOptions?.({
      headerBackTitle: 'Back',
      headerTintColor: '#ec4899',
      headerTitle: 'Pricing',
      headerBackTitleVisible: true,
    });
  }, [navigation]);

  // Load current plan from Firestore
  useEffect(() => {
    setCurrentPlan(subscription.planId || 'free');
    if (subscription.billingCycle === 'yearly' || subscription.billingCycle === 'monthly') {
      setBillingCycle(subscription.billingCycle);
    }
  }, [subscription.planId, subscription.billingCycle]);

  const handleSelectPlan = async (planId: string) => {
    if (planId === currentPlan || planId === 'free') return;
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    await handleProcessPayment(plan);
  };

  const handleProcessPayment = async (selectedPlan: Plan) => {
    if (!selectedPlan || isProcessing) return;

    try {
      setIsProcessing(true);

      const token = await getIdToken();
      if (!token) {
        Alert.alert('Sign in required', 'Please sign in to start a subscription.');
        return;
      }

      const subResp = await stripeClient.createSubscriptionPaymentSheet({
        token,
        planId: selectedPlan.id,
        billingCycle,
      });

      const paymentIntentClientSecret = subResp?.paymentIntentClientSecret;
      const customerId = subResp?.customerId;
      const customerEphemeralKeySecret =
        subResp?.customerEphemeralKeySecret || subResp?.ephemeralKeySecret;

      if (!paymentIntentClientSecret || !customerId || !customerEphemeralKeySecret) {
        throw new Error('Missing payment sheet data from server. Please try again.');
      }

      const init = await initPaymentSheet({
        paymentIntentClientSecret,
        customerId,
        customerEphemeralKeySecret,
        merchantDisplayName: 'Social Saver',
        allowsDelayedPaymentMethods: false,
      });

      if (init.error) {
        throw init.error;
      }

      const present = await presentPaymentSheet();
      if (present.error) {
        throw present.error;
      }

      Alert.alert(
        'Payment Successful',
        'Your subscription is being activated. It may take a moment to reflect.'
      );

    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const details = typeof data === 'string'
        ? data
        : data?.error || data?.message || data?.error_message || err?.message;

      console.error('Payment error:', err);

      const friendly = status === 502
        ? 'Server unavailable. Please check your connection and try again.'
        : details || 'An error occurred during payment.';

      Alert.alert('Payment Failed', friendly);
    } finally {
      setIsProcessing(false);
    }
  };

  if (subscriptionLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Choose Your Plan</Text>
          <Text style={styles.subtitle}>
            Upgrade to unlock more space and smarter AI sorting.
          </Text>
          <Text style={styles.currentPlanText}>
            Current plan: {plans.find(p => p.id === currentPlan)?.name || 'Free'}
          </Text>
        </View>

        <View style={styles.billingToggleContainer}>
          <View style={styles.billingToggle}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                billingCycle === 'monthly' && styles.toggleButtonActive,
              ]}
              onPress={() => setBillingCycle('monthly')}
            >
              <Text
                style={[
                  styles.toggleText,
                  billingCycle === 'monthly' && styles.toggleTextActive,
                ]}
              >
                Monthly
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                billingCycle === 'yearly' && styles.toggleButtonActive,
              ]}
              onPress={() => setBillingCycle('yearly')}
            >
              <Text
                style={[
                  styles.toggleText,
                  billingCycle === 'yearly' && styles.toggleTextActive,
                ]}
              >
                Yearly
              </Text>
            </TouchableOpacity>
          </View>
          {billingCycle === 'yearly' && (
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>Save 10%</Text>
            </View>
          )}
        </View>

        <View style={styles.plansGrid}>
          {plans.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              billingCycle={billingCycle}
              currentPlan={currentPlan}
              onSelect={handleSelectPlan}
              colors={colors}
            />
          ))}
        </View>
      </ScrollView>
      {isProcessing && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Preparing checkout…</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function PricingCard({
  plan,
  billingCycle,
  currentPlan,
  onSelect,
  colors,
}: {
  plan: Plan;
  billingCycle: BillingCycle;
  currentPlan: string;
  onSelect: (planId: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  const isCurrent = plan.id === currentPlan;
  const price = billingCycle === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
  const displayPrice =
    billingCycle === 'yearly'
      ? (price / 12).toFixed(2)
      : price.toFixed(2);

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View
      style={[
        styles.card,
        plan.popular && styles.cardPopular,
        isCurrent && styles.cardCurrent,
      ]}
    >
      {plan.popular && (
        <View style={styles.popularBadge}>
          <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
        </View>
      )}

      <View style={styles.cardHeader}>
        <Text style={styles.planName}>{plan.name}</Text>
        <View style={styles.priceContainer}>
          <Text style={styles.currency}>$</Text>
          <Text style={styles.price}>{displayPrice}</Text>
          <Text style={styles.period}>
            /month
          </Text>
        </View>
        {billingCycle === 'yearly' && plan.monthlyPrice > 0 && (
          <Text style={styles.yearlyNote}>
            ${price.toFixed(2)} billed annually (10% off)
          </Text>
        )}
        {plan.itemLimit && <Text style={styles.limit}>{plan.itemLimit}</Text>}
        {plan.aiLimit && <Text style={styles.limit}>{plan.aiLimit}</Text>}
      </View>

      <View style={styles.features}>
        {plan.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <View style={styles.checkIcon}>
              <Check size={16} color={colors.primary} strokeWidth={3} />
            </View>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.selectButton,
          plan.popular && styles.selectButtonPopular,
          isCurrent && styles.selectButtonCurrent,
        ]}
        onPress={() => onSelect(plan.id)}
        disabled={isCurrent}
      >
        <Text
          style={[
            styles.selectButtonText,
            plan.popular && styles.selectButtonTextPopular,
            isCurrent && styles.selectButtonTextCurrent,
          ]}
        >
          {isCurrent ? 'Current Plan' : 'Select'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (Colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  currentPlanText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  backButton: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  billingToggleContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  billingToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  toggleButton: {
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  toggleTextActive: {
    color: Colors.text,
  },
  saveBadge: {
    backgroundColor: '#fdf2f8',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  saveBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  plansGrid: {
    paddingHorizontal: 20,
    gap: 16,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardPopular: {
    borderColor: Colors.primary,
    shadowOpacity: 0.08,
    elevation: 2,
  },
  cardCurrent: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  popularBadgeText: {
    backgroundColor: Colors.primary,
    color: Colors.background,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    letterSpacing: 0.5,
  },
  cardHeader: {
    marginBottom: 24,
    paddingTop: 8,
  },
  planName: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  currency: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.text,
    marginRight: 2,
  },
  price: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.text,
    lineHeight: 48,
  },
  period: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginLeft: 4,
  },
  yearlyNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  limit: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  features: {
    marginBottom: 24,
    gap: 14,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fdf2f8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  selectButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  selectButtonPopular: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  selectButtonCurrent: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  selectButtonTextPopular: {
    color: Colors.background,
  },
  selectButtonTextCurrent: {
    color: Colors.background,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    padding: 20,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  loadingText: {
    color: Colors.text,
    fontWeight: '700',
  },
});
