// app/pricing.tsx
import { useUser } from '@clerk/clerk-expo';
import { useStripe } from '@stripe/stripe-react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import {
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
    itemLimit: '2 saves per day',
    aiLimit: '10 AI auto-tags / month',
    features: [
      '2 saves per day',
      '10 AI auto-tags per month',
      'Regular search',
      'Mobile & web access',
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
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
    name: 'Pro',
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
    name: 'Business',
    monthlyPrice: 30.99,
    yearlyPrice: 30.99 * 12 * 0.9,
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
  const router = useRouter();
  const { user } = useUser();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollViewRef = useRef<ScrollView>(null);

  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [currentPlan] = useState<string>('free');
  const [isProcessing, setIsProcessing] = useState(false);

  const { initPaymentSheet, presentPaymentSheet } = useStripe();

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

      const email = user?.primaryEmailAddress?.emailAddress ||
        user?.emailAddresses?.[0]?.emailAddress || undefined;
      const name = user?.fullName || user?.firstName || undefined;

      if (!email) {
        Alert.alert('Error', 'Email address is required for payment');
        setIsProcessing(false);
        return;
      }

      // Create customer
      let customerId: string | undefined;
      try {
        const customerResp = await stripeClient.createCustomer({
          email,
          name: name || undefined
        });
        customerId = customerResp.customerId || customerResp.customer?.id;
      } catch (err) {
        console.warn('Could not create customer:', err);
      }

      // Calculate amount
      const price = billingCycle === 'monthly'
        ? selectedPlan.monthlyPrice
        : selectedPlan.yearlyPrice;

      if (price <= 0) {
        Alert.alert('Invalid amount', 'Selected plan has no charge.');
        setIsProcessing(false);
        return;
      }

      // Create payment intent
      const piResp = await stripeClient.createPaymentIntent({
        amount: price,
        currency: 'usd',
        customerId
      });

      const clientSecret = piResp.clientSecret ||
        piResp.client_secret ||
        piResp.clientSecret;

      if (!clientSecret) {
        throw new Error('No client secret returned from server');
      }

      // Initialize payment sheet
      const initResponse = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Social Saver',
        defaultBillingDetails: {
          name: name || undefined,
          email: email || undefined,
        }
      });

      if (initResponse.error) {
        throw initResponse.error;
      }

      // Present payment sheet
      const presentResponse = await presentPaymentSheet();

      if (presentResponse.error) {
        throw presentResponse.error;
      }

      Alert.alert(
        'Payment Successful!',
        `Welcome to ${selectedPlan.name}! Your subscription is now active.`
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
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Choose Your Plan</Text>
          <Text style={styles.subtitle}>
            Upgrade to unlock more space and smarter AI sorting.
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
});