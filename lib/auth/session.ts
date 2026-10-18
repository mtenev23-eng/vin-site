import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE_NAME = "svh_admin_session";

const SESSION_DURATION_SECONDS = 12 * 60 * 60;

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SESSION_SECRET is missing or too short");
  }

  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret())
    .update(payload)
    .digest("hex");
}

export function createAdminSession(): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const nonce = randomBytes(16).toString("hex");
  const payload = `${expiresAt}.${nonce}`;

  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSession(token?: string): boolean {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [expiry, nonce, signature] = parts;

  if (!/^\d+$/.test(expiry) ||
      !/^[a-f0-9]{32}$/.test(nonce) ||
      !/^[a-f0-9]{64}$/.test(signature)) {
    return false;
  }

  const expiresAt = Number(expiry);

  if (!Number.isSafeInteger(expiresAt) ||
      expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = Buffer.from(sign(`${expiry}.${nonce}`), "hex");
  const actual = Buffer.from(signature, "hex");

  return timingSafeEqual(expected, actual);
}

export const ADMIN_COOKIE_MAX_AGE = SESSION_DURATION_SECONDS;
