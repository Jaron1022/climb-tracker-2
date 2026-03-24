# Climb Tracker

A simple mobile-friendly climbing gym progress tracker built with Next.js and Supabase.

## What this version includes

- Create a profile with a display name
- Log climbs with a photo, grade, style tags, an optional description, optional notes, status, and date
- View a personal climb feed
- See simple stats and a beginner-friendly XP system
- Load seed data so the app feels real immediately

## Project structure

This project is intentionally small:

- `app/page.tsx`: the whole main screen
- `app/globals.css`: the app styling
- `lib/supabase/client.ts`: talks to Supabase
- `lib/stats.ts`: calculates totals and favorites
- `lib/xp.ts`: XP, level, and next-grade logic
- `supabase/schema.sql`: database tables, policies, and storage bucket
- `supabase/seed.sql`: sample test data

## Exactly what to click in Supabase

1. Go to [https://supabase.com](https://supabase.com) and sign in.
2. Click `New project`.
3. Choose your organization.
4. Enter a project name like `climb-tracker`.
5. Set a database password and save it somewhere safe.
6. Choose a region close to you.
7. Click `Create new project`.
8. Wait for the project to finish provisioning.

## Set up the database

1. In Supabase, click `SQL Editor`.
2. Click `New query`.
3. Open the file [`schema.sql`](/C:/Users/jaron/OneDrive/Documents/Climb/supabase/schema.sql).
4. Copy everything in that file.
5. Paste it into the SQL editor.
6. Click `Run`.
7. Click `SQL Editor` again.
8. Click `New query`.
9. Open the file [`seed.sql`](/C:/Users/jaron/OneDrive/Documents/Climb/supabase/seed.sql).
10. Copy everything in that file.
11. Paste it into the SQL editor.
12. Click `Run`.

## Get your Supabase keys

1. In Supabase, click `Project Settings`.
2. Click `API`.
3. Copy the `Project URL`.
4. Copy the `anon public` key.

## Create your local environment file

1. In this project folder, duplicate `.env.example`.
2. Rename the copy to `.env.local`.
3. Replace the example values with your real Supabase values.

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=https://abc123.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Run the app

1. Open a terminal in this folder:
   `C:\Users\jaron\OneDrive\Documents\Climb`
2. Run:

```bash
npm install
npm run dev
```

3. Wait for Next.js to print a local address.
4. Open [http://localhost:3000](http://localhost:3000).

## What you should test first

1. Tap the profile chips to switch users.
2. Confirm you can see the seed climbs in the feed.
3. Create your own profile.
4. Log a climb with just a grade, or add a description and notes if they help.
5. Upload a photo.
6. Check that the XP and level change when a climb is marked `completed`.

## If "Create profile" fails

If clicking `Create profile` shows an error banner, the most common causes are:

1. `schema.sql` was not run in Supabase yet.
2. `.env.local` has the wrong project URL or anon key.
3. The app was not restarted after editing `.env.local`.

Quick fix checklist:

1. In Supabase, open `SQL Editor`.
2. Re-run [schema.sql](/C:/Users/jaron/OneDrive/Documents/Climb/supabase/schema.sql).
3. Re-run [seed.sql](/C:/Users/jaron/OneDrive/Documents/Climb/supabase/seed.sql).
4. Check `.env.local` carefully.
5. Stop the terminal and run `npm run dev` again.

## How version 1 handles "current user"

This starter does **not** include login yet.

Instead, the app stores your selected profile ID in your browser on that device. That keeps version 1 much easier to understand and set up. If you want, the next version can add real Supabase authentication.

## Notes

- The photo bucket is named `climb-photos`.
- The storage bucket is public in this starter so photo URLs work simply.
- The row-level security policies are open enough for local testing with the anonymous key.
- Before deploying publicly, we should tighten security and add auth.
