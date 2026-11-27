import type { ReactNode } from 'react'

export function SvgIcon({ children, viewBox = '0 0 24 24' }: { children: ReactNode; viewBox?: string }) {
  return <svg viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
}
export function MapPinSmallIcon() { return <SvgIcon><path d="M19 10c0 4-7 11-7 11S5 14 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></SvgIcon> }
export function SearchIcon() { return <SvgIcon><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></SvgIcon> }
export function StoreIcon() { return <SvgIcon><path d="M4 10v10h16V10M3 4h18l-2 6H5L3 4ZM8 14h4v6" /></SvgIcon> }
export function HeartIcon() { return <SvgIcon><path d="M12 21S4 16.5 4 10a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11Z" /><path d="M9 12h6M12 9v6" /></SvgIcon> }
export function BookIcon() { return <SvgIcon><path d="M3 5.5A4.5 4.5 0 0 1 7.5 3H11v17H7.5A4.5 4.5 0 0 0 3 22V5.5ZM21 5.5A4.5 4.5 0 0 0 16.5 3H13v17h3.5a4.5 4.5 0 0 1 4.5 2V5.5Z" /></SvgIcon> }
export function BriefcaseIcon() { return <SvgIcon><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2" /></SvgIcon> }
export function WalkIcon() { return <SvgIcon><circle cx="13" cy="4" r="2" /><path d="m11 8-2 5 4 2 2 6M11 9l5 3 3-1M9 13l-4 6" /></SvgIcon> }
export function SortIcon() { return <SvgIcon><path d="M8 6h12M8 12h9M8 18h6M4 4v16" /></SvgIcon> }
export function ChevronIcon() { return <SvgIcon><path d="m9 18 6-6-6-6" /></SvgIcon> }
export function FlagIcon() { return <SvgIcon><path d="M5 22V3M5 4h12l-2 4 2 4H5" /></SvgIcon> }
export function PlusIcon() { return <SvgIcon><path d="M12 5v14M5 12h14" /></SvgIcon> }
export function MinusIcon() { return <SvgIcon><path d="M5 12h14" /></SvgIcon> }
export function TargetIcon() { return <SvgIcon><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></SvgIcon> }
export function FilterIcon() { return <SvgIcon><path d="M4 6h16M7 12h10M10 18h4" /></SvgIcon> }
export function ListIcon() { return <SvgIcon><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></SvgIcon> }
export function BusIcon() { return <SvgIcon><rect x="4" y="3" width="16" height="14" rx="3" /><path d="M4 11h16M8 21v-4M16 21v-4M8 14h.01M16 14h.01" /></SvgIcon> }
export function TrophyIcon() { return <SvgIcon><path d="M8 4h8v5a4 4 0 0 1-8 0V4ZM8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 21h8M10 17h4" /></SvgIcon> }
export function CompassIcon() { return <SvgIcon><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" /></SvgIcon> }
