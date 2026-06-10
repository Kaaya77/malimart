-- Add UPDATE policies for orders
CREATE POLICY "Users can update own orders" ON public.orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Sellers can update orders" ON public.orders FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.order_items 
        WHERE public.order_items.order_id = public.orders.id 
        AND public.order_items.seller_id = auth.uid()
    )
);

-- Add UPDATE policies for order_items if necessary (e.g., if seller needs to update item status)
CREATE POLICY "Sellers can update order items" ON public.order_items FOR UPDATE USING (seller_id = auth.uid());
