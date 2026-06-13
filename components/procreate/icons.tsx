export function IconGallery({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function IconActions({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" strokeLinecap="round" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  );
}

export function IconAdjust({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" />
    </svg>
  );
}

export function IconSelect({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M7 3l4 14 2-6 6-2L7 3z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconTransform({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <rect x="4" y="4" width="16" height="16" rx="1" strokeDasharray="3 2" />
      <path d="M4 8h16M8 4v16M16 4v16M4 16h16" />
    </svg>
  );
}

export function IconBrush({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 18.5c3-2 6.5-2.5 9.5-1.5" />
      <path d="M5.5 17c2.5-1 5-1.5 7.5-0.5" />
      <path d="M12.5 9.5 20 3" strokeWidth="2.25" />
      <path d="M11 11l2-2" />
    </svg>
  );
}

export function IconSmudge({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9.5 19.5c-0.5-5.5 1.5-10 5.5-13 2.2-1.6 4.8-1.2 6.5 0.8" />
      <path d="M16.5 8c1.1-.7 2.5-.4 3.2 0.9" />
      <path d="M8.5 18.5c-2.5-0.5-4-2.5-3.5-5" />
    </svg>
  );
}

export function IconErase({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 15l7-7 9 9-7 7-9-9z" />
      <path d="M3.5 20.5h17" />
    </svg>
  );
}

export function IconLayers({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M12 3l9 5-9 5-9-5 9-5z" strokeLinejoin="round" />
      <path d="M3 12l9 5 9-5M3 17l9 5 9-5" strokeLinejoin="round" />
    </svg>
  );
}

export function IconColor({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function IconUndo({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 7H5v4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 11c1.5-3 4.5-5 8-5 4.4 0 8 3.6 8 8s-3.6 8-8 8" strokeLinecap="round" />
    </svg>
  );
}

export function IconRedo({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 7h4v4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 11c-1.5-3-4.5-5-8-5-4.4 0-8 3.6-8 8s3.6 8 8 8" strokeLinecap="round" />
    </svg>
  );
}

export function IconEyedropper({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M4 20l4-1 9-9a2.8 2.8 0 10-4-4l-9 9-1 4z" strokeLinejoin="round" />
      <path d="M13 6l5 5" />
    </svg>
  );
}

export function IconClose({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export function IconPlus({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export function IconSearch({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="6" />
      <path d="M16 16l5 5" strokeLinecap="round" />
    </svg>
  );
}

export function IconCheck({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconEye({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconEyeOff({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
      <path d="M2 12s3.5-7 10-7c2.2 0 4.1.7 5.6 1.7" strokeLinecap="round" />
      <path d="M22 12s-3.5 7-10 7c-2.2 0-4.1-.7-5.6-1.7" strokeLinecap="round" />
      <path d="M9.5 9.5c.9-.9 2.1-1.5 3.5-1.5 2.8 0 5 2.2 5 5 0 1.4-.6 2.6-1.5 3.5" strokeLinecap="round" />
      <path d="M3 3l18 18" strokeLinecap="round" />
    </svg>
  );
}
