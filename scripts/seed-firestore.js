/* global __dirname */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

function loadEnvFile(fileName) {
  const filePath = path.join(projectRoot, fileName);

  if (!fs.existsSync(filePath)) {
    return;
  }

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
    process.env[key] = process.env[key] || value;
  }
}

function readArg(name) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : null;
}

loadEnvFile('.env.local');
loadEnvFile('.env');

const now = new Date().toISOString();
const currentUserId = readArg('current-user') || process.env.DEMO_CURRENT_USER_ID || null;

const profileDefaults = {
  search_radius: 10,
  is_verified: true,
  is_onboarded: true,
  google_authenticated: true,
  phone_verified: true,
  accepted_terms_at: '2026-04-01T16:00:00.000Z',
  signup_bonus_awarded: true,
  weekly_streak: 1,
  monthly_streak: 0,
  last_reward_claimed_at: '2026-04-24T13:00:00.000Z',
  updated_at: now,
};

const demoProfiles = [
  {
    id: 'profile-aria',
    data: {
      ...profileDefaults,
      username: 'Aria Stone',
      avatar_url: 'repo://demo/avatars/aria-stone.png',
      bio: 'Verified gig starter with same-day event and home tasks.',
      skills: ['Events', 'Hospitality', 'Delivery'],
      interests: ['Events', 'Hospitality', 'Delivery', 'Cleaning', 'Errands'],
      credits: 32,
      location: { latitude: 44.0871, longitude: -103.2216 },
      phone_number: '+16055550184',
      birth_date: '1994-03-12',
      education_level: 'Bachelor degree',
      daily_streak: 13,
      vouch_count: 17,
      posted_vouch_count: 29,
      rating: 4.84,
    },
  },
  {
    id: 'profile-milo',
    data: {
      ...profileDefaults,
      username: 'Milo Reyes',
      avatar_url: 'repo://demo/avatars/milo-reyes.png',
      bio: 'Handyman, installer, and weekend problem solver.',
      skills: ['Handywork', 'Tech Setup', 'Assembly'],
      interests: ['Handywork', 'Tech Setup', 'Assembly', 'Moving', 'Yard Work'],
      credits: 9,
      location: { latitude: 44.0696, longitude: -103.2458 },
      phone_number: '+16055550149',
      birth_date: '1991-11-08',
      education_level: 'Trade certification',
      daily_streak: 21,
      weekly_streak: 3,
      vouch_count: 41,
      posted_vouch_count: 18,
      rating: 4.96,
    },
  },
  {
    id: 'profile-sage',
    data: {
      ...profileDefaults,
      username: 'Sage Kim',
      avatar_url: 'repo://demo/avatars/sage-kim.png',
      bio: 'Detail-focused cleaner and organizer.',
      skills: ['Cleaning', 'Organizing', 'Errands'],
      interests: ['Cleaning', 'Organizing', 'Errands', 'Pet Care', 'Admin'],
      credits: 14,
      location: { latitude: 44.1048, longitude: -103.2371 },
      phone_number: '+16055550190',
      birth_date: '1997-05-22',
      education_level: 'Some college',
      daily_streak: 8,
      vouch_count: 36,
      posted_vouch_count: 14,
      rating: 4.88,
    },
  },
  {
    id: 'profile-juno',
    data: {
      ...profileDefaults,
      username: 'Juno Patel',
      avatar_url: 'repo://demo/avatars/juno-patel.png',
      bio: 'Reliable mover with a dolly and compact SUV.',
      skills: ['Moving', 'Delivery', 'Assembly'],
      interests: ['Moving', 'Delivery', 'Assembly', 'Events', 'Auto Help'],
      credits: 11,
      location: { latitude: 44.052, longitude: -103.1937 },
      phone_number: '+16055550132',
      birth_date: '1996-09-01',
      education_level: 'Associate degree',
      daily_streak: 30,
      weekly_streak: 4,
      monthly_streak: 1,
      vouch_count: 53,
      posted_vouch_count: 9,
      rating: 4.98,
    },
  },
];

const demoTasks = [
  {
    id: 'task-setup-booth',
    data: {
      poster_id: 'profile-aria',
      title: 'Set up a pop-up booth downtown',
      description: 'Unload two folding tables, stage product trays, and run a compact checkout stand before doors open.',
      budget: 92,
      category: 'Events',
      location_label: 'Downtown Rapid City',
      location: { latitude: 44.0814, longitude: -103.2295 },
      required_skills: ['Events', 'Moving', 'Tech Setup', 'Hospitality'],
      image_urls: ['repo://demo/gigs/pop-up-booth.png'],
      is_boosted: true,
      boost_days: 3,
      boost_cost_bsts: 9,
      date_window: 'Apr 27, 8:00 AM - 10:00 AM',
      status: 'open',
      created_at: '2026-04-24T17:00:00.000Z',
      updated_at: now,
    },
  },
  {
    id: 'task-router',
    data: {
      poster_id: 'profile-milo',
      title: 'Install mesh Wi-Fi and tidy cables',
      description: 'Three-node mesh kit is already purchased. Need setup, speed test, and cable routing behind the media console.',
      budget: 75,
      category: 'Tech Setup',
      location_label: 'West Boulevard area',
      location: { latitude: 44.0687, longitude: -103.2479 },
      required_skills: ['Tech Setup', 'Handywork'],
      image_urls: ['repo://demo/gigs/mesh-wifi.png'],
      is_boosted: true,
      boost_days: 2,
      boost_cost_bsts: 6,
      date_window: 'Apr 26 - Apr 28',
      status: 'open',
      created_at: '2026-04-24T18:10:00.000Z',
      updated_at: now,
    },
  },
  {
    id: 'task-studio-reset',
    data: {
      poster_id: 'profile-sage',
      title: 'Reset photo studio after shoot',
      description: 'Sweep, pack two softboxes, wipe counters, and move a backdrop stand into storage.',
      budget: 64,
      category: 'Cleaning',
      location_label: 'North Rapid studio row',
      location: { latitude: 44.1032, longitude: -103.2386 },
      required_skills: ['Cleaning', 'Moving', 'Organizing'],
      image_urls: ['repo://demo/gigs/studio-reset.png'],
      is_boosted: false,
      boost_days: 0,
      boost_cost_bsts: 0,
      date_window: 'Finished Apr 23',
      status: 'archived',
      created_at: '2026-04-24T15:25:00.000Z',
      updated_at: now,
    },
  },
  {
    id: 'task-market-run',
    data: {
      poster_id: 'profile-aria',
      title: 'Pick up catering boxes',
      description: 'Grab prepaid catering boxes and deliver to a venue lobby between 4:00 and 4:30.',
      budget: 48,
      category: 'Errands',
      location_label: 'East North Street',
      location: { latitude: 44.0848, longitude: -103.1984 },
      required_skills: ['Delivery', 'Errands', 'Events'],
      image_urls: ['repo://demo/gigs/catering-run.png'],
      is_boosted: false,
      boost_days: 0,
      boost_cost_bsts: 0,
      date_window: 'Apr 27, 4:00 PM - 4:30 PM',
      status: 'open',
      created_at: '2026-04-24T14:00:00.000Z',
      updated_at: now,
    },
  },
  {
    id: 'task-patio',
    data: {
      poster_id: 'profile-milo',
      title: 'Assemble patio chairs',
      description: 'Four boxed chairs, tools provided. Prefer someone who can finish today and take packaging to the trash room.',
      budget: 58,
      category: 'Assembly',
      location_label: 'Robbinsdale',
      location: { latitude: 44.0482, longitude: -103.2564 },
      required_skills: ['Assembly', 'Handywork', 'Moving'],
      image_urls: ['repo://demo/gigs/patio-assembly.png'],
      is_boosted: false,
      boost_days: 0,
      boost_cost_bsts: 0,
      date_window: 'Apr 25 - Apr 26',
      status: 'open',
      created_at: '2026-04-24T13:15:00.000Z',
      updated_at: now,
    },
  },
];

function publicProfile(profile) {
  const publicData = { ...profile };
  delete publicData.phone_number;
  delete publicData.birth_date;
  delete publicData.education_level;
  delete publicData.accepted_terms_at;
  delete publicData.signup_bonus_awarded;
  delete publicData.credits;
  delete publicData.daily_streak;
  delete publicData.weekly_streak;
  delete publicData.monthly_streak;
  delete publicData.last_reward_claimed_at;
  return publicData;
}

function personalizedSeed() {
  if (!currentUserId) {
    return { profiles: [], publicProfiles: [], tasks: [], matches: [], messages: [] };
  }

  const suffix = currentUserId.slice(0, 8).toLowerCase();
  const currentProfile = {
    ...profileDefaults,
    username: 'Demo Hustler',
    avatar_url: 'repo://demo/avatars/demo-hustler.png',
    bio: 'Seeded collaborator account for full-flow SideHustle demos.',
    skills: ['Tech Setup', 'Cleaning', 'Organizing', 'Moving', 'Events'],
    interests: ['Tech Setup', 'Cleaning', 'Organizing', 'Moving', 'Events'],
    credits: 40,
    location: { latitude: 44.0805, longitude: -103.231 },
    phone_number: '+16055550100',
    birth_date: '1995-06-15',
    education_level: 'Some college',
    daily_streak: 6,
    vouch_count: 24,
    posted_vouch_count: 8,
    rating: 4.92,
  };
  const userTaskId = `task-${suffix}-garage`;
  const matchLockedId = `match-${suffix}-locked-chat`;
  const matchPosterReviewId = `match-${suffix}-poster-review`;
  const matchCompletedId = `match-${suffix}-completed`;

  const tasks = [
    {
      id: userTaskId,
      data: {
        poster_id: currentUserId,
        title: 'Help sort a garage shelf',
        description: 'One-hour organization sprint. Move bins, label holiday boxes, and bring light donation bags to the curb.',
        budget: 42,
        category: 'Organizing',
        location_label: 'Founders Park',
        location: { latitude: 44.0805, longitude: -103.231 },
        required_skills: ['Organizing', 'Moving'],
        image_urls: ['repo://demo/gigs/garage-sort.png'],
        is_boosted: false,
        boost_days: 0,
        boost_cost_bsts: 0,
        date_window: 'Apr 26, flexible',
        status: 'open',
        created_at: '2026-04-24T12:15:00.000Z',
        updated_at: now,
      },
    },
  ];
  const matches = [
    {
      id: matchLockedId,
      data: {
        task_id: 'task-router',
        poster_id: 'profile-milo',
        doer_id: currentUserId,
        participant_ids: ['profile-milo', currentUserId],
        bid_note: 'I can knock this out after lunch and verify speeds on each floor.',
        counter_bid: 80,
        availability_window: 'Apr 26, 1:00 PM - 4:00 PM',
        is_unlocked: false,
        status: 'matched',
        created_at: '2026-04-24T19:00:00.000Z',
        updated_at: now,
      },
    },
    {
      id: matchPosterReviewId,
      data: {
        task_id: userTaskId,
        poster_id: currentUserId,
        doer_id: 'profile-juno',
        participant_ids: [currentUserId, 'profile-juno'],
        bid_note: 'I have a dolly and can be there in 25 minutes.',
        counter_bid: 46,
        availability_window: 'Apr 26, 11:00 AM - 1:00 PM',
        is_unlocked: false,
        status: 'pending',
        created_at: '2026-04-24T18:45:00.000Z',
        updated_at: now,
      },
    },
    {
      id: matchCompletedId,
      data: {
        task_id: 'task-studio-reset',
        poster_id: 'profile-sage',
        doer_id: currentUserId,
        participant_ids: ['profile-sage', currentUserId],
        bid_note: 'I have event reset experience and can bring microfiber cloths.',
        counter_bid: 64,
        availability_window: 'Apr 23, 6:00 PM - 8:00 PM',
        is_unlocked: true,
        status: 'completed',
        created_at: '2026-04-23T21:30:00.000Z',
        updated_at: now,
      },
    },
  ];
  const messages = [
    {
      id: `message-${suffix}-router-1`,
      data: {
        match_id: matchLockedId,
        task_id: 'task-router',
        sender_id: 'profile-milo',
        participant_ids: ['profile-milo', currentUserId],
        content: 'Great profile. I liked you back for the Wi-Fi install.',
        created_at: '2026-04-24T19:02:00.000Z',
      },
    },
    {
      id: `message-${suffix}-studio-1`,
      data: {
        match_id: matchCompletedId,
        task_id: 'task-studio-reset',
        sender_id: 'profile-sage',
        participant_ids: ['profile-sage', currentUserId],
        content: 'Thanks again. Studio was spotless.',
        created_at: '2026-04-23T23:20:00.000Z',
      },
    },
  ];

  return {
    profiles: [{ id: currentUserId, data: currentProfile }],
    publicProfiles: [{ id: currentUserId, data: publicProfile(currentProfile) }],
    tasks,
    matches,
    messages,
  };
}

async function main() {
  const requiredKeys = [
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID',
  ];
  const missingKeys = requiredKeys.filter((key) => !process.env[key]);

  if (missingKeys.length > 0) {
    throw new Error(`Missing Firebase env vars: ${missingKeys.join(', ')}`);
  }

  const { initializeApp } = await import('firebase/app');
  const { doc, getFirestore, writeBatch } = await import('firebase/firestore');
  const app = initializeApp({
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  });
  const db = getFirestore(app);
  const personalized = personalizedSeed();
  const batch = writeBatch(db);

  for (const profile of [...demoProfiles, ...personalized.profiles]) {
    batch.set(doc(db, 'profiles', profile.id), profile.data, { merge: true });
    batch.set(doc(db, 'public_profiles', profile.id), publicProfile(profile.data), { merge: true });
  }

  for (const profile of personalized.publicProfiles) {
    batch.set(doc(db, 'public_profiles', profile.id), profile.data, { merge: true });
  }

  for (const task of [...demoTasks, ...personalized.tasks]) {
    batch.set(doc(db, 'tasks', task.id), task.data, { merge: true });
  }

  for (const match of personalized.matches) {
    batch.set(doc(db, 'matches', match.id), match.data, { merge: true });
  }

  for (const message of personalized.messages) {
    batch.set(doc(db, 'messages', message.id), message.data, { merge: true });
  }

  await batch.commit();
  console.log(
    `Seeded ${demoProfiles.length + personalized.profiles.length} profiles, ${
      demoTasks.length + personalized.tasks.length
    } tasks, ${personalized.matches.length} matches, and ${personalized.messages.length} messages.`,
  );

  if (!currentUserId) {
    console.log('Tip: pass --current-user=<firebase auth uid> to seed ready/pending/completed hustles for a real account.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
