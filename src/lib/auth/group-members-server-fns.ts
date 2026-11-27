import { createServerFn } from "@tanstack/react-start";
import { serializeBffAuthFailure } from "@/lib/auth/parse-bff-error";

/** Same limit as the backend (2 MB is far more than 500 rows of farmers). */
export const MEMBER_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rethrow(error: unknown): Promise<never> {
  const { BffAuthError } = await import("@/lib/server/bff-error");
  if (error instanceof BffAuthError) throw serializeBffAuthFailure(error);
  throw error;
}

/** The Excel template for registering farmers in a group, as base64 (GET /facilitator/groups/member-template). */
export const bffDownloadMemberTemplate = createServerFn({ method: "GET" }).handler(async () => {
  const { obtainAccessTokenFromSession } = await import("@/lib/server/auth-service");
  const { createBackendClient } = await import("@/lib/server/backend-client");
  try {
    const accessToken = await obtainAccessTokenFromSession();
    const { bytes } = await createBackendClient().adminDownload(
      accessToken,
      "facilitator/groups/member-template",
    );
    return { base64: Buffer.from(bytes).toString("base64") };
  } catch (error) {
    return rethrow(error);
  }
});

function validateImport(data: unknown): FormData {
  if (!(data instanceof FormData)) throw new Error("Expected form data");
  const groupId = data.get("groupId");
  if (typeof groupId !== "string" || !UUID.test(groupId)) throw new Error("Invalid group");
  const file = data.get("file");
  if (!(file instanceof File)) throw new Error("Choose the filled Excel template");
  if (file.size > MEMBER_IMPORT_MAX_BYTES) throw new Error("The file is larger than 2 MB");
  return data;
}

/** Uploads the filled template (POST /facilitator/groups/:id/members/import). */
export const bffImportGroupMembers = createServerFn({ method: "POST" })
  .validator(validateImport)
  .handler(async ({ data }) => {
    const { assertBffStateChangeOrigin } = await import("@/lib/server/auth-middleware");
    await assertBffStateChangeOrigin();
    const { obtainAccessTokenFromSession } = await import("@/lib/server/auth-service");
    const { createBackendClient } = await import("@/lib/server/backend-client");
    const form = new FormData();
    form.append("file", data.get("file") as File);
    try {
      const accessToken = await obtainAccessTokenFromSession();
      return (await createBackendClient().adminUpload(
        accessToken,
        `facilitator/groups/${String(data.get("groupId"))}/members/import`,
        form,
      )) as never;
    } catch (error) {
      return rethrow(error);
    }
  });
