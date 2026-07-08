import { pool } from './src/db.js';

async function debug() {
  // Reproduce exactly what findLocalOfficialFactor does
  const params = {
    region: 'FR',
    category: 'diesel',
    itemName: 'Diesel fuel gazole',
    unit: 'litre',
    auState: null,
    ukFlightType: null
  };

  const result = await pool.query(
    `
    select
      factor_id,
      activity_id,
      name,
      category,
      source,
      unit,
      factor,
      (
        (case when lower(category) = lower($2) then 20 else 0 end)
        + (case when lower($2) = 'diesel' and (lower(name) like '%no. 2%' or lower(name) like '%no 2%') then 100 else 0 end)
        + (case when lower($2) = 'diesel'
                 and (lower(name) like '%biodiesel%' or lower(name) like '%biofuel%' or lower(name) like '%b100%')
                 and lower($3) not like '%biodiesel%' and lower($3) not like '%b100%' and lower($3) not like '%biofuel%'
                 then -200 else 0 end)
        + (case when lower($2) = 'diesel' and (lower(name) like '%gasoil%' or lower(name) like '%gazole%' or lower(name) like '%diesel oil%' or lower(name) like '%diesel fuel%') then 80 else 0 end)
        + (case when lower($2) = 'diesel'
                 and (lower(name) like '%marine%' or lower(name) like '%mdo%' or lower(name) like '%maritime%' or lower(name) like '%fluvial%')
                 and lower($3) not like '%marine%' and lower($3) not like '%ship%' and lower($3) not like '%maritime%' and lower($3) not like '%bateau%'
                 then -250 else 0 end)
        + (case when lower($2) = 'diesel' and lower(name) like '%routier%' then 60 else 0 end)
        + (case when lower(name) like '%combustion%' or lower(source_lca_activity) like '%combustion%' then 100 else 0 end)
        + (case when lower(unit) like '%/l' or lower(unit) like '%/litre' or lower(unit) like '%/liter' then 50 else 0 end)
        + (case when lower(name) like '%wtt%' or lower(name) like '%well to tank%' then -50 else 0 end)
        + (case when lower(name) like '%outside of scopes%' then -200 else 0 end)
      ) as computed_score
    from official_emission_factors
    where region = $1
      and is_active = true
      and factor is not null
      and (
        lower(category) = lower($2)
        or lower($2) = 'diesel' and (lower(name) like '%distillate fuel oil%' or lower(name) like '%diesel%')
        or lower(name) like '%' || lower($2) || '%'
      )
    order by computed_score desc, year desc nulls last
    limit 10
    `,
    [params.region, params.category, params.itemName]
  );

  console.log("Top 10 FR diesel candidates with scores:");
  for (const row of result.rows) {
    console.log(`  Score: ${row.computed_score} | ${row.name} | ${row.unit} | factor: ${row.factor} | activity: ${row.activity_id}`);
  }
}

debug().then(() => process.exit(0)).catch(console.error);
