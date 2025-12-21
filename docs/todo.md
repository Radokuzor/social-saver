# TODO – UX, UI, and Functional Tests

## Prevent Regressions
- Add automated/regular manual checks for empty states (discovery, folders) to catch render loops.
- Include owner-handle lookup and public/private mirroring in smoke tests.
- Verify caps on title/description inputs in add-content flow on each release.

## UX/UI Test Scenarios
- Discovery: empty feed, populated feed, board cards show “{Title} by @handle”.
- Add content: title/description max height enforced; AI analyze button disabled/enabled states; tag add/remove flow.
- Viewer: TikTok/Instagram embeds load; error fallback shows “open in app”.
- Home/Folders: capitalized folder names; collaborator add/remove UI; long-press delete behavior.
- Public boards: owner-only public delete/“Remove from Public”; follow/unfollow button states.
- Auth: sign-in vs create-account toggle; handle/phone required only on sign-up; wrong-password/unknown-user errors.

## Functional Coverage
- Save flows for URL/image/video; public mirroring; deletion cleans up mirrors.
- Folder visibility toggle keeps public mirror in sync.
- Download/paywall (future): add test cases once implemented.

## Release Checklist Additions
- Run UX/UI smoke for discovery empty state and add-content input caps.
- Validate version/build bump prior to archive.
- Confirm prod env vars set before building (Stripe mode, API base URL).

## Backlog
- Add forced update gate: check app version against a minimum supported value (remote-config or server flag) and block usage until updated.
- Add Facebook/Twitter article support: metadata extraction, thumbnails, and viewer handling for shared links from these platforms.
