import type { SVGProps } from "react";

/** Minimal inline icon set — avoids pulling in an icon dependency. */

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

type Props = SVGProps<SVGSVGElement>;

export const IconCompass = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2.1 5-5 2.1 2.1-5z" />
  </svg>
);

export const IconGrid = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" />
  </svg>
);

export const IconRoute = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="6" cy="19" r="2.5" />
    <circle cx="18" cy="5" r="2.5" />
    <path d="M15.5 5H9a3 3 0 0 0 0 6h6a3 3 0 0 1 0 6H8.5" />
  </svg>
);

export const IconSearch = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </svg>
);

export const IconSpark = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M12 3.5 13.8 9 19.5 10.8 13.8 12.6 12 18.2 10.2 12.6 4.5 10.8 10.2 9z" />
    <path d="M18.5 16.5 19.2 18.6 21.3 19.3 19.2 20 18.5 22.1 17.8 20 15.7 19.3 17.8 18.6z" />
  </svg>
);

export const IconUser = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </svg>
);

export const IconCheck = (p: Props) => (
  <svg {...base} {...p}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
);

export const IconLock = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
);

export const IconThumbUp = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M7 21V10l4.5-7a2.2 2.2 0 0 1 2 3l-1 4h5.2a2 2 0 0 1 2 2.5l-1.8 7A2 2 0 0 1 16 21z" />
    <path d="M7 10H4.5v11H7" />
  </svg>
);

export const IconThumbDown = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M17 3v11l-4.5 7a2.2 2.2 0 0 1-2-3l1-4H6.3a2 2 0 0 1-2-2.5l1.8-7A2 2 0 0 1 8 3z" />
    <path d="M17 14h2.5V3H17" />
  </svg>
);

export const IconArrowRight = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M5 12h14m-5.5-5.5L19 12l-5.5 5.5" />
  </svg>
);

export const IconClock = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);

export const IconInfo = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5m0-8.2v.2" />
  </svg>
);

export const IconSend = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M20 4 3.5 10.2l6.6 2.7 2.7 6.6z" />
    <path d="m10.1 12.9 4.4-4.4" />
  </svg>
);

export const IconRefresh = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M20 11a8 8 0 0 0-13.7-5.2L3.5 8.5" />
    <path d="M4 13a8 8 0 0 0 13.7 5.2l2.8-2.7" />
    <path d="M3.5 4.5v4h4m9 7h4v4" />
  </svg>
);

export const IconTarget = (p: Props) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" />
  </svg>
);

export const IconBook = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M4 5.5A2 2 0 0 1 6 3.5h13v14H6a2 2 0 0 0-2 2z" />
    <path d="M4 19.5a2 2 0 0 1 2-2h13v3H6a2 2 0 0 1-2-1z" />
  </svg>
);

export const IconHammer = (p: Props) => (
  <svg {...base} {...p}>
    <path d="m13.5 6.5 4-4 4 4-4 4z" />
    <path d="m15.5 8.5-9 9a2.1 2.1 0 0 1-3-3l9-9" />
  </svg>
);

export const IconClipboard = (p: Props) => (
  <svg {...base} {...p}>
    <rect x="5" y="4.5" width="14" height="16" rx="2" />
    <path d="M9 4.5V3.5h6v1" />
    <path d="M9 10h6M9 14h4" />
  </svg>
);

export const IconExternal = (p: Props) => (
  <svg {...base} {...p}>
    <path d="M14 4h6v6" />
    <path d="M20 4 11 13" />
    <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 19V8a1.5 1.5 0 0 1 1.5-1.5H10" />
  </svg>
);
