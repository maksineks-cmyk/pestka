// Pestka — oryginalna maskotka aplikacji. Zmienia minę zależnie od postępu dnia.

export type Mood = 'sleepy' | 'sad' | 'ok' | 'happy' | 'party';

/** Dobiera nastrój maskotki do postępu (0..1). */
export function moodFor(done: number, total: number): Mood {
  if (total === 0) return 'sleepy';
  const p = done / total;
  if (p >= 1) return 'party';
  if (p >= 0.5) return 'happy';
  if (p > 0) return 'ok';
  return 'sad';
}

export function Mascot({ mood = 'happy', size = 72 }: { mood?: Mood; size?: number }) {
  const ink = '#1f2a30';
  // Oczy: zamknięte (śpiąca), zwykłe albo "uśmiechnięte łuki" (impreza).
  const eyes =
    mood === 'sleepy' ? (
      <g stroke={ink} strokeWidth="9" strokeLinecap="round" fill="none">
        <path d="M185 290 q20 14 40 0" /><path d="M287 290 q20 14 40 0" />
      </g>
    ) : mood === 'party' ? (
      <g stroke={ink} strokeWidth="11" strokeLinecap="round" fill="none">
        <path d="M183 292 q22 -30 44 0" /><path d="M285 292 q22 -30 44 0" />
      </g>
    ) : (
      <g>
        <ellipse cx="205" cy="285" rx="24" ry="30" fill={ink} />
        <ellipse cx="307" cy="285" rx="24" ry="30" fill={ink} />
        <circle cx="213" cy="274" r="9" fill="#fff" />
        <circle cx="315" cy="274" r="9" fill="#fff" />
      </g>
    );
  const mouth = {
    sleepy: <ellipse cx="256" cy="340" rx="10" ry="8" fill={ink} />,
    sad: <path d="M228 345 Q256 322 284 345" stroke={ink} strokeWidth="11" strokeLinecap="round" fill="none" />,
    ok: <path d="M230 335 Q256 350 282 335" stroke={ink} strokeWidth="11" strokeLinecap="round" fill="none" />,
    happy: <path d="M224 328 Q256 364 288 328" stroke={ink} strokeWidth="12" strokeLinecap="round" fill="none" />,
    party: <path d="M218 322 Q256 392 294 322 Z" fill="#c0392b" stroke={ink} strokeWidth="10" strokeLinejoin="round" />,
  }[mood];

  return (
    <svg className={`mascot mascot-${mood}`} width={size} height={size} viewBox="90 60 332 400" role="img" aria-label="Maskotka Pestka">
      <g className="mascot-leaves">
        <path d="M256 150 C 250 110, 215 80, 170 86 C 180 128, 215 150, 256 150 Z" fill="#2b8a00" />
        <path d="M256 150 C 262 100, 300 70, 352 78 C 340 126, 300 152, 256 150 Z" fill="#46b800" />
        <rect x="248" y="120" width="16" height="44" rx="8" fill="#2b8a00" />
      </g>
      <ellipse cx="256" cy="300" rx="150" ry="140" fill="#e6a700" />
      <ellipse cx="256" cy="288" rx="150" ry="136" fill="#ffd43b" />
      <ellipse cx="200" cy="215" rx="38" ry="22" fill="#fff3bf" transform="rotate(-25 200 215)" />
      {eyes}
      <ellipse cx="165" cy="330" rx="22" ry="13" fill="#ff8fa3" opacity={mood === 'sad' ? 0.3 : 0.75} />
      <ellipse cx="347" cy="330" rx="22" ry="13" fill="#ff8fa3" opacity={mood === 'sad' ? 0.3 : 0.75} />
      {mouth}
      {mood === 'sad' && <path d="M335 300 q8 18 0 26 q-8 -8 0 -26z" fill="#74c0fc" />}
      {mood === 'sleepy' && (
        <text x="350" y="170" fontSize="60" fontWeight="900" fill="#8fa3ad" fontFamily="inherit">z</text>
      )}
    </svg>
  );
}
