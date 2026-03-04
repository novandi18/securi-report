import { assertDevelopment } from "@/lib/env";

/**
 * Generate sample content for the report form.
 * This is a pure client-side function — no DB writes, no server action.
 * Can also be called on the server (assertDevelopment will guard it).
 */
export function generateSampleReportContent() {
  assertDevelopment();

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const reportId = `PEN-DOC-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;

  const auditStart = new Date(now.getTime() - 14 * 86400000);
  const auditEnd = new Date(now.getTime() - 1 * 86400000);

  return {
    reportIdCustom: reportId,
    title: "Penetration Test Report — ACME Corp Web Application",
    executiveSummary: `**Executive Summary**

ACME Corp engaged our team to perform a comprehensive penetration test of their web application (\`https://app.acme-corp.com\`) during the period ${auditStart.toISOString().slice(0, 10)} to ${auditEnd.toISOString().slice(0, 10)}.

**Key Findings:**
1. **Critical (2):** SQL Injection, Remote Code Execution
2. **High (3):** Stored XSS, IDOR, Broken Authentication
3. **Medium (4):** CSRF, Missing Rate Limiting, Weak Crypto, Session Fixation
4. **Low (2):** Information Disclosure, Verbose Error Messages

**Overall Rating:** The application presents a **HIGH** risk level. Immediate remediation of Critical and High findings is strongly recommended before the next production release.`,

    scopeIssa1: [
      { no: 1, sistemEndpoint: "app.acme-corp.com", ipAddress: "192.168.1.10", linkUrl: "https://app.acme-corp.com" },
      { no: 2, sistemEndpoint: "api.acme-corp.com", ipAddress: "192.168.1.11", linkUrl: "https://api.acme-corp.com" },
      { no: 3, sistemEndpoint: "admin.acme-corp.com", ipAddress: "192.168.1.12", linkUrl: "https://admin.acme-corp.com" },
    ],
    scopeIssa2: [
      { no: 1, ipPublic: "203.0.113.50", linkUrl: "https://db.acme-corp.com" },
    ],
    scopeIssa3: [
      { no: 1, ipInternal: "10.0.0.5" },
    ],

    methodology: `**Methodology**

The assessment followed the **OWASP Testing Guide v4.2** and **PTES (Penetration Testing Execution Standard)** frameworks.

**Phases:**
1. **Reconnaissance:** Passive and active information gathering using \`nmap\`, \`subfinder\`, and \`httpx\`.
2. **Mapping:** Application architecture analysis, endpoint enumeration, technology fingerprinting.
3. **Discovery:** Automated scanning with \`Burp Suite Pro\`, \`Nuclei\`, and \`SQLMap\`. Manual testing for logic flaws.
4. **Exploitation:** Proof-of-concept development for identified vulnerabilities.
5. **Reporting:** Risk-based prioritization using CVSS 4.0 scoring model.

Coverage = 142 / 156 endpoints = **91.0%**`,

    impact: `**Impact Analysis**

The identified vulnerabilities pose significant risks across the CIA triad:

- **Confidentiality (C):** Critical — SQL Injection enables full database extraction. With >50,000 records, this constitutes a major data breach under GDPR Art. 33.
- **Integrity (I):** High — XSS and IDOR allow unauthorized data modification.
- **Availability (A):** Medium — While DoS was out of scope, the RCE vulnerability could be leveraged for service disruption.

**Compliance Impact:**
1. **GDPR:** Potential fines up to 4% of annual turnover or €20M.
2. **PCI-DSS:** Non-compliant with Req. 6.5 (Secure Coding).
3. **SOC 2:** CC6.1 (Logical Access) control failure.`,

    recommendationSummary: `**Recommendations Summary**

**Immediate (0-7 days):**
1. Patch SQL Injection — deploy parameterized queries across all endpoints.
2. Fix RCE — remove \`eval()\` and \`child_process.exec()\` with user input.
3. Implement output encoding for all user-generated content.

**Short-term (1-4 weeks):**
1. Deploy Web Application Firewall (WAF) with OWASP CRS.
2. Implement RBAC with row-level authorization checks.
3. Add rate limiting: max 100 requests/minute per IP.
4. Enable MFA for all admin accounts.

**Long-term (1-3 months):**
1. Establish SSDLC (Secure Software Development Lifecycle).
2. Integrate SAST/DAST into CI/CD pipeline.
3. Conduct security awareness training for development team.
4. Schedule quarterly penetration tests (4 per year).`,

    referencesFramework: `OWASP Testing Guide v4.2\nPTES (Penetration Testing Execution Standard)\nNIST SP 800-115 (Technical Guide to Information Security Testing)\nCVSS v4.0 Specification (FIRST)\nMITRE ATT&CK Framework v14`,

    cvssVector:
      "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",

    auditDate: auditStart.toISOString().slice(0, 10),
  };
}
