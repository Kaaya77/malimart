# UX starter scaffolds

This branch contains starter scaffolds for several UX improvements. Each file includes a TODO note describing next implementation steps and relevant acceptance criteria.

Features included:
- Trust strip under price (components/TrustStrip.tsx)
- Checkout visual audit (docs/checkout-audit.md placeholder)
- Skeleton loaders consistency (components/Skeletons/CartSkeleton.tsx)
- Order tracking timeline (components/OrderTimeline.tsx)
- Seller onboarding checklist (components/SellerOnboardingCard.tsx)
- Search live results (components/SearchLiveResults.tsx)
- Notifications grouping (components/NotificationsGrouping.tsx)
- Empty states consistency (notes in components/EmptyStateUsage.md)
- Mali cart integration (services/maliCartIntegration.md)
- Unsaved changes bar (components/UnsavedChangesBar.tsx)

Next steps for reviewers:
- Review the TODOs in each file and link to corresponding issues.
- Run typecheck and build: `npx tsc --noEmit && npx vite build` (CI should run these checks).
