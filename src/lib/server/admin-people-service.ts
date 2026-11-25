import type {
  AdminDashboardReport,
  AdminRegistrationsReport,
  AdminUserResponse,
  ListAdminUsersQuery,
  PaginatedAdminUsers,
  ReportRangeQuery,
  UpdateAdminUserStatusInput,
} from "../api/admin-people-types";
import type { AddUserInput, AddUserResult, CreatedAccountResponse } from "../api/add-user-types";
import { obtainAccessTokenFromSession } from "./auth-service";
import { createBackendClient } from "./backend-client";

let clientFactory = () => createBackendClient();

/** @internal */
export function setAdminPeopleBackendClientFactory(factory: typeof clientFactory): void {
  clientFactory = factory;
}

/** @internal */
export function resetAdminPeopleBackendClientFactory(): void {
  clientFactory = () => createBackendClient();
}

/** All calls use the signed-in administrator's session; the backend enforces permissions. */
export async function listUsersFromSession(
  query: ListAdminUsersQuery,
): Promise<PaginatedAdminUsers> {
  return clientFactory().listUsers(await obtainAccessTokenFromSession(), query);
}

export async function getUserFromSession(id: string): Promise<AdminUserResponse> {
  return clientFactory().getUser(await obtainAccessTokenFromSession(), id);
}

export async function updateUserStatusFromSession(
  id: string,
  input: UpdateAdminUserStatusInput,
): Promise<AdminUserResponse> {
  return clientFactory().updateUserStatus(await obtainAccessTokenFromSession(), id, input);
}

/** Sends each role to the endpoint that also creates its profile (facilitator / farmer). */
export async function createUserFromSession(input: AddUserInput): Promise<AddUserResult> {
  const accessToken = await obtainAccessTokenFromSession();
  const base = {
    fullName: input.fullName,
    phoneNumber: input.phoneNumber,
    email: input.email,
    preferredLanguage: input.preferredLanguage,
    ...(input.password ? { password: input.password } : {}),
  };
  const client = clientFactory();
  let created: CreatedAccountResponse;
  if (input.role === "ADMIN") {
    created = await client.createAccount(accessToken, "users", { ...base, roles: ["ADMIN"] });
  } else if (input.role === "FACILITATOR") {
    const { province, district, sector, cell, village } = input.location;
    created = await client.createAccount(accessToken, "facilitators", {
      ...base,
      professionalTitle: input.professionalTitle,
      organization: input.organization,
      location: {
        province,
        district,
        ...(sector ? { sector } : {}),
        ...(cell ? { cell } : {}),
        ...(village ? { village } : {}),
      },
    });
  } else {
    created = await client.createAccount(accessToken, "farmers", {
      ...base,
      farmerType: "SMARTPHONE",
      farmerCategory: input.farmerCategory,
      location: input.location,
    });
  }
  return {
    userId: created.userId ?? created.id ?? "",
    fullName: created.fullName,
    email: created.email,
    role: input.role,
    emailSent: created.emailSent === true,
  };
}

export async function getAdminDashboardFromSession(
  query: ReportRangeQuery,
): Promise<{ dashboard: AdminDashboardReport; registrations: AdminRegistrationsReport }> {
  const accessToken = await obtainAccessTokenFromSession();
  const client = clientFactory();
  // Totals are all-time; the registrations report follows the selected range.
  const [dashboard, registrations] = await Promise.all([
    client.getAdminDashboardReport(accessToken, {}),
    client.getAdminRegistrationsReport(accessToken, query),
  ]);
  return { dashboard, registrations };
}
