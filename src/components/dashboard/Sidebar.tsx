
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";
import {
  FiActivity,
  FiBarChart2,
  FiBell,
  FiBox,
  FiChevronRight,
  FiClipboard,
  FiDollarSign,
  FiHome,
  FiLogOut,
  FiMenu,
  FiMessageCircle,
  FiX,
  FiAlertCircle,
  FiSettings,
  FiShoppingBag,
  FiUsers,
} from "react-icons/fi";

import { auth } from "@/lib/firebase";

const menuItems = [
  { label: "Dashboard", href: "/dashboard", icon: FiHome },
  { label: "Keuangan", href: "/dashboard/keuangan", icon: FiDollarSign },
  { label: "Penjualan", href: "/dashboard/penjualan", icon: FiShoppingBag },
  { label: "Produk & Stok", href: "/dashboard/produk", icon: FiBox },
  { label: "Pelanggan", href: "/dashboard/pelanggan", icon: FiUsers },
  { label: "Laporan", href: "/dashboard/laporan", icon: FiClipboard },
];

const advisorItems = [
  { label: "LUMA Advisor", href: "/dashboard/advisor", icon: FiMessageCircle },
  { label: "Analisis Bisnis", href: "/dashboard/analisis", icon: FiActivity },
  
  { label: "Notifikasi", href: "/dashboard/notifikasi", icon: FiBell },
];

type MenuItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
  }>;
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }

    return pathname.startsWith(href);
  };

  // Tutup drawer ketika pengguna berpindah halaman.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Izinkan drawer ditutup menggunakan tombol Escape.
  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  // Cegah halaman di belakang drawer ikut bergulir pada perangkat kecil.
  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError("");

    try {
      await signOut(auth);
      setMobileOpen(false);
      router.replace("/");
    } catch (error) {
      console.error("Logout error:", error);
      setLogoutError("Gagal keluar. Silakan coba lagi.");
      setLoggingOut(false);
    }
  };

  const renderMenu = (items: MenuItem[]) =>
    items.map((item) => {
      const Icon = item.icon;
      const active = isActive(item.href);

      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileOpen(false)}
          aria-current={active ? "page" : undefined}
          className={`group flex min-h-[44px] min-w-0 items-center gap-3 rounded-xl px-3 text-sm transition-colors duration-200 ${
            active
              ? "bg-[#D6B36A]/10 font-semibold text-[#8E6927]"
              : "text-black/55 hover:bg-black/[0.03] hover:text-black"
          }`}
        >
          <Icon
            size={18}
            strokeWidth={active ? 2 : 1.7}
            className={`shrink-0 transition-colors ${
              active
                ? "text-[#B38735]"
                : "text-black/40 group-hover:text-black/70"
            }`}
          />

          <span className="min-w-0 flex-1 break-words">
            {item.label}
          </span>

          {active && (
            <FiChevronRight
              size={15}
              strokeWidth={2}
              className="shrink-0 text-[#B38735]"
            />
          )}
        </Link>
      );
    });

  const sidebarContent = (
    <>
      {/* LOGO */}
      <div className="flex h-[88px] shrink-0 items-center justify-between border-b border-black/[0.08] px-5 sm:h-[96px] sm:px-6">
        <Link
          href="/dashboard"
          onClick={() => setMobileOpen(false)}
          className="group flex min-w-0 items-center gap-3"
        >
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white sm:h-12 sm:w-12">
            <Image
              src="/logo/luma.jpg"
              alt="LUMA"
              width={48}
              height={48}
              priority
              className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.04]"
            />
          </div>

          <div className="min-w-0">
            <h1 className="text-[19px] font-semibold tracking-[-0.02em] text-black">
              LUMA
            </h1>
            <p className="mt-0.5 text-[8px] font-medium uppercase tracking-[0.18em] text-black/40">
              Your Business Advisor
            </p>
          </div>
        </Link>

        {/* Tombol tutup hanya pada drawer mobile */}
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Tutup menu navigasi"
          className="ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-black/55 transition hover:bg-black/[0.05] hover:text-black lg:hidden"
        >
          <FiX size={21} />
        </button>
      </div>

      {/* NAVIGATION */}
      <nav
        aria-label="Navigasi utama"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:py-6"
      >
        <div>
          <p className="mb-3 px-3 text-[9px] font-semibold uppercase tracking-[0.25em] text-black/35">
            Workspace
          </p>

          <div className="space-y-1">
            {renderMenu(menuItems)}
          </div>
        </div>

        <div className="mt-7 sm:mt-8">
          <p className="mb-3 px-3 text-[9px] font-semibold uppercase tracking-[0.25em] text-black/35">
            Intelligence
          </p>

          <div className="space-y-1">
            {renderMenu(advisorItems)}
          </div>
        </div>
      </nav>

      {/* BOTTOM MENU */}
      <div className="shrink-0 border-t border-black/[0.08] px-4 py-4 sm:px-5">
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="group mt-1 flex min-h-[44px] w-full items-center gap-3 rounded-xl px-3 text-sm text-black/50 transition-colors duration-200 hover:bg-[#D6B36A]/10 hover:text-[#8E6927] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FiLogOut
            size={18}
            className="shrink-0 text-black/40 transition-colors group-hover:text-[#B38735]"
          />

          <span>
            {loggingOut ? "Sedang keluar..." : "Keluar"}
          </span>
        </button>

        {logoutError && (
          <p
            role="alert"
            className="mt-2 flex items-start gap-2 px-3 text-xs leading-5 text-red-600"
          >
            <FiAlertCircle className="mt-0.5 shrink-0" />
            <span>{logoutError}</span>
          </p>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] px-3 pt-3">
          <p className="text-[8px] font-medium uppercase tracking-[0.2em] text-black/30">
            LUMA
          </p>
          <p className="text-[8px] tracking-[0.12em] text-black/25">
            © 2026
          </p>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* MOBILE TOP BAR */}
      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b border-black/[0.08] bg-white/95 px-4 backdrop-blur-md lg:hidden">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2.5"
        >
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg">
            <Image
              src="/logo/luma.jpg"
              alt="LUMA"
              width={36}
              height={36}
              priority
              className="h-full w-full object-contain"
            />
          </div>

          <div className="min-w-0">
            <p className="text-base font-semibold tracking-tight text-black">
              LUMA
            </p>
            <p className="text-[8px] uppercase tracking-[0.16em] text-black/40">
              Your Business Advisor
            </p>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Buka menu navigasi"
          aria-expanded={mobileOpen}
          aria-controls="luma-mobile-sidebar"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-black/[0.08] bg-white text-black transition hover:bg-black/[0.03] active:scale-95"
        >
          <FiMenu size={22} />
        </button>
      </header>

      {/* DESKTOP SIDEBAR */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[270px] flex-col border-r border-black/[0.08] bg-white lg:flex">
        {sidebarContent}
      </aside>

      {/* MOBILE / TABLET DRAWER */}
      <div
        className={`fixed inset-0 z-50 lg:hidden ${
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
      >
        {/* Backdrop */}
        <button
          type="button"
          tabIndex={mobileOpen ? 0 : -1}
          aria-label="Tutup menu navigasi"
          onClick={() => setMobileOpen(false)}
          className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Drawer */}
        <aside
          id="luma-mobile-sidebar"
          aria-label="Menu navigasi mobile"
          className={`absolute inset-y-0 left-0 flex w-[min(300px,85vw)] max-w-full flex-col border-r border-black/[0.08] bg-white shadow-2xl transition-transform duration-300 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebarContent}
        </aside>
      </div>
    </>
  );
}
