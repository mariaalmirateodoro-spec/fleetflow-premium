# 🚗 FleetFlow Premium

> Premium HR/Admin car rental management system for corporate foreign guest transportation.

## ✨ Features

- **Role-based access**: Admin · Manager · Staff · Finance
- **Bookings CRUD**: Full lifecycle from request → quote → approval → completion
- **Quote Comparison**: Multi-supplier quote engine with AI best-value recommendation
- **Approval Workflow**: Manager approval with comments, rejection, and revision requests
- **Reports & Analytics**: Monthly spend, supplier rankings, route analysis, cost savings
- **AI Assistant**: Vehicle suggestions, supplier recommendations, email drafting, booking summaries
- **Real-time Notifications**: In-app + Supabase Realtime push
- **Dark Glassmorphism UI**: Premium SaaS design with smooth animations

---

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

### 2. Clone & Install

```bash
cd "Car Rental - App"
npm install
```

### 3. Set Up Environment Variables

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Set Up Database

1. Go to your Supabase project → **SQL Editor**
2. Run `supabase/schema.sql` (creates all tables, RLS policies, triggers)
3. Optionally run `supabase/seed.sql` (inserts demo suppliers, bookings, etc.)

### 5. Create Demo Users

In Supabase → **Authentication → Users → Add User**, create:

| Email | Password | Role (metadata) |
|-------|----------|-----------------|
| admin@fleetflow.demo | demo1234 | `{"role": "admin", "full_name": "Alexandra Chen"}` |
| manager@fleetflow.demo | demo1234 | `{"role": "manager", "full_name": "Marcus Johnson"}` |
| staff@fleetflow.demo | demo1234 | `{"role": "staff", "full_name": "Priya Patel"}` |
| finance@fleetflow.demo | demo1234 | `{"role": "finance", "full_name": "David Kim"}` |

After creating each user, copy their UUID and update the `seed.sql` profiles section to match.

### 6. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/login`.

---

## 🏗 Project Structure

```
├── app/
│   ├── (auth)/login/          # Login page
│   ├── (dashboard)/           # Protected dashboard area
│   │   ├── layout.tsx         # Sidebar + providers
│   │   ├── dashboard/         # Stats, charts, activity
│   │   ├── bookings/          # Booking management
│   │   ├── suppliers/         # Supplier directory
│   │   ├── approvals/         # Manager approval queue
│   │   ├── reports/           # Analytics & charts
│   │   ├── settings/          # User profile & preferences
│   │   └── users/             # User management (admin only)
│   ├── api/                   # REST API routes
│   │   ├── ai/                # AI assistant endpoint
│   │   ├── bookings/          # Bookings CRUD
│   │   ├── suppliers/         # Suppliers CRUD
│   │   ├── notifications/     # Notification management
│   │   └── dashboard/         # Dashboard stats
│   └── auth/callback/         # Supabase OAuth callback
├── components/
│   ├── layout/                # Sidebar, Topbar
│   ├── ui/                    # Badge, Modal, Toast, Spinner
│   ├── dashboard/             # Dashboard charts + content
│   ├── bookings/              # Booking list, modals
│   ├── suppliers/             # Supplier grid/table, modals
│   ├── approvals/             # Approval queue UI
│   ├── reports/               # Report charts
│   ├── settings/              # Settings forms
│   └── users/                 # User management table
├── lib/
│   ├── supabase/client.ts     # Browser Supabase client
│   ├── supabase/server.ts     # Server Supabase client
│   ├── ai.ts                  # AI functions (mock/real)
│   ├── notifications.ts       # Notification helpers
│   └── utils.ts               # Formatting, cn(), etc.
├── types/index.ts             # All TypeScript types
├── middleware.ts              # Auth guard
├── supabase/
│   ├── schema.sql             # Full DB schema
│   └── seed.sql               # Demo data
└── .env.example
```

---

## 🌐 Deploy to Vercel

```bash
npx vercel --prod
```

Or connect your GitHub repo in [Vercel Dashboard](https://vercel.com) and set environment variables there.

**Required env vars in Vercel:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL` (your Vercel URL)

---

## 🔑 Role Permissions

| Feature | Admin | Manager | Staff | Finance |
|---------|-------|---------|-------|---------|
| View all | ✅ | ✅ | ✅ | ✅ |
| Create bookings | ✅ | ✅ | ✅ | ❌ |
| Approve bookings | ✅ | ✅ | ❌ | ❌ |
| View reports | ✅ | ✅ | ❌ | ✅ |
| Manage suppliers | ✅ | ✅ | ❌ | ❌ |
| Manage users | ✅ | ❌ | ❌ | ❌ |
| Delete bookings | ✅ | ❌ | ❌ | ❌ |

---

## 🤖 AI Features

The AI assistant uses **mock functions by default**. To enable real OpenAI responses:

1. Add `OPENAI_API_KEY=sk-...` to `.env.local`
2. Update `lib/ai.ts` to make real API calls using the `OPENAI_AVAILABLE` flag

---

## 📧 Email Notifications

To enable real email sending (optional), add a [Resend](https://resend.com) API key:

```env
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v3 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Charts | Recharts |
| Icons | Lucide React |
| Forms | React Hook Form |
| Deployment | Vercel |
