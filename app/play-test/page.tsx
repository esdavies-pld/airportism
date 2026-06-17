'use client';

// Standalone test page for the Globe component (handoff §11.8).
// Removed in step 9 once the real /play page wires the globe into the
// game shell.

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { PinCoord } from '@/components/Globe';

const Globe = dynamic(() => import('@/components/Globe'), { ssr: false });

export default function PlayTestPage() {
  const [pin, setPin] = useState<PinCoord | null>(null);

  return (
    <div className="relative h-screen w-screen bg-black">
      <Globe onPinChange={setPin} />
      <div className="absolute left-4 top-4 rounded bg-black/80 px-3 py-2 font-mono text-sm text-white">
        {pin
          ? `pin: ${pin.lat.toFixed(4)}, ${pin.lon.toFixed(4)}`
          : 'click globe to drop a pin (drag to move)'}
      </div>
    </div>
  );
}
