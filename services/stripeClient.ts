import axios from 'axios';

const stripeMode = (process.env.EXPO_PUBLIC_STRIPE_MODE || 'test').toLowerCase();
const STRIPE_SERVER_URL =
    (stripeMode === 'live'
        ? process.env.EXPO_PUBLIC_STRIPE_SERVER_URL_LIVE
        : process.env.EXPO_PUBLIC_STRIPE_SERVER_URL_TEST || process.env.EXPO_PUBLIC_STRIPE_SERVER_URL) ||
    'https://dazzling-patience-production-3160.up.railway.app';

export async function createCustomer(data: { email?: string; name?: string; metadata?: Record<string, any> }) {
    const resp = await axios.post(`${STRIPE_SERVER_URL}/create-customer`, data);
    return resp.data;
}

export async function createPaymentIntent(data: { amount: number; currency?: string; customerId?: string; metadata?: Record<string, any> }) {
    const resp = await axios.post(`${STRIPE_SERVER_URL}/create-payment-intent`, data);
    return resp.data;
}

export async function createSubscription(data: { planId: string; billingCycle: 'monthly' | 'yearly'; email?: string; name?: string }) {
    const resp = await axios.post(`${STRIPE_SERVER_URL}/create-subscription`, data);
    return resp.data;
}

export default {
    createCustomer,
    createPaymentIntent,
    createSubscription,
};
