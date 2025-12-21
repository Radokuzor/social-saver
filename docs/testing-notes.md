# UAT Pointers

## Auth
- Sign in existing user (correct/wrong password).
- Switch to “Create Account”, set unique handle + phone, ensure success; attempt duplicate handle -> error.
- Verify handle shows on home greeting.

## Content Save & View
- Save URL (TikTok/Instagram/generic) and verify metadata/thumbnail. Saves are currently unlimited (no plan wall).
- Save image upload and video upload; confirm Storage link and playback preview.
- Search on home filters by title/description/tags.
- Open viewer for TikTok/Instagram: embeds render; “open in app” only on error.

## Folders & Public Boards
- Create folder; toggle public/private; add/remove collaborators (owner only).
- Save item to public folder -> appears in private view and public board.
- Long-press item in private folder (as owner) -> deleted in both private + public mirrors; media cleaned.
- Delete folder from collections -> public mirror removed.
- Public board (as owner): long-press item -> removed from public only; “Remove from Public” -> board private and public mirror deleted.
- Public board (visitor): follow/unfollow owner updates follower count/state.

## Payments
- Start subscription from pricing screen; confirm client secrets returned; webhook updates `meta/subscription`.
- Promo users (no Stripe) still marked pro.

## AI
- Trigger save with URL to call `/ai/analyze`; if server unavailable, fallback tags returned.

## Edge/Errors
- Network failures on save/delete show alerts and state recovers.
- Handle deletion retries without leaving orphan public items.
- Sign-in wrong password surfaces correct message (no auto sign-up).
