"use client";

import { ReactNode, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

import { auth } from "@/lib/firebase";

interface AuthGuardProps {
  children: ReactNode;
}

export default function AuthGuard({
  children,
}: AuthGuardProps) {
  const router = useRouter();

  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] =
    useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        if (user) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
          router.replace("/");
        }

        setCheckingAuth(false);
      }
    );

    return () => unsubscribe();
  }, [router]);

  // Selama Firebase mengecek session
  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#D6B36A] border-t-transparent" />

          <p className="text-sm text-black/50">
            Memeriksa sesi...
          </p>
        </div>
      </main>
    );
  }

  // Jika tidak login, jangan render halaman
  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}