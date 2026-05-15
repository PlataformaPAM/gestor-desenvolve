import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  /** Schema do banco atrás do Prisma (ex.: migration não aplicada). */
  | "MIGRATION_REQUIRED";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(code: ApiErrorCode, message: string, status = 400) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message },
    },
    { status }
  );
}

export async function parseJsonSafe<T>(req: Request): Promise<{ ok: true; value: T } | { ok: false }> {
  try {
    const parsed = (await req.json()) as T;
    return { ok: true, value: parsed };
  } catch {
    return { ok: false };
  }
}

