/**
 * 22-char URL-safe random token used in /book/quote/[token] and
 * /trip/[token]. ~131 bits of entropy — collision/guess risk is
 * effectively zero at our scale.
 *
 * URL-safe alphabet: digits + lowercase + uppercase + `-` + `_`
 * (matches the nanoid default minus problematic visual ambiguities
 * like 0/O, but kept simple — we're not asking humans to type these).
 */

const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

const TOKEN_LENGTH = 22;

export function generateShareToken(): string {
  // Node and modern browsers both expose globalThis.crypto.
  const bytes = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    out += ALPHABET[bytes[i] & 63];
  }
  return out;
}
