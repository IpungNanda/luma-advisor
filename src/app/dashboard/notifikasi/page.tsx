"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiBell,
  FiCheck,
  FiCheckCircle,
  FiChevronRight,
  FiClock,
  FiDollarSign,
  FiPackage,
  FiRefreshCw,
  FiSearch,
  FiShoppingBag,
  FiTrendingDown,
  FiX,
} from "react-icons/fi";

import { auth, db } from "@/lib/firebase";
import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

type AlertRecord = {
  id: string;
  ownerUid: string;
  title?: string;
  message?: string;
  description?: string;
  type?: string;
  category?: string;
  severity?: string;
  status?: string;
  isRead?: boolean;
  read?: boolean;
  createdAt?: unknown;
  date?: string;
  actionUrl?: string;
};

type Product = {
  id: string;
  name: string;
  stock: number;
  minimumStock: number;
};

type Finance = {
  id: string;
  type: string;
  amount: number;
  date: string;
  description: string;
  category: string;
};

type Sale = {
  id: string;
  totalAmount: number;
  date: string;
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  category: "inventory" | "finance" | "sales" | "system";
  severity: "critical" | "warning" | "info" | "success";
  date: Date;
  read: boolean;
  source: "generated" | "firestore";
  sourceId?: string;
  actionUrl?: string;
};

type FilterKey = "all" | "unread" | "inventory" | "finance" | "sales" | "system";

const GOLD = "#D6B36A";
const PAGE_BG = "#FAFAF8";

const FILTERS: { label: string; value: FilterKey }[] = [
  { label: "Semua", value: "all" },
  { label: "Belum dibaca", value: "unread" },
  { label: "Stok", value: "inventory" },
  { label: "Keuangan", value: "finance" },
  { label: "Penjualan", value: "sales" },
  { label: "Sistem", value: "system" },
];

function asNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && value !== null && "toDate" in value) {
    try {
      const parsed = (value as { toDate: () => Date }).toDate();
      return parsed instanceof Date && !Number.isNaN(parsed.getTime()) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

function dateFromString(value: string) {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function relativeDate(date: Date) {
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "Baru saja";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} menit lalu`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} hari lalu`;
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDate(date: Date) {
  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function normalizeCategory(value: unknown): NotificationItem["category"] {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("stok") || text.includes("stock") || text.includes("inventory") || text.includes("product")) return "inventory";
  if (text.includes("finance") || text.includes("keuangan") || text.includes("expense") || text.includes("cash") || text.includes("profit")) return "finance";
  if (text.includes("sale") || text.includes("penjualan") || text.includes("revenue")) return "sales";
  return "system";
}

function normalizeSeverity(value: unknown): NotificationItem["severity"] {
  const text = String(value ?? "").toLowerCase();
  if (text.includes("critical") || text.includes("urgent") || text.includes("danger") || text.includes("high")) return "critical";
  if (text.includes("warning") || text.includes("medium") || text.includes("caution")) return "warning";
  if (text.includes("success") || text.includes("positive") || text.includes("good")) return "success";
  return "info";
}

function categoryLabel(category: NotificationItem["category"]) {
  return {
    inventory: "Stok",
    finance: "Keuangan",
    sales: "Penjualan",
    system: "Sistem",
  }[category];
}

function severityLabel(severity: NotificationItem["severity"]) {
  return {
    critical: "Perlu segera ditangani",
    warning: "Perlu diperhatikan",
    info: "Informasi",
    success: "Kabar baik",
  }[severity];
}

function iconFor(item: NotificationItem) {
  if (item.category === "inventory") return FiPackage;
  if (item.category === "finance") return FiDollarSign;
  if (item.category === "sales") return FiShoppingBag;
  if (item.severity === "critical") return FiAlertCircle;
  if (item.severity === "warning") return FiAlertTriangle;
  if (item.severity === "success") return FiCheckCircle;
  return FiBell;
}

function severityClasses(severity: NotificationItem["severity"]) {
  if (severity === "critical") return "border-rose-200 bg-rose-50 text-rose-700";
  if (severity === "warning") return "border-amber-200 bg-amber-50 text-amber-700";
  if (severity === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function makeGeneratedId(value: string) {
  return `generated-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export default function NotificationsPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <NotificationsDashboard />
      </DashboardLayout>
    </AuthGuard>
  );
}

function NotificationsDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [finance, setFinance] = useState<Finance[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [localReadIds, setLocalReadIds] = useState<string[]>([]);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (current) => {
      setUser(current);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      if (authReady) setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    let pending = 4;
    const completeOne = () => {
      pending -= 1;
      if (pending <= 0) setLoading(false);
    };

    const unsubscribers: (() => void)[] = [];

    const attach = <T,>(
      collectionName: string,
      setter: (items: T[]) => void,
      mapItem: (data: Record<string, unknown>, id: string) => T,
    ) => {
      const q = query(collection(db, collectionName), where("ownerUid", "==", user.uid));
      let firstSnapshot = true;
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          setter(snapshot.docs.map((entry) => mapItem(entry.data() as Record<string, unknown>, entry.id)));
          if (firstSnapshot) {
            firstSnapshot = false;
            completeOne();
          }
        },
        (error) => {
          console.error(`LUMA notifications: ${collectionName}`, error);
          setErrorMessage((current) => current || "Sebagian data notifikasi tidak dapat dimuat. Periksa koneksi dan Firestore Rules.");
          if (firstSnapshot) {
            firstSnapshot = false;
            completeOne();
          }
        },
      );
      unsubscribers.push(unsubscribe);
    };

    attach<AlertRecord>("alerts", (items) => setAlerts(items), (data, id) => ({
      id,
      ownerUid: user.uid,
      title: typeof data.title === "string" ? data.title : undefined,
      message: typeof data.message === "string" ? data.message : undefined,
      description: typeof data.description === "string" ? data.description : undefined,
      type: typeof data.type === "string" ? data.type : undefined,
      category: typeof data.category === "string" ? data.category : undefined,
      severity: typeof data.severity === "string" ? data.severity : undefined,
      status: typeof data.status === "string" ? data.status : undefined,
      isRead: data.isRead === true,
      read: data.read === true,
      createdAt: data.createdAt,
      date: typeof data.date === "string" ? data.date : undefined,
      actionUrl: typeof data.actionUrl === "string" ? data.actionUrl : undefined,
    }));

    attach<Product>("products", (items) => setProducts(items), (data, id) => ({
      id,
      name: String(data.name ?? data.productName ?? "Produk tanpa nama"),
      stock: asNumber(data.stock ?? data.currentStock),
      minimumStock: asNumber(data.minimumStock ?? data.minStock ?? 5),
    }));

    attach<Finance>("financeTransactions", (items) => setFinance(items), (data, id) => ({
      id,
      type: String(data.type ?? ""),
      amount: asNumber(data.amount),
      date: String(data.date ?? ""),
      description: String(data.description ?? data.notes ?? ""),
      category: String(data.category ?? ""),
    }));

    attach<Sale>("salesTransactions", (items) => setSales(items), (data, id) => ({
      id,
      totalAmount: asNumber(data.totalAmount ?? data.total ?? data.amount),
      date: String(data.date ?? ""),
    }));

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [user, authReady]);

  const generated = useMemo<NotificationItem[]>(() => {
    if (!user) return [];
    const result: NotificationItem[] = [];
    const now = new Date();

    for (const product of products) {
      if (product.stock <= 0) {
        result.push({
          id: makeGeneratedId(`stock-empty-${product.id}`),
          title: `${product.name} kehabisan stok`,
          message: "Stok produk saat ini 0. Periksa kebutuhan restok agar penjualan tidak terhambat.",
          category: "inventory",
          severity: "critical",
          date: now,
          read: false,
          source: "generated",
          actionUrl: "/dashboard/produk",
        });
      } else if (product.stock <= Math.max(0, product.minimumStock)) {
        result.push({
          id: makeGeneratedId(`stock-low-${product.id}`),
          title: `Stok ${product.name} menipis`,
          message: `Stok tersisa ${product.stock} unit, sama dengan atau di bawah batas minimum ${product.minimumStock} unit.`,
          category: "inventory",
          severity: "warning",
          date: now,
          read: false,
          source: "generated",
          actionUrl: "/dashboard/produk",
        });
      }
    }

    const expenses = finance.filter((item) => {
      const type = item.type.toLowerCase();
      return type === "expense" || type === "pengeluaran";
    });
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayExpense = expenses
      .filter((item) => item.date === todayKey)
      .reduce((sum, item) => sum + item.amount, 0);
    const sevenDayExpense = expenses
      .filter((item) => {
        const date = dateFromString(item.date);
        return date && date.getTime() >= now.getTime() - 6 * 86_400_000 && date.getTime() <= now.getTime();
      })
      .reduce((sum, item) => sum + item.amount, 0);
    const averageDailyExpense = sevenDayExpense / 7;

    if (todayExpense > 0 && averageDailyExpense > 0 && todayExpense >= averageDailyExpense * 1.75) {
      result.push({
        id: makeGeneratedId("expense-spike-today"),
        title: "Pengeluaran hari ini relatif tinggi",
        message: `Pengeluaran tercatat ${rupiah(todayExpense)} hari ini, lebih dari 1,75 kali rata-rata pengeluaran harian tujuh hari terakhir (${rupiah(averageDailyExpense)}). Tinjau transaksi untuk memastikan semuanya sesuai rencana.`,
        category: "finance",
        severity: "warning",
        date: now,
        read: false,
        source: "generated",
        actionUrl: "/dashboard/keuangan",
      });
    }

    const recentSales = sales.filter((item) => {
      const date = dateFromString(item.date);
      return date && date.getTime() >= now.getTime() - 6 * 86_400_000 && date.getTime() <= now.getTime();
    });
    const currentSales = recentSales.reduce((sum, item) => sum + item.totalAmount, 0);
    const olderSales = sales.filter((item) => {
      const date = dateFromString(item.date);
      return date && date.getTime() >= now.getTime() - 13 * 86_400_000 && date.getTime() < now.getTime() - 6 * 86_400_000;
    }).reduce((sum, item) => sum + item.totalAmount, 0);

    if (olderSales > 0 && currentSales < olderSales * 0.7) {
      result.push({
        id: makeGeneratedId("sales-down-week"),
        title: "Penjualan mingguan menurun",
        message: `Total penjualan tujuh hari terakhir ${rupiah(currentSales)}, lebih rendah dari periode tujuh hari sebelumnya (${rupiah(olderSales)}). Periksa produk terlaris, promosi, dan perubahan permintaan sebelum mengambil keputusan.`,
        category: "sales",
        severity: "warning",
        date: now,
        read: false,
        source: "generated",
        actionUrl: "/dashboard/penjualan",
      });
    }

    return result;
  }, [user, products, finance, sales]);

  const firestoreNotifications = useMemo<NotificationItem[]>(() => {
    return alerts
      .filter((item) => !["deleted", "dismissed", "archived"].includes(String(item.status ?? "").toLowerCase()))
      .map((item) => {
        const date = toDate(item.createdAt) ?? dateFromString(item.date ?? "") ?? new Date(0);
        return {
          id: `firestore-${item.id}`,
          title: item.title?.trim() || "Pemberitahuan LUMA",
          message: item.message?.trim() || item.description?.trim() || "Ada informasi baru yang perlu Anda periksa.",
          category: normalizeCategory(item.category ?? item.type),
          severity: normalizeSeverity(item.severity ?? item.type),
          date,
          read: item.isRead === true || item.read === true || localReadIds.includes(`firestore-${item.id}`),
          source: "firestore" as const,
          sourceId: item.id,
          actionUrl: item.actionUrl,
        };
      });
  }, [alerts, localReadIds]);

  const notifications = useMemo(() => {
    const merged = [...firestoreNotifications, ...generated.map((item) => ({
      ...item,
      read: localReadIds.includes(item.id),
    }))];
    return merged.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [firestoreNotifications, generated, localReadIds]);

  const unreadCount = notifications.filter((item) => !item.read).length;
  const criticalCount = notifications.filter((item) => item.severity === "critical" && !item.read).length;

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("id-ID");
    return notifications.filter((item) => {
      if (filter === "unread" && item.read) return false;
      if (filter !== "all" && filter !== "unread" && item.category !== filter) return false;
      if (term && !`${item.title} ${item.message} ${categoryLabel(item.category)}`.toLocaleLowerCase("id-ID").includes(term)) return false;
      return true;
    });
  }, [notifications, filter, search]);

  async function markRead(item: NotificationItem) {
    if (item.read) return;
    if (item.source === "firestore" && item.sourceId) {
      try {
        await updateDoc(doc(db, "alerts", item.sourceId), {
          isRead: true,
          read: true,
          readAt: serverTimestamp(),
        });
      } catch (error) {
        console.error("Gagal menandai notifikasi sebagai dibaca:", error);
        setErrorMessage("Notifikasi belum dapat diperbarui. Periksa Firestore Rules.");
        return;
      }
    }
    setLocalReadIds((current) => current.includes(item.id) ? current : [...current, item.id]);
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      const unreadFirestore = notifications.filter((item) => !item.read && item.source === "firestore");
      for (const item of unreadFirestore) {
        if (!item.sourceId) continue;
        await updateDoc(doc(db, "alerts", item.sourceId), {
          isRead: true,
          read: true,
          readAt: serverTimestamp(),
        });
      }
      setLocalReadIds((current) => {
        const allUnread = notifications.filter((item) => !item.read).map((item) => item.id);
        return Array.from(new Set([...current, ...allUnread]));
      });
    } catch (error) {
      console.error("Gagal menandai semua notifikasi:", error);
      setErrorMessage("Sebagian notifikasi belum dapat ditandai sebagai dibaca. Periksa Firestore Rules.");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <main className="min-h-screen" style={{ background: PAGE_BG }}>
      <div className="mx-auto max-w-[1400px] space-y-7 p-4 sm:p-6 lg:p-8">
        <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#D6B36A]/40 bg-[#D6B36A]/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-[#8C6B2D]">
              <FiBell size={13} />
              LUMA BUSINESS MONITOR
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#171717] sm:text-4xl">Notifikasi</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55 sm:text-base">
              Pantau hal penting dalam bisnis Anda. LUMA membantu menyoroti kondisi yang perlu diperiksa, tanpa mengambil keputusan atas nama Anda.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-black/[0.07] bg-white px-4 py-3 shadow-sm">
              <p className="text-xs text-black/45">Belum dibaca</p>
              <p className="mt-1 text-2xl font-semibold text-[#171717]">{unreadCount}</p>
            </div>
            <div className="rounded-2xl border border-black/[0.07] bg-white px-4 py-3 shadow-sm">
              <p className="text-xs text-black/45">Prioritas tinggi</p>
              <p className="mt-1 text-2xl font-semibold text-rose-600">{criticalCount}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            icon={<FiAlertTriangle size={18} />}
            label="Perlu perhatian"
            value={String(notifications.filter((item) => !item.read && (item.severity === "critical" || item.severity === "warning")).length)}
            detail="Peringatan stok, keuangan, atau penjualan"
            accent="amber"
          />
          <SummaryCard
            icon={<FiPackage size={18} />}
            label="Masalah stok"
            value={String(notifications.filter((item) => item.category === "inventory" && !item.read).length)}
            detail="Produk yang perlu diperiksa"
            accent="gold"
          />
          <SummaryCard
            icon={<FiCheckCircle size={18} />}
            label="Status pemantauan"
            value={loading ? "Memuat" : errorMessage ? "Periksa" : "Aktif"}
            detail="Data diperbarui secara langsung"
            accent="green"
          />
        </section>

        {errorMessage && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <FiAlertCircle className="mt-0.5 shrink-0" />
            <p>{errorMessage}</p>
            <button onClick={() => setErrorMessage("")} className="ml-auto rounded-lg p-1 hover:bg-amber-100" aria-label="Tutup pesan">
              <FiX size={16} />
            </button>
          </div>
        )}

        <section className="overflow-hidden rounded-3xl border border-black/[0.07] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.025)]">
          <div className="flex flex-col gap-4 border-b border-black/[0.06] p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#171717]">Pusat notifikasi</h2>
              <p className="mt-1 text-sm text-black/45">{filtered.length} pemberitahuan ditampilkan</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="relative block min-w-0 sm:w-64">
                <FiSearch className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-black/35" size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Cari notifikasi..."
                  className="w-full rounded-xl border border-black/10 bg-[#FAFAF8] py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-[#D6B36A] focus:ring-4 focus:ring-[#D6B36A]/10"
                />
              </label>
              <button
                onClick={markAllRead}
                disabled={unreadCount === 0 || markingAll}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium text-[#171717] transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {markingAll ? <FiRefreshCw className="animate-spin" size={15} /> : <FiCheck size={15} />}
                Tandai semua dibaca
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto border-b border-black/[0.06] px-5 py-3 sm:px-6">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                onClick={() => setFilter(item.value)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition ${
                  filter === item.value
                    ? "bg-[#171717] text-white"
                    : "bg-[#F5F5F2] text-black/55 hover:bg-[#ECECE7] hover:text-black"
                }`}
              >
                {item.label}
                {item.value === "unread" && unreadCount > 0 && (
                  <span className={`ml-2 rounded-full px-1.5 py-0.5 ${filter === item.value ? "bg-white/15" : "bg-[#D6B36A]/25 text-[#795B24]"}`}>
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="space-y-4 p-6">
              {[1, 2, 3].map((item) => (
                <div key={item} className="animate-pulse rounded-2xl border border-black/[0.05] p-5">
                  <div className="h-4 w-1/3 rounded bg-black/[0.07]" />
                  <div className="mt-3 h-3 w-3/4 rounded bg-black/[0.05]" />
                  <div className="mt-2 h-3 w-1/2 rounded bg-black/[0.05]" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#D6B36A]/25 bg-[#D6B36A]/10 text-[#9B7838]">
                <FiBell size={25} />
              </div>
              <h3 className="mt-5 text-base font-semibold text-[#171717]">
                {search || filter !== "all" ? "Tidak ada notifikasi yang cocok" : "Semua terlihat tenang"}
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-black/45">
                {search || filter !== "all"
                  ? "Coba ubah kata kunci atau pilih filter lain."
                  : "Belum ada kondisi yang membutuhkan perhatian berdasarkan data yang tersedia. LUMA akan menampilkan peringatan ketika menemukan hal yang perlu diperiksa."}
              </p>
              {(search || filter !== "all") && (
                <button onClick={() => { setSearch(""); setFilter("all"); }} className="mt-4 text-sm font-semibold text-[#8C6B2D] hover:underline">
                  Reset filter
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-black/[0.055]">
              {filtered.map((item) => {
                const Icon = iconFor(item);
                return (
                  <article key={item.id} className={`group flex gap-3 p-5 transition sm:gap-4 sm:px-6 ${!item.read ? "bg-[#D6B36A]/[0.035]" : "bg-white"} hover:bg-[#FAFAF8]`}>
                    <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${severityClasses(item.severity)}`}>
                      <Icon size={19} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={`text-sm sm:text-[15px] ${item.read ? "font-medium text-[#333]" : "font-semibold text-[#171717]"}`}>
                          {item.title}
                        </h3>
                        {!item.read && <span className="h-2 w-2 rounded-full bg-[#D6B36A]" aria-label="Belum dibaca" />}
                      </div>
                      <p className="mt-1.5 max-w-4xl text-sm leading-6 text-black/55">{item.message}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-black/40">
                        <span className="inline-flex items-center gap-1.5"><FiClock size={12} />{relativeDate(item.date)}</span>
                        <span className="h-1 w-1 rounded-full bg-black/20" />
                        <span>{categoryLabel(item.category)}</span>
                        <span className="rounded-full border border-black/[0.07] px-2 py-1">{severityLabel(item.severity)}</span>
                        {item.source === "generated" && <span className="rounded-full bg-[#D6B36A]/10 px-2 py-1 text-[#8C6B2D]">Analisis otomatis</span>}
                      </div>
                      <p className="mt-2 text-[11px] text-black/30">{formatDate(item.date)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {!item.read && (
                        <button onClick={() => void markRead(item)} className="rounded-lg p-2 text-black/35 transition hover:bg-[#D6B36A]/15 hover:text-[#8C6B2D]" title="Tandai sudah dibaca" aria-label={`Tandai ${item.title} sudah dibaca`}>
                          <FiCheck size={16} />
                        </button>
                      )}
                      {item.actionUrl && (
                        <a href={item.actionUrl} className="inline-flex items-center gap-1 text-xs font-semibold text-[#8C6B2D] opacity-80 transition hover:opacity-100">
                          Buka <FiChevronRight size={13} />
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div className="flex flex-col gap-2 border-t border-black/[0.06] bg-[#FAFAF8] px-5 py-4 text-xs leading-5 text-black/40 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <span className="inline-flex items-center gap-2"><FiRefreshCw size={12} />Data bisnis dipantau secara langsung saat halaman terbuka.</span>
            <span>Analisis LUMA adalah alat bantu, bukan pengganti keputusan pemilik bisnis.</span>
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  accent: "amber" | "gold" | "green";
}) {
  const accentClass = {
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    gold: "border-[#D6B36A]/30 bg-[#D6B36A]/10 text-[#8C6B2D]",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  }[accent];

  return (
    <div className="rounded-2xl border border-black/[0.07] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-black/50">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-[#171717]">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${accentClass}`}>{icon}</div>
      </div>
      <p className="mt-3 text-xs leading-5 text-black/40">{detail}</p>
    </div>
  );
}
