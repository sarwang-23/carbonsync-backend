-- AU Road Freight Default Factor — Final Seed
-- Supabase SQL Editor mein paste karke run karo
-- Factor: 0.12 kg CO2e / tonne-km (CarbonSync manual default estimate)
-- Expected: 500 tonne-km × 0.12 = 60 kg CO2e

insert into official_emission_factors
(
  factor_id,
  activity_id,
  use_case,
  name,
  sector,
  category,
  country_name,
  region,
  source,
  source_dataset,
  source_lca_activity,
  year,
  unit_type,
  unit,
  factor,
  factor_calculation_method,
  factor_calculation_origin,
  scopes,
  keywords,
  is_active,
  created_at,
  updated_at
)
values
(
  'au-road-freight-tonne-km-default-2025',
  'au-road-freight-tonne-km-default',
  'freight_transport',
  'Road freight transport - default tonne-km',
  'Transport',
  'freight',
  'Australia',
  'AU',
  'CarbonSync default estimate',
  'Manual fallback factor',
  'road_freight',
  2025,
  'Weight distance',
  'kg/tonne-km',
  0.12,
  'estimate',
  'manual_default',
  array['3'],
  array['freight','road freight','truck freight','tonne-km','tonne kilometre','tonne kilometer','logistics'],
  true,
  now(),
  now()
)
on conflict (factor_id) do update set
  category           = excluded.category,
  unit               = excluded.unit,
  factor             = excluded.factor,
  source             = excluded.source,
  source_dataset     = excluded.source_dataset,
  keywords           = excluded.keywords,
  is_active          = true,
  updated_at         = now();

-- Verify row:
select factor_id, name, region, category, unit, factor, source, is_active
from official_emission_factors
where factor_id = 'au-road-freight-tonne-km-default-2025';
