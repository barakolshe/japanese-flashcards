import { afterEach, describe, expect, it, vi } from "vitest";
import { cancelSpeech, isSpeechSupported, speakJapanese } from "./speech";

/** Minimal stand-in for SpeechSynthesisUtterance that records what's set. */
class FakeUtterance {
  text: string;
  lang = "";
  voice: { lang: string; name: string } | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

type Voice = { lang: string; name: string };

function installSpeechApi(voices: Voice[], { speaking = false } = {}) {
  const synth = {
    speaking,
    cancel: vi.fn(),
    speak: vi.fn(),
    getVoices: vi.fn(() => voices),
  };
  // The lib reads these off `window`; node has no window, so fake one.
  vi.stubGlobal("window", {
    speechSynthesis: synth,
    SpeechSynthesisUtterance: FakeUtterance,
  });
  return synth;
}

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

describe("speakJapanese", () => {
  it("does nothing when speech is unsupported", () => {
    vi.stubGlobal("window", {});
    expect(() => speakJapanese("猫")).not.toThrow();
  });

  it("cancels any in-flight speech before speaking", () => {
    const synth = installSpeechApi([]);
    speakJapanese("猫");

    expect(synth.cancel).toHaveBeenCalledOnce();
    expect(synth.speak).toHaveBeenCalledOnce();
  });

  it("speaks the given text tagged as Japanese", () => {
    const synth = installSpeechApi([]);
    speakJapanese("猫");

    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(utterance.text).toBe("猫");
    expect(utterance.lang).toBe("ja-JP");
  });

  it("prefers an installed Japanese voice when one exists", () => {
    const jaVoice = { lang: "ja-JP", name: "Kyoko" };
    const synth = installSpeechApi([
      { lang: "en-US", name: "Samantha" },
      jaVoice,
    ]);
    speakJapanese("猫");

    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(utterance.voice).toBe(jaVoice);
  });

  it("leaves voice unset when no Japanese voice is installed", () => {
    const synth = installSpeechApi([{ lang: "en-US", name: "Samantha" }]);
    speakJapanese("猫");

    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    expect(utterance.voice).toBeNull();
  });

  it("wires start/end handlers so callers can track playback", () => {
    const synth = installSpeechApi([]);
    const onStart = vi.fn();
    const onEnd = vi.fn();
    speakJapanese("猫", { onStart, onEnd });

    const utterance = synth.speak.mock.calls[0][0] as FakeUtterance;
    utterance.onstart?.();
    expect(onStart).toHaveBeenCalledOnce();

    // Both natural end and error should resolve the "speaking" state.
    utterance.onend?.();
    utterance.onerror?.();
    expect(onEnd).toHaveBeenCalledTimes(2);
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
