# UX starter scaffolds — completed

This branch contains finished starter implementations (scaffolds) for several UX improvements. The components are intentionally self-contained and safe to review; they should be wired to real APIs and design tokens before shipping.

Components added or updated
- components/TrustStrip.tsx — compact trust strip (rating, seller badge, delivery, returns)
- components/OrderTimeline.tsx — horizontal order progress with timestamps
- components/SellerOnboardingCard.tsx — checklist with local persistence (localStorage) for demos
- components/Skeletons/CartSkeleton.tsx — animated skeleton for cart lists
- components/SearchLiveResults.tsx — debounced search with keyboard navigation and a fetchResults prop
- components/NotificationsGrouping.tsx — client-side grouping of notifications
- components/UnsavedChangesBar.tsx — persistent save/discard bar with beforeunload guard

Docs & guides
- components/EmptyStateUsage.md — guidance for replacing bare empty messages with a reusable EmptyState
- services/maliCartIntegration.md — detailed opt-in flow and API contract
- docs/UX-starter-scaffolds.md — this file (overview)

Notes for reviewers
- These components avoid depending on internal app modules to keep the PR reviewable. When integrating, replace placeholder classNames with project design tokens and wire to services (cart API, notifications API, account API).
- Run the typecheck and build steps: `npx tsc --noEmit && npx vite build`.
- The SellerOnboardingCard currently persists progress to localStorage as a demo — replace with server-side persistence when ready.
