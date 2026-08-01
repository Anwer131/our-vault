# OurSpace — Private Media App (Postgres)

Multi-space private media app. A superadmin creates spaces with N members. Each member gets an auto-generated slug username and default password `welcome123`, forced to change on first login. All content is scoped per space.

## Roles
- **Superadmin** (`admin` / `admin123`, must change on first login) — creates/deletes spaces, sees all spaces + member credentials.
- **Member** — auto-provisioned by admin. Belongs to exactly one space. Sees only their space's gallery, chat, scribble, AI-generated art. Can set private nicknames for other members in their space.

## Features
- **Auth**: JWT; forced password change on first login (both admin & member).
- **Superadmin dashboard** (`/(admin)/spaces`): list + create + delete spaces. Create modal takes name + member count and returns generated credentials to share.
- **Gallery**: staggered grid + "Add Photos / Videos" button at top of the tab, long-press or Select multi-select → bulk delete or "Create with AI".
- **Upload**: single & multi photo/video → Cloudinary (signed) → Postgres metadata (space-scoped).
- **Chat**: space-only, polled every 4s.
- **Scribble**: SVG canvas (6 colors, 4 brush sizes) → saved to space's gallery.
- **AI Studio**: pick photos + prompt → Gemini `gemini-2.5-flash-image` → new image saved to gallery.
- **Profile**: edit name, mobile. Set private per-target nicknames for other members. Change password. Logout.

## Tech
- Backend: FastAPI + SQLAlchemy 2 (async) + asyncpg. Supabase Postgres via the **session pooler** (aws-0-ap-northeast-1.pooler.supabase.com:5432) because Supabase direct URL is IPv6-only.
- Frontend: Expo Router v6 with route groups `(admin)` and `(tabs)`. Fraunces (display) + Nunito (body) loaded via expo-font.
- Storage: Cloudinary for photos/videos/scribble/AI. Postgres for users, spaces, media, messages, nicknames.
- AI: `google-genai` with user's own Gemini API key.

## Env keys
- `DATABASE_URL` (asyncpg pooler URL)
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
- `GEMINI_API_KEY`
- `JWT_SECRET`
