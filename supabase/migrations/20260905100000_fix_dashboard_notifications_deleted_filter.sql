-- get_dashboard_data's notifications subquery never filtered deleted_at,
-- unlike every other subquery in this function (orders, wishlist, cart all
-- correctly exclude soft-deleted rows). Deleting or clearing notifications
-- sets deleted_at (soft delete, see delete_my_notifications/clear_read_
-- notifications/delete_all_my_notifications) — so the optimistic UI update
-- looked right immediately, but a full page reload re-hydrates from THIS
-- RPC and brought every "deleted" notification straight back, badge count
-- included. Adds the same deleted_at IS NULL guard used everywhere else.
create or replace function public.get_dashboard_data()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
    v_uid      uuid    := auth.uid();
    v_role     text;
    v_is_banned boolean;
    v_result   jsonb;
BEGIN
    IF v_uid IS NULL THEN
        RETURN jsonb_build_object('error', 'not_authenticated');
    END IF;

    SELECT role::text, COALESCE(is_banned, false)
      INTO v_role, v_is_banned
    FROM public.profiles
    WHERE id = v_uid;

    v_result := jsonb_build_object(
        'role',       v_role,
        'is_banned',  v_is_banned,
        'addresses', (
            SELECT COALESCE(jsonb_agg(a.* ORDER BY a.is_default DESC, a.created_at DESC), '[]'::jsonb)
            FROM public.addresses a WHERE a.user_id = v_uid
        ),
        'notifications', CASE WHEN v_is_banned THEN '[]'::jsonb ELSE (
            SELECT COALESCE(jsonb_agg(n.* ORDER BY n.created_at DESC), '[]'::jsonb)
            FROM (SELECT * FROM public.notifications WHERE user_id = v_uid AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 50) n
        ) END,
        'wallet_transactions', (
            SELECT COALESCE(jsonb_agg(w.* ORDER BY w.created_at DESC), '[]'::jsonb)
            FROM (SELECT * FROM public.wallet_transactions WHERE profile_id = v_uid ORDER BY created_at DESC LIMIT 20) w
        ),
        'activity_logs', (
            SELECT COALESCE(jsonb_agg(l.* ORDER BY l.created_at DESC), '[]'::jsonb)
            FROM (SELECT * FROM public.activity_logs WHERE user_id = v_uid ORDER BY created_at DESC LIMIT 20) l
        ),
        'payment_methods', (
            SELECT COALESCE(jsonb_agg(pm.* ORDER BY pm.is_default DESC NULLS LAST, pm.created_at DESC), '[]'::jsonb)
            FROM public.payment_methods pm WHERE pm.user_id = v_uid
        ),
        'connected_accounts', (
            SELECT COALESCE(jsonb_agg(c.*), '[]'::jsonb)
            FROM public.connected_accounts c WHERE c.user_id = v_uid
        ),
        'login_history', (
            SELECT COALESCE(jsonb_agg(lh.* ORDER BY lh.login_time DESC), '[]'::jsonb)
            FROM (SELECT * FROM public.login_history WHERE user_id = v_uid ORDER BY login_time DESC LIMIT 10) lh
        ),
        'blocked_user_ids', (
            SELECT COALESCE(jsonb_agg(b.blocked_id), '[]'::jsonb)
            FROM public.blocked_users b WHERE b.blocker_id = v_uid
        ),
        'followers', (
            SELECT COALESCE(jsonb_agg(f.*), '[]'::jsonb)
            FROM public.followers f WHERE f.user_id = v_uid
        ),
        'unread_messages_count', (
            SELECT COUNT(*) FROM public.messages WHERE receiver_id = v_uid AND read = false
        ),
        'orders', (
            SELECT COALESCE(jsonb_agg(ord_data ORDER BY (ord_data->>'created_at') DESC), '[]'::jsonb)
            FROM (
                WITH items_agg AS (
                    SELECT
                        oi.order_id,
                        jsonb_agg(jsonb_build_object(
                            'id',               oi.id,
                            'order_id',         oi.order_id,
                            'product_id',       oi.product_id,
                            'variant_id',       oi.variant_id,
                            'seller_id',        oi.seller_id,
                            'quantity',         oi.quantity,
                            'price',            COALESCE(oi.price, oi.price_at_purchase),
                            'product', jsonb_build_object('name', p.name, 'images', p.images)
                        ) ORDER BY oi.created_at) AS items
                    FROM public.order_items oi
                    JOIN public.products p ON p.id = oi.product_id
                    WHERE oi.order_id IN (
                        SELECT id FROM public.orders
                        WHERE user_id = v_uid AND deleted_at IS NULL
                        ORDER BY created_at DESC LIMIT 50
                    )
                    GROUP BY oi.order_id
                )
                SELECT jsonb_build_object(
                    'id',               o.id,
                    'user_id',          o.user_id,
                    'status',           o.status::text,
                    'created_at',       o.created_at,
                    'updated_at',       o.updated_at,
                    'total',            o.total,
                    'subtotal',         o.subtotal,
                    'delivery_fee',     o.delivery_fee,
                    'discount_amount',  COALESCE(o.discount_amount, o.discount, 0),
                    'payment_method',   o.payment_method,
                    'payment_ref',      o.payment_ref,
                    'note',             COALESCE(o.note, o.customer_notes),
                    'shipping_address', COALESCE(o.shipping_address, o.shipping_address_snap, o.address),
                    'cancel_reason',    o.cancel_reason,
                    'is_gift',          o.is_gift,
                    'gift_message',     o.gift_message,
                    'items',            COALESCE(ia.items, '[]'::jsonb)
                ) AS ord_data
                FROM public.orders o
                LEFT JOIN items_agg ia ON ia.order_id = o.id
                WHERE o.user_id = v_uid AND o.deleted_at IS NULL
                ORDER BY o.created_at DESC LIMIT 50
            ) sub
        ),
        'wishlist', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', p.id, 'name', p.name, 'price', p.price, 'sale_price', p.sale_price,
                'images', p.images, 'rating', p.rating, 'review_count', p.review_count,
                'stock', p.stock, 'seller_id', p.seller_id, 'status', p.status,
                'slug', p.slug, 'brand', p.brand
            )), '[]'::jsonb)
            FROM public.wishlist_items w
            JOIN public.products p ON p.id = w.product_id
            WHERE w.user_id = v_uid AND w.deleted_at IS NULL AND p.deleted_at IS NULL
        ),
        'cart', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'cart_item_id', ci.id, 'product_id', ci.product_id,
                'variant_id',   ci.variant_id, 'quantity', ci.quantity,
                'product', jsonb_build_object(
                    'id', p.id, 'name', p.name, 'price', p.price, 'sale_price', p.sale_price,
                    'images', p.images, 'stock', p.stock, 'seller_id', p.seller_id,
                    'slug', p.slug, 'status', p.status,
                    'variants', case
                        when ci.variant_id is null then '[]'::jsonb
                        else coalesce((
                            select jsonb_agg(to_jsonb(pv.*))
                            from public.product_variants pv
                            where pv.id = ci.variant_id
                        ), '[]'::jsonb)
                    end
                )
            )), '[]'::jsonb)
            FROM public.cart_items ci
            JOIN public.carts c   ON c.id  = ci.cart_id
            JOIN public.products p ON p.id = ci.product_id
            WHERE c.user_id = v_uid AND p.deleted_at IS NULL
        )
    );

    IF v_role = 'seller' THEN
        v_result := v_result || jsonb_build_object(
            'vendor_profile', (
                SELECT to_jsonb(vp.*) FROM public.vendor_profiles vp WHERE vp.seller_id = v_uid
            ),
            'staff_accounts', (
                SELECT COALESCE(jsonb_agg(s.*), '[]'::jsonb)
                FROM public.staff_accounts s WHERE s.seller_id = v_uid
            ),
            'shipping_zones', (
                SELECT COALESCE(jsonb_agg(z.*), '[]'::jsonb)
                FROM public.shipping_zones z WHERE z.seller_id = v_uid
            ),
            'seller_stats', (
                SELECT jsonb_build_object(
                    'total_revenue',    COALESCE(SUM(COALESCE(oi.price_at_purchase, oi.price, 0) * oi.quantity)
                                          FILTER (WHERE o.status::text IN ('delivered','shipped','processing','confirmed')), 0),
                    'total_orders',     COUNT(DISTINCT oi.order_id),
                    'pending_orders',   COUNT(DISTINCT oi.order_id) FILTER (WHERE o.status::text = 'pending'),
                    'shipped_orders',   COUNT(DISTINCT oi.order_id) FILTER (WHERE o.status::text IN ('shipped','in_transit')),
                    'delivered_orders', COUNT(DISTINCT oi.order_id) FILTER (WHERE o.status::text = 'delivered'),
                    'cancelled_orders', COUNT(DISTINCT oi.order_id) FILTER (WHERE o.status::text = 'cancelled'),
                    'items_sold',       COALESCE(SUM(oi.quantity) FILTER (WHERE o.status::text IN ('delivered','shipped')), 0),
                    'low_stock_count',  (SELECT COUNT(*) FROM public.products
                                         WHERE seller_id = v_uid AND stock > 0 AND stock <= 5
                                           AND status = 'active' AND deleted_at IS NULL),
                    'product_count',    (SELECT COUNT(*) FROM public.products
                                         WHERE seller_id = v_uid AND deleted_at IS NULL)
                )
                FROM public.order_items oi
                JOIN public.orders o ON o.id = oi.order_id
                WHERE oi.seller_id = v_uid AND o.deleted_at IS NULL
            )
        );
    END IF;

    IF v_role = 'admin' THEN
        v_result := v_result || jsonb_build_object(
            'admin_stats', (
                SELECT jsonb_build_object(
                    'total_users',   SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END),
                    'total_sellers', SUM(CASE WHEN role::text = 'seller' AND deleted_at IS NULL THEN 1 ELSE 0 END),
                    'total_buyers',  SUM(CASE WHEN role::text = 'buyer'  AND deleted_at IS NULL THEN 1 ELSE 0 END),
                    'new_users_7d',  SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' AND deleted_at IS NULL THEN 1 ELSE 0 END)
                ) FROM public.profiles
            ) ||
            (SELECT jsonb_build_object(
                'total_products',  SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END),
                'active_products', SUM(CASE WHEN status = 'active' AND deleted_at IS NULL THEN 1 ELSE 0 END)
            ) FROM public.products) ||
            (SELECT jsonb_build_object(
                'total_orders',  COUNT(*),
                'pending_orders',SUM(CASE WHEN status::text = 'pending' THEN 1 ELSE 0 END),
                'total_revenue', COALESCE(SUM(total) FILTER (WHERE status::text IN ('shipped','delivered')), 0),
                'new_orders_7d', SUM(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END)
            ) FROM public.orders WHERE deleted_at IS NULL) ||
            (SELECT jsonb_build_object(
                'pending_verifications', COUNT(*) FILTER (WHERE is_verified = false),
                'open_disputes', (SELECT COUNT(*) FROM public.disputes WHERE status = 'open')
            ) FROM public.vendor_profiles)
        );
    END IF;

    RETURN v_result;
END;
$function$;
