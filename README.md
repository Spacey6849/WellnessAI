<div align="center">
  <h1>AI-Driven Mental Wellness Resource Platform</h1>
  <p>Personalized mental wellness companion: curated resources, community spaces, intelligent session booking, and contextual AI support.</p>
</div>

---

## 🎯 Description

An AI‑assisted mental wellness platform that lets users explore curated resources, join a supportive community, and seamlessly schedule virtual therapy sessions with Google Meet integration. Admin and user modes enable moderated, role‑aware interactions.

## ✨ Core Features

- Smart therapist booking with real‑time availability, slot conflict prevention, and automatic Google Meet + Calendar event creation (user OAuth or service account fallback).
- Hybrid authentication: credential-based (local/Supabase style) for login/signup; Google OAuth restricted to the booking flow for calendar/Meet permissions.
- Community section for discussion & peer support (role‑aware groundwork in place for future moderation tools).
- AI companion / chatbot entry point (scaffold present for contextual assistance & note drafting).
- Curated wellness resources dataset with category tagging & fast client filtering.
- Daily inspirational quote caching (server-side) to avoid redundant external calls.
- Email notifications to therapist and user with session details & Meet link.
- Accessible, responsive, keyboard-friendly UI with subtle motion & gradient theming (TailwindCSS + custom components).

## 🛠️ Technologies Used

- **Next.js (App Router)** – React server & client components, route handlers.
- **TypeScript** – Strong typing across API, hooks, and components.
- **NextAuth (Google OAuth)** – Limited to booking flow for calendar scope & token refresh.
- **(Hybrid) Supabase-style logic** – Credential & role modeling pattern (admin/user) via custom session hook.
- **PostgreSQL** – Bookings, therapists, quotes, community tables (Supabase admin client utilities).
- **Google Calendar & Meet API** – Event + conference creation (user token first, service account fallback).
- **Tailwind CSS** – Design system & rapid custom styling.
- **Nodemailer** – SMTP transactional emails (therapist + user confirmations).
- **Lucide Icons** – Consistent iconography.

## 📁 Key Directories

```
src/app/booking         # Booking flow UI & logic
src/app/api/*           # Route handlers (auth, bookings, meet, therapists)
src/components          # Reusable UI (navbar, theme, auth overlay)
src/lib                 # Helpers (sessions, mailer, calendar, supabase)
src/data                # Static curated resource dataset
```

## 🔐 Authentication Model

| Area                        | Method                            | Notes                                          |
| --------------------------- | --------------------------------- | ---------------------------------------------- |
| Login / Signup overlay      | Credential (local/Supabase style) | Provides user/admin mode for platform access   |
| Booking (Plan your session) | Google OAuth (NextAuth)           | Required for calendar.events scope & Meet link |
| Email notifications         | SMTP                              | Optional – gracefully degrades with warnings   |

## ⚙️ Environment Variables

Create a `.env.local` file (never commit). Only define what you need; unused features degrade gracefully.

### Google OAuth (User Calendar / Meet)

```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=your_long_random_string
NEXTAUTH_URL=http://localhost:3000
```

### (Optional) Service Account Fallback (if user token absent)

```
GOOGLE_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=your_calendar_id@group.calendar.google.com
```

### SMTP (Email Notifications)

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_user
SMTP_PASS=your_pass
SMTP_FROM="Wellness Platform <no-reply@example.com>"
```

### Database / Admin (if using Supabase style admin client)

```
SUPABASE_SERVICE_ROLE=...
SUPABASE_URL=...
```

## 🚀 How to Run

1. Clone this repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env.local` with the variables you need (see above).
4. Start the dev server:
   ```bash
   npm run dev
   ```
5. Open: http://localhost:3000
6. Navigate to /booking to test Google OAuth flow and Meet link generation.

### Production Build

```bash
npm run build
npm start
```

## 🧪 Booking Flow Lifecycle

1. User picks therapist → date → slot.
2. User authenticates with Google inside booking container (if not already).
3. API `/api/bookings` attempts event creation with user’s Google token; falls back to service account if configured.
4. Event + Meet URL stored in DB; therapist + user receive emails (if SMTP configured).
5. UI surfaces Meet link immediately after confirmation.

## 🛡️ Role Mode (User/Admin)

The auth overlay exposes a toggle (user/admin). Admin pathways are scaffolded for future moderation dashboards & elevated management actions (e.g., community post curation, therapist onboarding). Extend by attaching role checks to API handlers & DB policies.

## 🧰 Extensibility Ideas

- Integrate mood tracking & personalized therapist ranking.
- Add RLS + actual Supabase user auth + password reset flows.
- AI summarization of session notes (secure ephemeral processing).
- Calendar reschedule & cancellation endpoints with email updates.
- Rate limiting + audit logging for booking abuse prevention.

## ⚠️ Troubleshooting

| Issue                             | Likely Cause                             | Fix                                           |
| --------------------------------- | ---------------------------------------- | --------------------------------------------- |
| Missing Meet link                 | No calendar scope or invalid token       | Re-auth Google; verify calendar.events scope  |
| 403 on event create               | Calendar not shared with service account | Share calendar & give "Make changes" rights   |
| invalid_grant for service account | Broken private key formatting            | Ensure `\n` escapes preserved in env          |
| Emails not sent                   | SMTP vars incomplete                     | Provide host, port, credentials               |
| Slot conflict (409)               | Race condition                           | Pick another slot; list updates automatically |

## 👥 Team Members

- **Moses Rodrigues** – Frontend / UX Engineering ([spacey6849](https://github.com/spacey6849))
- **Ved Rankale** – Backend / API & Integrations ([ved1313](https://github.com/ved1313))
- **Shreyash Sawant** – Database & Data Architecture ([Donkiller30](https://github.com/Donkiller30))

## 📝 License

MIT (see `LICENSE`)

---

> Built with care for clarity, calm, and incremental improvement.
