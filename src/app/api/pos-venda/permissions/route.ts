import { ok } from "@/lib/server/api-response";
import { isSessionAdmin } from "@/lib/server/authorize";
import { posvendaAccessGate } from "@/lib/server/posvenda-access";

export async function GET(req: Request) {
  const gate = await posvendaAccessGate(req, "ver");
  if (!gate.ok) return gate.response;

  const isAdmin = isSessionAdmin(gate.session);
  return ok({ isAdmin });
}
