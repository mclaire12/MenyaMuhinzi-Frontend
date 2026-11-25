import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { districtsByProvince } from "@/components/auth/registration-schema";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  basicPhoneFarmerInputSchema,
  type BasicPhoneFarmerCreated,
  type BasicPhoneFarmerSubmission,
} from "@/lib/api/basic-phone-farmer-types";
import type { Province } from "@/lib/api/types";
import { bffCreateBasicPhoneFarmer } from "@/lib/auth/basic-phone-farmer-server-fns";
import { parseBffError } from "@/lib/auth/parse-bff-error";

const PROVINCES: { value: Province; label: string }[] = [
  { value: "KIGALI_CITY", label: "Kigali City" },
  { value: "NORTHERN", label: "Northern Province" },
  { value: "SOUTHERN", label: "Southern Province" },
  { value: "EASTERN", label: "Eastern Province" },
  { value: "WESTERN", label: "Western Province" },
];

type Values = {
  fullName: string;
  phoneNumber: string;
  email: string;
  preferredLanguage: "rw" | "en";
  province: Province;
  district: string;
  sector: string;
  cell: string;
  village: string;
  password: string;
  notes: string;
};

const empty: Values = {
  fullName: "",
  phoneNumber: "",
  email: "",
  preferredLanguage: "rw",
  province: "KIGALI_CITY",
  district: "",
  sector: "",
  cell: "",
  village: "",
  password: "",
  notes: "",
};

type Props = {
  /** "direct" for administrators (farmers:create), "request" for facilitators (approval first). */
  mode: BasicPhoneFarmerSubmission;
  onCreated: (created: BasicPhoneFarmerCreated) => void;
  onCancel: () => void;
};

/** Registers a basic-phone farmer in the backend. Personal email and the full address are required. */
export function BasicPhoneFarmerForm({ mode, onCreated, onCancel }: Props) {
  const [values, setValues] = useState<Values>(empty);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setServerError("");
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = basicPhoneFarmerInputSchema.safeParse({
      fullName: values.fullName,
      phoneNumber: values.phoneNumber.replace(/\s+/g, ""),
      email: values.email,
      preferredLanguage: values.preferredLanguage,
      ...(mode === "direct" && values.password ? { password: values.password } : {}),
      ...(mode === "request" && values.notes.trim() ? { notes: values.notes } : {}),
      location: {
        province: values.province,
        district: values.district,
        sector: values.sector,
        cell: values.cell,
        village: values.village,
      },
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path.at(-1));
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setBusy(true);
    try {
      onCreated(await bffCreateBasicPhoneFarmer({ data: { mode, farmer: parsed.data } }));
    } catch (error) {
      const failure = parseBffError(error);
      setServerError(
        failure.status === 403
          ? "You do not have permission to register basic-phone farmers."
          : failure.status === 409
            ? failure.message || "This phone number or email is already registered."
            : failure.message || "The farmer could not be registered. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof Values, label: string, input: React.ReactNode) => (
    <label>
      {label}
      {input}
      {errors[key] && (
        <span className="fac-field-error" role="alert">
          {errors[key]}
        </span>
      )}
    </label>
  );
  const text = (key: keyof Values, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input
      value={values[key]}
      aria-invalid={Boolean(errors[key])}
      onChange={(event) => set(key, event.target.value as never)}
      {...props}
    />
  );

  return (
    <form className="admin-form" noValidate onSubmit={submit}>
      <p className="fac-note">
        {mode === "direct"
          ? "The farmer receives an email to verify their personal address, then signs in with phone number or email on the basic-phone testing portal."
          : "Your request goes to an administrator. After approval the farmer receives an email to verify their personal address."}
      </p>
      {field(
        "fullName",
        "Full name",
        text("fullName", { autoComplete: "off", placeholder: "e.g. Mukeshimana Vestine" }),
      )}
      <div className="fac-row">
        {field(
          "phoneNumber",
          "Phone number",
          text("phoneNumber", { inputMode: "tel", placeholder: "07XXXXXXXX" }),
        )}
        {field(
          "email",
          "Personal email",
          text("email", { type: "email", placeholder: "name@example.rw" }),
        )}
        <label>
          Preferred language
          <select
            value={values.preferredLanguage}
            onChange={(event) =>
              set("preferredLanguage", event.target.value as Values["preferredLanguage"])
            }
          >
            <option value="rw">Kinyarwanda</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>
      <div className="fac-row">
        <label>
          Province
          <select
            value={values.province}
            onChange={(event) => {
              set("province", event.target.value as Province);
              set("district", "");
            }}
          >
            {PROVINCES.map((province) => (
              <option key={province.value} value={province.value}>
                {province.label}
              </option>
            ))}
          </select>
        </label>
        {field(
          "district",
          "District",
          <select
            value={values.district}
            aria-invalid={Boolean(errors["district"])}
            onChange={(event) => set("district", event.target.value)}
          >
            <option value="">Choose a district</option>
            {districtsByProvince[values.province].map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>,
        )}
      </div>
      <div className="fac-row">
        {field("sector", "Sector", text("sector", { placeholder: "e.g. Kimironko" }))}
        {field("cell", "Cell", text("cell", { placeholder: "e.g. Bibare" }))}
        {field("village", "Village", text("village", { placeholder: "e.g. Imena" }))}
      </div>
      {mode === "direct"
        ? field(
            "password",
            "Initial password (optional)",
            text("password", {
              type: "password",
              autoComplete: "new-password",
              placeholder: "At least 8 characters with a letter and a digit",
            }),
          )
        : field(
            "notes",
            "Notes for the administrator (optional)",
            text("notes", { placeholder: "e.g. Registered during a field visit" }),
          )}
      {serverError && (
        <p className="fac-field-error" role="alert">
          {serverError}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy && <LoaderCircle className="animate-spin" aria-hidden />}
          {mode === "direct" ? "Register farmer" : "Submit for approval"}
        </Button>
      </DialogFooter>
    </form>
  );
}
