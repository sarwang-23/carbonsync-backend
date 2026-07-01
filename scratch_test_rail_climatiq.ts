import 'dotenv/config';

async function run() {
  const apiKey = process.env.CLIMATIQ_API_KEY;
  const url = "https://api.climatiq.io/data/v1/estimate";

  const parametersList = [
    { distance: 550, distance_unit: 'km' },
    { passenger_distance: 550, passenger_distance_unit: 'passenger_km' },
    { passengers: 1, distance: 550, distance_unit: 'km' },
    { passenger_distance: 550 },
    { passengers: 550 }
  ];

  for (const params of parametersList) {
    try {
      console.log(`Testing parameters:`, params);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emission_factor: {
            activity_id: 'passenger_train-route_type_national_rail-fuel_source_na',
            data_version: '^21',
            region: 'GB',
          },
          parameters: params
        })
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`SUCCESS:`, data.co2e);
      } else {
        console.log(`FAILED:`, data);
      }
    } catch (e: any) {
      console.log(`ERROR:`, e.message);
    }
  }
}
run();
