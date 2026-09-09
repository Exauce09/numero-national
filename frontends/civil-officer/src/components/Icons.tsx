/** Icônes SVG style Modernize / Tabler (Justicia e-gov). */

import type { ReactNode } from "react";

type IconProps = { size?: number; className?: string };

function base({ size = 22, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconUsers(p: IconProps) {
  return base({
    ...p,
    children: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  });
}

export function IconBaby(p: IconProps) {
  return base({
    ...p,
    children: (
      <>
        <path d="M9 12h.01" />
        <path d="M15 12h.01" />
        <path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5" />
        <path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" />
      </>
    ),
  });
}

export function IconHeart(p: IconProps) {
  return base({
    ...p,
    children: <path d="M19.5 12.5 12 20l-7.5-7.5a5 5 0 0 1 7.5-6.6 5 5 0 0 1 7.5 6.6Z" />,
  });
}

export function IconCross(p: IconProps) {
  return base({
    ...p,
    children: (
      <>
        <path d="M10 2h4v6h6v4h-6v10h-4V12H4V8h6V2Z" />
      </>
    ),
  });
}

export function IconRing(p: IconProps) {
  return base({
    ...p,
    children: (
      <>
        <circle cx="9" cy="12" r="5" />
        <circle cx="15" cy="12" r="5" />
      </>
    ),
  });
}

export function IconHome(p: IconProps) {
  return base({
    ...p,
    children: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 10v10h14V10" />
        <path d="M10 20v-6h4v6" />
      </>
    ),
  });
}

export function IconFile(p: IconProps) {
  return base({
    ...p,
    children: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
      </>
    ),
  });
}

export function IconMap(p: IconProps) {
  return base({
    ...p,
    children: (
      <>
        <path d="m9 18-6 3V6l6-3 6 3 6-3v15l-6 3Z" />
        <path d="M9 3v15" />
        <path d="M15 6v15" />
      </>
    ),
  });
}

export function IconSearch(p: IconProps) {
  return base({
    ...p,
    children: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3-3" />
      </>
    ),
  });
}

export function IconClipboard(p: IconProps) {
  return base({
    ...p,
    children: (
      <>
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      </>
    ),
  });
}

export function IconCar(p: IconProps) {
  return base({
    ...p,
    children: (
      <>
        <path d="M5 17h14v-5l-1.5-4.5A2 2 0 0 0 15.6 6H8.4a2 2 0 0 0-1.9 1.5L5 12v5Z" />
        <circle cx="7.5" cy="17.5" r="1.5" />
        <circle cx="16.5" cy="17.5" r="1.5" />
      </>
    ),
  });
}

export function IconSplit(p: IconProps) {
  return base({
    ...p,
    children: (
      <>
        <path d="M16 3h5v5" />
        <path d="M8 3H3v5" />
        <path d="M12 22V8" />
        <path d="m21 3-9 9" />
        <path d="M3 3l9 9" />
      </>
    ),
  });
}

export function IconDashboard(p: IconProps) {
  return base({
    ...p,
    children: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </>
    ),
  });
}

export function IconTable(p: IconProps) {
  return base({
    ...p,
    children: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18" />
        <path d="M3 15h18" />
        <path d="M9 4v16" />
      </>
    ),
  });
}
