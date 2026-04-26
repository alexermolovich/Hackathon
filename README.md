# SideHustle

Hackathon PoC for a cross-platform Expo app: a swipe-first local gig marketplace with Google/phone account creation, double opt-in hustles, BST currency, profile-driven discovery, and Firebase Auth/Firestore wiring.

## What is included

- Expo Router mobile app with Forge, Swipe, Hustles, Profile, onboarding, and locked Chat flows.
- BSTs (Blood, Sweat Tokens) for signup rewards, boost payments, purchases, and chat unlocks.
- Firestore-backed profiles, public profiles, gigs, matches, and messages.
- Repo-hosted demo image references, so demos do not require Firebase Storage.
- A Firestore seed script for demo profiles, gigs, and optional current-user hustles.
- NativeWind/Tailwind styling for the SideHustle dark/light theme.

## Run locally

```bash
npm install
npm run start
```

For iOS/Android dependencies that are Expo-versioned, this project pins compatible package versions in `package.json`.

## Firebase setup

1. Create or use a Firebase project with Auth and Firestore enabled.
2. Enable Google sign-in and phone sign-in in Firebase Auth.
3. Copy `.env.example` to `.env` and add your Firebase web app values.
4. Deploy or paste `firestore.rules` after seeding demo data.
4. Restart Expo so `EXPO_PUBLIC_*` variables are loaded.

Seed shared demo data:

```bash
npm run seed:firestore
```

Seed full current-user hustles after you know your Firebase Auth UID:

```bash
npm run seed:firestore -- --current-user=<firebase-auth-uid>
```
