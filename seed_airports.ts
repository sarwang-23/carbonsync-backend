import { pool } from "./src/db.js";

async function run() {
  try {
    // Create airport_coordinates table
    await pool.query(`
      create table if not exists airport_coordinates (
        id serial primary key,
        airport_code varchar(3) not null unique,
        city varchar(100) not null,
        country varchar(100) not null default 'India',
        latitude numeric(10, 6) not null,
        longitude numeric(10, 6) not null,
        is_active boolean default true,
        created_at timestamptz default now(),
        updated_at timestamptz default now()
      );
    `);
    console.log("Table airport_coordinates created/verified.");

    const airports = [
      ["DEL", "Delhi", 28.5562, 77.1000],
      ["BOM", "Mumbai", 19.0896, 72.8656],
      ["BLR", "Bengaluru", 13.1979, 77.7063],
      ["MAA", "Chennai", 12.9941, 80.1709],
      ["HYD", "Hyderabad", 17.2403, 78.4294],
      ["CCU", "Kolkata", 22.6520, 88.4463],
      ["PAT", "Patna", 25.5913, 85.0878],
      ["PNQ", "Pune", 18.5822, 73.9197],
      ["GOI", "Goa", 15.3808, 73.8314],
      ["RPR", "Raipur", 21.1804, 81.7388],
      ["AMD", "Ahmedabad", 23.0731, 72.6347],
      ["JAI", "Jaipur", 26.8242, 75.8122],
      ["LKO", "Lucknow", 26.7606, 80.8893],
      ["BHO", "Bhopal", 23.2875, 77.3374],
      ["IDR", "Indore", 22.7218, 75.8011],
      ["NAG", "Nagpur", 21.0922, 79.0472],
      ["VTZ", "Visakhapatnam", 17.7212, 83.2245],
      ["COK", "Kochi", 10.1520, 76.4019],
      ["TRV", "Thiruvananthapuram", 8.4821, 76.9201],
      ["IXC", "Chandigarh", 30.6735, 76.7885],
      ["ATQ", "Amritsar", 31.7096, 74.7973],
      ["SXR", "Srinagar", 33.9871, 74.7742],
      ["IXB", "Bagdogra", 26.6812, 88.3286],
      ["GAU", "Guwahati", 26.1061, 91.5859],
      ["IXJ", "Jammu", 32.6890, 74.8374],
      ["VNS", "Varanasi", 25.4524, 82.8593],
      ["AGR", "Agra", 27.1558, 77.9608],
      ["UDR", "Udaipur", 24.6177, 73.8961],
      ["JDH", "Jodhpur", 26.2511, 73.0489],
      ["BBI", "Bhubaneswar", 20.2444, 85.8178],
      ["IXZ", "Port Blair", 11.6412, 92.7297],
    ];

    for (const [code, city, lat, lon] of airports) {
      await pool.query(
        `
        insert into airport_coordinates (airport_code, city, latitude, longitude, is_active)
        values ($1, $2, $3, $4, true)
        on conflict (airport_code) do update
          set city = excluded.city,
              latitude = excluded.latitude,
              longitude = excluded.longitude,
              is_active = true,
              updated_at = now()
        `,
        [code, city, lat, lon]
      );
    }

    console.log(`Seeded ${airports.length} airport coordinates.`);

    // Quick distance test: RPR → GOI
    const rpr = airports.find(a => a[0] === "RPR")!;
    const goi = airports.find(a => a[0] === "GOI")!;
    const R = 6371;
    const toRad = (d: number) => d * Math.PI / 180;
    const dLat = toRad(Number(goi[2]) - Number(rpr[2]));
    const dLon = toRad(Number(goi[3]) - Number(rpr[3]));
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(Number(rpr[2]))) * Math.cos(toRad(Number(goi[2]))) * Math.sin(dLon/2)**2;
    const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
    console.log(`RPR → GOI haversine distance: ${dist} km`);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

run();
