
"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import {
  FiArrowRight,
  FiEye,
  FiEyeOff,
  FiLock,
  FiMail,
} from "react-icons/fi";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";

import { auth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Email wajib diisi.");
      return;
    }

    if (!password) {
      setError("Password wajib diisi.");
      return;
    }

    try {
      setLoading(true);

      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      router.replace("/dashboard");
    } catch (err: unknown) {
      const errorCode =
        err && typeof err === "object" && "code" in err
          ? String(err.code)
          : "";

      switch (errorCode) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          setError("Email atau password salah.");
          break;

        case "auth/invalid-email":
          setError("Format email tidak valid.");
          break;

        case "auth/too-many-requests":
          setError(
            "Terlalu banyak percobaan login. Coba lagi nanti."
          );
          break;

        case "auth/user-disabled":
          setError("Akun ini telah dinonaktifkan.");
          break;

        case "auth/operation-not-allowed":
          setError(
            "Login Email/Password belum diaktifkan di Firebase."
          );
          break;

        default:
          console.error("Login error:", err);
          setError(
            "Login gagal. Periksa koneksi dan konfigurasi Firebase."
          );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-black">
      {/* Dekorasi gold */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full border-[2px] border-[#D6B36A]/70" />
      <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full border border-[#D6B36A]/40" />

      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full border-[2px] border-[#D6B36A]/60" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-72 w-72 rounded-full border border-[#D6B36A]/30" />

      {/* Brand statement */}
      <div className="absolute right-8 top-8 hidden text-right md:block lg:right-12 lg:top-10">
        <p className="text-[10px] font-medium uppercase tracking-[0.35em] text-black/50">
          Simple Business
        </p>
        <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.35em] text-black/50">
          Brighter Future
        </p>
        <div className="ml-auto mt-3 h-px w-14 bg-[#D6B36A]" />
      </div>

      {/* Main content */}
      <section className="relative z-10 flex min-h-screen items-center justify-center px-5 py-12 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-[590px]"
        >
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: 0.6,
              delay: 0.1,
              ease: "easeOut",
            }}
            className="mb-8 flex justify-center"
          >
            <Image
              src="/logo/luma.jpg"
              alt="LUMA - Your Business Advisor"
              width={500}
              height={500}
              priority
              className="h-auto w-[190px] object-contain sm:w-[220px]"
            />
          </motion.div>

          {/* Welcome */}
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Selamat Datang{" "}
              <span className="text-[#C49A4A]">Kembali</span>
            </h1>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-black/50 sm:text-base">
              Masuk ke LUMA dan kelola bisnis Anda dengan lebih mudah dan
              terarah.
            </p>
          </div>

          {/* Login form */}
          <motion.form
            onSubmit={handleLogin}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="space-y-5"
          >
            {error && (
              <motion.div
                role="alert"
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                {error}
              </motion.div>
            )}

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-semibold"
              >
                Email
              </label>

              <div className="relative">
                <FiMail
                  size={19}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-black/50"
                />

                <input
                  id="email"
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  autoComplete="username"
                  required
                  disabled={loading}
                  className="h-[54px] w-full rounded-xl border border-black/15 bg-white pl-12 pr-4 text-sm text-black outline-none transition-all duration-200 placeholder:text-black/35 hover:border-black/25 focus:border-[#D6B36A] focus:ring-4 focus:ring-[#D6B36A]/10 disabled:cursor-not-allowed disabled:bg-black/[0.02]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-semibold"
                >
                  Password
                </label>

                <button
                  type="button"
                  onClick={() =>
                    setError(
                      "Fitur reset password belum diaktifkan."
                    )
                  }
                  disabled={loading}
                  className="text-xs font-medium text-[#B38735] transition-colors hover:text-[#8E6927]"
                >
                  Lupa password?
                </button>
              </div>

              <div className="relative">
                <FiLock
                  size={19}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-black/50"
                />

                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  className="h-[54px] w-full rounded-xl border border-black/15 bg-white pl-12 pr-12 text-sm text-black outline-none transition-all duration-200 placeholder:text-black/35 hover:border-black/25 focus:border-[#D6B36A] focus:ring-4 focus:ring-[#D6B36A]/10 disabled:cursor-not-allowed disabled:bg-black/[0.02]"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  aria-label={
                    showPassword
                      ? "Sembunyikan password"
                      : "Tampilkan password"
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-black/40 transition-colors hover:text-[#B38735]"
                >
                  {showPassword ? (
                    <FiEyeOff size={19} />
                  ) : (
                    <FiEye size={19} />
                  )}
                </button>
              </div>
            </div>

            {/* Login button */}
            <button
              type="submit"
              disabled={loading}
              className="group flex h-[54px] w-full items-center justify-center gap-3 rounded-xl bg-[#D6B36A] text-sm font-semibold text-white shadow-[0_10px_25px_rgba(214,179,106,0.20)] transition-all duration-300 hover:bg-[#C49A4A] hover:shadow-[0_12px_30px_rgba(214,179,106,0.28)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>
                {loading ? "Memeriksa akun..." : "Masuk ke LUMA"}
              </span>

              {!loading && (
                <FiArrowRight
                  size={20}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              )}
            </button>
          </motion.form>

          {/* Footer */}
          <div className="mt-12 flex flex-col items-center justify-between gap-4 text-[9px] uppercase tracking-[0.3em] text-black/35 sm:flex-row">
            <span>© 2026 LUMA</span>

            <div className="flex items-center gap-3">
              <span>Grow</span>
              <span>Analyze</span>
              <span>Make a Better Decision</span>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
