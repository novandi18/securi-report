"use client";

import { useSession } from "next-auth/react";

export function useRole() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  return {
    role,
    isAdmin: role === "administrator",
    isEditor: role === "editor",
    isViewer: role === "viewer",
    /** Can perform CRUD on customers (admin + editor) */
    canEditCustomers: role === "administrator" || role === "editor",
    /** Can perform CRUD on reports (admin + editor) */
    canEditReports: role === "administrator" || role === "editor",
    /** Can manage CWE/OWASP frameworks (admin only) */
    canEditFrameworks: role === "administrator",
    /** Can perform CRUD on finding templates (admin + editor) */
    canEditTemplates: role === "administrator" || role === "editor",
    /** Can access Knowledge Base (admin + editor) */
    canAccessKB: role === "administrator" || role === "editor",
    /** Can access Tools (admin + editor) */
    canAccessTools: role === "administrator" || role === "editor",
    isAuthenticated: !!session?.user,
    user: session?.user,
  };
}
