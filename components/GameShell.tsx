'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getPlayerId } from '@/lib/player-client';
import type { PinCoord } from './Globe';
import Question from './Question';
import ResultCard from './ResultCard';

const Globe = dynamic(() => import('./Globe'), { ssr: false });

interface QuestionInfo {
  index: number;
  iata: string;
}

interface RoundData {
  playDate: string;
  questions: QuestionInfo[];
  alreadyCompleted?: boolean;
  totalScore?: number;
}

interface GuessResult {
  score: number;
  distanceKm: number;
  actual: {
    lat: number;
    lon: number;
    iata: string;
    name: string;
    city: string | null;
    country: string;
  };
}

type Phase = 'loading' | 'awaitingGuess' | 'guessing' | 'revealed' | 'complete' | 'error';

const TIER_LABELS = ['Easy', 'Medium', 'Hard'];

function storageKey(playDate: string) {
  return `apg.round.${playDate}`;
}

function loadPersisted(playDate: string): GuessResult[] {
  if (typeof window === 'undefined') return [];
  const raw = sessionStorage.getItem(storageKey(playDate));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { reveals: GuessResult[] };
    return Array.isArray(parsed.reveals) ? parsed.reveals : [];
  } catch {
    return [];
  }
}

function savePersisted(playDate: string, reveals: GuessResult[]) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(storageKey(playDate), JSON.stringify({ reveals }));
}

export default function GameShell() {
  const [round, setRound] = useState<RoundData | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [pin, setPin] = useState<PinCoord | null>(null);
  const [reveals, setReveals] = useState<GuessResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [questionStart, setQuestionStart] = useState(0);

  useEffect(() => {
    const playerId = getPlayerId();
    fetch('/api/round/today', { headers: { 'X-Player-Id': playerId } })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return (await res.json()) as RoundData;
      })
      .then((data) => {
        setRound(data);
        if (data.alreadyCompleted) {
          setPhase('complete');
          return;
        }
        const persisted = loadPersisted(data.playDate);
        setReveals(persisted);
        if (persisted.length >= data.questions.length) {
          setPhase('complete');
          return;
        }
        setCurrentIdx(persisted.length);
        setPhase('awaitingGuess');
        setQuestionStart(Date.now());
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setPhase('error');
      });
  }, []);

  const submitGuess = async () => {
    if (!pin || !round) return;
    setPhase('guessing');
    try {
      const res = await fetch('/api/round/today/guess', {
        method: 'POST',
        headers: {
          'X-Player-Id': getPlayerId(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionIndex: currentIdx,
          lat: pin.lat,
          lon: pin.lon,
          elapsedMs: Date.now() - questionStart,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const result = (await res.json()) as GuessResult;
      const next = [...reveals, result];
      setReveals(next);
      savePersisted(round.playDate, next);
      setPhase('revealed');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPhase('error');
    }
  };

  const advance = () => {
    if (!round) return;
    if (currentIdx >= round.questions.length - 1) {
      setPhase('complete');
      return;
    }
    setCurrentIdx(currentIdx + 1);
    setPin(null);
    setPhase('awaitingGuess');
    setQuestionStart(Date.now());
  };

  if (phase === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-black text-white">Loading…</div>
    );
  }

  if (phase === 'error' || !round) {
    return (
      <div className="flex h-screen items-center justify-center bg-black p-8 text-center text-white">
        <div>
          <div className="text-lg font-semibold text-red-400">Error</div>
          <div className="mt-2 text-sm text-gray-400">{error ?? 'Unknown error'}</div>
        </div>
      </div>
    );
  }

  if (phase === 'complete') {
    const total = round.totalScore ?? reveals.reduce((s, r) => s + r.score, 0);
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-black p-8 text-white">
        <div className="text-xl text-gray-400">Round complete</div>
        <div className="font-mono text-6xl font-bold text-orange-500">
          {total.toLocaleString()}
        </div>
        <div className="text-sm text-gray-500">of 15,000</div>
        <div className="mt-8 text-xs text-gray-600">
          (RoundSummary + share is step 10. /complete persistence is step 11.)
        </div>
      </div>
    );
  }

  const question = round.questions[currentIdx];
  const cumulativeScore = reveals.reduce((s, r) => s + r.score, 0);
  const lastReveal = phase === 'revealed' ? reveals[reveals.length - 1] : null;
  const revealForGlobe =
    lastReveal && pin
      ? { guess: pin, actual: { lat: lastReveal.actual.lat, lon: lastReveal.actual.lon } }
      : null;

  return (
    <div className="relative h-screen w-screen bg-black">
      <Globe pin={pin} onPinChange={setPin} locked={phase !== 'awaitingGuess'} reveal={revealForGlobe} />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-4">
        <div className="pointer-events-auto">
          <Question
            questionIndex={currentIdx}
            totalQuestions={round.questions.length}
            iata={question.iata}
            tierLabel={TIER_LABELS[currentIdx] ?? ''}
            cumulativeScore={cumulativeScore}
          />
        </div>
      </div>

      {phase === 'awaitingGuess' && (
        <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center">
          <button
            type="button"
            onClick={submitGuess}
            disabled={!pin}
            className="rounded-full bg-orange-500 px-10 py-3 font-bold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
          >
            Guess
          </button>
        </div>
      )}

      {phase === 'guessing' && (
        <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center text-white">
          Scoring…
        </div>
      )}

      {phase === 'revealed' && lastReveal && (
        <div className="absolute inset-x-0 bottom-0 z-10 p-4">
          <ResultCard
            reveal={lastReveal}
            onNext={advance}
            isLast={currentIdx === round.questions.length - 1}
          />
        </div>
      )}
    </div>
  );
}
