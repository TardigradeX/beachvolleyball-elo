/**
 * Seed script — creates demo players in Firebase.
 *
 * Against the local emulator (default):
 *   npm run seed
 *
 * Against production Firebase (after deploying):
 *   npm run seed:prod
 *
 * Requires emulators to be running for the local variant:
 *   firebase emulators:start
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  connectAuthEmulator,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  setDoc,
  Timestamp,
  connectFirestoreEmulator,
} from "firebase/firestore";

// ── Config ────────────────────────────────────────────────────────────────────

const isProd = process.argv.includes("--prod");

function loadEnv() {
  const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.env.local");
  const raw = readFileSync(envPath, "utf-8");
  return Object.fromEntries(
    raw.split("\n")
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#"))
      .map(line => line.split("=").map(s => s.trim()))
      .filter(([k]) => k)
      .map(([k, ...rest]) => [k, rest.join("=")])
  );
}

let firebaseConfig;

if (isProd) {
  const env = loadEnv();
  firebaseConfig = {
    apiKey:            env.VITE_FIREBASE_API_KEY,
    authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             env.VITE_FIREBASE_APP_ID,
  };
} else {
  firebaseConfig = { apiKey: "demo", projectId: "beachvolleyball-elo" };
}

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

if (!isProd) {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
}

// ── Player definitions ────────────────────────────────────────────────────────

const PASSWORD = "passwordTest";

const players = [
  // Male players
  { name: "Lars",   email: "lars@demo.com",   gender: "male"   },
  { name: "Tom",    email: "tom@demo.com",    gender: "male"   },
  { name: "Finn",   email: "finn@demo.com",   gender: "male"   },
  { name: "Max",    email: "max@demo.com",    gender: "male"   },
  { name: "Ben",    email: "ben@demo.com",    gender: "male"   },
  { name: "Noah",   email: "noah@demo.com",   gender: "male"   },
  // Female players
  { name: "Sara",   email: "sara@demo.com",   gender: "female" },
  { name: "Lisa",   email: "lisa@demo.com",   gender: "female" },
  { name: "Mia",    email: "mia@demo.com",    gender: "female" },
  { name: "Emma",   email: "emma@demo.com",   gender: "female" },
  { name: "Lena",   email: "lena@demo.com",   gender: "female" },
  { name: "Julia",  email: "julia@demo.com",  gender: "female" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function createPlayer({ name, email, gender }) {
  const cred = await createUserWithEmailAndPassword(auth, email, PASSWORD);
  await updateProfile(cred.user, { displayName: name });

  await setDoc(doc(db, "players", cred.user.uid), {
    uid:              cred.user.uid,
    displayName:      name,
    displayNameLower: name.toLowerCase(),
    email,
    photoUrl:         null,
    gender,
    eloGender:        1000,
    eloMixed:         1000,
    gamesPlayed:      0,
    wins:             0,
    losses:           0,
    winsGender:       0,
    lossesGender:     0,
    winsMixed:        0,
    lossesMixed:      0,
    createdAt:        Timestamp.now(),
  });

  console.log(`  ✓  ${gender === "male" ? "♂" : "♀"}  ${name.padEnd(8)} — ${email}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\nSeeding demo players into ${isProd ? "🚀 PRODUCTION" : "🧪 emulator"}…\n`);

if (isProd) {
  console.log("  ⚠️  This will create real Firebase Auth users.\n");
}

let ok = 0;
let fail = 0;

for (const p of players) {
  try {
    await createPlayer(p);
    ok++;
  } catch (err) {
    const msg = err?.code === "auth/email-already-in-use"
      ? "already exists, skipped"
      : err.message;
    console.log(`  ✗  ${p.name.padEnd(8)} — ${msg}`);
    fail++;
  }
}

console.log(`\nDone. ${ok} created, ${fail} skipped/failed.\n`);
process.exit(0);
