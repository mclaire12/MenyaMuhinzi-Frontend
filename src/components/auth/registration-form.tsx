import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/api-error";
import { registerAccount } from "@/lib/api/registration-service";
import type { RegistrationRequest, RegistrationResponse } from "@/lib/api/types";
import {
  districtsByProvince,
  type RegistrationFormValues,
  registrationSchema,
} from "./registration-schema";

interface RegistrationFormProps {
  onReturnToLogin: () => void;
}

const initialValues: RegistrationFormValues = {
  accountType: "SMARTPHONE_FARMER",
  fullName: "",
  phoneNumber: "",
  email: "",
  password: "",
  preferredLanguage: "rw",
  province: "KIGALI_CITY",
  district: "",
  sector: "",
  farmerCategory: "",
  professionalTitle: "",
  organization: "",
  contactEmail: "",
  contactPhone: "",
};

export function RegistrationForm({ onReturnToLogin }: RegistrationFormProps) {
  const [result, setResult] = useState<RegistrationResponse | null>(null);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const form = useForm<RegistrationFormValues, undefined, RegistrationRequest>({
    resolver: zodResolver(registrationSchema),
    defaultValues: initialValues,
  });
  const accountType = useWatch({ control: form.control, name: "accountType" });
  const province = useWatch({ control: form.control, name: "province" });
  const errors = form.formState.errors;

  async function submit(request: RegistrationRequest) {
    setServerErrors([]);
    try {
      const response = await registerAccount(request);
      form.reset(initialValues);
      setResult(response);
    } catch (error) {
      setServerErrors(getRegistrationErrorMessages(error));
    }
  }

  if (result) {
    return (
      <section className="space-y-5 text-center" aria-live="polite">
        <CheckCircle2 className="mx-auto size-12 text-primary" aria-hidden />
        <div>
          <h2 className="text-2xl font-semibold">
            {result.requiresApproval ? "Ubusabe bwawe bwakiriwe" : "Konti yawe yarafunguwe"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{result.message}</p>
        </div>
        {result.requiresApproval && (
          <p className="rounded-lg border bg-card p-4 text-sm">
            Konti yawe izakoreshwa nyuma y’uko ubuyobozi bwemeje ubusabe bwawe.
          </p>
        )}
        {result.accountRequestId && (
          <p className="text-xs text-muted-foreground">
            Nomero y’ubusabe: <span className="font-mono">{result.accountRequestId}</span>
          </p>
        )}
        <Button type="button" className="w-full" onClick={onReturnToLogin}>
          Subira ku kwinjira
        </Button>
      </section>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
      {serverErrors.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {serverErrors.length === 1 ? (
            <p>{serverErrors[0]}</p>
          ) : (
            <ul className="list-inside list-disc space-y-1">
              {serverErrors.map((message, index) => (
                <li key={`${index}-${message}`}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="accountType">Ubwoko bwa konti</Label>
        <select
          id="accountType"
          className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          {...form.register("accountType", {
            onChange: () => setServerErrors([]),
          })}
        >
          <option value="SMARTPHONE_FARMER">Umuhinzi ukoresha telefoni igezweho</option>
          <option value="FACILITATOR">Umufashamyumvire w’ubuhinzi</option>
        </select>
      </div>

      <FormField label="Amazina yawe yose" id="registration-name" error={errors.fullName?.message}>
        <Input
          id="registration-name"
          autoComplete="name"
          maxLength={150}
          {...form.register("fullName")}
        />
      </FormField>
      <FormField
        label="Nimero ya telefoni"
        id="registration-phone"
        error={errors.phoneNumber?.message}
      >
        <Input
          id="registration-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0788 123 456"
          {...form.register("phoneNumber")}
        />
      </FormField>
      <FormField
        label={accountType === "FACILITATOR" ? "Email" : "Email (si ngombwa)"}
        id="registration-email"
        error={errors.email?.message}
      >
        <Input
          id="registration-email"
          type="email"
          autoComplete="email"
          maxLength={254}
          {...form.register("email")}
        />
      </FormField>
      <FormField
        label="Ijambo ry'ibanga"
        id="registration-password"
        error={errors.password?.message}
        hint="Nibura inyuguti 8, irimo inyuguti n’umubare."
      >
        <Input
          id="registration-password"
          type="password"
          autoComplete="new-password"
          maxLength={128}
          {...form.register("password")}
        />
      </FormField>

      <div className="space-y-2">
        <Label htmlFor="registration-language">Ururimi ukunda</Label>
        <select
          id="registration-language"
          className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          {...form.register("preferredLanguage")}
        >
          <option value="rw">Ikinyarwanda</option>
          <option value="en">English</option>
        </select>
        {errors.preferredLanguage?.message && (
          <FieldError>{errors.preferredLanguage.message}</FieldError>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="registration-province">Intara</Label>
          <select
            id="registration-province"
            className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            {...form.register("province", {
              onChange: () => {
                setServerErrors([]);
                form.setValue("district", "");
              },
            })}
          >
            <option value="KIGALI_CITY">Umujyi wa Kigali</option>
            <option value="NORTHERN">Amajyaruguru</option>
            <option value="SOUTHERN">Amajyepfo</option>
            <option value="EASTERN">Iburasirazuba</option>
            <option value="WESTERN">Iburengerazuba</option>
          </select>
          {errors.province?.message && <FieldError>{errors.province.message}</FieldError>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="registration-district">Akarere</Label>
          <select
            id="registration-district"
            className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            {...form.register("district")}
          >
            <option value="">Hitamo akarere</option>
            {districtsByProvince[province].map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
          {errors.district?.message && <FieldError>{errors.district.message}</FieldError>}
        </div>
      </div>

      {accountType === "SMARTPHONE_FARMER" ? (
        <>
          <FormField label="Umurenge" id="registration-sector" error={errors.sector?.message}>
            <Input id="registration-sector" maxLength={80} {...form.register("sector")} />
          </FormField>
          <div className="space-y-2">
            <Label htmlFor="registration-category">Icyiciro cy’ubuhinzi</Label>
            <select
              id="registration-category"
              className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              {...form.register("farmerCategory")}
            >
              <option value="">Si ngombwa</option>
              <option value="SMALLHOLDER">Umuhinzi muto</option>
              <option value="MEDIUM_SCALE">Umuhinzi wo ku rwego ruciriritse</option>
              <option value="COMMERCIAL">Ubuhinzi bw’ubucuruzi</option>
              <option value="COOPERATIVE_MEMBER">Umunyamuryango wa koperative</option>
              <option value="LEAD_FARMER">Umuhinzi w’icyitegererezo</option>
            </select>
          </div>
        </>
      ) : (
        <>
          <FormField
            label="Umwanya w'akazi"
            id="registration-title"
            error={errors.professionalTitle?.message}
          >
            <Input
              id="registration-title"
              maxLength={150}
              {...form.register("professionalTitle")}
            />
          </FormField>
          <FormField
            label="Umuryango cyangwa ikigo ukorera"
            id="registration-organization"
            error={errors.organization?.message}
          >
            <Input
              id="registration-organization"
              maxLength={200}
              {...form.register("organization")}
            />
          </FormField>
          <FormField
            label="Email y'akazi (si ngombwa)"
            id="registration-contact-email"
            error={errors.contactEmail?.message}
          >
            <Input
              id="registration-contact-email"
              type="email"
              {...form.register("contactEmail")}
            />
          </FormField>
          <FormField
            label="Telefoni y'akazi (si ngombwa)"
            id="registration-contact-phone"
            error={errors.contactPhone?.message}
          >
            <Input
              id="registration-contact-phone"
              type="tel"
              inputMode="tel"
              placeholder="0788 123 456"
              {...form.register("contactPhone")}
            />
          </FormField>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {accountType === "FACILITATOR"
          ? "Ubusabe bw’abafashamyumvire busuzumwa n’ubuyobozi mbere yo kwinjira."
          : "Ubusabe bwawe bushobora gusaba kwemezwa n’ubuyobozi mbere yo kwinjira."}
      </p>
      <Button type="submit" size="xl" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <LoaderCircle className="animate-spin" aria-hidden />}
        {form.formState.isSubmitting ? "Turimo kohereza..." : "Ohereza ubusabe"}
      </Button>
      <div className="relative my-4 text-center text-xs font-bold text-muted-foreground">
        <span className="bg-background px-2">cyangwa</span>
        <div className="absolute inset-x-0 top-1/2 -z-10 h-px bg-border" aria-hidden />
      </div>
      <GoogleSignInButton
        mode="register"
        disabled={form.formState.isSubmitting}
        registerContext={{
          accountType,
          phoneNumber: form.watch("phoneNumber"),
          fullName: form.watch("fullName"),
          preferredLanguage: form.watch("preferredLanguage"),
        }}
      />
    </form>
  );
}

function FormField({
  label,
  id,
  error,
  hint,
  children,
}: {
  label: string;
  id: string;
  error: string | undefined;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <FieldError>{error}</FieldError>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-destructive">{children}</p>;
}

export function getRegistrationErrorMessages(error: unknown): string[] {
  if (!(error instanceof ApiError)) {
    return ["Habaye ikibazo kitateganyijwe. Ongera ugerageze."];
  }

  if (error.kind === "network" || error.kind === "configuration") {
    return ["Seriveri ntishobora kugerwaho ubu. Reba internet wongere ugerageze."];
  }
  if (error.kind === "timeout") {
    return ["Ibyo wohereje byatinze. Ongera ugerageze."];
  }
  if (error.status === 409) return [conflictMessage(errorMessageText(error))];
  if (error.status === 400) return validationMessages(error);
  if (error.status !== undefined && error.status >= 500) {
    return ["Habaye ikibazo kuri seriveri. Ongera ugerageze nyuma."];
  }
  return ["Habaye ikibazo kitateganyijwe. Ongera ugerageze."];
}

function errorMessageText(error: ApiError): string {
  const message = error.response?.message;
  if (Array.isArray(message)) return message.join(" ");
  return message ?? "";
}

function conflictMessage(text: string): string {
  const normalized = text.toLowerCase();
  if (normalized.includes("pending")) {
    return "Hari ubusabe bwa iyi nimero ya telefoni bugisuzumwa.";
  }
  if (normalized.includes("email address")) return "Iyi email isanzwe yanditse.";
  if (normalized.includes("phone number already")) return "Iyi nimero ya telefoni isanzwe yanditse.";
  return "Iyi email cyangwa nimero ya telefoni isanzwe yanditse cyangwa ifite ubusabe bugisuzumwa.";
}

function validationMessages(error: ApiError): string[] {
  const message = error.response?.message;
  const raw = Array.isArray(message) ? message : message ? [message] : [];
  const translated = [
    ...new Set(raw.map(translateFieldError).filter((item): item is string => item !== undefined)),
  ];
  return translated.length > 0
    ? translated
    : ["Hari amakuru atari yo. Reba ibyo wuzuzanya wongere ugerageze."];
}

function translateFieldError(message: string): string | undefined {
  const text = message.toLowerCase();
  if (text.includes("phone")) {
    return "Andika nimero ya telefoni yo mu Rwanda yemewe, urugero: 0788123456.";
  }
  if (text.includes("email")) return "Andika email yemewe.";
  if (text.includes("password") && text.includes("letter")) {
    return "Ijambo ry'ibanga rigomba kugira inyuguti nibura imwe.";
  }
  if (text.includes("password") && text.includes("digit")) {
    return "Ijambo ry'ibanga rigomba kugira umubare nibura umwe.";
  }
  if (text.includes("password")) {
    return "Ijambo ry'ibanga rigomba kugira nibura inyuguti 8 kandi ntirirenze 128.";
  }
  if (text.includes("fullname") || text.includes("full name")) return "Andika amazina yawe.";
  if (text.includes("district")) return "Hitamo akarere kari muri iyi ntara.";
  if (text.includes("sector")) return "Hitamo umurenge.";
  if (text.includes("professional")) return "Andika umwanya wawe w'akazi.";
  if (text.includes("organization")) return "Andika izina ry'umuryango cyangwa ikigo ukorera.";
  if (text.includes("province")) return "Hitamo intara.";
  return undefined;
}
