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
    executiveSummary: `\\textbf{Executive Summary}

ACME Corp engaged our team to perform a comprehensive penetration test of their web application (\\texttt{https://app.acme-corp.com}) during the period ${auditStart.toISOString().slice(0, 10)} to ${auditEnd.toISOString().slice(0, 10)}.

\\textbf{Key Findings:}
\\begin{enumerate}
  \\item \\textbf{Critical (2):} SQL Injection, Remote Code Execution
  \\item \\textbf{High (3):} Stored XSS, IDOR, Broken Authentication
  \\item \\textbf{Medium (4):} CSRF, Missing Rate Limiting, Weak Crypto, Session Fixation
  \\item \\textbf{Low (2):} Information Disclosure, Verbose Error Messages
\\end{enumerate}

\\textbf{Risk Score:}
$$R_{total} = \\sum_{i=1}^{n} S_i \\cdot W_i = 2(9.8) + 3(7.5) + 4(5.5) + 2(3.0) = 70.1$$

where $S_i$ is the CVSS score and $W_i$ is the count per severity level.

\\textbf{Overall Rating:} The application presents a \\textbf{HIGH} risk level. Immediate remediation of Critical and High findings is strongly recommended before the next production release.`,

    scope: `\\textbf{Scope of Assessment}

\\begin{tabular}{|l|l|}
\\hline
\\textbf{Target} & \\textbf{Description} \\\\
\\hline
\\texttt{app.acme-corp.com} & Main web application (React + Node.js) \\\\
\\texttt{api.acme-corp.com} & REST API backend (Express.js) \\\\
\\texttt{admin.acme-corp.com} & Admin dashboard (Next.js) \\\\
\\hline
\\end{tabular}

\\textbf{In Scope:}
\\begin{itemize}
  \\item Web application security testing (OWASP Top 10)
  \\item API endpoint security assessment
  \\item Authentication and authorization testing
  \\item Session management analysis
  \\item Input validation and output encoding
\\end{itemize}

\\textbf{Out of Scope:}
\\begin{itemize}
  \\item Physical security
  \\item Social engineering
  \\item Denial of Service (DoS) testing
  \\item Third-party integrations (Stripe, AWS)
\\end{itemize}`,

    methodology: `\\textbf{Methodology}

The assessment followed the \\textbf{OWASP Testing Guide v4.2} and \\textbf{PTES (Penetration Testing Execution Standard)} frameworks.

\\textbf{Phases:}
\\begin{enumerate}
  \\item \\textbf{Reconnaissance:} Passive and active information gathering using \\texttt{nmap}, \\texttt{subfinder}, and \\texttt{httpx}.
  \\item \\textbf{Mapping:} Application architecture analysis, endpoint enumeration, technology fingerprinting.
  \\item \\textbf{Discovery:} Automated scanning with \\texttt{Burp Suite Pro}, \\texttt{Nuclei}, and \\texttt{SQLMap}. Manual testing for logic flaws.
  \\item \\textbf{Exploitation:} Proof-of-concept development for identified vulnerabilities.
  \\item \\textbf{Reporting:} Risk-based prioritization using CVSS 4.0 scoring model.
\\end{enumerate}

$$\\text{Coverage} = \\frac{|\\text{Endpoints Tested}|}{|\\text{Total Endpoints}|} = \\frac{142}{156} = 91.0\\%$$`,

    impact: `\\textbf{Impact Analysis}

The identified vulnerabilities pose significant risks across the CIA triad:

\\begin{itemize}
  \\item \\textbf{Confidentiality ($C$):} Critical — SQL Injection enables full database extraction. With $|records| > 50{,}000$, this constitutes a major data breach under GDPR Art. 33.
  \\item \\textbf{Integrity ($I$):} High — XSS and IDOR allow unauthorized data modification. Trust score: $T = 1 - P(\\text{tamper}) \\approx 0.3$.
  \\item \\textbf{Availability ($A$):} Medium — While DoS was out of scope, the RCE vulnerability could be leveraged for service disruption.
\\end{itemize}

\\textbf{Compliance Impact:}
\\begin{enumerate}
  \\item \\textbf{GDPR:} Potential fines up to $\\epsilon = 4\\%$ of annual turnover or \\EUR{20M}.
  \\item \\textbf{PCI-DSS:} Non-compliant with Req. 6.5 (Secure Coding).
  \\item \\textbf{SOC 2:} CC6.1 (Logical Access) control failure.
\\end{enumerate}`,

    recommendationSummary: `\\textbf{Recommendations Summary}

\\textbf{Immediate (0-7 days):}
\\begin{enumerate}
  \\item Patch SQL Injection — deploy parameterized queries across all endpoints.
  \\item Fix RCE — remove \\texttt{eval()} and \\texttt{child\\_process.exec()} with user input.
  \\item Implement output encoding for all user-generated content.
\\end{enumerate}

\\textbf{Short-term (1-4 weeks):}
\\begin{enumerate}
  \\item Deploy Web Application Firewall (WAF) with OWASP CRS.
  \\item Implement RBAC with row-level authorization checks.
  \\item Add rate limiting: $r_{max} = 100$ requests/minute per IP.
  \\item Enable MFA for all admin accounts.
\\end{enumerate}

\\textbf{Long-term (1-3 months):}
\\begin{enumerate}
  \\item Establish SSDLC (Secure Software Development Lifecycle).
  \\item Integrate SAST/DAST into CI/CD pipeline.
  \\item Conduct security awareness training for development team.
  \\item Schedule quarterly penetration tests: $f = 4$ per year.
\\end{enumerate}

\\textbf{Risk Reduction Projection:}
$$R_{after} = R_{total} \\cdot (1 - \\eta) = 70.1 \\cdot 0.15 = 10.5$$

where $\\eta = 0.85$ is the expected remediation effectiveness.`,

    referencesFramework: `OWASP Testing Guide v4.2\nPTES (Penetration Testing Execution Standard)\nNIST SP 800-115 (Technical Guide to Information Security Testing)\nCVSS v4.0 Specification (FIRST)\nMITRE ATT&CK Framework v14`,

    cvssVector:
      "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N",

    auditDate: auditStart.toISOString().slice(0, 10),
  };
}
