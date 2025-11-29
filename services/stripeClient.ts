import axios from 'axios';

const STRIPE_SERVER_URL = process.env.EXPO_PUBLIC_STRIPE_SERVER_URL || 'https://stripe-server-production-40db.up.railway.app';

export async function createCustomer(data: { email?: string; name?: string; metadata?: Record<string, any> }) {
    const resp = await axios.post(`${STRIPE_SERVER_URL}/create-customer`, data);
    return resp.data;
}

export async function createPaymentIntent(data: { amount: number; currency?: string; customerId?: string; metadata?: Record<string, any> }) {
    const resp = await axios.post(`${STRIPE_SERVER_URL}/create-payment-intent`, data);
    return resp.data;
}

export default {
    createCustomer,
    createPaymentIntent,
};
