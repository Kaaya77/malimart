-- Order Security and RBAC Updates

-- 1. Drop existing basic function
DROP FUNCTION IF EXISTS public.update_order_status_safe(UUID, TEXT);

-- 2. Create robust RBAC status update function
CREATE OR REPLACE FUNCTION public.update_order_status_rbac(
    p_order_id UUID,
    p_new_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status TEXT;
    v_buyer_id UUID;
    v_seller_id UUID;
    v_user_role TEXT;
    v_caller_id UUID := auth.uid();
BEGIN
    -- Get order details
    SELECT status, user_id INTO v_current_status, v_buyer_id 
    FROM public.orders 
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found';
    END IF;

    -- Allow service_role to bypass
    IF current_setting('role', true) = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
        RETURN;
    END IF;

    -- Get seller ID from the first order item
    SELECT seller_id INTO v_seller_id
    FROM public.order_items
    WHERE order_id = p_order_id AND seller_id = v_caller_id
    LIMIT 1;

    -- Get caller role from profiles
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_caller_id;

    -- Determine permissions
    DECLARE
        is_buyer BOOLEAN := (v_caller_id = v_buyer_id);
        is_seller BOOLEAN := (v_seller_id IS NOT NULL);
        is_admin BOOLEAN := (v_user_role = 'admin');
    BEGIN
        -- Admin can do anything
        IF is_admin THEN
            UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
            RETURN;
        END IF;

        -- State Machine Logic
        IF p_new_status = 'cancelled' THEN
            IF is_buyer AND v_current_status = 'pending' THEN
                UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
                RETURN;
            ELSIF is_seller AND v_current_status IN ('pending', 'processing') THEN
                UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
                RETURN;
            ELSE
                RAISE EXCEPTION 'Unauthorized or invalid state transition to cancelled';
            END IF;
        END IF;

        IF p_new_status = 'processing' THEN
            IF is_seller AND v_current_status = 'pending' THEN
                UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
                RETURN;
            ELSE
                RAISE EXCEPTION 'Only seller can mark as processing from pending';
            END IF;
        END IF;

        IF p_new_status = 'in_transit' THEN
            IF is_seller AND v_current_status = 'processing' THEN
                UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
                RETURN;
            ELSE
                RAISE EXCEPTION 'Only seller can mark as in_transit from processing';
            END IF;
        END IF;

        IF p_new_status = 'delivered' THEN
            IF is_seller AND v_current_status = 'in_transit' THEN
                UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
                RETURN;
            ELSE
                RAISE EXCEPTION 'Only seller can mark as delivered from in_transit';
            END IF;
        END IF;

        IF p_new_status = 'refunded' THEN
            IF is_seller AND v_current_status IN ('pending', 'processing', 'in_transit', 'delivered', 'disputed') THEN
                UPDATE public.orders SET status = p_new_status WHERE id = p_order_id;
                RETURN;
            ELSE
                RAISE EXCEPTION 'Only seller can refund';
            END IF;
        END IF;

        RAISE EXCEPTION 'Invalid status transition from % to %', v_current_status, p_new_status;
    END;
END;
$$;

-- 3. Trigger to prevent direct status updates bypassing RBAC
CREATE OR REPLACE FUNCTION public.enforce_order_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_user_role TEXT;
    is_buyer BOOLEAN;
    is_seller BOOLEAN;
    is_admin BOOLEAN;
BEGIN
    -- If status hasn't changed, allow the update
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Allow service_role to bypass
    IF current_setting('role', true) = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- Get caller role from profiles
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_caller_id;

    is_buyer := (v_caller_id = OLD.user_id);
    is_admin := (v_user_role = 'admin');
    
    -- Check if caller is a seller for this order
    SELECT EXISTS (
        SELECT 1 FROM public.order_items
        WHERE order_id = OLD.id AND seller_id = v_caller_id
    ) INTO is_seller;

    -- Admin can do anything
    IF is_admin THEN
        RETURN NEW;
    END IF;

    -- State Machine Logic
    IF NEW.status = 'cancelled' THEN
        IF is_buyer AND OLD.status = 'pending' THEN
            RETURN NEW;
        ELSIF is_seller AND OLD.status IN ('pending', 'processing') THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Unauthorized or invalid state transition to cancelled';
        END IF;
    END IF;

    IF NEW.status = 'processing' THEN
        IF is_seller AND OLD.status = 'pending' THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Only seller can mark as processing from pending';
        END IF;
    END IF;

    IF NEW.status = 'in_transit' THEN
        IF is_seller AND OLD.status = 'processing' THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Only seller can mark as in_transit from processing';
        END IF;
    END IF;

    IF NEW.status = 'delivered' THEN
        IF is_seller AND OLD.status = 'in_transit' THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Only seller can mark as delivered from in_transit';
        END IF;
    END IF;

    IF NEW.status = 'refunded' THEN
        IF is_seller AND OLD.status IN ('pending', 'processing', 'in_transit', 'delivered', 'disputed') THEN
            RETURN NEW;
        ELSE
            RAISE EXCEPTION 'Only seller can refund';
        END IF;
    END IF;

    RAISE EXCEPTION 'Invalid status transition from % to %', OLD.status, NEW.status;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_order_status_transition ON public.orders;
CREATE TRIGGER trg_enforce_order_status_transition
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_order_status_transition();

