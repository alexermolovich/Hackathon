# SideHustle

Hackathon PoC for a cross-platform Expo app: a swipe-first local gig marketplace with Google/phone account creation, double opt-in hustles, BST currency, profile-driven discovery, and Supabase/PostGIS wiring.

## What is included

- Expo Router mobile app with Forge, Swipe, Hustles, Profile, onboarding, and locked Chat flows.
- BSTs (Blood, Sweat Tokens) for signup rewards, streak rewards, boost payments, purchases, and chat unlocks.
- Mock data fallback so the app demos immediately.
- Supabase client that activates when `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set.
- PostGIS schema and RPCs in `supabase/schema.sql`.
- NativeWind/Tailwind styling for the SideHustle dark/light theme.

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

The app keeps using seeded demo data until those environment variables are present.
