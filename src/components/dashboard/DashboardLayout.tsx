
"use client";

import type { ReactNode } from "react";
import Sidebar from "./Sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-clip bg-[#FAFAF9] text-black">
      {/* Sidebar desktop dan drawer mobile */}
      <Sidebar />

      {/* Konten utama */}
      <main
        className="
          min-h-screen
          min-w-0
          w-full
          pt-16
          transition-[padding]
          duration-200
          lg:ml-[270px]
          lg:w-[calc(100%-270px)]
          lg:pt-0
        "
      >
        <div className="min-w-0 w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
