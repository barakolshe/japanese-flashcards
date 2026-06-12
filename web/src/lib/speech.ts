"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Text-to-speech for Japanese words via the browser's built-in Web Speech API
 * (`window.speechSynthesis`). It runs entirely on the user's device — no API
 * key, no network, no cost — which keeps the app purely client-side. Voice
 * quality and availability depend on the voices the user's OS/browser ships.
 *
 * The Web Speech API has two well-known reliability traps this module works
 * around:
 *   1. `getVoices()` returns an empty list until the engine has loaded voices
 *      asynchronously and fired `voiceschanged`. A naive synchronous read on
 *      the very first tap finds no Japanese voice, so the engine reads the word
 *      with the wrong (or no) voice — often silence. We warm voices up on mount
 *      and defer speaking until they're ready.
 *   2. In Chromium, `speechSynthesis` can be left in a paused state after a
 *      `cancel()`, which silently swallows the next `speak()`. We nudge it back
 *      to life with `resume()` after queuing.
 */

/** Whether this browser exposes the Web Speech synthesis API. */
export function isSpeechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

/**
 * The best Japanese (`ja*`) voice the browser has loaded, or null. Prefers an
 * exact `ja-JP` match, then falls back to any `ja*` locale.
 */
function pickJapaneseVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => voice.lang.toLowerCase() === "ja-jp") ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("ja")) ??
    null
  );
}

/** Whether the browser currently has any Japanese voice loaded. */
export function hasJapaneseVoice(): boolean {
  if (!isSpeechSupported()) return false;
  return pickJapaneseVoice() !== null;
}

/**
 * Ask the engine to start loading voices early. The act of calling
 * `getVoices()` kicks off async loading in most engines, so a later tap finds
 * a populated list instead of an empty one. No-op when unsupported.
 */
export function primeVoices(): void {
  if (!isSpeechSupported()) return;
  window.speechSynthesis.getVoices();
}

/**
 * Run `cb` once voices are available. If the engine has already loaded them we
 * call straight through; otherwise we wait for the `voiceschanged` event, with
 * a timeout fallback for engines that never fire it. Speech synthesis doesn't
 * require the originating user gesture to persist, so deferring is safe.
 */
function whenVoicesReady(cb: () => void): void {
  const synth = window.speechSynthesis;
  if (synth.getVoices().length > 0) {
    cb();
    return;
  }

  let ran = false;
  const run = () => {
    if (ran) return;
    ran = true;
    synth.removeEventListener?.("voiceschanged", run);
    cb();
  };

  synth.addEventListener?.("voiceschanged", run);
  // Some engines never fire `voiceschanged`; don't hang the tap forever.
  if (typeof setTimeout === "function") setTimeout(run, 500);
  else run();
}

/** Lifecycle callbacks so callers can reflect playback state in the UI. */
export type SpeakHandlers = {
  /** Fires when the browser actually begins speaking. */
  onStart?: () => void;
  /** Fires once playback finishes, is interrupted, or errors. */
  onEnd?: () => void;
};

/**
 * Speak a Japanese string aloud. Waits for voices to load when needed, cancels
 * anything currently playing so rapid taps don't queue up, tags the utterance
 * as `ja-JP`, and prefers a Japanese voice when one is installed. No-op when
 * the API is unavailable.
 */
export function speakJapanese(text: string, handlers?: SpeakHandlers): void {
  if (!isSpeechSupported()) return;

  const synth = window.speechSynthesis;

  whenVoicesReady(() => {
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

    // Chromium quirk: after a `cancel()` the queue can be left paused, which
    // silently swallows the utterance we just queued. Nudge it awake.
    if (synth.paused) synth.resume?.();
  });
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
  /** Speak the word, replacing any current playback. Good for lists of words. */
  speak: (text: string) => void;
  /** Speak the word, or stop it if that same playback is already running. */
  toggle: (text: string) => void;
  /** Stop any playback (e.g. when the visible card changes). */
  stop: () => void;
};

/**
 * Stateful wrapper around {@link speakJapanese} that tracks whether audio is
 * playing, so a button can show a clear "speaking" state and act as a
 * play/stop toggle. Warms up voices on mount, reconciles the playing flag with
 * the engine in case an end event is dropped, and cancels playback on unmount.
 * All returned functions are stable so they're safe in effect dependency lists.
 */
export function useJapaneseSpeech(): JapaneseSpeech {
  const supported = useSpeechAvailable();
  const [speaking, setSpeaking] = useState(false);

  // Warm up the voice list as soon as we can speak, so the first tap finds a
  // Japanese voice instead of an empty list.
  useEffect(() => {
    if (supported) primeVoices();
  }, [supported]);

  // Never leave audio playing after the component goes away.
  useEffect(() => () => cancelSpeech(), []);

  // Safety net: Chromium occasionally drops the `end`/`error` event, which
  // would leave the button stuck in its "speaking" pose. While we think audio
  // is playing, poll the engine and clear the flag once it's actually idle.
  useEffect(() => {
    if (!speaking || !isSpeechSupported()) return;
    const synth = window.speechSynthesis;
    const id = setInterval(() => {
      if (!synth.speaking && !synth.pending) setSpeaking(false);
    }, 250);
    return () => clearInterval(id);
  }, [speaking]);

  const stop = useCallback(() => {
    cancelSpeech();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!isSpeechSupported()) return;
    speakJapanese(text, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
    });
  }, []);

  const toggle = useCallback((text: string) => {
    if (!isSpeechSupported()) return;
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) {
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
    () => ({ supported, speaking, speak, toggle, stop }),
    [supported, speaking, speak, toggle, stop],
  );
}
