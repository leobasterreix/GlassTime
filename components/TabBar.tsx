"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  {
    href: "/",
    label: "Agenda",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="3.5" />
        <path d="M8 2.5V6M16 2.5V6M3 10h18" />
      </svg>
    ),
  },
  {
    href: "/discover",
    label: "Découvrir",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7.5" />
        <path d="m20.5 20.5-4-4" />
      </svg>
    ),
  },
  {
    href: "/profile",
    label: "Profil",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8.5" r="4" />
        <path d="M4.5 20.5c1.5-3.6 4.2-5.5 7.5-5.5s6 1.9 7.5 5.5" />
      </svg>
    ),
  },
];

export default function TabBar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <nav className="tabbar">
      {TABS.map((t) => {
        const active =
          t.href === "/" ? pathname === "/" : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={active ? "active" : ""}>
            {t.icon}
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
