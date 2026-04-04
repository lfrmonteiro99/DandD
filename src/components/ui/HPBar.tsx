'use client';

interface HPBarProps {
  current: number;
  max: number;
  label?: string;
  size?: 'sm' | 'md';
}

export function HPBar({ current, max, label, size = 'md' }: HPBarProps) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const color = pct > 50 ? 'bg-green-600' : pct > 25 ? 'bg-yellow-600' : 'bg-red-600';
  const height = size === 'sm' ? 'h-2' : 'h-4';

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">{label}</span>
          <span className="text-gray-300">{current}/{max}</span>
        </div>
      )}
      <div className={`${height} bg-gray-800 rounded-full overflow-hidden border border-gray-700`}>
        <div
          className={`${height} ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
