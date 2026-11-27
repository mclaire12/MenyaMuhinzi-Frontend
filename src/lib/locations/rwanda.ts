import { useEffect, useState } from "react";
import { districtsByProvince } from "@/components/auth/registration-schema";
import type { Province } from "@/lib/api/types";

/**
 * Rwanda's administrative divisions: province → district → sector → cell → villages.
 *
 * `rwanda-locations.json` is generated from the MIT-licensed `rwanda` npm package
 * (github.com/knowbee/rwanda, v3.0.2). It is ~190 KB, so it is loaded on demand in its own
 * chunk the first time a location picker is shown, then cached for the rest of the session.
 */
export type RwandaLocationTree = Record<
  Province,
  Record<string, Record<string, Record<string, readonly string[]>>>
>;

export const LOCATION_LEVELS = ["province", "district", "sector", "cell", "village"] as const;
export type LocationLevel = (typeof LOCATION_LEVELS)[number];

export interface LocationValue {
  province: Province;
  district: string;
  sector: string;
  cell: string;
  village: string;
}

let cached: RwandaLocationTree | null = null;
let pending: Promise<RwandaLocationTree> | null = null;

export function loadRwandaLocations(): Promise<RwandaLocationTree> {
  if (cached) return Promise.resolve(cached);
  pending ??= import("./rwanda-locations.json")
    .then((module) => {
      cached = module.default as unknown as RwandaLocationTree;
      return cached;
    })
    .catch((error: unknown) => {
      pending = null;
      throw error;
    });
  return pending;
}

/** The location tree once loaded (`null` while loading); `failed` when the chunk could not load. */
export function useRwandaLocations(): { tree: RwandaLocationTree | null; failed: boolean } {
  const [tree, setTree] = useState<RwandaLocationTree | null>(cached);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (tree) return;
    let active = true;
    loadRwandaLocations().then(
      (loaded) => active && setTree(loaded),
      () => active && setFailed(true),
    );
    return () => {
      active = false;
    };
  }, [tree]);
  return { tree, failed };
}

function keysOf(record: Record<string, unknown> | undefined): string[] {
  return record ? Object.keys(record) : [];
}

/** Finds a key ignoring case, so values saved with different casing still match the list. */
function find<T>(record: Record<string, T> | undefined, name: string): T | undefined {
  if (!record || !name) return undefined;
  if (name in record) return record[name];
  const wanted = name.trim().toLowerCase();
  const key = Object.keys(record).find((item) => item.toLowerCase() === wanted);
  return key === undefined ? undefined : record[key];
}

/** The choices for one level given the levels above it (empty until the parent is chosen). */
export function locationOptions(
  tree: RwandaLocationTree | null,
  level: Exclude<LocationLevel, "province">,
  value: LocationValue,
): string[] {
  if (level === "district") return [...districtsByProvince[value.province]];
  const district = find(tree?.[value.province], value.district);
  if (level === "sector") return keysOf(district);
  const sector = find(district, value.sector);
  if (level === "cell") return keysOf(sector);
  return [...(find(sector, value.cell) ?? [])];
}

/** Clears every level below the one that changed, because its choices depend on the parent. */
export function changeLocation(
  value: LocationValue,
  level: LocationLevel,
  next: string,
): LocationValue {
  const index = LOCATION_LEVELS.indexOf(level);
  const updated = { ...value, [level]: next } as LocationValue;
  for (const below of LOCATION_LEVELS.slice(index + 1)) {
    if (below !== "province") updated[below] = "";
  }
  return updated;
}
