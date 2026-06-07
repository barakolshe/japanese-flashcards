"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Text-to-speech for Japanese words via the browser's built-in Web Speech API
 * (`window.speechSynthesis`). It runs entirely on the user's device — no API
 * key, no network, no cost — which keeps the app purely client-side. Voice
 * quality and availability depend on the voices the user's OS/browser ships.
 */

/** Whether this browser exposes the Web Speech synthesis API. */
export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

/** The first Japanese (`ja*`) voice the browser has loaded, or null. */
function pickJapaneseVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.lang.toLowerCase().startsWith("ja")) ?? null;
}

/** Lifecycle callbacks so callers can reflect playback state in the UI. */
export type SpeakHandlers = {
  /** Fires when the browser actually begins speaking. */
  onStart?: () => void;
  /** Fires once playback finishes, is interrupted, or errors. */
  onEnd?: () => void;
};

/**
 * Speak a Japanese string aloud. Cancels anything currently playing so rapid
 * taps don't queue up. Tags the utterance as `ja-JP` and prefers a Japanese
 * voice when one is installed, otherwise lets the engine choose. No-op when the
 * API is unavailable.
 */
export function speakJapanese(text: string, handlers?: SpeakHandlers): void {
  if (!isSpeechSupported()) return;

  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = "ja-JP";
  const voice = pickJapaneseVoice();
  if (voice) utterance.voice = voice;

  if (handlers?.onStart) utterance.onstart = handlers.onStart;
  if (handlers?.onEnd) {
    // `end` covers normal completion; `error` covers cancellation/failure.
    utterance.onend = handlers.onEnd;
    utterance.onerror = handlers.onEnd;
  }

  synth.speak(utterance);
}

/** Stop any in-flight speech immediately. No-op when unsupported. */
export function cancelSpeech(): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.cancel();
}

/**
 * Whether speech is available, resolved on the client after mount so the value
 * never differs between server and client render (avoiding a hydration
 * mismatch). Lets callers hide the speak control when the API is missing.
 */
export function useSpeechAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    setAvailable(isSpeechSupported());
  }, []);
  return available;
}

/** What {@link useJapaneseSpeech} hands back to a component. */
export type JapaneseSpeech = {
  /** True once we know the browser can speak (resolved after mount). */
  supported: boolean;
  /** True while a word is actively being spoken — drive the UI off this. */
  speaking: boolean;
  /** Speak the word, or stop it if that same playback is already running. */
  toggle: (text: string) => void;
  /** Stop any playback (e.g. when the visible card changes). */
  stop: () => void;
};

/**
 * Stateful wrapper around {@link speakJapanese} that tracks whether audio is
 * playing, so a button can show a clear "speaking" state and act as a
 * play/stop toggle. Cancels playback on unmount. All returned functions are
 * stable so they're safe to use in effect dependency lists.
 */
export function useJapaneseSpeech(): JapaneseSpeech {
  const supported = useSpeechAvailable();
  const [speaking, setSpeaking] = useState(false);

  // Never leave audio playing after the component goes away.
  useEffect(() => () => cancelSpeech(), []);

  const stop = useCallback(() => {
    cancelSpeech();
    setSpeaking(false);
  }, []);

  const toggle = useCallback((text: string) => {
    if (!isSpeechSupported()) return;
    if (window.speechSynthesis.speaking) {
      cancelSpeech();
      setSpeaking(false);
      return;
    }
    speakJapanese(text, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
    });
  }, []);

  return useMemo(
    () => ({ supported, speaking, toggle, stop }),
    [supported, speaking, toggle, stop],
  );
}
