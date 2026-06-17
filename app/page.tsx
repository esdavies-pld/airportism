import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 p-8">
      <div className="flex flex-col items-center gap-3">
        <h1 className="font-mono text-5xl font-bold tracking-widest text-orange-500 md:text-7xl">
          AIRPORTISM
        </h1>
        <p className="text-center text-lg text-gray-400">Where on Earth is that airport?</p>
      </div>

      <Link
        href="/play"
        className="rounded-full bg-orange-500 px-12 py-4 font-bold text-black transition-colors hover:bg-orange-400"
      >
        Play Today&apos;s Round
      </Link>

      <div className="flex gap-6 text-sm text-gray-500">
        <Link href="/how-it-works" className="underline hover:text-gray-300">
          How it works
        </Link>
        <Link href="/stats" className="underline hover:text-gray-300">
          Your stats
        </Link>
      </div>
    </main>
  );
}
