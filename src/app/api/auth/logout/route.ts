import { COOKIE_NAME } from "@/lib/auth";
import { ok } from "@/lib/server/api-response";
const IS_PROD = process.env.NODE_ENV === "production";

export async function POST() {
  const response = ok({ loggedOut: true });
  response.cookies.set({
    name: COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
  });
  return response;
}

