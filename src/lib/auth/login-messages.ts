import type { ParsedBffError } from "./parse-bff-error";

export function loginErrorToast(error: ParsedBffError): string {
  if (error.code === "unauthorized") {
    return "Email cyangwa ijambo ry'ibanga si byo.";
  }
  if (error.code === "locked" || error.status === 423) {
    return "Konti ifunze by'agateganyo kubera ibigeragezo byinshi. Gerageza nyuma.";
  }
  if (error.code === "rate_limit" || error.status === 429) {
    return "Ibigeragezo byinshi. Gerageza nyuma.";
  }
  if (error.code === "unavailable" || error.code === "network" || error.code === "timeout") {
    return "Serivisi ntiboneka by'agateganyo. Gerageza nyuma.";
  }
  if (error.code === "forbidden") {
    const msg = error.message.toLowerCase();
    if (msg.includes("awaiting administrator") || msg.includes("pending")) {
      return "Konti yawe iracyategereje kwemezwa n'umuyobozi.";
    }
    if (msg.includes("rejected")) {
      return "Konti yawe yanze kwemezwa.";
    }
    if (msg.includes("suspended")) {
      return "Konti yawe ihagaritswe.";
    }
    if (msg.includes("deactivated") || msg.includes("inactive")) {
      return "Konti yawe ntikora.";
    }
    return "Konti ntishobora gukoreshwa.";
  }
  return error.message || "Igikorwa nticyashoboye.";
}