"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarDots,
  ChatCircleText,
  ChartLineUp,
  List,
  PlugsConnected,
  SignOut,
  SlidersHorizontal,
  X,
} from "@phosphor-icons/react";
import { BrandMark } from "@/components/brand";
import { logout } from "../(auth)/actions";

const NAV = [
  { href: "/dashboard", label: "Resumen", icon: ChartLineUp },
  { href: "/conversaciones", label: "Conversaciones", icon: ChatCircleText },
  { href: "/citas", label: "Citas", icon: CalendarDots },
  { href: "/personalizacion", label: "Personalización", icon: SlidersHorizontal },
  { href: "/integraciones", label: "Integraciones", icon: PlugsConnected },
];

export function Sidebar({ orgName, userName }: { orgName: string; userName: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Alto fijo: conversaciones/layout.tsx lo descuenta del viewport */}
      <header className="flex h-16 items-center justify-between border-b border-line bg-paper px-4 md:hidden">
        <BrandMark />
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="app-nav"
          className="rounded-lg p-2 text-ink hover:bg-ink/5"
        >
          {open ? <X size={22} /> : <List size={22} />}
          <span className="sr-only">Menú</span>
        </button>
      </header>

      <aside
        id="app-nav"
        className={`${open ? "block" : "hidden"} border-b border-line bg-paper md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-r md:border-b-0`}
      >
        <div className="hidden px-5 pt-6 pb-8 md:block">
          <BrandMark />
        </div>
        <nav className="flex flex-col gap-0.5 px-3 py-3 md:py-0">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "bg-haze text-royal-dark" : "text-ink-soft hover:bg-ink/5 hover:text-ink"
                }`}
              >
                <Icon size={20} weight={active ? "fill" : "regular"} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-line px-5 py-4">
          <p className="truncate text-sm font-medium text-ink">{orgName}</p>
          {userName && <p className="truncate text-xs text-ink-soft">{userName}</p>}
          <form action={logout} className="mt-3">
            <button type="submit" className="flex items-center gap-2 text-sm text-ink-soft hover:text-ink">
              <SignOut size={18} />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
