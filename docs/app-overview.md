# Social Saver – App Overview

## Purpose
Save, organize, and share inspirational social content (videos, images, links). Users can create personal boards (folders), optionally mirror public “Inspo boards”, collaborate, and manage subscriptions.

## Platforms & Stack
- Expo React Native app using Expo Router.
- Backend: Express server (AI/Stripe/TikTok proxy) + Firebase (Auth, Firestore, Storage).
- Payments: Stripe subscriptions (plans mapped in env).
- AI: OpenAI (analyze content) via server `/ai/analyze`.

## Navigation & Screens
- `(tabs)/index.tsx` – Home: user’s saved content grid; search/filter; tap opens viewer.
- `(tabs)/collections.tsx` – Folder list (create/delete folder; tap opens folder detail).
- `(tabs)/discovery.tsx` – Public discovery feed (public boards; follow owners).
- `(tabs)/add.tsx` – Add/save new content (URL/image/video flows).
- `(tabs)/profile.tsx` – Profile, handle setup, stats, logout, delete account.
- `folder/[id].tsx` – Folder detail (owner/collaborators, visibility toggle, delete items via long-press).
- `public/[id].tsx` – Public board detail (follow/unfollow; owners can remove items from public or make board private).
- `viewer.tsx` – Content viewer (TikTok/Instagram/generic via WebView embeds; native app open fallback).
- `item/[id].tsx` – Single item detail.
- `sign-in.tsx` – Sign-in/sign-up (email/password; handles/phone required for new accounts).
- `signup.tsx` – Legacy redirect to sign-in.
- `pricing.tsx` – Plan selection + Stripe payment sheet.
- `phone-sign-in.tsx` – Alternate auth notice (phone handled elsewhere).

## Core Features
- Save content: URL/image/video; AI-assisted metadata; auto-folder suggestion; upload media to Firebase Storage.
- Folder management: create, delete, toggle public/private, collaborators; mirrored `publicFolders` when public.
- Public inspo boards: mirrored items for public view; owners can prune public items or make boards private.
- Content viewing: inline video/image previews on cards; viewer screen for full playback/embeds.
- Search/filter: Home search by title/description/tags.
- Followers: follow creators from public board page.
- Subscriptions: Stripe-backed plans; promo “pro” fallback; webhook handlers.
- AI tagging: server `/ai/analyze` to categorize/tag content.

## Auth & Identity
- Firebase Auth email/password.
- Sign-up requires unique `handle` + `phoneNumber`; stored with `handleLower` and `email` in `users` collection.
- Greeting uses handle when available.

## Environment Highlights
- `EXPO_PUBLIC_STRIPE_MODE`, `EXPO_PUBLIC_AI_SERVER_URL_*`, Firebase config keys, Stripe keys, RapidAPI (optional legacy), LinkPreview/Microlink keys.

