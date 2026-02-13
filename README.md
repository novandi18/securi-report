<div align="center">

# 🛡️ Securi Report

**Professional Penetration Testing Report Generator**

A modern, security-hardened web application for managing penetration test engagements, generating professional reports with LaTeX support, and collaborating across security teams.

[![CI](https://github.com/YOUR_USERNAME/securi-report/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/securi-report/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OWASP](https://img.shields.io/badge/OWASP-2025%20Hardened-green.svg)](#-security)

</div>

---

## ✨ Features

| Category | Details |
|---|---|
| **Report Management** | Create, edit, merge, and release pentest reports with full CVSS 4.0 scoring |
| **LaTeX Editor** | Built-in LaTeX editor with live preview for professional report formatting |
| **PDF Generation** | One-click PDF deliverable generation with SHA-256 integrity hashing |
| **Collaboration** | Draft → Open → Merge workflow for multi-editor pentest engagements |
| **Instant Search** | Meilisearch-powered full-text search across reports, customers, and findings |
| **Knowledge Base** | CWE/OWASP framework library and reusable finding templates |
| **Notifications** | Real-time per-user notifications with email alerts for critical events |
| **2FA Security** | TOTP two-factor authentication with backup codes |
| **OWASP Hardened** | Rate limiting, CSP headers, input sanitization, audit logging, brute-force detection |
| **Role-Based Access** | Administrator, Editor, and Viewer roles with granular permissions |
| **Security Tools** | Built-in JSON formatter, hashing/encryption, and encoder/decoder utilities |

## 🏗️ Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, React 19, Server Actions)
- **Database:** MySQL 8 with [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication:** [NextAuth v5](https://authjs.dev/) (JWT strategy, Credentials + 2FA)
- **Search:** [Meilisearch](https://www.meilisearch.com/)
- **PDF Engine:** [Puppeteer](https://pptr.dev/) (Headless Chromium)
- **Email:** [Nodemailer](https://nodemailer.com/) (SMTP)
- **Styling:** [Tailwind CSS 3](https://tailwindcss.com/)

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 22+
- **MySQL** 8.0+
- **Meilisearch** v1.x
- **npm** 10+

### Option A: Local Development

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/securi-report.git
cd securi-report

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your database, auth, SMTP, and Meilisearch credentials

# 4. Run database migrations
npm run db:migrate

# 5. (Optional) Seed the database with sample data
npm run db:seed

# 6. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Option B: Docker (One-Click)

```bash
# 1. Clone and configure
git clone https://github.com/YOUR_USERNAME/securi-report.git
cd securi-report
cp .env.example .env.local
# Edit .env.local with your AUTH_SECRET and SMTP settings

# 2. Start all services
docker compose up -d

# 3. Run database migrations (first time only)
docker compose exec app npx drizzle-kit migrate
```

This starts:
- **App** → `http://localhost:3000`
- **MySQL** → `localhost:3306`
- **Meilisearch** → `http://localhost:7700`

---

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Login, forgot-password, 2FA verification
│   ├── (home)/             # Dashboard, reports, customers, settings
│   └── api/                # API routes (auth handlers)
├── components/             # Reusable UI components
│   ├── Layouts/            # Header, sidebar, breadcrumbs
│   ├── FormElements/       # Input groups, select, CVSS input
│   ├── latex-editor/       # LaTeX editor with toolbar & preview
│   └── ui/                 # Toast, dropdown, table, pagination
├── lib/
│   ├── actions/            # Server Actions (report, user, notification, etc.)
│   ├── db/                 # Drizzle schema, migrations, seed
│   ├── pdf/                # PDF generation with Puppeteer
│   ├── security/           # Audit logger, rate limiter, access control
│   └── validations/        # Zod schemas for form validation
└── types/                  # TypeScript type definitions
```

---

## 🔄 Collaboration Workflow

Securi Report uses a **Draft-to-Master** merge workflow for team engagements:

```
Editor creates report  →  Draft
Editor submits         →  Open (admins notified)
Admin reviews & merges →  Master Report (Draft)
Admin generates PDF    →  Deliverable
```

1. **Editors** create individual reports per finding area (network, web, etc.)
2. **Editors** submit reports by setting status to **Open**
3. **Administrators** review and **merge** multiple Open contributions into a single Master Report
4. Merged contributions are automatically **closed** and linked to the master
5. The master report is finalized, and a **PDF deliverable** is generated

---

## 🔒 Security

Securi Report is hardened against the **OWASP Top 10 (2025)**:

- **A01 – Broken Access Control:** Role-based authorization on every server action
- **A02 – Cryptographic Failures:** bcrypt password hashing, secure session cookies, SHA-256 PDF integrity
- **A03 – Injection:** LaTeX sanitization, parameterized SQL (Drizzle ORM), input validation (Zod)
- **A04 – Insecure Design:** Rate limiting on auth endpoints, brute-force detection with admin alerting
- **A05 – Security Misconfiguration:** CSP, HSTS, X-Frame-Options, Permissions-Policy headers
- **A06 – Vulnerable Components:** Automated `npm audit` in CI pipeline, CodeQL analysis
- **A07 – Auth Failures:** TOTP 2FA, account lockout, secure cookie flags, password complexity enforcement
- **A08 – Data Integrity:** Audit logging for all sensitive actions, SHA-256 deliverable hashing
- **A09 – Logging & Monitoring:** Comprehensive audit trail with brute-force alerting and email notifications
- **A10 – SSRF:** Restricted server-side requests, origin validation

See [SECURITY.md](SECURITY.md) for vulnerability reporting guidelines.

---

## 🧪 CI/CD

GitHub Actions pipeline (`.github/workflows/ci.yml`):

| Job | Description |
|---|---|
| **Lint** | ESLint with Next.js rules |
| **Type-check** | `tsc --noEmit` strict mode |
| **Build** | Production build verification |
| **Security Audit** | `npm audit` for known CVEs |
| **CodeQL** | Static analysis for OWASP compliance |
| **Docker Build** | Dockerfile build validation |

---

## ⚙️ Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL connection string |
| `AUTH_SECRET` | NextAuth session encryption key |
| `AUTH_URL` | Application canonical URL |
| `SMTP_HOST/USER/PASS` | SMTP credentials for email notifications |
| `MEILISEARCH_HOST` | Meilisearch server URL |
| `MEILISEARCH_ADMIN_KEY` | Meilisearch admin API key |
| `NEXT_PUBLIC_APP_ENV` | `development` or `production` |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Follow the **Draft-to-Master** workflow for report-related changes
4. Ensure `npm run lint` and `npx tsc --noEmit` pass with zero errors
5. Submit a Pull Request targeting `main`

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with ❤️ for the security community

</div>
