import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, LoaderCircle, Search, Upload, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LocationFields } from "@/components/location/location-fields";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { adminApi, adminErrorMessage } from "@/lib/admin/api";
import type { FarmerCategory, Province } from "@/lib/api/types";
import {
  bffDownloadMemberTemplate,
  bffImportGroupMembers,
  MEMBER_IMPORT_MAX_BYTES,
} from "@/lib/auth/group-members-server-fns";
import {
  facilitatorGroupsKey,
  farmerSearchQueryOptions,
  farmerTypeLabels,
  type MemberImportResult,
  type NewMemberBody,
  type RegisteredMember,
} from "@/lib/facilitator/backend-groups";

const CATEGORIES: { value: FarmerCategory; label: string }[] = [
  { value: "SMALLHOLDER", label: "Smallholder" },
  { value: "MEDIUM_SCALE", label: "Medium scale" },
  { value: "COMMERCIAL", label: "Commercial" },
  { value: "COOPERATIVE_MEMBER", label: "Cooperative member" },
  { value: "LEAD_FARMER", label: "Lead farmer" },
];

type Group = { id: string; name: string };

function useRefreshMembers(groupId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: facilitatorGroupsKey });
}

// ---------------------------------------------------------------- one new farmer

type Values = {
  fullName: string;
  phoneNumber: string;
  email: string;
  farmerType: "SMARTPHONE" | "BASIC_PHONE";
  farmerCategory: FarmerCategory;
  preferredLanguage: "rw" | "en";
  province: Province;
  district: string;
  sector: string;
  cell: string;
  village: string;
};

const empty: Values = {
  fullName: "",
  phoneNumber: "",
  email: "",
  farmerType: "SMARTPHONE",
  farmerCategory: "SMALLHOLDER",
  preferredLanguage: "rw",
  province: "KIGALI_CITY",
  district: "",
  sector: "",
  cell: "",
  village: "",
};

function validateMember(values: Values): Partial<Record<keyof Values, string>> {
  const errors: Partial<Record<keyof Values, string>> = {};
  if (!values.fullName.trim()) errors.fullName = "Enter the full name.";
  if (!/^(?:\+?250|0)7[2389]\d{7}$/.test(values.phoneNumber.replace(/\s+/g, ""))) {
    errors.phoneNumber = "Enter a valid Rwandan mobile number, e.g. 0788123456.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
    errors.email = "Enter a valid personal email address.";
  if (!values.district) errors.district = "Choose a district.";
  if (!values.sector.trim()) errors.sector = "Choose the sector.";
  if (!values.cell.trim()) errors.cell = "Choose the cell.";
  if (!values.village.trim()) errors.village = "Choose the village.";
  return errors;
}

/** Same information as registering a new farmer. The farmer becomes a user and gets a verification email. */
export function NewMemberDialog({
  group,
  open,
  onClose,
}: {
  group: Group;
  open: boolean;
  onClose: () => void;
}) {
  const refresh = useRefreshMembers(group.id);
  const [values, setValues] = useState<Values>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Values, string>>>({});
  const [serverError, setServerError] = useState("");
  useEffect(() => {
    if (open) {
      setValues(empty);
      setErrors({});
      setServerError("");
    }
  }, [open]);
  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setServerError("");
  };

  const register = useMutation({
    mutationFn: (body: NewMemberBody) =>
      adminApi<RegisteredMember>("POST", `facilitator/groups/${group.id}/members/register`, {
        body,
      }),
    onSuccess: async (member) => {
      await refresh();
      if (member.emailSent) {
        toast.success(
          `${member.fullName} added to ${group.name}. A verification email was sent to ${member.email}.`,
        );
      } else {
        toast.warning(
          `${member.fullName} added to ${group.name}, but the verification email could not be sent. They can request a new one from the sign-in page.`,
        );
      }
      onClose();
    },
    onError: (error) =>
      setServerError(adminErrorMessage(error, "The farmer could not be registered.")),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateMember(values);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    register.mutate({
      fullName: values.fullName.trim(),
      phoneNumber: values.phoneNumber.replace(/\s+/g, ""),
      email: values.email.trim().toLowerCase(),
      farmerType: values.farmerType,
      farmerCategory: values.farmerCategory,
      preferredLanguage: values.preferredLanguage,
      location: {
        province: values.province,
        district: values.district,
        sector: values.sector.trim(),
        cell: values.cell.trim(),
        village: values.village.trim(),
      },
    });
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
      aria-invalid={!!errors[key]}
      onChange={(event) => set(key, event.target.value as never)}
      {...props}
    />
  );

  return (
    <Dialog open={open} onOpenChange={(value) => !value && !register.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Register a new farmer in {group.name}</DialogTitle>
          <DialogDescription>
            The farmer becomes a user on the platform and receives an email to verify their personal
            address.
          </DialogDescription>
        </DialogHeader>
        <form className="admin-form" noValidate onSubmit={submit}>
          <fieldset disabled={register.isPending} className="contents">
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
            </div>
            <div className="fac-row">
              <label>
                Phone type
                <select
                  value={values.farmerType}
                  onChange={(event) =>
                    set("farmerType", event.target.value as Values["farmerType"])
                  }
                >
                  <option value="SMARTPHONE">{farmerTypeLabels.SMARTPHONE}</option>
                  <option value="BASIC_PHONE">
                    {farmerTypeLabels.BASIC_PHONE} (USSD and voice)
                  </option>
                </select>
              </label>
              <label>
                Farmer category
                <select
                  value={values.farmerCategory}
                  onChange={(event) => set("farmerCategory", event.target.value as FarmerCategory)}
                >
                  {CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Language
                <select
                  value={values.preferredLanguage}
                  onChange={(event) => set("preferredLanguage", event.target.value as "rw" | "en")}
                >
                  <option value="rw">Kinyarwanda</option>
                  <option value="en">English</option>
                </select>
              </label>
            </div>
            <LocationFields
              idPrefix="new-member"
              value={values}
              errors={errors}
              onChange={(next, changed) => {
                setValues((current) => ({ ...current, ...next }));
                setErrors((current) => ({ ...current, [changed]: undefined }));
                setServerError("");
              }}
            />
          </fieldset>
          {serverError && (
            <p className="fac-field-error" role="alert">
              {serverError}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={register.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={register.isPending}>
              {register.isPending && <LoaderCircle className="animate-spin" aria-hidden />}
              Register and add to group
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- Excel import

function saveBase64(base64: string, filename: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 1. download the template, 2. fill it, 3. upload it. Each valid row becomes a user in the group. */
export function ImportMembersDialog({
  group,
  open,
  onClose,
}: {
  group: Group;
  open: boolean;
  onClose: () => void;
}) {
  const refresh = useRefreshMembers(group.id);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MemberImportResult | null>(null);
  useEffect(() => {
    if (open) {
      setFile(null);
      setError("");
      setResult(null);
    }
  }, [open]);

  const download = useMutation({
    mutationFn: () => bffDownloadMemberTemplate(),
    onSuccess: ({ base64 }) => saveBase64(base64, "menyamuhinzi-group-members.xlsx"),
    onError: (failure) =>
      toast.error(adminErrorMessage(failure, "The template could not be downloaded.")),
  });
  const upload = useMutation({
    mutationFn: (chosen: File) => {
      const data = new FormData();
      data.set("groupId", group.id);
      data.set("file", chosen);
      return bffImportGroupMembers({ data }) as Promise<MemberImportResult>;
    },
    onSuccess: async (imported) => {
      setResult(imported);
      await refresh();
      if (imported.created.length)
        toast.success(`${imported.created.length} farmer(s) added to ${group.name}.`);
    },
    onError: (failure) => setError(adminErrorMessage(failure, "The file could not be imported.")),
  });

  const unsent = result?.created.filter((row) => !row.emailSent).length ?? 0;
  return (
    <Dialog open={open} onOpenChange={(value) => !value && !upload.isPending && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import farmers into {group.name}</DialogTitle>
          <DialogDescription>
            Each farmer in the file becomes a user on the platform and receives an email to verify
            their personal address.
          </DialogDescription>
        </DialogHeader>
        {!result ? (
          <div className="space-y-4">
            <ol className="space-y-3 text-sm">
              <li className="rounded-lg border p-3">
                <b>1. Download the template.</b> It has the same information as registering a new
                farmer, with the allowed values and an example.
                <div className="mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={download.isPending}
                    onClick={() => download.mutate()}
                  >
                    {download.isPending ? (
                      <LoaderCircle className="animate-spin" aria-hidden />
                    ) : (
                      <Download aria-hidden />
                    )}
                    Download Excel template
                  </Button>
                </div>
              </li>
              <li className="rounded-lg border p-3">
                <b>2. Fill one farmer per row</b> on the “Farmers” sheet. Keep the header row.
              </li>
              <li className="rounded-lg border p-3">
                <b>3. Upload the filled file</b> (.xlsx, up to 2 MB, at most 500 farmers).
                <Input
                  className="mt-2"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  aria-label="Filled Excel template"
                  onChange={(event) => {
                    setFile(event.target.files?.[0] ?? null);
                    setError("");
                  }}
                />
              </li>
            </ol>
            {error && (
              <p className="fac-field-error" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 text-sm" role="status">
            <p>
              <b>{result.created.length}</b> of {result.total} farmer(s) added.{" "}
              {result.failed.length > 0 && (
                <b className="text-destructive">{result.failed.length} row(s) need fixing.</b>
              )}
              {unsent > 0 && ` ${unsent} verification email(s) could not be sent.`}
            </p>
            {result.created.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-3">
                {result.created.map((row) => (
                  <li key={row.userId} className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-primary" aria-hidden />
                    Row {row.row}: {row.fullName} · {row.email}
                  </li>
                ))}
              </ul>
            )}
            {result.failed.length > 0 && (
              <ul className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-destructive/40 p-3">
                {result.failed.map((row) => (
                  <li key={row.row}>
                    <span className="flex items-center gap-2 font-semibold">
                      <XCircle className="size-4 text-destructive" aria-hidden />
                      Row {row.row}
                      {row.fullName ? `: ${row.fullName}` : ""}
                    </span>
                    <ul className="ml-6 list-disc text-muted-foreground">
                      {row.errors.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
            {result.failed.length > 0 && (
              <p className="text-muted-foreground">
                Fix these rows in your file, keep only them, and upload again.
              </p>
            )}
          </div>
        )}
        <DialogFooter>
          {result ? (
            <>
              <Button variant="outline" onClick={() => setResult(null)}>
                Upload another file
              </Button>
              <Button onClick={onClose}>Done</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={upload.isPending}>
                Cancel
              </Button>
              <Button
                disabled={upload.isPending}
                onClick={() => {
                  if (!file) return setError("Choose the filled Excel template.");
                  if (file.size > MEMBER_IMPORT_MAX_BYTES)
                    return setError("The file is larger than 2 MB.");
                  upload.mutate(file);
                }}
              >
                {upload.isPending ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : (
                  <Upload aria-hidden />
                )}
                Import farmers
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------- existing farmers

/** Farmers already on the platform: search by email and add them to the group. */
export function AddExistingMemberDialog({
  group,
  memberIds,
  open,
  onClose,
}: {
  group: Group;
  memberIds: Set<string>;
  open: boolean;
  onClose: () => void;
}) {
  const refresh = useRefreshMembers(group.id);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [added, setAdded] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebounced("");
      setAdded(new Set());
    }
  }, [open]);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);
  const results = useQuery(farmerSearchQueryOptions(debounced, open));
  const add = useMutation({
    mutationFn: (userId: string) =>
      adminApi("POST", `facilitator/groups/${group.id}/members`, { body: { userIds: [userId] } }),
    onSuccess: async (_r, userId) => {
      setAdded((current) => new Set(current).add(userId));
      await refresh();
      toast.success(`Added to ${group.name}.`);
    },
    onError: (error) => toast.error(adminErrorMessage(error, "The farmer could not be added.")),
  });

  const rows = results.data?.data ?? [];
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a farmer already on MenyaMuhinzi</DialogTitle>
          <DialogDescription>
            Search by email (or phone number) and add the farmer to {group.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-9"
            type="search"
            aria-label="Search farmers by email"
            placeholder="name@example.rw"
            value={query}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {debounced.length < 3 ? (
          <p className="text-sm text-muted-foreground">
            Type at least 3 characters of the farmer's email.
          </p>
        ) : results.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {adminErrorMessage(results.error, "The search failed.")}
          </p>
        ) : results.isLoading ? (
          <p className="text-sm text-muted-foreground">Searching…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No farmer found. Register them as a new farmer or import them from Excel instead.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rows.map((row) => {
              const inGroup = memberIds.has(row.userId) || added.has(row.userId);
              const active = row.status === "ACTIVE";
              return (
                <li
                  key={row.userId}
                  className="flex items-center justify-between gap-3 p-3 text-sm"
                >
                  <span>
                    <b>{row.fullName}</b>
                    <small className="block text-muted-foreground">
                      {row.email ?? "no email"} · {row.phoneNumber} ·{" "}
                      {farmerTypeLabels[row.farmerType]}
                      {row.location ? ` · ${row.location.district}` : ""}
                    </small>
                  </span>
                  {inGroup ? (
                    <span className="text-xs font-semibold text-primary">In this group</span>
                  ) : !active ? (
                    <span className="text-xs text-muted-foreground">Account not active</span>
                  ) : (
                    <Button
                      size="sm"
                      disabled={add.isPending}
                      onClick={() => add.mutate(row.userId)}
                    >
                      Add
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
