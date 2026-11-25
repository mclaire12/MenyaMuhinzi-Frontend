export type UserRole = "ADMIN" | "FACILITATOR" | "SMARTPHONE_FARMER" | "BASIC_PHONE_FARMER";

export type AccountStatus = "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED" | "REJECTED";

export type Language = "rw" | "en";

export type Province = "KIGALI_CITY" | "NORTHERN" | "SOUTHERN" | "EASTERN" | "WESTERN";

export type FarmerType = "SMARTPHONE" | "BASIC_PHONE";

export type FarmerCategory =
  "SMALLHOLDER" | "MEDIUM_SCALE" | "COMMERCIAL" | "COOPERATIVE_MEMBER" | "LEAD_FARMER";

export type Permission =
  | "users:read"
  | "users:create"
  | "users:update"
  | "users:manage-status"
  | "users:assign-roles"
  | "roles:read"
  | "roles:manage"
  | "account-requests:create"
  | "account-requests:read"
  | "account-requests:decide"
  | "farmers:read"
  | "farmers:create"
  | "farmers:update"
  | "facilitators:read"
  | "facilitators:create"
  | "facilitators:update"
  | "targeting-groups:read"
  | "targeting-groups:manage"
  | "farmer-groups:read"
  | "farmer-groups:manage"
  | "crops:read"
  | "crops:manage"
  | "courses:read"
  | "courses:manage"
  | "courses:publish"
  | "group-courses:assign"
  | "enrollments:read"
  | "enrollments:manage"
  | "progress:read"
  | "progress:update"
  | "assessments:read"
  | "assessments:manage"
  | "assessments:attempt"
  | "assessments:review"
  | "knowledge:read"
  | "knowledge:manage"
  | "knowledge:approve"
  | "ai-assistants:read"
  | "ai-assistants:manage"
  | "ai-models:read"
  | "ai-models:manage"
  | "ai-prompts:read"
  | "ai-prompts:manage"
  | "ai-conversations:read"
  | "ai-conversations:manage"
  | "ai-requests:read"
  | "ai-usage:read"
  | "ai-safety:read"
  | "ai-safety:manage"
  | "notifications:read"
  | "notifications:manage"
  | "notification-templates:read"
  | "notification-templates:manage"
  | "notification-settings:read"
  | "notification-settings:manage"
  | "notification-deliveries:read"
  | "reports:read"
  | "reports:export"
  | "facilitator-reports:read"
  | "facilitator-reports:export"
  | "farmer-reports:read"
  | "ussd:sessions:read"
  | "ussd:sessions:manage"
  | "ussd:configuration:read"
  | "ussd:configuration:manage"
  | "ussd:analytics:read"
  | "ivr:sessions:read"
  | "ivr:sessions:manage"
  | "ivr:configuration:read"
  | "ivr:configuration:manage"
  | "ivr:analytics:read";

export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  method: string;
  timestamp: string;
  requestId?: string;
}

export interface UserLocation {
  province: Province;
  district: string;
  sector: string | null;
  cell: string | null;
  village: string | null;
}

export interface FarmerProfile {
  id: string;
  farmerType: FarmerType;
  farmerCategory: FarmerCategory;
  registeredAt: string;
}

export interface FacilitatorProfile {
  id: string;
  professionalTitle: string;
  organization: string;
  contactEmail: string | null;
  contactPhone: string | null;
}

export interface UserResponse {
  id: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  status: AccountStatus;
  statusReason: string | null;
  statusChangedAt: string | null;
  preferredLanguage: Language;
  roles: UserRole[];
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentUserResponse extends UserResponse {
  location: UserLocation | null;
  farmerProfile: FarmerProfile | null;
  facilitatorProfile: FacilitatorProfile | null;
  permissions: Permission[];
}

/** Full NestJS payload; never return `resetToken` to the browser. */
export interface ForgotPasswordResponse {
  message: string;
  resetToken?: string;
  expiresAt?: string;
}

export interface AuthTokensResponse {
  tokenType: "Bearer";
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: UserResponse;
}

export interface RegistrationLocation {
  province: Province;
  district: string;
  sector?: string;
  cell?: string;
  village?: string;
}

interface RegistrationRequestBase {
  fullName: string;
  phoneNumber: string;
  /** Personal email, mandatory for every account; used for verification and notifications. */
  email: string;
  password: string;
  preferredLanguage: Language;
  location: RegistrationLocation;
}

export type RegistrationRequest =
  | (RegistrationRequestBase & {
      accountType: "SMARTPHONE_FARMER";
      location: RegistrationLocation & { sector: string; cell: string; village: string };
      farmerCategory?: FarmerCategory;
    })
  | (RegistrationRequestBase & {
      accountType: "FACILITATOR";
      facilitator: {
        professionalTitle: string;
        organization: string;
        contactEmail?: string;
        contactPhone?: string;
      };
    });

export interface RegistrationResponse {
  user: UserResponse;
  requiresApproval: boolean;
  /** Every account verifies its personal email before signing in. */
  requiresEmailVerification?: boolean;
  /** True only when the backend's SMTP server accepted the verification email. */
  verificationEmailSent?: boolean;
  accountRequestId: string | null;
  message: string;
}

export interface DependencyHealth {
  status: "up" | "down";
  latencyMs: number;
  error?: string;
}

/** GET /health readiness body. `status` is `error` when Postgres or Redis is down (HTTP 503). */
export interface HealthResponse {
  status: "ok" | "error";
  timestamp: string;
  uptimeSeconds: number;
  checks: {
    database: DependencyHealth;
    redis: DependencyHealth;
  };
}
