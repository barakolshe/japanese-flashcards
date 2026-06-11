import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Deck } from "./deck";

/**
 * The storage layer talks to Firestore through the modular SDK. We mock both the
 * `getDb` handle and the handful of `firebase/firestore` functions it uses with a
 * tiny in-memory store keyed by document path, so these tests exercise the real
 * validation and payload-shaping logic without a network or a live project.
 */

const DECK_PATH = "flashcards/deck";
const FRONT_PATH = "flashcards/front";

const mocks = vi.hoisted(() => ({
  // Swappable so a single test can make Firestore "fail".
  getDb: vi.fn(() => ({}) as unknown),
  store: new Map<string, Record<string, unknown>>(),
}));

vi.mock("./firebase", () => ({
  getDb: () => mocks.getDb(),
}));

vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, collection: string, id: string) => ({
    path: `${collection}/${id}`,
  }),
  getDoc: async (ref: { path: string }) => {
    const data = mocks.store.get(ref.path);
    return { exists: () => data !== undefined, data: () => data };
  },
  setDoc: async (ref: { path: string }, data: Record<string, unknown>) => {
    mocks.store.set(ref.path, data);
  },
  deleteDoc: async (ref: { path: string }) => {
    mocks.store.delete(ref.path);
  },
}));

const {
  clearStoredDeck,
  loadStoredDeck,
  loadStoredFront,
  saveDeck,
  saveFront,
} = await import("./deck-storage");

const sampleDeck: Deck = {
  cards: [
    { id: "1", japanese: "犬", english: "dog", collection: "Animals" },
    { id: "2", japanese: "猫", english: "cat", collection: "Animals" },
  ],
  collections: ["Animals", "Phrases"],
  folders: [{ name: "Nature", collections: ["Animals"] }],
};

beforeEach(() => {
  mocks.store.clear();
  mocks.getDb.mockReset();
  mocks.getDb.mockReturnValue({} as unknown);
});

describe("saveDeck / loadStoredDeck", () => {
  it("round-trips a deck through storage", async () => {
    await saveDeck(sampleDeck);
    expect(await loadStoredDeck()).toEqual(sampleDeck);
  });

  it("stores a versioned payload, not the bare deck", async () => {
    await saveDeck(sampleDeck);
    const stored = mocks.store.get(DECK_PATH)!;
    expect(stored.version).toBe(2);
    expect(stored.deck).toEqual(sampleDeck);
  });

  it("returns null when nothing is stored", async () => {
    expect(await loadStoredDeck()).toBeNull();
  });
});

describe("loadStoredDeck validation", () => {
  it("discards a payload from an unknown future version", async () => {
    mocks.store.set(DECK_PATH, { version: 99, deck: sampleDeck });
    expect(await loadStoredDeck()).toBeNull();
  });

  it("discards a deck with the wrong card shape", async () => {
    mocks.store.set(DECK_PATH, {
      version: 2,
      deck: { cards: [{ id: "1", japanese: "犬" }], collections: [], folders: [] },
    });
    expect(await loadStoredDeck()).toBeNull();
  });

  it("discards a deck whose collections aren't all strings", async () => {
    mocks.store.set(DECK_PATH, {
      version: 2,
      deck: { cards: [], collections: [1, 2], folders: [] },
    });
    expect(await loadStoredDeck()).toBeNull();
  });

  it("discards a deck whose folders are malformed", async () => {
    mocks.store.set(DECK_PATH, {
      version: 2,
      deck: { cards: [], collections: [], folders: [{ name: "x" }] },
    });
    expect(await loadStoredDeck()).toBeNull();
  });
});

describe("loadStoredDeck migration", () => {
  it("migrates a version-1 deck to the collection/folder shape", async () => {
    mocks.store.set(DECK_PATH, {
      version: 1,
      deck: {
        cards: [
          { id: "1", japanese: "犬", english: "dog", folder: "Animals" },
          { id: "2", japanese: "本", english: "book", folder: "Objects" },
        ],
        folders: ["Animals", "Objects", "Empty"],
      },
    });

    expect(await loadStoredDeck()).toEqual({
      cards: [
        { id: "1", japanese: "犬", english: "dog", collection: "Animals" },
        { id: "2", japanese: "本", english: "book", collection: "Objects" },
      ],
      collections: ["Animals", "Objects", "Empty"],
      folders: [],
    });
  });

  it("discards a version-1 payload that doesn't match the old shape", async () => {
    mocks.store.set(DECK_PATH, {
      version: 1,
      deck: { cards: [{ id: "1", japanese: "犬" }], folders: [] },
    });
    expect(await loadStoredDeck()).toBeNull();
  });
});

describe("clearStoredDeck", () => {
  it("removes a saved deck", async () => {
    await saveDeck(sampleDeck);
    await clearStoredDeck();
    expect(await loadStoredDeck()).toBeNull();
  });

  it("leaves the saved direction untouched", async () => {
    await saveDeck(sampleDeck);
    await saveFront("english");
    await clearStoredDeck();
    expect(await loadStoredFront()).toBe("english");
  });
});

describe("saveFront / loadStoredFront", () => {
  it("round-trips the chosen direction", async () => {
    await saveFront("english");
    expect(await loadStoredFront()).toBe("english");
    await saveFront("japanese");
    expect(await loadStoredFront()).toBe("japanese");
  });

  it("returns null when nothing is stored", async () => {
    expect(await loadStoredFront()).toBeNull();
  });

  it("discards an unrecognized value", async () => {
    mocks.store.set(FRONT_PATH, { front: "sideways" });
    expect(await loadStoredFront()).toBeNull();
  });
});

describe("when Firestore is unavailable", () => {
  beforeEach(() => {
    // Simulate a missing config / offline / denied-by-rules situation: every
    // call to the db throws.
    mocks.getDb.mockImplementation(() => {
      throw new Error("Firestore unavailable");
    });
  });

  it("loads resolve to null and writes never reject", async () => {
    await expect(loadStoredDeck()).resolves.toBeNull();
    await expect(loadStoredFront()).resolves.toBeNull();
    await expect(saveDeck(sampleDeck)).resolves.toBeUndefined();
    await expect(clearStoredDeck()).resolves.toBeUndefined();
    await expect(saveFront("english")).resolves.toBeUndefined();
  });
});
