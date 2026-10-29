import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "./auth";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function assertOrigin(request: Request) {
  const configured = process.env.APP_URL;
  if (!configured)
    throw new HttpError(
      503,
      "APP_URL must be configured by the administrator.",
    );
  if (request.headers.get("origin") !== new URL(configured).origin)
    throw new HttpError(403, "Request origin is not allowed.");
}
export async function readJson(
  request: Request,
  limit = 32768,
): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new HttpError(415, "Use application/json.");
  if (Number(request.headers.get("content-length") ?? 0) > limit)
    throw new HttpError(413, "Request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      await reader.cancel();
      throw new HttpError(413, "Request is too large.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}
export async function apiUser(request?: Request) {
  if (request && request.method !== "GET") assertOrigin(request);
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in to continue.");
  return user;
}
export function apiError(error: unknown) {
  if (error instanceof HttpError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof z.ZodError)
    return NextResponse.json(
      {
        error: error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  // Log a code, never database query parameters or credentials.
  console.error(
    "Request failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return NextResponse.json(
    {
      error:
        "The request could not be completed. Please retry or check the server logs.",
    },
    { status: 500 },
  );
}
