# Direct Auto Wholesale

Vehicle acquisition and dealership management platform.

## Live URLs

- **Admin Dashboard**: https://directauto.vercel.app
- **Admin Login**: contact@directauto.info
- **Public Seller Form**: https://directauto.vercel.app/submit

## Tech Stack

- **Framework**: Next.js (App Router)
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Hosting**: Vercel (Singapore region)

## Key Integrations

- **Autograb** — Vehicle lookup by VIN/rego + valuations + PPSR via Car Analysis
- **DocuSign** — Bill of Sale e-signature (JWT Grant auth)
- **Supabase** — PostgreSQL database + file storage
- **Gmail SMTP** — Transactional emails (nodemailer)

## Getting Started

```bash
npm install
cp .env.example .env.local  # configure environment variables
npx prisma generate
npm run dev
```

## Environment Variables

See `.env.example` for required configuration including:

- `DATABASE_URL` — Supabase PostgreSQL connection string
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL`
- `AUTOGRAB_API_KEY`
- `DOCUSIGN_INTEGRATION_KEY` / `DOCUSIGN_ACCOUNT_ID` / `DOCUSIGN_USER_ID` / `DOCUSIGN_PRIVATE_KEY`
- `GMAIL_USER` / `GMAIL_APP_PASSWORD`
