// Inline stroke SVG icons (no emoji, per SPEC §3).
type P = { size?: number; className?: string };

export function PlusIcon({ size = 16, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={className}>
      <path d="M12 5v14" /><path d="M5 12h14" />
    </svg>
  );
}

export function UploadIcon({ size = 16, className, stroke }: P & { stroke?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 16V4" /><path d="M6 10l6-6 6 6" /><path d="M4 20h16" />
    </svg>
  );
}

export function SparkIcon({ size = 18, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
    </svg>
  );
}

export function CloseIcon({ size = 16, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className={className}>
      <path d="M6 6l12 12" /><path d="M18 6L6 18" />
    </svg>
  );
}

/** "Translate" glyph used by the Vietnamese panel buttons (prototype SVG). */
export function TranslateIcon({ size = 16, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M4 5h8" /><path d="M8 3v2" /><path d="M10 5c-.5 3-2.5 6-6 8" /><path d="M6 9c1 2 3 3.5 5 4" /><path d="M13 21l4-9 4 9" /><path d="M14.5 18h5" />
    </svg>
  );
}

export function FlagIcon({ size = 14, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}
