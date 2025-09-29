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

### Local LLM (Ollama) Integration (Optional)

Enable a locally hosted model via [Ollama](https://ollama.com/) for private, offline-friendly generation. Falls back automatically to Gemini (if configured) or JSON intent responses.

```
OLLAMA_ENABLED=true
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

Steps:

1. Install Ollama from https://ollama.com
2. Pull a model (examples):
   - `ollama pull llama3.2`
   - `ollama pull mistral`
3. Start Ollama service (usually runs automatically):
   - macOS/Linux: it runs as a background service
   - Windows (WSL) example: `ollama serve`
4. Start the app `npm run dev`
5. Chat endpoint priority order:
   - Crisis intent → emergency JSON response
   - Ollama (if enabled & responds)
   - Gemini (if complex & configured with `GEMINI_API_KEY`)
   - JSON fallback intents (pattern matched)

If `OLLAMA_ENABLED` is false or the server is unreachable, the system gracefully proceeds to Gemini / fallback without crashing.

### Gemini Cloud Mode (Optional)

Add a hosted model option using Google Gemini. Set an API key in your environment:

```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-1.5-flash
```

Usage:

- In the chatbot page, choose `GEMINI` mode near the bottom input (Mode selector: AUTO / GEMINI / LOCAL).
- `AUTO` = Try local Ollama first, fallback to Gemini if configured.
- `GEMINI` = Force Gemini even if a local model is available.
- `LOCAL` = Only send a specific Ollama model (selected in dropdown) or env default.

Security: The API key is only read server‑side in `/api/chat`; the client never receives it.


#### Using Gemma Model

Gemma (Google lightweight models) can also be served through Ollama.

Pull a Gemma variant (examples):

```
ollama pull gemma:2b
ollama pull gemma:7b
```

Set globally via env:

```
OLLAMA_MODEL=gemma:2b
```

Or per request (overrides env) by adding a `model` field in the POST body to `/api/chat`:

```json
{
  "model": "gemma:2b",
  "messages": [{ "role": "user", "content": "Help me manage evening anxiety" }]
}
```

Response JSON will include `source": "ollama:gemma:2b"` when that model generated the answer.

### Dynamic Wellness Context & Safety Layer (Optional)

You can enable lightweight retrieval-augmented grounding for the AI chatbot using curated micro‑knowledge units (breathing, grounding, behavioral activation, etc.).

```
WELLNESS_DYNAMIC_CONTEXT=true
```

When enabled:

- The last user message is scanned for keywords and up to 3 matching wellness knowledge topics are embedded into the system prompt.
- Topics live in `src/data/wellnessKnowledge.ts` (compact summaries + micro‑strategies).
- A safety filter (`enforceWellnessSafety`) scrubs obviously disallowed patterns (medication dosage, self‑harm instructions, pseudo-diagnosis phrases).
- A consistent AI companion disclaimer is appended if missing.

Disable anytime by setting the flag to `false` or removing it.

### Speech Mode + Local Model Selection

The chatbot page includes a Speech mode (browser microphone + streaming transcription). You can also choose a local Ollama model while in Speech mode. When you stop recording, the transcribed text is sent to `/api/chat` with the selected `model` (if set) so the same local model pipeline is used as in text chat.

Behavior:

- Tap mic → live transcription (browser STT by default).
- Tap again → finalizes transcript, sends to backend.
- If `OLLAMA_ENABLED=true` the system attempts local generation first.
- Assistant reply is optionally converted to audio via `/api/tts`.

### Helpline / Hotline Keyword Assistance

If a user explicitly asks for a helpline/hotline (e.g. _"What is the suicide hotline?"_, _"Give me crisis helpline numbers"_) but the message does not trigger a crisis intent pattern, the response automatically appends a short curated list of support lines (988, Crisis Text Line, SAMHSA). Full crisis phrasing still routes through the higher-priority crisis branch with dedicated messaging and safety emphasis.

This logic lives in `src/app/api/chat/route.ts` and uses regex detection plus `wellnessFallback.getEmergencyResources()`.

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
