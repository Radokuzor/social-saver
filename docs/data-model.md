# Data Model (Firestore)

## Collections
- `users/{uid}`
  - `email` (string)
  - `handle` / `handleLower` (string, unique lowercase)
  - `phoneNumber` (string)
  - `firstName` / `lastName` (optional)
  - `subscription` (embedded, plan/billing/stripe ids)
  - `createdAt` / `updatedAt` (timestamp)
- `users/{uid}/meta/subscription`
  - Stripe subscription mirror (planId, billingCycle, status, stripe ids, currentPeriodEnd, cancelAtPeriodEnd, promo flags).
- `folders/{folderId}`
  - `userId` (owner uid)
  - `name` / `nameLower`
  - `isPublic` (bool; default true)
  - `collaborators` (uid[])
  - `tags` (string[])
  - `description` (string)
  - `color`, `icon`, `colorIndex`
  - `itemCount` (number)
  - `createdAt` / `updatedAt`
- `publicFolders/{folderId}`
  - `ownerUid`
  - `title`, `description`, `tags`
  - `isPublic` (bool)
  - `itemsCount`, `followersCount`
  - `createdAt` / `updatedAt`
  - Subcollection `items/{itemId}`
    - `userId` (who added)
    - `ownerUid`
    - `type` ('url' | 'image' | 'video')
    - `url`, `mediaUrl`, `thumbnail`, `title`, `description`, `tags`
    - `createdAt` / `updatedAt`
    - `addedBy` (uid)
- `items/{itemId}`
  - `userId` (owner uid)
  - `folderId` (string)
  - `type` ('url' | 'image' | 'video')
  - `url`, `mediaUrl`, `thumbnail`
  - `title`, `description`, `tags`
  - `aiSuggestedFolders`, `aiCategory`
  - `metadata` (raw extracted JSON)
  - `createdAt` / `updatedAt`
- `users/{uid}/following/{targetUid}` / `users/{uid}/followers/{followerUid}`
  - Track follow relationships; used for public boards and counts.
- `aiUsage`
  - `userId`, `createdAt` (per-call logging for plan limits).

## Storage
- Firebase Storage paths (via `uploadMedia`): user media uploads for image/video saves; references stored in `mediaUrl` and `thumbnail`.

