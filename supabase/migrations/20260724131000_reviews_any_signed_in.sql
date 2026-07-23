-- Product owner wants any signed-in user to be able to leave a review (not just
-- verified purchasers). Relax the reviews_insert policy to drop the delivered-
-- purchase requirement, keeping the ownership + rating/length sanity checks.
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews
  for insert to public
  with check (
    user_id = (select auth.uid())
    and rating >= 1 and rating <= 5
    and length(coalesce(comment, '')) <= 2000
  );
