import { calculateIndiaFixedEmission } from "./IndiaFixedEmission.service.js";
import { calculateIndiaClimatiqFallback } from "./IndiaClimatiqFallback.service.js";

type IndiaEmissionInput = {
  category: string;
  itemName: string;
  value: number;
  unit: string;
};

const INDIA_FIXED_CATEGORIES = ["electricity", "railway", "flight"];

export async function calculateIndiaEmission(input: IndiaEmissionInput) {
  const category = input.category.toLowerCase();

  if (INDIA_FIXED_CATEGORIES.includes(category)) {
    return await calculateIndiaFixedEmission({
      category,
      value: input.value,
      unit: input.unit,
    });
  }

  return await calculateIndiaClimatiqFallback({
    category,
    itemName: input.itemName,
    value: input.value,
    unit: input.unit,
  });
}
