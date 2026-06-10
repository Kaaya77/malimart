-- Function to create a notification
CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_link TEXT DEFAULT NULL,
    p_order_id UUID DEFAULT NULL,
    p_payload JSONB DEFAULT '{}'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.notifications (user_id, type, title, message, link, order_id, payload)
    VALUES (p_user_id, p_type, p_title, p_message, p_link, p_order_id, p_payload);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new messages
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER AS $$
DECLARE
    sender_name TEXT;
BEGIN
    SELECT full_name INTO sender_name FROM public.profiles WHERE id = NEW.sender_id;

    PERFORM public.create_notification(
        NEW.receiver_id,
        'message',
        'New Message from ' || sender_name,
        NEW.body,
        '/messages?room=' || NEW.room_id,
        NULL,
        jsonb_build_object('sender_id', NEW.sender_id, 'product_id', NEW.product_id)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_new_message
    AFTER INSERT ON public.messages
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_message_notification();

-- Trigger for order status changes
CREATE OR REPLACE FUNCTION public.handle_order_status_change()
RETURNS TRIGGER AS $$
DECLARE
    notification_title TEXT;
    notification_message TEXT;
    notification_link TEXT;
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        notification_title := 'Order Status Updated';
        notification_message := 'Your order #' || substr(NEW.id::text, 1, 8) || ' is now ' || NEW.status || '.';
        notification_link := '/orders/' || NEW.id;

        PERFORM public.create_notification(
            NEW.user_id,
            'order',
            notification_title,
            notification_message,
            notification_link,
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_order_status_update
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW EXECUTE PROCEDURE public.handle_order_status_change();
