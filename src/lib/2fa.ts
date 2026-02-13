import { generateSecret, generateURI, verifySync } from "otplib";
import QRCode from "qrcode";
import { createHash, randomInt } from "crypto";

const APP_NAME = "DEIT-Reporting";
const BACKUP_CODE_COUNT = 8;

/**
 * Generate a new TOTP secret for a user.
 */
export function generateTOTPSecret(): string {
  return generateSecret();
}

/**
 * Generate the otpauth:// URI for authenticator apps.
 */
export function generateTOTPUri(secret: string, username: string): string {
  return generateURI({
    secret,
    issuer: APP_NAME,
    label: username,
    algorithm: "sha1",
    digits: 6,
    period: 30,
  });
}

/**
 * Generate a QR code Data URL from a TOTP URI.
 */
export async function generateQRCodeDataURL(otpauthUri: string): Promise<string> {
  return QRCode.toDataURL(otpauthUri, {
    width: 256,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

/**
 * Verify a 6-digit TOTP token against a secret.
 * Allows a 1-step window (±30 seconds) for clock drift.
 */
export function verifyTOTPToken(token: string, secret: string): boolean {
  const result = verifySync({ token, secret });
  return result.valid;
}

// ─── Backup Codes ────────────────────────────────────────

/**
 * Hash a backup code with SHA-256.
 */
function hashBackupCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * Generate a set of one-time backup codes.
 * Returns { plain: string[], hashed: string[] }.
 * The plain codes are shown to the user once; hashed codes are stored in DB.
 */
export function generateBackupCodes(): { plain: string[]; hashed: string[] } {
  const plain: string[] = [];
  const hashed: string[] = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    // Generate 8-digit random number (10000000–99999999)
    const code = randomInt(10_000_000, 100_000_000).toString();
    plain.push(code);
    hashed.push(hashBackupCode(code));
  }

  return { plain, hashed };
}

/**
 * Verify a backup code against hashed codes stored in DB.
 * Returns the index of the matched code, or -1 if no match.
 */
export function verifyBackupCode(code: string, hashedCodes: string[]): number {
  const inputHash = hashBackupCode(code);
  return hashedCodes.findIndex((h) => h === inputHash);
}
