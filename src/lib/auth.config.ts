import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible auth config.
 * This file must NOT import any Node.js modules (mysql2, bcryptjs, etc.)
 * because it's used by the middleware which runs in the Edge runtime.
 *
 * The Credentials provider with DB logic is added in auth.ts.
 */
export const authConfig: NextAuthConfig = {
  providers: [], // Populated in auth.ts with Node.js-compatible providers
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id ?? undefined;
        token.role = user.role ?? undefined;
        token.username = user.name ?? undefined;
        token.mustChangePassword = user.mustChangePassword ?? false;
      }
      // Handle explicit session update from client's update() call
      if (trigger === "update") {
        if (typeof session?.mustChangePassword === "boolean") {
          token.mustChangePassword = session.mustChangePassword;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "administrator" | "editor" | "viewer";
        session.user.username = token.username as string;
        session.user.mustChangePassword = token.mustChangePassword ?? false;
      }
      return session;
    },
    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      // Public routes that don't require authentication
      const publicRoutes = ["/login", "/verify-2fa", "/api/auth", "/forgot-password"];
      const isPublicRoute = publicRoutes.some((route) =>
        pathname.startsWith(route),
      );

      if (isPublicRoute) {
        // Redirect logged-in users away from login/verify/forgot pages
        if (isLoggedIn && (pathname === "/login" || pathname === "/verify-2fa" || pathname === "/forgot-password")) {
          return Response.redirect(new URL("/", request.nextUrl));
        }
        return true;
      }

      // Protect all other routes
      if (!isLoggedIn) {
        return Response.redirect(new URL("/login", request.nextUrl));
      }

      // Force password change redirect
      const mustChange = (auth as { user?: { mustChangePassword?: boolean } })?.user?.mustChangePassword;
      const changePasswordPath = "/settings/change-password";
      if (mustChange && pathname !== changePasswordPath && !pathname.startsWith("/api/auth")) {
        return Response.redirect(new URL(changePasswordPath, request.nextUrl));
      }

      // Admin-only routes
      const adminOnlyRoutes = ["/users", "/register", "/settings/app", "/settings/custom-template", "/reports/merge"];
      const isAdminRoute = adminOnlyRoutes.some((route) =>
        pathname.startsWith(route),
      );

      if (isAdminRoute && auth?.user?.role !== "administrator") {
        return Response.redirect(new URL("/", request.nextUrl));
      }

      // Viewer-blocked routes (Knowledge Base & Tools)
      const viewerBlockedRoutes = ["/kb", "/tools"];
      const isViewerBlocked = viewerBlockedRoutes.some((route) =>
        pathname.startsWith(route),
      );

      if (isViewerBlocked && auth?.user?.role === "viewer") {
        return Response.redirect(new URL("/", request.nextUrl));
      }

      return true;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-authjs.session-token"
        : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    callbackUrl: {
      name: process.env.NODE_ENV === "production"
        ? "__Secure-authjs.callback-url"
        : "authjs.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
    csrfToken: {
      name: process.env.NODE_ENV === "production"
        ? "__Host-authjs.csrf-token"
        : "authjs.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  trustHost: true,
};
