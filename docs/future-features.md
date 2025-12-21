# Future Features Wishlist

## Share-to-App Intents (TikTok/Instagram)
- Platform intent/extension to receive shared URLs directly into the app.
- Auto-detect platform (TikTok/Instagram) and prefill save flow with metadata.
- Deep link to: select target folder, confirm tags, and save in one step.
- Background parse while the user switches to the app; show quick toast on success.

## Send Boards via SMS
- Generate a shareable board link (public/expiring link options).
- SMS sending flow from within the app (use device SMS composer or server-side SMS via Twilio/MessageBird).
- Optional access controls: view-only, time-limited, or require auth.
- Track link clicks and optionally follow conversions (if the recipient signs up).

## Paid Downloads (future paywall shift)
- Keep content creation/saves free and unlimited.
- Introduce pay-per-download or subscription gating specifically for media downloads (e.g., server-side TikTok/Instagram mp4 retrieval).
- Track download counts per user; integrate with Stripe for entitlement checks.

## Other Ideas (parking lot)
- Offline queue for saves when connectivity is poor.
- Rich push notifications: “new items added to board you follow”.
- Multi-select on folder items for bulk moves/deletes.
- Basic analytics per board (views, saves, follows).
- Public inspo board voting and ranking:
  - Allow users to vote up/down on a public inspo board when opening it from Discovery.
  - Sort public inspo boards in Discovery by rating first, then newest-to-oldest.
