# Direct Auto Wholesale — Vehicle Acquisition Compliance Platform

A full-stack web application for Direct Auto Wholesale to manage vehicle acquisition compliance. Features a public seller submission form (DocuSign-like experience) and a powerful admin dashboard for reviewing all submissions.

## Tech Stack

- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes (Node.js)
- **Database**: PostgreSQL with Prisma ORM
- **Auth**: NextAuth.js with credentials provider (email + password)
- **File Storage**: Local filesystem (`uploads/`) structured for easy S3 swap-out
- **Charts**: recharts
- **PDF Export**: Server-rendered HTML (print-ready)
- **Email**: Nodemailer with SMTP
- **PWA**: Installable on mobile via Add to Home Screen

## Prerequisites

- Node.js 18+
- PostgreSQL 15+
- npm

## Local Development Setup

```bash
# 1. Clone and install
git clone <repo-url> && cd direct-auto-compliance
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — fill in DATABASE_URL and NEXTAUTH_SECRET at minimum

# 3. Set up database
npx prisma migrate dev --name init

# 4. Seed default admin user and settings
npx prisma db seed

# 5. Start development server
npm run dev

# 6. Open the app
# Admin dashboard: http://localhost:3000/admin
# Public form:     http://localhost:3000/submit
# Login:           http://localhost:3000/login
```

### Default Login Credentials

| Role  | Email                    | Password         |
|-------|--------------------------|------------------|
| Admin | contact@directauto.info  | $RichardJohnson  |

## Key URLs

| URL                | Purpose                               | Auth Required |
|--------------------|---------------------------------------|---------------|
| `/submit`          | Public seller form (share with sellers) | No          |
| `/submit/[token]`  | Single-use pre-filled link            | No            |
| `/admin`           | Admin dashboard                       | Yes           |
| `/admin/vehicles`  | All vehicles table                    | Yes           |
| `/admin/documents` | Document vault                        | Yes           |
| `/admin/audit`     | Full audit log                        | Yes           |
| `/admin/settings`  | Dealership settings                   | Yes (Admin)   |
| `/login`           | Staff login                           | No            |

## Features

### Public Seller Form (`/submit`)
- 5-step guided form (DocuSign-like experience)
- Mobile-first with camera capture for documents
- Auto-saves progress to localStorage
- VIN validation, honeypot spam protection, rate limiting
- Confirmation email sent on submission
- Single-use links for specific sellers

### Admin Dashboard (`/admin`)
- KPI cards with real-time stats
- Submissions chart, status breakdown, risk score trends
- Recent submissions feed
- Quick actions (add vehicle, copy form link, export)

### Vehicle Management
- Sortable, filterable, paginated vehicle table
- Detailed vehicle review with all submitted data
- Inline editing for staff-only fields
- Identity and ownership verification workflows
- PPSR check recording with automatic risk recalculation

### Bill of Sale Generator
- Professional legal document PDF for approved vehicles
- Auto-populated with vehicle and seller details
- Signature blocks for buyer, seller, and witnesses
- Accessible from vehicle detail page and vehicles table

### Risk Scoring Engine
- Automatic scoring on submission and PPSR update
- Flags: written-off, stolen, finance owing, name mismatch, expired licence, missing docs, duplicate VIN
- Auto-block for critical flags (stolen, written-off, duplicate VIN)
- Visual risk gauge (0-100) with color coding

### Document Management
- Document vault across all vehicles
- Drag-and-drop upload with progress
- Image lightbox and PDF preview
- Category-based organization

### Audit Trail
- Every state mutation logged
- User, action, timestamp, IP address, details
- Searchable and filterable audit log
- CSV export

### PDF Reports
- Full acquisition report (all sections)
- Bill of Sale (for approved vehicles)
- Seller summary (download from success screen)
- Print-ready HTML with dealership branding

### PWA (Progressive Web App)
- Installable on iOS and Android home screens
- Offline support with service worker caching
- Standalone app experience (no browser chrome)

## Role Permissions

| Action                | Admin | Staff |
|-----------------------|-------|-------|
| View dashboard        | Yes   | Yes   |
| View vehicles         | Yes   | Yes   |
| Create vehicle        | Yes   | Yes   |
| Upload documents      | Yes   | Yes   |
| Approve/Reject        | Yes   | No    |
| Generate Bill of Sale | Yes   | Yes   |
| Manage settings       | Yes   | No    |
| Manage users          | Yes   | No    |
| Export data           | Yes   | Yes   |

## Deployment Guide

### Database (Supabase - Free)

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Name it "direct-auto-compliance"
3. Copy the connection string (Transaction pooler, port 6543)
4. This is your `DATABASE_URL` for production

### Deploy to Vercel

1. Push code to GitHub (see below)
2. Go to [vercel.com](https://vercel.com) and import your GitHub repo
3. Add these environment variables in the Vercel dashboard:

| Variable                | Value                                    |
|-------------------------|------------------------------------------|
| `DATABASE_URL`          | Your Supabase connection string          |
| `NEXTAUTH_SECRET`       | Run: `openssl rand -base64 32`           |
| `NEXTAUTH_URL`          | `https://your-app.vercel.app`            |
| `UPLOAD_DIR`            | `/tmp`                                   |
| `PPSR_CLOUD_BASE_URL`   | `https://gateway.ppsrcloud.com`          |
| `PPSR_CLOUD_USERNAME`   | `contact@directauto.info`                |
| `PPSR_CLOUD_PASSWORD`   | `$RichardJohnson`                        |
| `ADMIN_EMAIL`           | `contact@directauto.info`                |
| `PUBLIC_FORM_URL`       | `https://your-app.vercel.app/submit`     |

4. Click **Deploy**
5. After deploy, run in Vercel CLI:
   ```bash
   vercel env pull
   npx prisma migrate deploy
   npx prisma db seed
   ```
6. Your app is live at: `https://your-app.vercel.app`

### Push to GitHub

```bash
# Create a new repo on GitHub named "direct-auto-compliance"
git remote add origin https://github.com/USERNAME/direct-auto-compliance.git
git push -u origin main
```

### File Uploads in Production

Since Vercel is serverless, uploaded files need cloud storage. After deployment:

```bash
npm install @vercel/blob
```

1. Add `BLOB_READ_WRITE_TOKEN` to Vercel env vars
2. Update `lib/storage.ts` to use Vercel Blob in production

### Custom Domain (Optional)

In Vercel dashboard: Your Project > Settings > Domains

Add: `compliance.directauto.com.au` (or similar)

Update DNS at your domain registrar.

### PWA on iPhone (for staff)

1. Open `https://your-app.vercel.app` in Safari
2. Tap the **Share** button
3. Tap **"Add to Home Screen"**
4. Tap **"Add"**
5. App appears on home screen like a native app

### PWA on Android

1. Open in Chrome
2. Tap menu > **"Add to Home Screen"** or the install banner appears
3. Tap **Install**

## Environment Variables

See `.env.example` for all required variables:

| Variable               | Description                           | Required |
|------------------------|---------------------------------------|----------|
| `DATABASE_URL`         | PostgreSQL connection string          | Yes      |
| `NEXTAUTH_SECRET`      | Session encryption key                | Yes      |
| `NEXTAUTH_URL`         | App base URL                          | Yes      |
| `UPLOAD_DIR`           | File upload directory (default: ./uploads) | No  |
| `SMTP_HOST`            | SMTP server host                      | No*      |
| `SMTP_PORT`            | SMTP server port (default: 587)       | No*      |
| `SMTP_USER`            | SMTP username                         | No*      |
| `SMTP_PASS`            | SMTP password                         | No*      |
| `SMTP_FROM`            | Sender email address                  | No*      |
| `ADMIN_EMAIL`          | Admin notification email              | No       |
| `PUBLIC_FORM_URL`      | Public form URL for links             | No       |
| `PPSR_CLOUD_BASE_URL`  | PPSR Cloud API base URL               | No       |
| `PPSR_CLOUD_USERNAME`  | PPSR Cloud username                   | No       |
| `PPSR_CLOUD_PASSWORD`  | PPSR Cloud password                   | No       |

*Email notifications are disabled when SMTP is not configured (logged to console instead).

## Project Structure

```
app/
  (auth)/login/          Login page
  (admin)/admin/         Admin dashboard and sub-pages
  submit/                Public seller form
  api/                   API routes
components/
  ui/                    shadcn/ui components
  public-form/           Multi-step form components
  admin/                 Dashboard components
  documents/             Upload and preview components
  layout/                Sidebar and topbar
lib/                     Shared utilities
prisma/                  Schema and seed
public/                  Static assets, PWA manifest, service worker
```
