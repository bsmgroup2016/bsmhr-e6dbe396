-- Site map locations for automatic project assignment at check-in.
-- Coordinates are filled automatically from the site address (Google Geocoding)
-- and refreshed when older than 30 days.
alter table public.sites add column if not exists lat double precision;
alter table public.sites add column if not exists lng double precision;
alter table public.sites add column if not exists geofence_radius_m integer not null default 500;
alter table public.sites add column if not exists geocoded_at timestamptz;
notify pgrst, 'reload schema';
