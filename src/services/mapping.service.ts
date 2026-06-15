import db from "../db.js";

export async function findBestMapping(itemName: string) {
  const result = await db.query(
    `
    SELECT *
    FROM emission_factor_mappings
    WHERE is_default = true
    AND EXISTS (
      SELECT 1 FROM unnest(item_keywords) AS keyword
      WHERE LOWER($1) LIKE '%' || LOWER(keyword) || '%'
    )
    LIMIT 1
    `,
    [itemName]
  );

  return result.rows[0] || null;
}