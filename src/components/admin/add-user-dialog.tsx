import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FACILITATOR_TITLE_OPTIONS } from "@/components/auth/facilitator-titles";
import { districtsByProvince } from "@/components/auth/registration-schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { adminUsersKey, backendRoleLabels } from "@/lib/admin/backend-people";
import { addUserSchema, ADD_USER_ROLES, type AddUserRole } from "@/lib/api/add-user-types";
import type { Permission, Province } from "@/lib/api/types";
import { bffCreateUser } from "@/lib/auth/admin-people-server-fns";
import { parseBffError } from "@/lib/auth/parse-bff-error";

const PROVINCES: { value: Province; label: string }[] = [
  { value: "KIGALI_CITY", label: "Kigali City" },
  { value: "NORTHERN", label: "Northern Province" },
  { value: "SOUTHERN", label: "Southern Province" },
  { value: "EASTERN", label: "Eastern Province" },
  { value: "WESTERN", label: "Western Province" },
];

const CATEGORIES = [
  { value: "SMALLHOLDER", label: "Smallholder" },
  { value: "MEDIUM_SCALE", label: "Medium scale" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "COOPERATIVE_MEMBER", label: "Cooperative member" },
  { value: "LEAD_FARMER", label: "Lead farmer" },
] as const;

/** Permission each role needs on the backend (POST /farmers, /facilitators, /users). */
const ROLE_PERMISSION: Record<AddUserRole, Permission> = {
  SMARTPHONE_FARMER: "farmers:create",
  FACILITATOR: "facilitators:create",
  ADMIN: "users:assign-roles",
};

type Values = {
  role: AddUserRole;
  fullName: string;
  phoneNumber: string;
  email: string;
  preferredLanguage: "rw" | "en";
  password: string;
  farmerCategory: string;
  professionalTitle: string;
  organization: string;
  province: Province;
  district: string;
  sector: string;
  cell: string;
  village: string;
};

const empty = (role: AddUserRole): Values => ({
  role,
  fullName: "",
  phoneNumber: "",
  email: "",
  preferredLanguage: "rw",
  password: "",
  farmerCategory: "SMALLHOLDER",
  professionalTitle: "",
  organization: "",
  province: "KIGALI_CITY",
  district: "",
  sector: "",
  cell: "",
  village: "",
});

function toInput(values: Values) {
  const account = {
    role: values.role,
    fullName: values.fullName,
    phoneNumber: values.phoneNumber,
    email: values.email,
    preferredLanguage: values.preferredLanguage,
    password: values.password,
  };
  const location = {
    province: values.province,
    district: values.district,
    sector: values.sector,
    cell: values.cell,
    village: values.village,
  };
  if (values.role === "SMARTPHONE_FARMER") {
    return { ...account, farmerCategory: values.farmerCategory, location };
  }
  if (values.role === "FACILITATOR") {
    return {
      ...account,
      professionalTitle: values.professionalTitle,
      organization: values.organization,
      location,
    };
  }
  return account;
}

/**
 * Users → Add user. Creates a smartphone farmer, facilitator or administrator in the backend.
 * Every new account receives an email with a link and a 6-digit code to verify the address.
 */
export function AddUserDialog() {
  const { permissions } = useAuth();
  const queryClient = useQueryClient();
  const allowed = ADD_USER_ROLES.filter((role) => permissions.includes(ROLE_PERMISSION[role]));
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Values>(() => empty(allowed[0] ?? "SMARTPHONE_FARMER"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState("");
  const [busy, setBusy] = useState(false);
  if (allowed.length === 0) return null;

  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    setServerError("");
  };

  function close(next: boolean) {
    if (busy) return;
    setOpen(next);
    if (!next) {
      setValues(empty(allowed[0] ?? "SMARTPHONE_FARMER"));
      setErrors({});
      setServerError("");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = addUserSchema.safeParse(toInput(values));
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
      const created = await bffCreateUser({ data: parsed.data });
      await queryClient.invalidateQueries({ queryKey: adminUsersKey });
      void queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      setBusy(false);
      close(false);
      if (created.emailSent) {
        toast.success(
          `${created.fullName} added as ${backendRoleLabels[created.role].toLowerCase()}. A verification email with a code was sent to ${created.email ?? "their address"}.`,
        );
      } else {
        toast.warning(
          `${created.fullName} was added, but the verification email could not be sent. They can request a new one from the sign-in page.`,
        );
      }
    } catch (failure) {
      const parsedError = parseBffError(failure);
      setServerError(
        parsedError.status === 403
          ? "You do not have permission to add this type of user."
          : parsedError.status === 409
            ? parsedError.message || "This phone number or email is already registered."
            : parsedError.message || "The user could not be added. Try again.",
      );
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
  const farmer = values.role === "SMARTPHONE_FARMER";
  const facilitator = values.role === "FACILITATOR";
  const optional = facilitator ? " (optional)" : "";

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <UserPlus aria-hidden />
        Add user
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add a user</DialogTitle>
            <DialogDescription>
              The account is active right away. The user receives an email with a link and a 6-digit
              code, and can sign in once the email is verified. Use “Register basic-phone farmer”
              for farmers without a smartphone.
            </DialogDescription>
          </DialogHeader>
          <form className="admin-form" noValidate onSubmit={submit}>
            <label>
              User type
              <select
                value={values.role}
                onChange={(event) => set("role", event.target.value as AddUserRole)}
              >
                {allowed.map((role) => (
                  <option key={role} value={role}>
                    {backendRoleLabels[role]}
                  </option>
                ))}
              </select>
            </label>
            {field(
              "fullName",
              "Full name",
              text("fullName", { autoComplete: "off", placeholder: "e.g. Uwase Aline" }),
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
            {farmer && (
              <label>
                Farmer category
                <select
                  value={values.farmerCategory}
                  onChange={(event) => set("farmerCategory", event.target.value)}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {facilitator && (
              <div className="fac-row">
                {field(
                  "professionalTitle",
                  "Professional title",
                  <select
                    value={values.professionalTitle}
                    aria-invalid={Boolean(errors["professionalTitle"])}
                    onChange={(event) => set("professionalTitle", event.target.value)}
                  >
                    <option value="">Choose a title</option>
                    {FACILITATOR_TITLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>,
                )}
                {field(
                  "organization",
                  "Organisation",
                  text("organization", { placeholder: "e.g. Rwanda Agriculture Board" }),
                )}
              </div>
            )}
            {(farmer || facilitator) && (
              <>
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
                  {field(
                    "sector",
                    `Sector${optional}`,
                    text("sector", { placeholder: "e.g. Kimironko" }),
                  )}
                  {field("cell", `Cell${optional}`, text("cell", { placeholder: "e.g. Bibare" }))}
                  {field(
                    "village",
                    `Village${optional}`,
                    text("village", { placeholder: "e.g. Imena" }),
                  )}
                </div>
              </>
            )}
            {field(
              "password",
              "Initial password (optional)",
              text("password", {
                type: "password",
                autoComplete: "new-password",
                placeholder: "Leave empty: the user sets one with “Forgot password”",
              }),
            )}
            {serverError && (
              <p className="fac-field-error" role="alert">
                {serverError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <LoaderCircle className="animate-spin" aria-hidden />}
                Add user
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
