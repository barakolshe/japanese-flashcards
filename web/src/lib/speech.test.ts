import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelSpeech,
  hasJapaneseVoice,
  isSpeechSupported,
  speakJapanese,
} from "./speech";

/** Minimal stand-in for SpeechSynthesisUtterance that records what's set. */
class FakeUtterance {
  text: string;
  lang = "";
  voice: { lang: string; name: string } | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event?: { error?: string }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

type Voice = { lang: string; name: string };

function installSpeechApi(
  voices: Voice[],
  { speaking = false, paused = false } = {},
) {
  const listeners: Record<string, Array<() => void>> = {};
  const synth = {
    speaking,
    pending: false,
    paused,
    cancel: vi.fn(),
    speak: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => voices),
    addEventListener: vi.fn((type: string, cb: () => void) => {
      (listeners[type] ??= []).push(cb);
    }),
    removeEventListener: vi.fn((type: string, cb: () => void) => {
      listeners[type] = (listeners[type] ?? []).filter((f) => f !== cb);
    }),
    /** Test helper: fire a synthetic event to all current listeners. */
    dispatch: (type: string) =>
      (listeners[type] ?? []).slice().forEach((f) => f()),
  };
  // The lib reads these off `window`; node has no window, so fake one.
  vi.stubGlobal("window", {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: FakeUtterance,
  });
  return synth;
}

const EN_VOICE: Voice = { lang: "en-US", name: "Samantha" };
const JA_VOICE: Voice = { lang: "ja-JP", name: "Nanami" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isSpeechSupported", () => {
  it("is false when there is no window (e.g. server render)", () => {
    vi.stubGlobal("window", undefined);
    expect(isSpeechSupported()).toBe(false);
  });

  it("is false when the API is missing from window", () => {
    vi.stubGlobal("window", {});
    expect(isSpeechSupported()).toBe(false);
  });

  it("is true when both speechSynthesis and the utterance ctor exist", () => {
    installSpeechApi([]);
    expect(isSpeechSupported()).toBe(true);
  });
});

describe("hasJapaneseVoice", () => {
  it("is false when unsupported", () => {
    vi.stubGlobal("window", {});
    expect(hasJapaneseVoice()).toBe(false);
  });

  it("is false when no Japanese voice is installed", () => {
    installSpeechApi([EN_VOICE]);
    expect(hasJapaneseVoice()).toBe(false);
  });

  it("is true when a Japanese voice is installed", () => {
    installSpeechApi([EN_VOICE, { lang: "ja-JP", name: "Nanami" }]);
    expect(hasJapaneseVoice()).toBe(true);
  });
});

describe("speakJapanese", () => {
  it("does nothing when speech is unsupported", () => {
    vi.stubGlobal("window", {});
    expect(() => speakJapanese("猫")).not.toThrow();
  });

  it("cancels any in-flight speech before speaking", () => {
    const synth = installSpeechApi([JA_VOICE]);
    speakJapanese("猫");

    expect(synth.cancel).toHaveBeenCalledOnce();
    expect(synth.speak).toHaveBeenCalledOnce();
  });

  it("speaks the given text tagged as Japanese", () => {
    const synth = installSpeechApi([JA_VOICE]);
    speakJapanese("猫");

    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(utterance.text).toBe("猫");
    expect(utterance.lang).toBe("ja-JP");
  });

  it("prefers an installed Japanese voice when one exists", () => {
    const jaVoice = { lang: "ja-JP", name: "Kyoko" };
    const synth = installSpeechApi([EN_VOICE, jaVoice]);
    speakJapanese("猫");

    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(utterance.voice).toBe(jaVoice);
  });

  it("prefers an exact ja-JP voice over other ja* locales", () => {
    const jaJp = { lang: "ja-JP", name: "Nanami" };
    const synth = installSpeechApi([{ lang: "ja-Hira", name: "Other" }, jaJp]);
    speakJapanese("猫");

    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(utterance.voice).toBe(jaJp);
  });

  it("reports unavailable instead of speaking when voices are loaded but none are Japanese", () => {
    const synth = installSpeechApi([EN_VOICE]);
    const onUnavailable = vi.fn();
    speakJapanese("猫", { onUnavailable });

    // A non-Japanese voice would be silent or mispronounce, so don't fake it.
    expect(synth.speak).not.toHaveBeenCalled();
    expect(onUnavailable).toHaveBeenCalledOnce();
  });

  it("still attempts to speak when the voice list is empty (engine may use lang alone)", () => {
    const synth = installSpeechApi([]);
    const onUnavailable = vi.fn();
    speakJapanese("猫", { onUnavailable });
    // An empty list defers until voices load; fire the event with it still
    // empty — some engines speak fine off `lang`, so we try rather than give up.
    synth.dispatch("voiceschanged");

    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(utterance.lang).toBe("ja-JP");
    expect(utterance.voice).toBeNull();
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it("reports unavailable when an empty-list utterance never starts (watchdog)", () => {
    vi.useFakeTimers();
    try {
      const synth = installSpeechApi([]);
      const onUnavailable = vi.fn();
      speakJapanese("猫", { onUnavailable });
      synth.dispatch("voiceschanged");

      // The engine accepted speak() but it never starts and isn't busy —
      // a silent drop (e.g. Brave's empty farbled list).
      expect(onUnavailable).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1500);
      expect(onUnavailable).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not fire the watchdog once playback has started", () => {
    vi.useFakeTimers();
    try {
      const synth = installSpeechApi([]);
      const onUnavailable = vi.fn();
      speakJapanese("猫", { onUnavailable });
      synth.dispatch("voiceschanged");

      const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
      utterance.onstart?.();
      vi.advanceTimersByTime(1500);
      expect(onUnavailable).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("waits for voices to load before speaking when none are ready yet", () => {
    let voices: Voice[] = [];
    const synth = installSpeechApi([]);
    synth.getVoices.mockImplementation(() => voices);

    speakJapanese("猫");
    // Voices aren't loaded, so nothing should be spoken yet.
    expect(synth.speak).not.toHaveBeenCalled();
    expect(synth.addEventListener).toHaveBeenCalledWith(
      "voiceschanged",
      expect.any(Function),
    );

    // Engine finishes loading voices and notifies.
    voices = [{ lang: "ja-JP", name: "Nanami" }];
    synth.dispatch("voiceschanged");

    expect(synth.speak).toHaveBeenCalledOnce();
    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(utterance.voice).toEqual({ lang: "ja-JP", name: "Nanami" });
  });

  it("resumes a paused engine after queuing speech (Chromium nudge)", () => {
    const synth = installSpeechApi([{ lang: "ja-JP", name: "Nanami" }], {
      paused: true,
    });
    speakJapanese("猫");
    expect(synth.resume).toHaveBeenCalledOnce();
  });

  it("does not resume when the engine isn't paused", () => {
    const synth = installSpeechApi([{ lang: "ja-JP", name: "Nanami" }]);
    speakJapanese("猫");
    expect(synth.resume).not.toHaveBeenCalled();
  });

  it("wires start/end handlers so callers can track playback", () => {
    const synth = installSpeechApi([JA_VOICE]);
    const onStart = vi.fn();
    const onEnd = vi.fn();
    speakJapanese("猫", { onStart, onEnd });

    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    utterance.onstart?.();
    expect(onStart).toHaveBeenCalledOnce();

    utterance.onend?.();
    expect(onEnd).toHaveBeenCalledOnce();
  });

  it("treats a cancel/interrupt error as a normal end, not a failure", () => {
    const synth = installSpeechApi([JA_VOICE]);
    const onEnd = vi.fn();
    const onUnavailable = vi.fn();
    speakJapanese("猫", { onEnd, onUnavailable });

    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    utterance.onerror?.({ error: "interrupted" });
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it("reports unavailable when synthesis errors before audio starts", () => {
    const synth = installSpeechApi([JA_VOICE]);
    const onEnd = vi.fn();
    const onUnavailable = vi.fn();
    speakJapanese("猫", { onEnd, onUnavailable });

    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    utterance.onerror?.({ error: "synthesis-failed" });
    expect(onUnavailable).toHaveBeenCalledOnce();
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("resolves a terminal event only once", () => {
    const synth = installSpeechApi([JA_VOICE]);
    const onEnd = vi.fn();
    const onUnavailable = vi.fn();
    speakJapanese("猫", { onEnd, onUnavailable });

    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    utterance.onend?.();
    utterance.onerror?.({ error: "synthesis-failed" });
    expect(onEnd).toHaveBeenCalledOnce();
    expect(onUnavailable).not.toHaveBeenCalled();
  });
});

describe("cancelSpeech", () => {
  it("cancels in-flight speech when supported", () => {
    const synth = installSpeechApi([], { speaking: true });
    cancelSpeech();
    expect(synth.cancel).toHaveBeenCalledOnce();
  });

  it("is a safe no-op when speech is unsupported", () => {
    vi.stubGlobal("window", {});
    expect(() => cancelSpeech()).not.toThrow();
  });
});
