-- AU Freight tonne-km → Climatiq fallback mapping
-- Run this in Supabase SQL Editor

insert into emission_factor_mappings
(
  region,
  country_name,
  category,
  keywords,
  activity_id,
  preferred_source,
  preferred_lca_activity,
  parameter_name,
  parameter_unit,
  data_version,
  is_active,
  notes,
  created_at,
  updated_at
)
values
(
  'AU',
  'Australia',
  'freight',
  array[
    'freight',
    'truck freight',
    'road freight',
    'goods transport',
    'tonne-km',
    'tonne kilometer',
    'tonne kilometre',
    'logistics'
  ],
  null,
  'Climatiq',
  'fallback',
  'weight_distance',
  'tonne-km',
  '^6',
  true,
  'AU freight tonne-km: local NGA missing ho toh Climatiq fallback use karo',
  now(),
  now()
)
on conflict do nothing;
