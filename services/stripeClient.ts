import axios from 'axios';
import { ensureApiBaseUrl } from './api';

export type CreateSubscriptionPayload = {
  token: string;
  planId: string;
  billingCycle: 'monthly' | 'yearly';
};

export async function createSubscriptionPaymentSheet(payload: CreateSubscriptionPayload) {
  const baseUrl = ensureApiBaseUrl();
  const resp = await axios.post(
    `${baseUrl}/create-subscription`,
    {
      planId: payload.planId,
      billingCycle: payload.billingCycle,
    },
    {
      headers: {
        Authorization: `Bearer ${payload.token}`,
      },
    }
  );
  return resp.data as {
    subscriptionId?: string;
    customerId: string;
    paymentIntentClientSecret: string;
    customerEphemeralKeySecret: string;
    ephemeralKeySecret?: string;
  };
}

export async function fetchPlans() {
  const baseUrl = ensureApiBaseUrl();
  const resp = await axios.get(`${baseUrl}/plans`);
  return resp.data;
}

export default {
  createSubscriptionPaymentSheet,
  fetchPlans,
};
