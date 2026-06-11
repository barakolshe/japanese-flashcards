import { getApp, getApps, initializeApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getFirebaseConfig } from "./env";

/**
 * Firebase wiring for the app. The whole project is single-user with no auth, so
 * there's nothing to sign in — we just initialize the app and hand out the
 * Firestore handle that {@link ./deck-storage} reads and writes through.
 */

let db: Firestore | null = null;

/**
 * Lazily initialize Firebase and return the Firestore handle. Initialization is
 * deferred to first use (not module load) so the config is only validated when
 * persistence is actually needed — a server render or build that never touches
 * Firestore won't fail for missing env vars. Reuses the existing app on repeat
 * calls (and across HMR reloads) instead of re-initializing.
 */
export function getDb(): Firestore {
  if (!db) {
    const app = getApps().length
      ? getApp()
      : initializeApp(getFirebaseConfig());
    db = getFirestore(app);
  }
  return db;
}
