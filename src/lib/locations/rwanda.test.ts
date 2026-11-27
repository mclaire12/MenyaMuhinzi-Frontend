import { describe, expect, it } from "vitest";
import { districtsByProvince } from "@/components/auth/registration-schema";
import { changeLocation, loadRwandaLocations, locationOptions, type LocationValue } from "./rwanda";

const musanze: LocationValue = {
  province: "NORTHERN",
  district: "Musanze",
  sector: "Kinigi",
  cell: "Nyonirima",
  village: "Kansoro",
};

describe("Rwanda locations", () => {
  it("covers every district the backend accepts", async () => {
    const tree = await loadRwandaLocations();
    for (const [province, districts] of Object.entries(districtsByProvince)) {
      expect(Object.keys(tree[province as keyof typeof tree]).sort()).toEqual(
        [...districts].sort(),
      );
    }
  });

  it("lists each level inside the level chosen above it", async () => {
    const tree = await loadRwandaLocations();
    expect(locationOptions(tree, "sector", musanze)).toContain("Kinigi");
    expect(locationOptions(tree, "sector", musanze)).not.toContain("Kimironko");
    expect(locationOptions(tree, "cell", musanze)).toContain("Nyonirima");
    expect(locationOptions(tree, "village", musanze)).toContain("Kansoro");
    expect(locationOptions(tree, "cell", { ...musanze, sector: "" })).toEqual([]);
  });

  it("clears the levels below the one that changed", () => {
    expect(changeLocation(musanze, "district", "Burera")).toEqual({
      province: "NORTHERN",
      district: "Burera",
      sector: "",
      cell: "",
      village: "",
    });
    expect(changeLocation(musanze, "cell", "Bisoke")).toMatchObject({
      sector: "Kinigi",
      cell: "Bisoke",
      village: "",
    });
  });
});
