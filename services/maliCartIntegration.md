# Mali cart integration

This document outlines a starter plan for integrating Mali assistant with the shopping cart context.

Goals:
- Provide an explicit opt-in for Mali to access a user's cart.
- Surface basic cart summary (items, quantities, total) to Mali to enable intents such as:
  - "Check for better deals"
  - "Suggest bundles"
  - "Apply coupons"

Security / Privacy:
- The UI should present an opt-in toggle before sending cart data to any assistant services.
- Use server-side endpoints to fetch cart details to avoid leaking database credentials in the frontend.

Starter tasks:
- Add a persisted opt-in toggle in account preferences.
- Implement a secure endpoint (RPC) to fetch the minimal cart summary for the assistant.
- Wire the assistant service (services/aiService.ts) to request the summary when the user invokes Mali and opt-in is set.
