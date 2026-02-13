# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Securi Report seriously. If you discover a vulnerability, please report it responsibly so we can address it before it is publicly disclosed.

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities.
2. Email your findings to **security@example.com** (replace with your actual security contact).
3. Include the following in your report:
   - Description of the vulnerability
   - Steps to reproduce (proof of concept)
   - Affected component / file path
   - Potential impact and severity (use CVSS 4.0 if possible)
   - Suggested remediation (optional but appreciated)

### What to Expect

- **Acknowledgment** within **48 hours** of your report.
- **Triage & assessment** within **5 business days**.
- **Patch timeline** communicated once severity is confirmed.
- Credit in the changelog (unless you prefer anonymity).

### Scope

The following are in scope for security reports:

- Authentication & authorization bypass
- SQL injection, XSS, CSRF, SSRF
- Insecure direct object references (IDOR)
- Sensitive data exposure (credentials, tokens, PII)
- Remote code execution
- Path traversal / file inclusion
- LaTeX injection leading to server-side impact
- Dependency vulnerabilities with a known exploit

### Out of Scope

- Denial of Service (DoS) without significant impact
- Social engineering attacks
- Issues in third-party services we don't control
- Vulnerabilities requiring physical access to the server

### Security Hardening

Securi Report is built with OWASP Top 10 (2025) compliance in mind:

- **Rate limiting** on authentication endpoints
- **Input sanitization** (LaTeX, SQL, XSS)
- **CSRF protection** via SameSite cookies and Origin checks
- **Security headers** (CSP, HSTS, X-Frame-Options, etc.)
- **Audit logging** for all sensitive actions
- **2FA support** with TOTP and backup codes
- **Brute-force detection** with admin alerting

## Responsible Disclosure

We follow a coordinated disclosure process. Please allow us adequate time to patch vulnerabilities before any public disclosure. We are committed to acknowledging researchers who help us improve security.

Thank you for helping keep Securi Report and its users safe.
