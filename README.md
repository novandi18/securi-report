<div align="center">

# Securi Report

**Professional Penetration Testing Report Generator**

A modern, security-hardened web application for managing penetration test engagements, generating professional reports with Markdown & KaTeX support, AI-powered report generation, and collaborating across security teams.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![OWASP](https://img.shields.io/badge/OWASP-2025%20Hardened-green.svg)](#-security)

</div>

---

## Features

| Category | Details |
|---|---|
| **Report Management** | Create, edit, and manage pentest reports with full CVSS 4.0 scoring and file attachments |
| **AI Report Generation** | Generate complete pentest reports from uploaded documents using Google Gemini AI |
| **Markdown Editor** | Built-in Markdown editor (Monaco) with live preview, toolbar, and KaTeX math formula support |
| **PDF Generation** | One-click PDF deliverable generation via Puppeteer with SHA-256 integrity hashing |
| **Custom Templates** | Upload custom PDF report templates with automatic text extraction for AI-assisted generation |
| **Instant Search** | Meilisearch-powered full-text search across reports, customers, and findings |
| **Knowledge Base** | CWE/OWASP framework library and reusable finding templates |
| **Notifications** | Per-user notifications (collaboration, security, engagement, system) with email alerts |
| **2FA Security** | TOTP two-factor authentication with backup codes |
| **OWASP Hardened** | Rate limiting, CSP headers, Markdown sanitization, audit logging, brute-force detection |
| **Role-Based Access** | Administrator, Editor, and Viewer roles with granular permissions |
| **Dark Mode** | Full dark mode support via `next-themes` |
| **Security Tools** | Built-in JSON formatter, hashing/encryption (crypto), and encoder/decoder utilities |
| **Dashboard** | Interactive dashboard with ECharts visualizations |

## Tech Stack

- **Framework:** [Next.js 16](https://nextjs.org/) (App Router, React 19, Server Actions)
- **Database:** MySQL 8 with [Drizzle ORM](https://orm.drizzle.team/)
- **Authentication:** [NextAuth v5](https://authjs.dev/) (JWT strategy, Credentials + TOTP 2FA)
- **AI:** [Google Gemini](https://ai.google.dev/) (`@google/genai`) for AI-powered report generation
- **Search:** [Meilisearch](https://www.meilisearch.com/)
- **Editor:** [Monaco Editor](https://microsoft.github.io/monaco-editor/) with Markdown & KaTeX support
- **PDF Engine:** [Puppeteer](https://pptr.dev/) (Headless Chromium)
- **Charts:** [ECharts](https://echarts.apache.org/) for dashboard visualizations
- **Email:** [Nodemailer](https://nodemailer.com/) (SMTP)
- **Animations:** [Framer Motion](https://motion.dev/)
- **Styling:** [Tailwind CSS 3](https://tailwindcss.com/)
- **Validation:** [Zod](https://zod.dev/)

---

## Quick Start

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
# Edit .env.local with your database, auth, SMTP, Meilisearch, and Gemini credentials

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
# Edit .env.local with your AUTH_SECRET, SMTP, and Gemini settings

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

## Project Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── (auth)/                 # Login, forgot-password, 2FA verification
│   ├── (home)/                 # Dashboard, reports, customers, settings
│   │   ├── customers/          # Customer management
│   │   ├── kb/                 # Knowledge Base (frameworks, templates)
│   │   ├── notifications/      # User notifications
│   │   ├── profile/            # Profile management
│   │   ├── reports/            # Reports CRUD, AI generation, deliverables
│   │   ├── settings/           # App settings, account, custom templates
│   │   ├── tools/              # Crypto, encoding, JSON utilities
│   │   └── users/              # User management (admin)
│   ├── api/                    # API routes (auth, CVSS, AI PDF, template PDF)
│   └── register/               # User registration
├── components/                 # Reusable UI components
│   ├── Breadcrumbs/            # Breadcrumb navigation
│   ├── FormElements/           # Input groups, CVSS calculator, dropzone, select
│   ├── Layouts/                # Header, sidebar, footer
│   ├── markdown-editor/        # Markdown editor with toolbar, preview & AI assist
│   ├── search/                 # Meilisearch integration components
│   └── ui/                     # Toast, dropdown, table, pagination, dialog
├── lib/
│   ├── actions/                # Server Actions (report, AI generate, user, etc.)
│   ├── db/                     # Drizzle schema, migrations, seed
│   ├── pdf/                    # PDF generation with Puppeteer
│   ├── security/               # Audit logger, rate limiter, access control, sanitizer
│   └── validations/            # Zod schemas for form validation
├── hooks/                      # Custom React hooks
├── css/                        # Global styles (Satoshi font, Tailwind)
└── types/                      # TypeScript type definitions
```

---

## Report Workflow

Securi Report uses a **Draft → Open → Closed** workflow:

```
Editor creates report  →  Draft
Editor submits         →  Open (ready for review)
Admin reviews          →  Closed (finalized)
Admin generates PDF    →  Deliverable (SHA-256 hashed)
```

1. **Editors** create reports manually or using **AI-powered generation** from uploaded documents
2. **Editors** submit reports by setting status to **Open**
3. **Administrators** review and finalize reports, setting status to **Closed**
4. **Administrators** generate **PDF deliverables** with SHA-256 integrity hashing
5. All status changes and key actions are recorded in the **audit log**

### AI Report Generation

Editors can generate complete pentest reports by:
1. Uploading reference documents (PDF attachments)
2. Providing context and scope information
3. Letting Google Gemini AI generate a structured Markdown report
4. Reviewing and editing the generated content in the Markdown editor

---

## Security

Securi Report is hardened against the **OWASP Top 10 (2025)**:

- **A01 – Broken Access Control:** Role-based authorization on every server action
- **A02 – Cryptographic Failures:** bcrypt password hashing, secure session cookies, SHA-256 PDF integrity
- **A03 – Injection:** Markdown sanitization (DOMPurify), parameterized SQL (Drizzle ORM), input validation (Zod)
- **A04 – Insecure Design:** Rate limiting on auth endpoints, brute-force detection with admin alerting
- **A05 – Security Misconfiguration:** CSP, HSTS, X-Frame-Options, Permissions-Policy headers
- **A06 – Vulnerable Components:** Automated `npm audit` in CI pipeline, CodeQL analysis
- **A07 – Auth Failures:** TOTP 2FA, account lockout, secure cookie flags, password complexity enforcement
- **A08 – Data Integrity:** Audit logging for all sensitive actions, SHA-256 deliverable hashing
- **A09 – Logging & Monitoring:** Comprehensive audit trail with brute-force alerting and email notifications
- **A10 – SSRF:** Restricted server-side requests, origin validation

See [SECURITY.md](SECURITY.md) for vulnerability reporting guidelines.

---

## CI/CD

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

## Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL connection string |
| `AUTH_SECRET` | NextAuth session encryption key |
| `AUTH_URL` | Application canonical URL |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | SMTP credentials for email notifications |
| `SMTP_FROM` | Email sender address |
| `MEILISEARCH_HOST` | Meilisearch server URL |
| `MEILISEARCH_ADMIN_KEY` | Meilisearch admin API key |
| `NEXT_PUBLIC_MEILISEARCH_HOST` | Meilisearch URL for client-side search |
| `NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY` | Meilisearch search-only key (safe for browser) |
| `GEMINI_API_KEY` | Google Gemini API key for AI report generation |
| `GEMINI_MODEL` | Gemini model name (default: `gemini-3-flash-preview`) |
| `NEXT_PUBLIC_APP_ENV` | `development` or `production` |

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Run database migrations |
| `npm run db:push` | Push schema changes directly |
| `npm run db:studio` | Open Drizzle Studio (DB browser) |
| `npm run db:seed` | Seed database with sample data |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Ensure `npm run lint` and `npm run typecheck` pass with zero errors
4. Submit a Pull Request targeting `main`

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with ❤️ for DefendIT360

</div>
