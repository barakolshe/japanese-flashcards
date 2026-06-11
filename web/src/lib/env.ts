/**
 * Central, validated configuration. This is the ONLY module that reads
 * `process.env`; everything else imports typed values from here.
 *
 * The Firebase web config arrives through `NEXT_PUBLIC_*` variables. These are
 * public by design — they identify the Firebase project and are embedded in the
 * client bundle; they are not secrets (access is governed by Firestore security
 * rules, not by hiding these values). Validation is lazy so a build that never
 * touches persistence still compiles; a missing variable only throws when the
 * app actually tries to reach Firestore.
 */

export type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy web/.env.example ` +
        `to web/.env.local and fill in your Firebase project's web config.`,
    );
  }
  return value;
}

/** Read and validate the Firebase web config. Throws if any value is missing. */
export function getFirebaseConfig(): FirebaseConfig {
  return {
    apiKey: required(
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    ),
    authDomain: required(
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    ),
    projectId: required(
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    ),
    storageBucket: required(
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    ),
    messagingSenderId: required(
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    ),
    appId: required(
      "NEXT_PUBLIC_FIREBASE_APP_ID",
      process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    ),
  };
}
