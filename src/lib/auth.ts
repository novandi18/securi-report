import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { loginSchema } from "@/lib/validations/auth";
import { eq, or, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { verifyTOTPToken, verifyBackupCode } from "@/lib/2fa";

/**
 * Custom error thrown when 2FA verification is required before login completes.
 * The login action catches this to redirect to the verify-2fa page.
 */
export class TwoFactorRequiredError extends Error {
  public userId: string;
  public identifier: string;

  constructor(userId: string, identifier: string) {
    super("2FA_REQUIRED");
    this.name = "TwoFactorRequiredError";
    this.userId = userId;
    this.identifier = identifier;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        identifier: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
        totpToken: { label: "2FA Code", type: "text" },
        backupCode: { label: "Backup Code", type: "text" },
      },
      async authorize(credentials) {
        const identifier = credentials?.identifier as string | undefined;
        const password = credentials?.password as string | undefined;
        const totpToken = credentials?.totpToken as string | undefined;
        const backupCode = credentials?.backupCode as string | undefined;

        if (!identifier || !password) {
          return null;
        }

        const [user] = await db
          .select()
          .from(users)
          .where(
            or(eq(users.username, identifier), eq(users.email, identifier)),
          )
          .limit(1);

        if (!user) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
          return null;
        }

        // Check if user has 2FA enabled
        if (user.twoFactorEnabled && user.twoFactorSecret) {
          // If no TOTP token AND no backup code provided, signal that 2FA is required
          if (!totpToken && !backupCode) {
            throw new TwoFactorRequiredError(user.id, identifier);
          }

          // Try backup code first if provided
          if (backupCode) {
            const storedHashes: string[] = user.backupCodes ? JSON.parse(user.backupCodes) : [];
            const matchIndex = verifyBackupCode(backupCode, storedHashes);
            if (matchIndex === -1) {
              throw new Error("INVALID_BACKUP_CODE");
            }
            // Remove the used backup code
            storedHashes.splice(matchIndex, 1);
            await db
              .update(users)
              .set({ backupCodes: JSON.stringify(storedHashes) })
              .where(eq(users.id, user.id));
          } else if (totpToken) {
            // Validate the provided TOTP token
            const isValidToken = verifyTOTPToken(totpToken, user.twoFactorSecret);
            if (!isValidToken) {
              throw new Error("INVALID_TOTP");
            }
          }
        }

        // Update last_login timestamp
        await db
          .update(users)
          .set({ lastLogin: sql`NOW()` })
          .where(eq(users.id, user.id));

        return {
          id: user.id,
          name: user.username,
          email: user.email,
          role: user.role,
          mustChangePassword: user.mustChangePassword ?? false,
        };
      },
    }),
  ],
});
