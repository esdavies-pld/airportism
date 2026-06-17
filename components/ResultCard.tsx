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

export default function ResultCard({ reveal, onNext, isLast }: ResultCardProps) {
  return (
    <div className="mx-auto max-w-md rounded-lg bg-black/85 p-4 text-white backdrop-blur">
      <div className="flex items-baseline justify-between">
        <div className="font-mono text-4xl font-bold text-orange-500">
          {reveal.score.toLocaleString()}
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
