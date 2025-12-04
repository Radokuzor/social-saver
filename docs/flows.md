# Key Flows

## Auth
- Sign-in: email/password via Firebase Auth. Errors on wrong-password; “user not found” prompts switching to sign-up.
- Sign-up: requires unique handle + phone; handle uniqueness checked (`handleLower`); email saved to `users/{uid}` with handle/phone.
- Greeting: uses stored handle.

## Saving Content
- Entry points: Add tab, folder view, item pages.
- Types: URL (with metadata extraction + AI), image upload, video upload.
- Flow (hooks/useContent):
  1) Validate limits based on subscription (plan limits from user profile).
  2) Resolve/ensure folder (getOrCreateFolder); require owner/collaborator access.
  3) Upload media to Storage if needed.
  4) Extract metadata (Microlink/LinkPreview/oEmbed) for URLs.
  5) Save item to `items` with metadata/AI fields.
  6) If folder `isPublic`, mirror to `publicFolders/{folderId}` and `publicFolders/{folderId}/items`, increment `itemsCount`.

## Viewing Content
- Home: grid of user items with inline video/image previews; search filter.
- Folder detail: grid; owner can toggle visibility, manage collaborators, delete items via long-press (removes private + public mirror).
- Public board: grid of mirrored items; visitors can follow owner; owner can long-press to remove an item from public only; owner can “Remove from Public” to make board private (delete public mirror).
- Viewer: loads TikTok/Instagram via WebView embeds; generic URLs via WebView; “open in app” fallback only in error state.

## Public/Private Behavior
- When folder `isPublic`:
  - New/updated saves mirrored to `publicFolders/{folderId}/items` with ownerUid.
  - `itemsCount` maintained.
- Deleting an item (owner, private view):
  - Removes `items/{itemId}`, cleans Storage, deletes mirrored `publicFolders/{folderId}/items/{itemId}`, decrements `itemsCount`.
- Deleting a folder (Collections long-press):
  - Deletes private folder and all public mirrors (`publicFolders/{folderId}` and its items).
- Public board owner actions:
  - Long-press item: delete from public mirror only (private item stays).
  - “Remove from Public”: set private folder `isPublic=false`, delete public mirror docs/items, remove from discovery.

## Following
- Public board screen: follow/unfollow owner.
- Data: `users/{uid}/following/{ownerUid}` and reciprocal `followers` entry; `publicFolders.followersCount` increment/decrement.

## AI Analysis
- Client calls server `/ai/analyze` with URL/image/video + metadata and token.
- Server: OpenAI (assistant or chat) builds structured tags/title/description; fallback JSON when AI unavailable.

## Payments
- Plans from env `PRICE_MAP_*` on server; client `pricing.tsx` fetches `/plans`.
- Subscription flow: `/create-subscription` (Stripe), PaymentSheet client secret, webhook updates Firestore `meta/subscription`.
- Promo: ensurePromoPro grants pro without Stripe if no subscription exists.

## Error/Retry Notes
- Content saving and deletion include retry/backoff for Firestore operations.
- Media cleanup best-effort when deleting items.
- Handle uniqueness checked before sign-up.

