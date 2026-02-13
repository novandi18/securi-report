import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "administrator" | "editor" | "viewer";
      username: string;
      mustChangePassword?: boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role?: "administrator" | "editor" | "viewer" | null;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: "administrator" | "editor" | "viewer" | null;
    username?: string;
    mustChangePassword?: boolean;
  }
}
