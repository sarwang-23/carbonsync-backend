import axios from "axios";
import dotenv from "dotenv";
import { readFileSync } from "fs";

// Load env
const envContent = readFileSync(".env", "utf-8");
const envVars: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
}
const CLIMATIQ_API_KEY = envVars.CLIMATIQ_API_KEY || process.env.CLIMATIQ_API_KEY;

const activityId = "freight_vehicle-vehicle_type_hgv-fuel_source_diesel-vehicle_weight_na-percentage_load_avg";

// Test 1: weight + distance separately
console.log("=== TEST 1: weight + distance separately ===");
try {
  const r1 = await axios.post(
    "https://api.climatiq.io/data/v1/estimate",
    {
      emission_factor: { activity_id: activityId },
      parameters: { weight: 1, weight_unit: "t", distance: 585, distance_unit: "km" }
    },
    { headers: { Authorization: `Bearer ${CLIMATIQ_API_KEY}` } }
  );
  console.log("✅ SUCCESS:", r1.data.co2e, r1.data.co2e_unit);
} catch (e: any) {
  console.log("❌ FAIL:", e?.response?.data?.message || e.message);
}

// Test 2: weight_distance in tonne_km
console.log("\n=== TEST 2: weight_distance tonne_km ===");
try {
  const r2 = await axios.post(
    "https://api.climatiq.io/data/v1/estimate",
    {
      emission_factor: { activity_id: activityId },
      parameters: { weight_distance: 585, weight_distance_unit: "tonne_km" }
    },
    { headers: { Authorization: `Bearer ${CLIMATIQ_API_KEY}` } }
  );
  console.log("✅ SUCCESS:", r2.data.co2e, r2.data.co2e_unit);
} catch (e: any) {
  console.log("❌ FAIL:", e?.response?.data?.message || e.message);
}

// Test 3: passenger railway
console.log("\n=== TEST 3: railway distance + passengers ===");
try {
  const r3 = await axios.post(
    "https://api.climatiq.io/data/v1/estimate",
    {
      emission_factor: { activity_id: "passenger_train-route_type_national_rail-fuel_source_na" },
      parameters: { distance: 585, distance_unit: "km", passengers: 1 }
    },
    { headers: { Authorization: `Bearer ${CLIMATIQ_API_KEY}` } }
  );
  console.log("✅ SUCCESS:", r3.data.co2e, r3.data.co2e_unit);
} catch (e: any) {
  console.log("❌ FAIL:", e?.response?.data?.message || e.message);
}

// Test 4: flight distance + passengers (no region)
console.log("\n=== TEST 4: flight distance + passengers (no region) ===");
try {
  const r4 = await axios.post(
    "https://api.climatiq.io/data/v1/estimate",
    {
      emission_factor: { activity_id: "passenger_flight-route_type_domestic-aircraft_type_na-distance_na-class_na-rf_included-distance_uplift_included" },
      parameters: { distance: 505, distance_unit: "km", passengers: 1 }
    },
    { headers: { Authorization: `Bearer ${CLIMATIQ_API_KEY}` } }
  );
  console.log("✅ SUCCESS:", r4.data.co2e, r4.data.co2e_unit);
} catch (e: any) {
  console.log("❌ FAIL:", e?.response?.data?.message || e.message);
}

// Test 5: petrol without region
console.log("\n=== TEST 5: petrol volume (no region) ===");
try {
  const r5 = await axios.post(
    "https://api.climatiq.io/data/v1/estimate",
    {
      emission_factor: { activity_id: "fuel-type_motor_gasoline-fuel_use_stationary" },
      parameters: { volume: 100, volume_unit: "l" }
    },
    { headers: { Authorization: `Bearer ${CLIMATIQ_API_KEY}` } }
  );
  console.log("✅ SUCCESS:", r5.data.co2e, r5.data.co2e_unit);
} catch (e: any) {
  console.log("❌ FAIL:", e?.response?.data?.message || e.message);
}

// Test 6: coal weight kg (no region)
console.log("\n=== TEST 6: coal weight kg (no region) ===");
try {
  const r6 = await axios.post(
    "https://api.climatiq.io/data/v1/estimate",
    {
      emission_factor: { activity_id: "fuel-type_coal_bituminous-fuel_use_stationary" },
      parameters: { weight: 1000, weight_unit: "kg" }
    },
    { headers: { Authorization: `Bearer ${CLIMATIQ_API_KEY}` } }
  );
  console.log("✅ SUCCESS:", r6.data.co2e, r6.data.co2e_unit);
} catch (e: any) {
  console.log("❌ FAIL:", e?.response?.data?.message || e.message);
}
