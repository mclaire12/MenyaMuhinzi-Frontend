import { createServerFn } from "@tanstack/react-start";
import { serializeBffAuthFailure } from "@/lib/auth/parse-bff-error";

/** Same limit as the backend's KNOWLEDGE_MAX_FILE_BYTES default. */
export const KNOWLEDGE_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const UPLOAD_PATH = /^knowledge\/sources(?:\/[0-9a-f-]{36}\/versions)?$/;

/** Fields the backend accepts next to the file (metadata only). */
const ALLOWED_FIELDS = new Set([
  "title",
  "description",
  "sourceType",
  "language",
  "sourceOrganization",
  "author",
  "publicationDate",
  "cropIds",
  "topicIds",
  "changeNote",
  "originalFilename",
  "storageRef",
]);

function validate(data: unknown): FormData {
  if (!(data instanceof FormData)) throw new Error("Expected form data");
  const path = data.get("__path");
  if (typeof path !== "string" || !UPLOAD_PATH.test(path))
    throw new Error("Upload target not allowed");
  const file = data.get("file");
  if (file instanceof File && file.size > KNOWLEDGE_MAX_UPLOAD_BYTES) {
    throw new Error("The file is larger than 20 MB");
  }
  for (const key of data.keys()) {
    if (key !== "__path" && key !== "file" && !ALLOWED_FIELDS.has(key)) {
      throw new Error(`Field not allowed: ${key}`);
    }
  }
  return data;
}

/**
 * Creates a knowledge source (POST /knowledge/sources) or adds a version
 * (POST /knowledge/sources/:id/versions) with an uploaded file, as the signed-in admin.
 */
export const bffUploadKnowledge = createServerFn({ method: "POST" })
  .validator(validate)
  .handler(async ({ data }) => {
    const { assertBffStateChangeOrigin } = await import("@/lib/server/auth-middleware");
    await assertBffStateChangeOrigin();
    const { obtainAccessTokenFromSession } = await import("@/lib/server/auth-service");
    const { createBackendClient } = await import("@/lib/server/backend-client");
    const { stripSensitive } = await import("@/lib/server/admin-api-service");
    const path = String(data.get("__path"));
    const form = new FormData();
    for (const [key, value] of data.entries()) {
      if (key !== "__path") form.append(key, value);
    }
    try {
      const accessToken = await obtainAccessTokenFromSession();
      return stripSensitive(
        await createBackendClient().adminUpload(accessToken, path, form),
      ) as never;
    } catch (error) {
      const { BffAuthError } = await import("@/lib/server/bff-error");
      if (error instanceof BffAuthError) throw serializeBffAuthFailure(error);
      throw error;
    }
  });
