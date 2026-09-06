# Mali cart integration

This document expands the starter plan for integrating the Mali assistant with cart/checkout context. It provides a recommended API contract, opt-in flow, and privacy considerations.

API contract (server-side)
- Endpoint: GET /api/assistant/cart-summary
- Auth: user session cookie / bearer token
- Response: { items: [{ id, name, qty, price }], subtotal: number, currency: string }

Opt-in flow
1. Add a persisted toggle in Account > Integrations: "Allow Mali assistant to access my cart" (default: off).
2. When a user interacts with Mali and the toggle is ON, the client requests /api/assistant/cart-summary and sends only the minimal summary to the assistant.
3. The assistant may propose bundling, price checks, or coupon suggestions. Any action that modifies the cart must go through the standard cart APIs (no direct assistant write).

Security & privacy
- Data minimization: only send item ids, names, quantities, and subtotal (no PII).
- Log events for telemetry but do not persist item-level data in analytics without explicit consent.
- Provide a clear revocation UI that deletes any server-side assistant context for the user.

Telemetry
- Events: assistant_opt_in_changed, assistant_cart_summarized, assistant_suggestion_applied

Starter tasks
- Add Account setting and store in user's preferences (server-side preference flag).
- Implement /api/assistant/cart-summary to return a minimal cart payload.
- Update services/aiService to request the cart summary when assistant is invoked and opt-in is true.
- Add UI affordance in the assistant modal showing "Assistant has access to your cart" when enabled.
