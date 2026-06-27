import db from "../db.js";

export async function findBestMapping(itemName: string, country = "Malaysia") {
  const result = await db.query(
    `
    SELECT *
    FROM public.emission_factor_mappings
    WHERE country = $1
      AND active = true
      AND $2 ~* pattern
    ORDER BY priority DESC
    LIMIT 1
    `,
    [country, itemName]
  );

  return result.rows[0] || null;
}