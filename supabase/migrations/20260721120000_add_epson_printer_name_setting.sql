-- Seed the settings row that stores the Epson (LX-310) printer name used by the
-- "Cetak Epson" button. Empty until the owner sets it in Pengaturan.
insert into public.settings (key, value)
values ('epson_printer_name', '')
on conflict (key) do nothing;
