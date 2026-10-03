'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Alternative = { transcript: string; confidence?: number };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  phrases?: unknown[];
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<Alternative> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;
type PhraseCtor = new (phrase: string, boost: number) => unknown;

type SpeechWindow = {
  SpeechRecognition?: RecognitionCtor;
  webkitSpeechRecognition?: RecognitionCtor;
  SpeechRecognitionPhrase?: PhraseCtor;
};

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access is off. Allow it in your browser settings.',
  'service-not-allowed': 'Voice isn’t available here. Type it instead.',
  'no-speech': 'Didn’t catch that. Try again?',
  network: 'Voice needs a connection. Type it instead.',
  'audio-capture': 'No microphone found.',
};

const MAX_ALTERNATIVES = 5;

/**
 * Build whole-utterance alternatives from per-segment results: alternative i takes
 * each segment's i-th guess (or its best one when that segment has fewer).
 */
export function combineAlternatives(results: ArrayLike<ArrayLike<Alternative>>): string[] {
  const segments = Array.from(results, (r) => Array.from(r, (a) => a.transcript.trim()).filter(Boolean));
  const width = Math.max(0, ...segments.map((s) => s.length));
  const out: string[] = [];
  for (let i = 0; i < width; i++) {
    const text = segments
      .map((s) => s[Math.min(i, s.length - 1)] ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text && !out.includes(text)) out.push(text);
  }
  return out;
}

/** Indian English understands "₹", lakhs and local brand names far better than en-US. */
export function speechLang(currency: string): string {
  const lang = typeof navigator === 'undefined' ? 'en-IN' : navigator.language || 'en-US';
  if (currency === 'INR' && lang.toLowerCase().startsWith('en')) return 'en-IN';
  return lang;
}

type Options = {
  lang: string;
  /** names the user says often, used as recognition hints where the browser supports them */
  phrases: string[];
  onFinal: (alternatives: string[]) => void;
  onError: (message: string) => void;
};

export function useSpeech({ lang, phrases, onFinal, onError }: Options) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const rec = useRef<Recognition | null>(null);
  const heard = useRef<string[]>([]);
  const phrasesBroken = useRef(false);
  const opts = useRef({ lang, phrases, onFinal, onError });
  opts.current = { lang, phrases, onFinal, onError };

  useEffect(() => {
    const w = window as unknown as SpeechWindow;
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => rec.current?.abort();
  }, []);

  const start = useCallback(() => {
    const w = window as unknown as SpeechWindow;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = opts.current.lang;
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = MAX_ALTERNATIVES;

    // Contextual biasing (newer Chrome): nudge the engine toward places this user names.
    let usingPhrases = false;
    if (!phrasesBroken.current && w.SpeechRecognitionPhrase && 'phrases' in r && opts.current.phrases.length) {
      try {
        const Phrase = w.SpeechRecognitionPhrase;
        r.phrases = opts.current.phrases.slice(0, 40).map((p) => new Phrase(p, 3));
        usingPhrases = true;
      } catch {
        phrasesBroken.current = true;
      }
    }

    heard.current = [];
    setTranscript('');
    let retryWithoutPhrases = false;
    r.onresult = (e) => {
      heard.current = combineAlternatives(e.results);
      setTranscript(heard.current[0] ?? '');
    };
    r.onerror = (e) => {
      if (e.error === 'phrases-not-supported' && usingPhrases) {
        phrasesBroken.current = true;
        retryWithoutPhrases = true;
        return;
      }
      if (e.error !== 'aborted') opts.current.onError(ERRORS[e.error] ?? 'Voice didn’t work. Try again.');
      heard.current = [];
    };
    r.onend = () => {
      rec.current = null;
      if (retryWithoutPhrases) {
        start();
        return;
      }
      setListening(false);
      const alternatives = heard.current;
      heard.current = [];
      if (alternatives.length) opts.current.onFinal(alternatives);
    };
    try {
      r.start();
      rec.current = r;
      setListening(true);
      navigator.vibrate?.(8);
    } catch {
      rec.current = null;
    }
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { supported, listening, transcript, start, stop };
}
