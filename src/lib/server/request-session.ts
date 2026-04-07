import { COOKIE_NAME, decodeSession } from "@/lib/auth";

/** `userId` gravado no cookie após login (UUID do `Usuario`). */
export function getSessionUserId(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const session = decodeSession(match?.[1]?.trim());
  const id = session?.userId?.trim();
  return id || null;
}
