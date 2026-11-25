import type { ReportRangeQuery } from "../api/admin-people-types";
import type { FacilitatorDashboardReport } from "../api/facilitator-dashboard-types";
import { obtainAccessTokenFromSession } from "./auth-service";
import { createBackendClient } from "./backend-client";

let clientFactory = () => createBackendClient();

/** @internal */
export function setFacilitatorDashboardBackendClientFactory(factory: typeof clientFactory): void {
  clientFactory = factory;
}

/** @internal */
export function resetFacilitatorDashboardBackendClientFactory(): void {
  clientFactory = () => createBackendClient();
}

/** The backend scopes every figure to the signed-in facilitator's own groups. */
export async function getFacilitatorDashboardFromSession(
  query: ReportRangeQuery,
): Promise<FacilitatorDashboardReport> {
  return clientFactory().getFacilitatorDashboardReport(await obtainAccessTokenFromSession(), query);
}
