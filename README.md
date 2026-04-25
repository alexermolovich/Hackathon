# GigSwipe

Hackathon PoC for a cross-platform Expo app: a dark, swipe-first local gig marketplace with double opt-in matching, selfie verification, credit-gated chat, and Supabase/PostGIS wiring.

## What is included

- Expo Router mobile app with Deck, Matches, Post, Profile, and locked Chat screens.
- Mock data fallback so the app demos immediately.
- Supabase client that activates when `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set.
- PostGIS schema and RPCs in `supabase/schema.sql`.
- NativeWind/Tailwind configuration for the Stealth Dark UI.

## Run locally

```bash
npm install
npm run start
```

For iOS/Android dependencies that are Expo-versioned, this project pins compatible package versions in `package.json`.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Copy `.env.example` to `.env` and add your project URL and anon key.
4. Restart Expo so `EXPO_PUBLIC_*` variables are loaded.

The app will keep using seeded demo data until those environment variables are present.
