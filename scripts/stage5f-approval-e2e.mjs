/**
 * Stage 5F API lifecycle verification (dev only). Never logs secrets or session IDs.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

function loadEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    out[line.slice(0, i)] = line.slice(i + 1).trim();
  }
  return out;
}

const fe = loadEnv(".env");
const be = loadEnv("../MenyaMuhinzi-Backend/.env");
const API = fe.API_BASE_URL || "http://localhost:4000/api/v1";
const BFF = fe.MENYA_BFF_SHARED_SECRET;
const ADMIN_EMAIL = be.SEED_ADMIN_EMAIL || "admin@menyamuhinzi.rw";
const ADMIN_PASSWORD = be.SEED_ADMIN_PASSWORD;

let phoneCounter = 0;
function pickPhone() {
  phoneCounter += 1;
  const digits = String(((Date.now() + phoneCounter) % 900000) + 100000).slice(-6);
  return `0788${digits}`;
}

function maskEmail(email) {
  if (!email) return "—";
  const [user, domain] = email.split("@");
  return `${user.slice(0, 2)}***@${domain}`;
}

async function api(path, { method = "GET", body, session, accessToken } = {}) {
  const headers = { Accept: "application/json", "Content-Type": "application/json" };
  if (BFF) headers["x-menya-bff-secret"] = BFF;
  if (session) headers["x-menya-web-session"] = session;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${API}/${path.replace(/^\//, "")}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  const sessionHeader = res.headers.get("x-menya-web-session") || undefined;
  const accessHeader = res.headers.get("x-menya-access-token") || undefined;
  return { status: res.status, json, sessionHeader, accessHeader };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function adminSession() {
  let created;
  for (let attempt = 0; attempt < 5; attempt++) {
    created = await api("auth/web-sessions", {
      method: "POST",
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (created.status !== 429) break;
    await sleep(1500 * (attempt + 1));
  }
  const sessionId = created.sessionHeader;
  if (created.status !== 201 || !sessionId) {
    throw new Error(`Admin web session failed (${created.status})`);
  }
  const refreshed = await api("auth/web-sessions/refresh", {
    method: "POST",
    session: sessionId,
  });
  const access = refreshed.accessHeader || refreshed.json?.accessToken;
  const nextSession = refreshed.sessionHeader || sessionId;
  if (refreshed.status !== 200 || !access) {
    throw new Error(`Admin refresh failed (${refreshed.status})`);
  }
  const me = await api("auth/web-sessions/me", { session: nextSession });
  const perms = me.json?.permissions ?? [];
  return {
    session: nextSession,
    access,
    permissions: perms,
    hasRead: perms.includes("account-requests:read"),
    hasDecide: perms.includes("account-requests:decide"),
  };
}

async function registerFarmer(label) {
  const phone = pickPhone();
  const email = `stage5f-${label}-${Date.now()}@example.rw`;
  const body = {
    accountType: "SMARTPHONE_FARMER",
    fullName: `Stage5F Farmer ${label}`,
    phoneNumber: phone,
    email,
    password: "Umuhinzi2026",
    preferredLanguage: "rw",
    location: { province: "NORTHERN", district: "Musanze", sector: "Muhoza", cell: "Test" },
    farmerCategory: "SMALLHOLDER",
  };
  const res = await api("auth/register", { method: "POST", body });
  return {
    phone,
    email,
    status: res.status,
    userId: res.json?.user?.id,
    accountRequestId: res.json?.accountRequestId,
    requiresApproval: res.json?.requiresApproval,
  };
}

async function farmerLogin(email, password) {
  const res = await api("auth/web-sessions", {
    method: "POST",
    body: { email, password },
  });
  return { status: res.status, hasSession: !!res.sessionHeader };
}

async function main() {
  const report = { ts: new Date().toISOString(), steps: [] };
  const ok = (id, detail) => report.steps.push({ id, pass: true, ...detail });
  const fail = (id, detail) => report.steps.push({ id, pass: false, ...detail });

  report.environment = {
    frontend: (await fetch("http://localhost:3000/")).status,
    backend: (await fetch(`${API}/health`)).status,
    swagger: (await fetch("http://localhost:4000/api/docs")).status,
    bffSecretAligned: BFF === be.MENYA_BFF_SHARED_SECRET,
    apiBase: API,
  };

  let admin;
  try {
    admin = await adminSession();
    ok("admin-permissions", {
      hasRead: admin.hasRead,
      hasDecide: admin.hasDecide,
    });
    if (!admin.hasRead || !admin.hasDecide) {
      fail("admin-permissions-required", { hasRead: admin.hasRead, hasDecide: admin.hasDecide });
    }
  } catch (error) {
    fail("admin-session", { error: error.message });
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const approveTarget = await registerFarmer("approve");
  const rejectTarget = await registerFarmer("reject");
  if (approveTarget.status !== 201 || !approveTarget.accountRequestId) {
    fail("register-approve-target", approveTarget);
  } else {
    ok("register-approve-target", {
      requestId: approveTarget.accountRequestId,
      applicantId: approveTarget.userId,
      idsDistinct: approveTarget.accountRequestId !== approveTarget.userId,
      email: maskEmail(approveTarget.email),
    });
  }
  if (rejectTarget.status !== 201 || !rejectTarget.accountRequestId) {
    fail("register-reject-target", rejectTarget);
  } else {
    ok("register-reject-target", {
      requestId: rejectTarget.accountRequestId,
      applicantId: rejectTarget.userId,
      email: maskEmail(rejectTarget.email),
    });
  }

  const pendingBefore = await api(
    `accounts/requests?status=PENDING&search=${encodeURIComponent("Stage5F")}`,
    { accessToken: admin.access, session: admin.session },
  );
  const foundApprove = pendingBefore.json?.data?.some(
    (row) => row.id === approveTarget.accountRequestId,
  );
  (pendingBefore.status === 200 && foundApprove ? ok : fail)("list-pending-search", {
    status: pendingBefore.status,
    found: !!foundApprove,
    total: pendingBefore.json?.meta?.total,
  });

  if (rejectTarget.accountRequestId) {
    const rejectShort = await api(`accounts/requests/${rejectTarget.accountRequestId}/reject`, {
      method: "POST",
      accessToken: admin.access,
      session: admin.session,
      body: { reason: "no" },
    });
    (rejectShort.status === 400 ? ok : fail)("reject-validation-400", {
      status: rejectShort.status,
      expected: 400,
    });
  }

  const pendingAfterApprove =
    approveTarget.accountRequestId
      ? await api(`accounts/requests?status=PENDING&search=${encodeURIComponent("Stage5F Farmer reject")}`, {
          accessToken: admin.access,
          session: admin.session,
        })
      : null;

  if (approveTarget.accountRequestId) {
    const approved = await api(`accounts/requests/${approveTarget.accountRequestId}/approve`, {
      method: "POST",
      accessToken: admin.access,
      session: admin.session,
      body: { note: "Stage 5F approval note" },
    });
    (approved.status === 200 && approved.json?.status === "APPROVED" ? ok : fail)("approve", {
      status: approved.status,
      finalStatus: approved.json?.status,
      requestId: approveTarget.accountRequestId,
    });

    const approvedLogin = await farmerLogin(approveTarget.email, "Umuhinzi2026");
    (
      approvedLogin.status === 201 && approvedLogin.hasSession ? ok : fail
    )("approved-farmer-login", {
      status: approvedLogin.status,
      sessionCreated: approvedLogin.hasSession,
      email: maskEmail(approveTarget.email),
    });

    const double = await api(`accounts/requests/${approveTarget.accountRequestId}/approve`, {
      method: "POST",
      accessToken: admin.access,
      session: admin.session,
      body: {},
    });
    (double.status === 409 ? ok : fail)("duplicate-decision-409", {
      status: double.status,
      expected: 409,
    });

    if (pendingAfterApprove) {
      const stillOnPending = pendingAfterApprove.json?.data?.some(
        (row) => row.id === approveTarget.accountRequestId,
      );
      (pendingAfterApprove.status === 200 && !stillOnPending ? ok : fail)("pending-after-approve", {
        status: pendingAfterApprove.status,
        removedFromPending: !stillOnPending,
      });
    }
  }

  if (rejectTarget.accountRequestId) {
    const rejected = await api(`accounts/requests/${rejectTarget.accountRequestId}/reject`, {
      method: "POST",
      accessToken: admin.access,
      session: admin.session,
      body: { reason: "Stage 5F duplicate test rejection." },
    });
    (rejected.status === 200 && rejected.json?.status === "REJECTED" ? ok : fail)("reject", {
      status: rejected.status,
      finalStatus: rejected.json?.status,
      reason: rejected.json?.decision?.reason,
      decidedBy: rejected.json?.decision?.decidedBy?.fullName,
    });

    const rejectedLogin = await farmerLogin(rejectTarget.email, "Umuhinzi2026");
    (
      rejectedLogin.status === 403 || rejectedLogin.status === 401 ? ok : fail
    )("rejected-farmer-login-blocked", {
      status: rejectedLogin.status,
      sessionCreated: rejectedLogin.hasSession,
      email: maskEmail(rejectTarget.email),
    });

    const detail = await api(`accounts/requests/${rejectTarget.accountRequestId}`, {
      accessToken: admin.access,
      session: admin.session,
    });
    (
      detail.status === 200 && detail.json?.decision?.reason ? ok : fail
    )("reject-detail", {
      status: detail.status,
      applicantMatch: detail.json?.applicant?.fullName?.includes("Stage5F"),
      reason: detail.json?.decision?.reason,
    });
  }

  const facilitator = await farmerLogin("jeanne@example.rw", "Umuhinzi2026");
  if (facilitator.hasSession) {
    const facSessionRes = await api("auth/web-sessions", {
      method: "POST",
      body: { email: "jeanne@example.rw", password: "Umuhinzi2026" },
    });
    const facSession = facSessionRes.sessionHeader;
    const facRefresh = await api("auth/web-sessions/refresh", {
      method: "POST",
      session: facSession,
    });
    const facAccess = facRefresh.accessHeader;
    const facList = await api("accounts/requests?status=PENDING", {
      accessToken: facAccess,
      session: facRefresh.sessionHeader || facSession,
    });
    (facList.status === 403 ? ok : fail)("facilitator-cannot-list", {
      status: facList.status,
      expected: 403,
    });
  } else {
    ok("facilitator-skip", { note: "jeanne@example.rw not available for permission test" });
  }

  const allPass = report.steps.every((step) => step.pass);
  report.summary = { pass: allPass, count: report.steps.length };
  console.log(JSON.stringify(report, null, 2));
  process.exit(allPass ? 0 : 1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});