/**
 * Professional titles offered to facilitators / agronomists at registration.
 * Must match FACILITATOR_TITLES in the backend
 * (MenyaMuhinzi-Backend/src/modules/facilitators/facilitator-titles.ts), which validates them.
 * `value` is stored as the title and shown on profiles; `label` is the Kinyarwanda description.
 */
export const FACILITATOR_TITLE_OPTIONS = [
  { value: "Agronomist", label: "Umuhanga mu by'ubuhinzi (Agronomist)" },
  {
    value: "Agricultural Extension Officer",
    label: "Umukozi ushinzwe ubujyanama mu buhinzi (Extension Officer)",
  },
  {
    value: "Crop Production Officer",
    label: "Umukozi ushinzwe umusaruro w'ibihingwa (Crop Production Officer)",
  },
  { value: "Farmer Promoter", label: "Umufashamyumvire w'abahinzi (Farmer Promoter)" },
] as const;

export type FacilitatorTitle = (typeof FACILITATOR_TITLE_OPTIONS)[number]["value"];

export const FACILITATOR_TITLES: readonly string[] = FACILITATOR_TITLE_OPTIONS.map(
  (option) => option.value,
);
