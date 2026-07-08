import { pool } from "./src/db.js";

async function run() {
  try {
    // Create flight_route_distances table
    await pool.query(`
      create table if not exists flight_route_distances (
        id serial primary key,
        from_airport_code varchar(3) not null,
        to_airport_code varchar(3) not null,
        distance_km numeric(10, 2) not null,
        is_active boolean default true,
        created_at timestamptz default now(),
        updated_at timestamptz default now(),
        unique (from_airport_code, to_airport_code)
      );
    `);
    console.log("Table created/verified.");

    const routes = [
      ["PAT", "BOM", 1449],
      ["BOM", "PAT", 1449],
      ["PNQ", "DEL", 1173],
      ["DEL", "PNQ", 1173],
      ["DEL", "BOM", 1148],
      ["BOM", "DEL", 1148],
      ["DEL", "BLR", 1740],
      ["BLR", "DEL", 1740],
      ["DEL", "HYD", 1253],
      ["HYD", "DEL", 1253],
      ["DEL", "MAA", 1754],
      ["MAA", "DEL", 1754],
      ["DEL", "CCU", 1305],
      ["CCU", "DEL", 1305],
      ["BOM", "BLR", 843],
      ["BLR", "BOM", 843],
      ["BOM", "HYD", 619],
      ["HYD", "BOM", 619],
      ["BOM", "CCU", 1660],
      ["CCU", "BOM", 1660],
      ["BOM", "MAA", 1004],
      ["MAA", "BOM", 1004],
      ["BLR", "HYD", 498],
      ["HYD", "BLR", 498],
      ["DEL", "GOI", 1882],
      ["GOI", "DEL", 1882],
      ["BOM", "GOI", 451],
      ["GOI", "BOM", 451],
      ["DEL", "AMD", 888],
      ["AMD", "DEL", 888],
      ["DEL", "JAI", 250],
      ["JAI", "DEL", 250],
    ];

    for (const [from, to, dist] of routes) {
      await pool.query(
        `
        insert into flight_route_distances (from_airport_code, to_airport_code, distance_km, is_active)
        values ($1, $2, $3, true)
        on conflict (from_airport_code, to_airport_code) do update
          set distance_km = excluded.distance_km,
              is_active = true,
              updated_at = now()
        `,
        [from, to, dist]
      );
    }

    console.log(`Seeded ${routes.length} flight routes.`);

    const verify = await pool.query(
      "select from_airport_code, to_airport_code, distance_km from flight_route_distances where is_active = true order by from_airport_code"
    );
    console.log("Active routes:", verify.rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

run();
