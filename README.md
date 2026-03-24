# Climb Tracker

A mobile-friendly climbing gym tracker built with Next.js, Supabase Auth + database, and optional Cloudflare R2 photo storage.

## What This Version Does

- Create an account with email, password, and display name
- Sign in on a different device and keep the same climbs
- Log climbs with grades, modifiers, flash bonus, tags, notes, and photos
- Edit and delete climbs
- Track XP, levels, sends by grade, favorite style, and personal best
- Install to your phone home screen like an app

## Project Structure

- `app/page.tsx`: main app screen and auth flow
- `app/globals.css`: app styling
- `lib/supabase/client.ts`: browser Supabase client
- `lib/supabase-store.ts`: auth and database helpers
- `lib/local-store.ts`: photo upload helpers and local fallback pieces
- `lib/stats.ts`: totals, XP progress, personal best
- `lib/xp.ts`: grades, XP, levels
- `supabase/schema.sql`: database schema and security policies

## Exactly What To Click In Supabase

1. Go to [Supabase](https://supabase.com) and create a new project.
2. Wait for the project to finish provisioning.
3. In the left sidebar, click `Authentication`.
4. Click `Providers`.
5. Make sure `Email` is enabled.
6. Click `Email` settings.
7. Turn off `Confirm email` for now.
   This keeps setup simple while testing.
8. In the left sidebar, click `SQL Editor`.
9. Click `New query`.
10. Open [`supabase/schema.sql`](/C:/Users/jaron/OneDrive/Documents/Climb/supabase/schema.sql), copy all of it, paste it into Supabase, and click `Run`.
11. In the left sidebar, click `Project Settings`.
12. Click `API`.
13. Copy `Project URL`.
14. Copy the `anon public` key.

## Exactly What To Put In `.env.local`

Copy [`.env.example`](/C:/Users/jaron/OneDrive/Documents/Climb/.env.example) to `.env.local`.

At minimum, fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

If you want the `Delete account` button to fully remove the auth account too, also add:

```env
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

If you also want Cloudflare R2 photo storage, keep the R2 values too.

## Exactly What To Run

In `C:\Users\jaron\OneDrive\Documents\Climb`:

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Using It On Your Phone

Run:

```bash
npm run dev -- --hostname 0.0.0.0
```

Then find your local IP:

```bash
ipconfig
```

Open `http://YOUR-IP:3000` on your phone while it is on the same Wi-Fi.

## How Accounts Work

- Each account gets one profile
- Your profile is tied to your Supabase user ID
- Climbs belong to that account
- Signing in on another device loads the same climbs
- The Account menu lets you sign out, change your display name, and delete your account

## Free Plan Notes

Supabase Free is enough for testing and small friend groups.
The main limits you are likely to care about early are:

- up to `50,000` monthly active users
- `500 MB` database
- `1 GB` Supabase Storage if you ever use it

For this app, the first limit you hit is more likely photo storage than auth.

## Optional: Keep Cloudflare R2 For Photos

If you already set up R2, this app can still use it for photos.
That keeps image storage separate from Supabase and reduces the chance of filling browser storage.

## Good Next Step After Setup

1. Create your account
2. Log one climb
3. Sign out
4. Sign back in
5. Confirm the climb is still there
