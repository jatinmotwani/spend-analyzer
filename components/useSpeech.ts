'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access is off. Allow it in your browser settings.',
  'service-not-allowed': 'Voice isn’t available here. Type it instead.',
  'no-speech': 'Didn’t catch that. Try again?',
  network: 'Voice needs a connection. Type it instead.',
  'audio-capture': 'No microphone found.',
};

export function useSpeech({ onFinal, onError }: { onFinal: (text: string) => void; onError: (message: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const rec = useRef<Recognition | null>(null);
  const heard = useRef('');
  const handlers = useRef({ onFinal, onError });
  handlers.current = { onFinal, onError };

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => rec.current?.abort();
  }, []);

  const start = useCallback(() => {
    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = navigator.language || 'en-US';
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    heard.current = '';
    setTranscript('');
    r.onresult = (e) => {
      heard.current = Array.from(e.results, (res) => res[0].transcript).join(' ');
      setTranscript(heard.current);
    };
    r.onerror = (e) => {
      if (e.error !== 'aborted') handlers.current.onError(ERRORS[e.error] ?? 'Voice didn’t work. Try again.');
      heard.current = '';
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
      const text = heard.current.trim();
      heard.current = '';
      if (text) handlers.current.onFinal(text);
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
