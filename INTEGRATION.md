# MaliMart UX Overhaul — Phase 1 Integration Guide

## What's already live (no action needed)
The migration `ux_overhaul_messaging_orders_settings` has been **applied to your Supabase project** (`ubpapxdmqlepynonhaeo`). It added:
- `messages.sender_deleted_at` / `receiver_deleted_at` (per-user delete) + thread index
- 14 SECURITY DEFINER RPCs, locked to `authenticated` only:
  - Messaging: `get_my_conversations`, `get_thread`, `send_direct_message`, `delete_my_message`, `delete_my_conversation`
  - Notifications: `mark_all_notifications_read`, `delete_my_notifications`, `clear_read_notifications`
  - Orders: `cancel_my_order` (state-machine guarded, restores stock, logs inventory, notifies), `hide_my_order`
  - Settings: `update_my_settings` (column whitelist — role/wallet/tier/is_banned are unreachable)
  - Security: `revoke_my_session`, `revoke_my_other_sessions`
  - Overview: `get_account_overview` (one round trip for navbar + dashboards)

A copy of the SQL is in `supabase/migrations/` for your repo history.

## Files to commit
```
src/lib/api/accountApi.ts          → typed RPC client (use everywhere)
src/lib/theme.ts                   → customization engine (whitelisted accents)
src/components/ui/ConfirmDialog.tsx→ ONE destructive-action pattern app-wide
src/components/AccountMenu.tsx     → role-aware navbar account dropdown
src/components/NotificationsPanel.tsx → bulk read/delete/clear
src/components/OrderActions.tsx    → cancel + remove-from-history buttons
src/pages/MessagesPage.tsx         → full modern chat (all roles)
src/pages/account/SettingsPage.tsx → tabbed settings (all roles)
```

## Wiring (5 steps)
1. **Routes** (App.tsx):
```tsx
<Route path="/messages" element={<MessagesPage />} />
<Route path="/messages/:peerId" element={<MessagesPage />} />
<Route path="/account/settings" element={<SettingsPage />} />
```
2. **Navbar**: replace your current avatar/account button with `<AccountMenu />`, and render `<NotificationsPanel onClose={...} />` from your bell icon.
3. **index.css** — add the CSS variables block from the comment at the bottom of `src/lib/theme.ts`.
4. **After login / app boot**: call `applyTheme(profile)` so theme_mode/accent/reduced_motion take effect.
5. **Order pages**: drop `<OrderActions orderId={o.id} status={o.status} onChanged={refetch} />` into each order card, and add `.is("deleted_at", null)` to your buyer order queries.
6. Adjust the `@/lib/supabase` import path if your client lives elsewhere, then `npm run build` before pushing (Vercel auto-deploys from main).

## Security & efficiency notes
- All writes go through RPCs with `auth.uid()` ownership checks — components never write tables directly.
- `get_thread` marks messages read in the same call; `get_my_conversations` is one query for the whole inbox (no N+1, minimal egress).
- Customization is sandboxed: accents are a curated whitelist validated server-side, so no arbitrary CSS/values reach the DB.
- Delete-for-everyone has a 1-hour window and blanks the body rather than hard-deleting (audit-safe).
