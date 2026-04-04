'use client';

import { useState, useEffect } from 'react';

interface DiceDisplayProps {
  result: number;
  dieType: string;
  modifier?: number;
  total?: number;
  isCritical?: boolean;
  isFumble?: boolean;
  purpose?: string;
}

export function DiceDisplay({ result, dieType, modifier = 0, total, isCritical, isFumble, purpose }: DiceDisplayProps) {
  const [rolling, setRolling] = useState(true);
  const [displayNumber, setDisplayNumber] = useState(0);

  useEffect(() => {
    // Animate dice roll
    let frame = 0;
    const interval = setInterval(() => {
      setDisplayNumber(Math.floor(Math.random() * parseInt(dieType.slice(1))) + 1);
      frame++;
      if (frame >= 10) {
        clearInterval(interval);
        setDisplayNumber(result);
        setRolling(false);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [result, dieType]);

  return (
    <div className="inline-flex items-center gap-2 p-2 rounded-lg bg-gray-800 border border-gray-700">
      <div className={`
        w-12 h-12 flex items-center justify-center rounded-lg text-xl font-bold
        ${rolling ? 'dice-rolling' : ''}
        ${isCritical ? 'bg-yellow-600 text-yellow-100 border-2 border-yellow-400' :
          isFumble ? 'bg-red-900 text-red-200 border-2 border-red-600' :
          'bg-gray-700 text-white'}
      `}>
        {displayNumber}
      </div>
      <div className="text-sm">
        <div className="text-gray-400">{dieType}{modifier !== 0 ? `${modifier >= 0 ? '+' : ''}${modifier}` : ''}</div>
        {total !== undefined && !rolling && (
          <div className="font-bold text-white">
            = {total}
            {isCritical && <span className="text-yellow-400 ml-1">CRIT!</span>}
            {isFumble && <span className="text-red-400 ml-1">MISS!</span>}
          </div>
        )}
        {purpose && <div className="text-xs text-gray-500">{purpose}</div>}
      </div>
    </div>
  );
}
