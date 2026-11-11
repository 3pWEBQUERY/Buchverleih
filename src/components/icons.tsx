/** Schlichte Linien-Icons, 1.5 px, auf 24er-Raster. */
import type { SVGProps } from "react";

const I = (d: React.ReactNode) =>
  function Icon(p: SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
        {d}
      </svg>
    );
  };

export const IconHome = I(<><path d="M4 10.5 12 4l8 6.5" /><path d="M6 9v10h12V9" /></>);
export const IconSearch = I(<><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>);
export const IconShelf = I(<><path d="M3 20h18" /><path d="M5 20V6h3v14" /><path d="M9 20V4h3v16" /><path d="m13.5 20 2.6-13.5 2.9.6L16.4 20" /></>);
export const IconLoans = I(<><path d="M4 8h13l-3-3" /><path d="M20 16H7l3 3" /></>);
export const IconUser = I(<><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c1.2-3.5 3.8-5 7-5s5.8 1.5 7 5" /></>);
export const IconBell = I(<><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15Z" /><path d="M10 20a2 2 0 0 0 4 0" /></>);
export const IconCircles = I(<><circle cx="9" cy="12" r="5" /><circle cx="15" cy="12" r="5" /></>);
export const IconBookmark = I(<path d="M7 4h10v16l-5-3.5L7 20Z" />);
export const IconScan = I(<><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M4 12h16" /></>);
export const IconPlus = I(<path d="M12 5v14M5 12h14" />);
export const IconSettings = I(<><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></>);
export const IconShield = I(<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6Z" />);
export const IconArrowRight = I(<path d="M5 12h14m-5-5 5 5-5 5" />);
export const IconArrowLeft = I(<path d="M19 12H5m5-5-5 5 5 5" />);
export const IconClose = I(<path d="M6 6l12 12M18 6 6 18" />);
export const IconCamera = I(<><path d="M4 8h3l1.5-2h7L17 8h3v11H4Z" /><circle cx="12" cy="13" r="3.5" /></>);
export const IconCalendar = I(<><rect x="4" y="5" width="16" height="15" rx="1" /><path d="M4 10h16M9 3v4M15 3v4" /></>);
export const IconChat = I(<path d="M5 5h14v10H10l-4 4v-4H5Z" />);
export const IconCheck = I(<path d="m5 12.5 4.5 4.5L19 7" />);
export const IconSwap = I(<><path d="M7 4 4 7l3 3" /><path d="M4 7h12a4 4 0 0 1 0 8h-1" /><path d="m17 20 3-3-3-3" /><path d="M20 17H8a4 4 0 0 1 0-8h1" /></>);
export const IconFlag = I(<><path d="M5 21V4" /><path d="M5 4h11l-2 4 2 4H5" /></>);
export const IconDots = I(<><circle cx="6" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="18" cy="12" r="1" /></>);
