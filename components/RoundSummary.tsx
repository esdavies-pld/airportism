'use client';

import { useState } from 'react';
import { MAX_ROUND_SCORE, scoreEmoji, shareString } from '@/lib/share';

interface RoundSummaryProps {
  playDate: string;
  totalScore: number;
  scores: number[];
}

export default function RoundSummary({ playDate, totalScore, scores }: RoundSummaryProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const onShare = async () => {
    const text = shareString({
      playDate,
      totalScore,
      scores,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    });
    try {
      await navigator.clipboard.writeText(text);
      setStatus('copied');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('failed');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-black p-8 text-white">
      <div className="text-sm uppercase tracking-widest text-gray-400">
        Airportism · {playDate}
      </div>

      <div className="flex flex-col items-center gap-1">
        <div className="font-mono text-7xl font-bold text-orange-500">
          {totalScore.toLocaleString()}
        </div>
        <div className="text-sm text-gray-500">of {MAX_ROUND_SCORE.toLocaleString()}</div>
      </div>

      {scores.length > 0 && (
        <div className="flex gap-2 text-5xl">
          {scores.map((s, i) => (
            <span key={i}>{scoreEmoji(s)}</span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onShare}
        className="rounded-full bg-orange-500 px-10 py-3 font-bold text-black hover:bg-orange-400"
      >
        {status === 'copied' ? 'Copied!' : status === 'failed' ? 'Copy failed' : 'Share'}
      </button>
    </div>
  );
}
