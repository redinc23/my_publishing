-- order_items had RLS enabled (20260708074716) with no SELECT policy, so
-- session-client nested reads via orders → order_items returned empty items.
-- Match the ownership model used by "Users can view own orders".
--
-- DROP + CREATE keeps the migration idempotent (CREATE POLICY IF NOT EXISTS
-- is not supported by Postgres). Same policy name and definition as the
-- originally applied version, so environments that already applied it
-- converge to the identical state.

DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items" ON public.order_items
FOR SELECT
USING (
  order_id IN (
    SELECT id
    FROM public.orders
    WHERE user_id IN (
      SELECT id FROM public.profiles WHERE user_id = auth.uid()
    )
  )
);
