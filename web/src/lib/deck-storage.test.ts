import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Deck } from "./deck";
import {
  clearStoredDeck,
  loadStoredDeck,
  loadStoredFront,
  saveDeck,
  saveFront,
} from "./deck-storage";

const STORAGE_KEY = "flashcards:deck:v1";
const FRONT_STORAGE_KEY = "flashcards:front:v1";

/** Minimal in-memory localStorage stand-in for the node test environment. */
function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    raw: store,
  };
}

let localStorage: ReturnType<typeof makeLocalStorage>;

const sampleDeck: Deck = {
  cards: [
    { id: "1", japanese: "犬", english: "dog", folder: "Animals" },
    { id: "2", japanese: "猫", english: "cat", folder: "Animals" },
  ],
  folders: ["Animals", "Phrases"],
};

beforeEach(() => {
  localStorage = makeLocalStorage();
  vi.stubGlobal("window", { localStorage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saveDeck / loadStoredDeck", () => {
  it("round-trips a deck through storage", () => {
    saveDeck(sampleDeck);
    expect(loadStoredDeck()).toEqual(sampleDeck);
  });

  it("stores a versioned payload, not the bare deck", () => {
    saveDeck(sampleDeck);
    const stored = JSON.parse(localStorage.raw.get(STORAGE_KEY)!);
    expect(stored.version).toBe(1);
    expect(stored.deck).toEqual(sampleDeck);
  });

  it("returns null when nothing is stored", () => {
    expect(loadStoredDeck()).toBeNull();
  });
});

describe("loadStoredDeck validation", () => {
  it("discards corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadStoredDeck()).toBeNull();
  });

  it("discards a payload from a different version", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 99, deck: sampleDeck }),
    );
    expect(loadStoredDeck()).toBeNull();
  });

  it("discards a deck with the wrong shape", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        deck: { cards: [{ id: "1", japanese: "犬" }], folders: [] },
      }),
    );
    expect(loadStoredDeck()).toBeNull();
  });

  it("discards a deck whose folders aren't all strings", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, deck: { cards: [], folders: [1, 2] } }),
    );
    expect(loadStoredDeck()).toBeNull();
  });
});

describe("clearStoredDeck", () => {
  it("removes a saved deck", () => {
    saveDeck(sampleDeck);
    clearStoredDeck();
    expect(loadStoredDeck()).toBeNull();
  });
});

describe("saveFront / loadStoredFront", () => {
  it("round-trips the chosen direction", () => {
    saveFront("english");
    expect(loadStoredFront()).toBe("english");
    saveFront("japanese");
    expect(loadStoredFront()).toBe("japanese");
  });

  it("returns null when nothing is stored", () => {
    expect(loadStoredFront()).toBeNull();
  });

  it("discards an unrecognized value", () => {
    localStorage.setItem(FRONT_STORAGE_KEY, "sideways");
    expect(loadStoredFront()).toBeNull();
  });
});

describe("without browser storage (SSR)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal("window", undefined);
  });

  it("loadStoredDeck returns null and writes never throw", () => {
    expect(loadStoredDeck()).toBeNull();
    expect(() => saveDeck(sampleDeck)).not.toThrow();
    expect(() => clearStoredDeck()).not.toThrow();
  });

  it("front helpers are also safe without storage", () => {
    expect(loadStoredFront()).toBeNull();
    expect(() => saveFront("english")).not.toThrow();
  });
});
