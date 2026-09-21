<div align="center">

# Rynex Technologies Limited
### Global Cybersecurity Lead Intelligence & Outreach Platform

*Autonomous lead discovery, passive security signal correlation, deterministic 5-pillar scoring, and evidence-grounded outreach generation.*

[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.1-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL_Mode-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Platform](https://img.shields.io/badge/Platform-Windows_%7C_Linux-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://microsoft.com)

</div>

---

## Table of Contents
1. [Niche Lead Generation & Contextual AI Outreach](#niche-lead-generation--contextual-ai-outreach)
2. [Product Overview & Visual Identity](#product-overview--visual-identity)
3. [Architecture & Discovery Engines](#architecture--discovery-engines)
4. [Prerequisites](#prerequisites)
5. [How to Run on Windows](#how-to-run-on-windows)
6. [Pre-Configured Enterprise Accounts](#pre-configured-enterprise-accounts)
7. [API Keys Integration (OpenAI, Gemini, Groq, SerpAPI)](#api-keys-integration)
8. [Running the Verification Test Suite](#running-the-verification-test-suite)
9. [REST API Reference](#rest-api-reference)

---

## Niche Lead Generation & Contextual AI Outreach

The platform is engineered around an intelligent client-discovery and contextual outreach workflow:

1. **Targeting Clients Who NEED Cybersecurity Services (Vendor Exclusion)**:
   - When entering **"Cyber Security"** as the niche, the engine does **NOT** search for other cybersecurity firms or competitors selling security.
   - Instead, it pivots dynamically to target high-propensity client buyers (e.g., Software Development Houses, Fintech platforms, Healthcare systems, Banks, Logistics enterprises, and E-commerce) across the selected regional hub (e.g., Karachi, Lahore, Islamabad, Dubai, Riyadh, London, or Global).
   - Built-in heuristic filters automatically eliminate cybersecurity agencies, pentest consultants, MSP vendors, and directory scrapers.

2. **5 Specialized Cybersecurity Service Offerings**:
   - **VAPT** (Vulnerability Assessment & Penetration Testing): Targets software houses, fintechs, and SaaS web apps with web application and API attack simulations.
   - **SOC** (24/7 Security Operations Center Monitoring): Targets transactional enterprises, banks, and IT infrastructure needing continuous log monitoring and rapid threat hunting.
   - **GRC** (Governance, Risk & Compliance): Targets regulated financial, medical, and SaaS firms needing ISO 27001, SOC 2, and PCI DSS compliance gap assessments.
   - **Security Audits** (Independent Architecture Audits): Targets cloud-native platforms needing independent AWS/Azure perimeter reviews and configuration audits.
   - **Cyber Security Trainings** (Staff Awareness & Phishing): Targets distributed corporate workforces and logistics giants needing employee awareness programs and phishing simulations.

3. **Context of Need Detection**:
   - For every prospect discovered, the system analyzes business operations and generates an evidence-backed **Context of Need / Opportunity** explaining why this organization requires the selected cybersecurity service.

4. **Persistent Lead Pipeline (Save Leads)**:
   - Checkbox-select individual leads or 1-click **"Select All"**.
   - Save selected leads directly to your persistent SQLite pipeline with status tracking (*New*, *Contacted*, *Meeting Booked*, *Qualified*, *Closed*), custom notes, and CSV export.

5. **AI Contextual Email Studio (4-Stage Sequences & Branded HTML)**:
   - Generate bespoke offensive security outreach emails across 4 sequence stages:
     - **Stage 1**: Initial Outreach (Problem-solver angle)
     - **Stage 2**: Follow-up 1 (Technical approach)
     - **Stage 3**: Follow-up 2 (Technical checklist)
     - **Stage 4**: Follow-up 3 (Final low-pressure note)
   - Dual output: Generates both formatted Plain Text (for quick copy-pasting) and Rynex Branded HTML with official logo and responsive styling.
   - Powered by **OpenAI GPT-4o-mini**, **Google Gemini 1.5 Flash**, **Groq Llama-3.3-70B**, or the instant **Built-in Contextual Outreach Engine**.

---

## Product Overview & Visual Identity

**Rynex Technologies Limited** is a cybersecurity company specializing in:
- **VAPT** — Vulnerability Assessment & Penetration Testing (Web, API, Mobile, Cloud)
- **SOC** — 24/7 Security Operations Center Continuous Threat Hunting
- **GRC** — Governance, Risk & Compliance (ISO 27001, SOC 2, PCI DSS)
- **Security Audits** — Independent Cloud Architecture & Configuration Audits
- **Cyber Security Trainings** — Employee Awareness & Simulated Phishing Campaigns
- **Cybersecurity Consulting & Risk Advisory**

### Brand Visual Identity
The platform strictly adheres to an enterprise cybersecurity design standard:
- **White**: `#FFFFFF`
- **Black**: `#000000` (deep grayscale hierarchy `#0a0a0a`, `#111111`, `#161616`)
- **Cyan**: `#00D4FF` (Primary Accent Color)
- **Zero Emojis**: Replaced completely with pixel-perfect minimalist SVG line icons and structured typography.
- **Enterprise SaaS Ergonomics**: Clean data cards, tables, data grids, compact action controls, and high information density.

---

## Architecture & Live Reconnaissance Engine

```
+--------------------------------------------------------------------+
|                      React 18 Single Page App                      |
|       (Vite 6 · Tailwind CSS v4 · Recharts · Minimalist SVG)       |
|                    Runs on http://localhost:5180                   |
+---------------------------------+----------------------------------+
                                  | (Vite Proxy / Production Dist)
+---------------------------------v----------------------------------+
|                   Express.js REST API Server                       |
|   - Live Passive Reconnaissance Engine (DNS DoH + HTTP Audit)      |
|   - RBAC Session Guards (Admin, Manager, Researcher, Sales)        |
|   - 10-Stage Background Discovery Pipeline (Non-Blocking)          |
|   - Deterministic 5-Pillar Lead Scoring & Service Matchers         |
|   - AI Evidence-Grounded Outreach Generator (Zero Hallucinations)  |
|   - Multi-Format Exporters (ExcelJS, PDFKit, CSV Streamer)         |
|                    Runs on http://127.0.0.1:4180                   |
+---------------------------------+----------------------------------+
                                  |
+---------------------------------v----------------------------------+
|                 SQLite Database (Node.js 22+ Native)               |
|            WAL Mode Enabled · 17 Relational Tables                 |
|                   Located at: data/rynex.db                        |
+--------------------------------------------------------------------+
```

### Real Live Cybersecurity Intelligence (Zero Intrusive Probing)
The application incorporates a live passive reconnaissance engine (`server/engines/realrecon.js`):
1. **DNS Security Auditing via DNS-over-HTTPS (DoH)**:
   - **MX Infrastructure**: Identifies mail routing (Google Workspace, Microsoft 365, Mimecast, Proofpoint).
   - **SPF Validation**: Queries `v=spf1`. Detects missing or permissive policies (`+all`, `?all`), identifying email spoofing vulnerabilities.
   - **DMARC Posture**: Queries `_dmarc.<domain>`. Flags missing policies or un-enforced monitor-only modes (`p=none`).
2. **HTTP Security Header Auditing**:
   - Inspects `Strict-Transport-Security` (HSTS) enforcement on HTTPS endpoints.
   - Audits `Content-Security-Policy` (CSP) presence for Cross-Site Scripting (XSS) defense.
   - Verifies `X-Frame-Options` (Clickjacking mitigation) and `X-Content-Type-Options`.
3. **Vulnerability Disclosure Policy**:
   - Queries RFC 9116 `/.well-known/security.txt` and `/security.txt` to verify whether the target maintains a formal vulnerability disclosure contact.
4. **Passive Technology Footprints**:
   - Detects Cloudflare, WordPress, Shopify, React, Node.js, and web server software from response headers and DOM assets.
5. **Compliance Detection**:
   - Scans public policy references for SOC 2, ISO 27001, PCI DSS, HIPAA, GDPR, DORA, and NIST.

---

## Prerequisites

- **Node.js**: **v22.0.0 or higher** (Required for Node's native `node:sqlite` module `DatabaseSync`).
- **Operating System**: Windows 10/11, macOS, or Linux.
- **Windows PowerShell**: Use `npm.cmd` when PowerShell script execution policies (`about_Execution_Policies`) are active.

Check your installed Node.js version:
```powershell
node -v
# Example: v24.21.0 or v22.x
```

---

## How to Run on Windows

### Step 1: Install Dependencies
```powershell
npm.cmd install
```

### Step 2: Choose Execution Mode

#### Mode 1: Production Mode (Recommended - Single Port 4180)
Compiles the React frontend with Vite into `dist/` and runs the Express server serving both the REST API and the SPA:

```powershell
# 1. Build the frontend
npm.cmd run build

# 2. Launch the unified server
npm.cmd run server
```

Access the application in your browser:
**http://127.0.0.1:4180**

---

#### Mode 2: Development Mode (Hot Reloading)
Runs the Express backend on port `4180` and the Vite development server with React Fast Refresh on port `5180` concurrently:

```powershell
npm.cmd run dev
```

Access the development interface:
**http://localhost:5180**

---

#### Mode 3: Re-seed or Reset Database
Re-populates the database with demo records:

```powershell
npm.cmd run seed
```

---

## Pre-Configured Enterprise Accounts

The sign-in view provides **1-click credential buttons** for all enterprise roles:

| Role | Email | Password | RBAC Permissions |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@rynex.io` | `Admin@123` | **Full System Authority**: Manage system settings, configure AES-256 encrypted API keys, manage suppression lists, purge demo records, execute pipelines. |
| **Manager** | `manager@rynex.io` | `Manager@123` | **Outreach & Pipeline Governance**: Create and manage campaigns, approve email drafts, launch discovery jobs, update lead statuses. |
| **Researcher**| `researcher@rynex.io`| `Research@123` | **Intelligence Discovery**: Run passive reconnaissance, inspect lead dossiers, add tasks, record audit notes. |
| **Sales** | `sales@rynex.io` | `Sales@123` | **Outbound Engagement**: Filter qualified prospects, generate evidence-backed outreach copy, simulate prospect replies. |

---

## Running the Verification Test Suite

### Test 1: Database & Seed Verification
Validates database table creation, foreign keys, and seed integrity:
```powershell
node seed-test.js
```
*Result*: Validates 17 tables and verifies relational integrity across all records.

---

### Test 2: Autonomous 10-Stage Background Pipeline Test
Executes a multi-stage discovery, deduplication, enrichment, and qualification background task:
```powershell
node pipeline-test.js
```
*Result*: Displays 100% completion across all 10 pipeline stages.

---

### Test 3: Full REST API Smoke Test
Queries all 19 primary API routes, exercises authenticated sessions, generates an evidence-backed email, and downloads a test CSV export:
```powershell
# With the server running on http://127.0.0.1:4180:
powershell -ExecutionPolicy Bypass -File .\api-test.ps1
```
*Result*: All 19 endpoints return HTTP 200 OK.

---

## Directory Structure

```
Lead-Gen_Web_App/
|-- client/                      # React 18 frontend source code
|   |-- index.html               # HTML5 entry template
|   `-- src/
|       |-- api.js               # Centralized API client & session manager
|       |-- App.jsx              # Main SPA (Dashboard, Prospector, Leads, Jobs, etc.)
|       |-- icons.jsx            # Zero-emoji SVG icon library
|       |-- index.css            # Tailwind CSS v4 directives & #00D4FF theme
|       `-- main.jsx             # React DOM root render
|
|-- data/                        # Local persistent database
|   |-- rynex.db                 # Primary SQLite database (WAL mode)
|   |-- .server-secret           # Auto-generated AES-256 / HMAC secret
|   `-- (exports)                # Generated CSV, XLSX, and PDF exports
|
|-- server/                      # Node.js backend source code
|   |-- auth.js                  # scrypt hashing, HMAC-SHA256 tokens, RBAC guards
|   |-- db.js                    # node:sqlite connection, schema & transactions
|   |-- index.js                 # Express server & production static asset host
|   |-- providers.js             # Modular data provider abstractions
|   |-- seed.js                  # Idempotent database seeder
|   |-- engines/
|   |   |-- emailgen.js          # Fact/Inference-safe email outreach generator
|   |   |-- intel.js             # 5-pillar scoring formulas & service matchers
|   |   |-- pipeline.js          # 10-stage cooperative background pipeline runner
|   |   `-- realrecon.js         # Live passive DNS (DoH) & HTTP security auditor
|   `-- routes/
|       |-- auth.js              # /api/auth (login, me, demo-accounts)
|       |-- jobs.js              # /api/jobs & /api/methods (pipeline execution)
|       |-- leads.js             # /api/leads, /prospect, /demo, /companies, /contacts
|       |-- misc.js              # /api/dashboard, /analytics, /exports, /settings
|       `-- outreach.js          # /api/campaigns, /api/emails/drafts, /api/templates
|
|-- api-test.ps1                 # PowerShell automated test suite
|-- pipeline-test.js             # Pipeline engine verification script
|-- seed-test.js                 # Database schema verification script
|-- vite.config.js               # Vite 6 + Tailwind CSS v4 build configuration
`-- package.json                 # Project dependencies & npm scripts
```

---

## The 18 Core Application Modules

### 1. Live Passive Reconnaissance Prospector
Accessible from the sidebar and top navigation:
- Enter any live domain (e.g. `monzo.com`, `stripe.com`, `snyk.io`, or custom URL).
- Instantly queries DNS-over-HTTPS for MX servers, SPF policies, and DMARC spoofing protections.
- Audits public web headers for HSTS, CSP, and X-Frame-Options.
- Identifies technology stacks and compliance indicators.
- Automatically computes the 5-pillar lead score and saves it as a verified live lead record (`is_demo = 0`).

---

### 2. 10-Stage Lead Discovery Pipeline
The background runner in `server/engines/pipeline.js` executes cooperatively without blocking web requests:
```
DISCOVERY
   |
DEDUPLICATION
   |
COMPANY ENRICHMENT
   |
CONTACT ENRICHMENT
   |
TECHNOLOGY INTELLIGENCE
   |
SECURITY SIGNAL DETECTION
   |
COMPLIANCE SIGNAL DETECTION
   |
INTENT ANALYSIS
   |
LEAD SCORING
   |
QUALIFICATION
```

---

### 3. Deterministic 5-Pillar Scoring Model
Scores are calculated deterministically on a 0-100 scale:

| Scoring Pillar | Weight | Evaluation Criteria |
| :--- | :---: | :--- |
| **Company Fit** | 20 pts | Evaluates industry relevance, employee headcount (10-250 sweet spot), and target geography. |
| **Security Signals**| 20 pts | Passive findings: missing SPF/DMARC, absent HSTS/CSP headers, public security hiring, tech surface area. |
| **Intent Signals** | 20 pts | Recency of observed security signals, compliance preparation, and technology expansion. |
| **Service Fit** | 20 pts | Algorithmic relevance to **VAPT, SOC, GRC, or Security Audit**. |
| **Data Quality** | 20 pts | Profile completeness, verified corporate domain, and direct contact email availability. |

---

### 4. Evidence-Based Outreach Generation
The outreach generator in `server/engines/emailgen.js` strictly distinguishes facts from inferences:
- **Zero Hallucinations**: Only cites verified records from the lead's evidence list.
- **Safety Preflight Checks**: Verifies domain validity, confirms suppression status, verifies recipient, and ensures no unfounded breach claims.
- **3 Personalization Tiers**:
  - `Basic`: Polite, service-relevant introductory inquiry.
  - `Standard`: Contextual hook citing an observable company characteristic.
  - `Deep Research`: Multi-evidence cited outreach tying infrastructure, compliance requirements, and recommended services.

---

### 5. Data Center (CSV, XLSX, PDF Export & Import)
- **Multi-Format Export**: Stream filtered leads into **CSV**, **Microsoft Excel (.xlsx)** via `exceljs`, or **Executive Landscape PDF Reports** via `pdfkit`.
- **Structured Ingestion**: Upload external CSV, JSON, or Excel files with interactive column mapping and deduplication previewing.

---

## REST API Reference

All protected endpoints require an `Authorization: Bearer <token>` header obtained from `/api/auth/login`.

| Method | Endpoint | Description | Role Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate and obtain JWT token | Public |
| `GET` | `/api/auth/me` | Retrieve profile of authenticated user | Any Authenticated |
| `GET` | `/api/auth/demo-accounts` | List available demo accounts | Public |
| `GET` | `/api/dashboard` | Telemetry KPIs, 30-day timeline series, and recent activity | Any Authenticated |
| `GET` | `/api/analytics` | Yield rates, engagement funnels, and score distributions | Any Authenticated |
| `POST` | `/api/leads/prospect` | Run real-time passive reconnaissance on any live domain | Any Authenticated |
| `DELETE`| `/api/leads/demo` | Purge all synthetic demo records from the database | Admin |
| `GET` | `/api/leads` | Filter, paginate, and search leads (`isDemo`, `q`, `status`, `service`) | Any Authenticated |
| `GET` | `/api/leads/:id` | Retrieve comprehensive dossier (evidence, signals, contacts, notes) | Any Authenticated |
| `PATCH`| `/api/leads/:id` | Update lead status (`Qualified`, `Won`, `Do Not Contact`, etc.) | Manager, Admin |
| `POST` | `/api/leads/bulk` | Bulk status changes, mass tagging, or bulk deletions | Manager, Admin |
| `GET` | `/api/methods` | List 15 autonomous discovery methods | Any Authenticated |
| `GET` | `/api/jobs` | Retrieve all background discovery jobs and stage progress | Any Authenticated |
| `POST` | `/api/jobs` | Launch a new 10-stage discovery job | Manager, Admin |
| `POST` | `/api/jobs/:id/cancel`| Cancel an active running job | Manager, Admin |
| `POST` | `/api/emails/generate` | Generate context-aware outreach email from lead evidence | Sales, Manager, Admin |
| `POST` | `/api/emails/drafts` | Save or queue generated email draft | Sales, Manager, Admin |
| `GET` | `/api/emails/drafts` | List outreach drafts with status filtering | Any Authenticated |
| `PATCH`| `/api/emails/drafts/:id`| Approve draft, schedule, or trigger sending | Manager, Admin |
| `POST` | `/api/emails/drafts/:id/events` | Record engagement event (`opened`, `replied`, `bounced`) | Manager, Admin |
| `GET` | `/api/exports/leads` | Stream export as `csv`, `xlsx`, or `pdf` | Any Authenticated |
| `GET` | `/api/suppression` | List do-not-contact domains and emails | Manager, Admin |
| `POST` | `/api/suppression` | Add domain or email to suppression list | Manager, Admin |
| `GET` | `/api/integrations` | List integration catalog (APIs, SMTP, LLMs) | Admin |
| `PUT` | `/api/integrations/:key`| Save encrypted credentials (AES-256-GCM) | Admin |

---

## Database Schema & PostgreSQL Migration

The database layer in `server/db.js` uses Node's native SQLite with Write-Ahead Logging (`PRAGMA journal_mode = WAL;`) and enforced foreign keys (`PRAGMA foreign_keys = ON;`).

### Relational Schema
- `users`: Accounts, scrypt hashes, roles (`admin`, `manager`, `researcher`, `sales`).
- `companies`: Domains, industries, locations, employee counts, revenue bands, `is_demo` flag.
- `contacts`: Verified business contacts, titles, emails, LinkedIn URLs, primary flags.
- `leads`: Core pipeline record linking company and primary contact with scores.
- `lead_evidence`: Specific public findings (hiring, announcements, compliance badges).
- `lead_signals`: Categorized security and business momentum signals.
- `company_technologies`: Cloud, CMS, framework, and security infrastructure tags.
- `company_compliance`: SOC 2, ISO 27001, HIPAA, PCI DSS certifications and evidence.
- `lead_generation_jobs`: Background runner states, stage progress JSON, yield stats.
- `campaigns` & `campaign_leads`: Marketing campaign groupings and segment criteria.
- `email_drafts` & `email_events`: Outbound communications, approval workflows, and engagement logs.
- `suppression`: Global exclusion list (`email` and `domain`).
- `api_integrations`: Provider configurations with AES-256-GCM encrypted secrets.

### Migration to PostgreSQL
The schema syntax was designed to map 1:1 to PostgreSQL for production scaling:
1. Replace `INTEGER PRIMARY KEY AUTOINCREMENT` with `BIGSERIAL PRIMARY KEY`.
2. Swap `datetime('now')` with `CURRENT_TIMESTAMP`.
3. In `server/db.js`, replace `DatabaseSync` calls with standard parameterized queries via `pg` (`$1, $2` syntax).

---

<div align="center">

**Built for precision cybersecurity outreach — fact-based, transparent, and compliant.**

</div>
