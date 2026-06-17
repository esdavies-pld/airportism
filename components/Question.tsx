interface QuestionProps {
  questionIndex: number;
  totalQuestions: number;
  iata: string;
  tierLabel: string;
  cumulativeScore: number;
}

export default function Question({
  questionIndex,
  totalQuestions,
  iata,
  tierLabel,
  cumulativeScore,
}: QuestionProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-black/80 px-6 py-4 text-white backdrop-blur">
      <div className="text-xs uppercase tracking-widest text-gray-400">
        Question {questionIndex + 1} of {totalQuestions} — {tierLabel}
      </div>
      <div className="font-mono text-6xl font-bold tracking-widest text-orange-500 md:text-7xl">
        {iata}
      </div>
      <div className="text-xs text-gray-400">
        Score so far:{' '}
        <span className="font-mono text-white">{cumulativeScore.toLocaleString()}</span>
      </div>
    </div>
  );
}
