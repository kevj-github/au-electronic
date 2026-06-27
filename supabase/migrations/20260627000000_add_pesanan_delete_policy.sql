-- Allow owner to delete individual pesanan (cascades to item_pesanan and pembayaran via FK)
create policy "pesanan_delete" on public.pesanan
  for delete using (current_user_role() = 'owner');
