'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getPlayerId } from '@/lib/player-client';
import { MAX_ROUND_SCORE } from '@/lib/share';

interface Stats {
  gamesPlayed: number;
  currentStreak: number;
  maxStreak: number;
  avgScore: number;
  bestScore: number;
  distribution: number[];
}

const BIN_LABELS = ['0–3k', '3–6k', '6–9k', '9–12k', '12–15k'];

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/me/stats', { headers: { 'X-Player-Id': getPlayerId() } })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await res.json()) as Stats;
      })
      .then(setStats)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Unknown error'),
      );
  }, []);

  return (
    <main className="mx-auto max-w-2xl p-6 md:p-10">
      <Link href="/" className="text-sm text-gray-500 underline hover:text-gray-300">
        ← home
      </Link>
      <h1 className="mt-6 text-3xl font-bold">Stats</h1>

      {error ? (
        <p className="mt-8 text-red-400">Error: {error}</p>
      ) : !stats ? (
        <p className="mt-8 text-gray-500">Loading…</p>
      ) : (
        <>
          {stats.gamesPlayed === 0 ? (
            <p className="mt-8 text-gray-400">
              No rounds yet.{' '}
              <Link href="/play" className="text-orange-500 underline">
                Play today&apos;s round
              </Link>
              .
            </p>
          ) : (
            <>
              <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-3">
                <Stat label="Games played" value={stats.gamesPlayed} />
                <Stat label="Current streak" value={stats.currentStreak} />
                <Stat label="Max streak" value={stats.maxStreak} />
                <Stat label="Best score" value={stats.bestScore.toLocaleString()} />
                <Stat label="Average" value={stats.avgScore.toLocaleString()} />
                <Stat label="Max possible" value={MAX_ROUND_SCORE.toLocaleString()} />
              </dl>

              <h2 className="mt-12 text-lg font-bold text-gray-200">Score distribution</h2>
              <Histogram bins={stats.distribution} labels={BIN_LABELS} />
            </>
          )}
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-widest text-gray-400">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-bold text-orange-500">{value}</dd>
    </div>
  );
}

function Histogram({ bins, labels }: { bins: number[]; labels: string[] }) {
  const max = Math.max(1, ...bins);
  return (
    <div className="mt-4 grid grid-cols-5 gap-2">
      {bins.map((count, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className="text-xs text-gray-400">{count}</div>
          <div className="relative h-32 w-full overflow-hidden rounded-t bg-zinc-900">
            <div
              className="absolute inset-x-0 bottom-0 bg-orange-500"
              style={{ height: `${(count / max) * 100}%` }}
            />
          </div>
          <div className="text-xs text-gray-500">{labels[i]}</div>
        </div>
      ))}
    </div>
  );
}
