'use client';

import { useEffect, useState } from 'react';

interface RevealActual {
  name: string;
  city: string | null;
  country: string;
}

interface ResultCardProps {
  reveal: {
    score: number;
    distanceKm: number;
    actual: RevealActual;
  };
  onNext: () => void;
  isLast: boolean;
}

function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString()} km`;
}

const COUNT_UP_MS = 800;

function useCountUp(target: number): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return value;
}

export default function ResultCard({ reveal, onNext, isLast }: ResultCardProps) {
  const animatedScore = useCountUp(reveal.score);

  return (
    <div className="mx-auto max-w-md rounded-lg bg-black/85 p-4 text-white backdrop-blur">
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-4xl font-bold tabular-nums text-orange-500">
          {animatedScore.toLocaleString()}
        </div>
        <div className="font-mono text-sm text-gray-400">{formatKm(reveal.distanceKm)}</div>
      </div>
      <div className="mt-3 text-sm">
        <div className="font-semibold">{reveal.actual.name}</div>
        <div className="text-gray-400">
          {reveal.actual.city ? `${reveal.actual.city}, ` : ''}
          {reveal.actual.country}
        </div>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="mt-4 w-full rounded bg-orange-500 px-4 py-2 font-bold text-black hover:bg-orange-400"
      >
        {isLast ? 'Finish' : 'Next'}
      </button>
    </div>
  );
}
