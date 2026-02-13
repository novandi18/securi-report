import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Use the edge-compatible config (no Node.js modules like mysql2/bcrypt)
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder (images, etc.)
     * - api/auth (NextAuth API routes are handled by Auth.js)
     */
    "/((?!_next/static|_next/image|favicon\\.ico|images|fonts|api/auth).*)",
  ],
};
