import { readFileSync } from "fs";
import { join } from "path";
import { TaxonomyLoadError } from "../errors/index.js";
import type { TaxonomyStore } from "../types/index.js";

// ─── Raw JSON shapes ──────────────────────────────────────────────────────────

interface CategoriesFile {
  categories: string[];
}

interface SectorsFile {
  sectors: string[];
}

interface MappingsFile {
  mapping: Record<string, string[]>;
}

interface UnitTypeEntry {
  unit_type: string;
}

interface UnitTypeFile {
  unit_types: UnitTypeEntry[];
}

// ─── Loader ───────────────────────────────────────────────────────────────────

function readJSON<T>(filePath: string): T {
  try {
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new TaxonomyLoadError(filePath, err);
  }
}

/**
 * Loads all taxonomy files once and returns an immutable TaxonomyStore.
 * The dataDir defaults to <project-root>/data but can be overridden for tests.
 */
export function loadTaxonomy(dataDir?: string): TaxonomyStore {
  const dir = dataDir ?? join(__dirname, "..", "..", "data");

  const categoriesFile = readJSON<CategoriesFile>(join(dir, "categories.json"));
  const sectorsFile = readJSON<SectorsFile>(join(dir, "sectors.json"));
  const mappingsFile = readJSON<MappingsFile>(join(dir, "sector_category_mappings.json"));
  const unitTypeFile = readJSON<UnitTypeFile>(join(dir, "unit-type.json"));

  const sectors = new Set(sectorsFile.sectors);
  const categories = new Set(categoriesFile.categories);
  const unitTypes = new Set(unitTypeFile.unit_types.map((u) => u.unit_type));

  const sectorCategoryMap = new Map<string, ReadonlySet<string>>(
    Object.entries(mappingsFile.mapping).map(([sector, cats]) => [sector, new Set(cats)])
  );

  return {
    sectors,
    categories,
    unitTypes,
    sectorCategoryMap,
  };
}

// ─── Singleton (loaded once at module import time) ────────────────────────────

let _store: TaxonomyStore | null = null;

export function getTaxonomy(dataDir?: string): TaxonomyStore {
  if (!_store) {
    _store = loadTaxonomy(dataDir);
  }
  return _store;
}

/** Clears the cached singleton — useful for tests */
export function resetTaxonomyCache(): void {
  _store = null;
}
