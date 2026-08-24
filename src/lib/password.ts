import { randomInt } from "crypto";

// Excludes visually ambiguous characters (0/O, 1/l/I) so a temp password
// relayed by phone or read off a screen is easy to type back correctly.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** Generates a random temporary password for a newly-created customer account. */
export function generateTempPassword(length = 10): string {
  let password = "";
  for (let i = 0; i < length; i++) {
    password += ALPHABET[randomInt(ALPHABET.length)];
  }
  return password;
}
