import { assertDevelopment } from "@/lib/env";

/**
 * Generate sample content for the single finding report form.
 * This is a pure client-side function — no DB writes, no server action.
 * Can also be called on the server (assertDevelopment will guard it).
 */
export function generateSampleReportContent() {
  assertDevelopment();

  return {
    reportIdCustom: "",
    title: "SQL Injection in Login Form",
    clientCode: "TF",
    serviceAffected: "HTTP",
    findingSequence: "3",
    severity: "High",
    location: "/api/v1/auth/login",
    description: `## SQL Injection in Login Endpoint

The application's login endpoint (\`/api/v1/auth/login\`) is vulnerable to SQL Injection through the \`username\` parameter. User input is directly concatenated into the SQL query without parameterization.

**Vulnerable Code Pattern:**
\`\`\`sql
SELECT * FROM users WHERE username = '$input' AND password = '$hash'
\`\`\`

An attacker can bypass authentication by injecting: \`' OR '1'='1' --\``,

    pocText: `## Steps to Reproduce

1. Navigate to the login page at \`https://app.target.com/login\`
2. Enter the following payload in the username field:
   \`\`\`
   admin' OR '1'='1' --
   \`\`\`
3. Enter any value in the password field
4. Click "Login"
5. Observe that authentication is bypassed and the attacker is logged in as the first user in the database (typically admin)`,

    impact: `**Confidentiality:** Critical — Full database extraction possible via UNION-based or blind SQL injection. With >50,000 user records, this constitutes a major data breach.

**Integrity:** High — Attacker can modify or delete records through stacked queries.

**Availability:** Medium — Potential for denial of service via resource-intensive queries.`,

    recommendation: `**Immediate (0-7 days):**
1. Deploy parameterized queries (prepared statements) across all database interactions
2. Use ORM methods instead of raw SQL where possible

**Short-term (1-4 weeks):**
1. Implement input validation / allowlist for the username field
2. Deploy a Web Application Firewall (WAF) with SQL Injection rules
3. Review all other endpoints for similar injection patterns

**Long-term:**
1. Integrate SAST tools into the CI/CD pipeline to catch injection flaws early
2. Conduct developer security training on OWASP Top 10`,

    referencesList: `- CWE-89: Improper Neutralization of Special Elements used in an SQL Command
- OWASP A03:2021 – Injection
- NIST SP 800-53: SI-10 (Information Input Validation)`,

    cvssVector:
      "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",
    cvssScore: "9.3",
  };
}
