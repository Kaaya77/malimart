# MaliMart — Supabase Migration Guide
## Apply in your Supabase SQL Editor

### Step 1 — Open SQL Editor
Go to: https://supabase.com/dashboard/project/ubpapxdmqlepynonhaeo/sql/new

### Step 2 — Run the migration
Copy the contents of `supabase_performance_and_cleanup.sql` and paste into the editor.
Click **Run** (or press Ctrl+Enter).

The migration is safe to run multiple times — every statement uses `IF NOT EXISTS`,
`OR REPLACE`, `DROP POLICY IF EXISTS`, or `ON CONFLICT DO NOTHING`.

Expected runtime: ~10–30 seconds on a free-tier project.

---

## What the migration does (summary)

### Missing columns fixed
| Table | Columns added |
|-------|--------------|
| `orders` | `vat`, `discount`, `address`, `payment_ref`, `deleted_at` |
| `products` | `sort_order`, `badges`, `is_verified` |
| `vendor_profiles` | `tin_number`, `business_reg_no`, `vrn`, `payout_schedule`, `social_links`, `return_policy`, `processing_time`, `warranty`, `district`, `total_sales` |
| `profiles` | `email_notifications`, `sms_notifications`, `push_notifications`, `newsletter`, `profile_visibility`, `two_factor_auth`, `language`, `default_currency`, `high_contrast_mode`, `export_format`, `opt_out_analytics` |
| `offers` | `is_auto_apply`, `tier_requirement`, `description` |
| `disputes` | `refunded` status, `updated_at` |

### New tables created
- `platform_settings` — admin panel config (seeded with 1 row)
- `revenue_stats` — VIEW replacing hardcoded chart data
- `review_helpful_votes` — review helpfulness voting
- `login_history` — buyer security tab
- `connected_accounts` — OAuth connections
- `payment_methods` — saved payment methods
- `shipments` + `shipment_events` — order tracking
- `audit_log` — admin security monitor
- `seller_payouts` — payout management
- `hero_recommendations` — AI hero section
- `followers`, `order_notes`, `inventory_logs`

### Performance indexes (62 total)
Every hot query path is covered:
- Products: 9 indexes including GIN for full-text search
- Orders: 6 indexes including composite (user_id, status)
- Messages: 6 indexes including conversation composite + unread partial
- Notifications: 3 indexes including unread partial
- All foreign keys indexed

### Security hardening
- `place_order_atomic` rewritten: server-side price fetch only (client can never override price)
- `profiles` trigger: prevents role escalation, wallet/points manipulation  
- `vendor_profiles` trigger: prevents self-verification
- RLS enabled and scoped policies on 25 tables
- Storage: 10MB file size limit, mime-type whitelist (jpg/png/webp/gif/pdf only), owner-scoped upload paths

### Auto-maintenance
- `updated_at` trigger on 15 tables
- Full-text search vector auto-updated on product changes
- Existing products backfilled with search vectors

---

## After running the migration

### Verify it worked
Run this in SQL Editor to confirm:
```sql
-- Check indexes
SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';
-- Should be 60+ (was ~0 before)

-- Check RLS is on
SELECT tablename, rowsecurity FROM pg_tables 
WHERE schemaname = 'public' ORDER BY tablename;
-- All tables should show rowsecurity = true

-- Check platform_settings seeded
SELECT * FROM public.platform_settings;
-- Should show 1 row

-- Check revenue_stats view works
SELECT * FROM public.revenue_stats LIMIT 5;
```

### Enable Realtime in Dashboard
Go to: Database → Replication → Tables
Enable for: `messages`, `notifications`, `orders`, `products`

### Update Vercel Environment Variables
Make sure these are set in Vercel (Project → Settings → Environment Variables):
- `SUPABASE_URL` = `https://ubpapxdmqlepynonhaeo.supabase.co`
- `SUPABASE_ANON_KEY` = your anon key (from Supabase → Project Settings → API)

---

## Troubleshooting

**"column already exists"** — Safe to ignore, migration uses `IF NOT EXISTS`

**"policy already exists"** — Safe to ignore, migration drops before recreating

**"publication does not exist"** — Skip Section 12 (Realtime) and enable it via Dashboard UI instead

**"permission denied for table profiles"** (in the privilege escalation trigger) —
This is by design. The trigger correctly blocks non-admins from changing their own role.
