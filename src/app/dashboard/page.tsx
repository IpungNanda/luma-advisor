"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import {
  FiActivity,
  FiAlertCircle,
  FiArrowDownRight,
  FiArrowUpRight,
  FiBarChart2,
  FiCalendar,
  FiChevronRight,
  FiDollarSign,
  FiInfo,
  FiPackage,
  FiRefreshCw,
  FiShoppingBag,
  FiTrendingUp,
} from "react-icons/fi";

import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { auth, db } from "@/lib/firebase";

type FinanceTransaction = {
  id: string;
  type: "income" | "expense";
  description: string;
  category: string;
  amount: number;
  date: string;
  createdAt?: unknown;
  status?: string;
  isDeleted?: boolean;
  deletedAt?: unknown;
};

type SaleTransaction = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  date: string;
  customerName: string;
  createdAt?: unknown;
  status?: string;
  isDeleted?: boolean;
  deletedAt?: unknown;
};

type Product = {
  id: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minimumStock: number;
  status?: string;
  isDeleted?: boolean;
  deletedAt?: unknown;
};

type StockMovement = {
  id: string;
  productId: string;
  productName: string;
  type: string;
  quantity: number;
  reason: string;
  date: string;
  status?: string;
  isDeleted?: boolean;
  deletedAt?: unknown;
};

type Activity = {
  id: string;
  title: string;
  detail: string;
  date: string;
  amount?: number;
  kind: "income" | "expense" | "sale" | "stock";
};

const GOLD = "#D6B36A";

function currency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function compactCurrency(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `Rp${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (absolute >= 1_000_000) return `Rp${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (absolute >= 1_000) return `Rp${(value / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} rb`;
  return currency(value);
}

function parseDate(value: string) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameMonth(value: string, date = new Date()) {
  const parsed = parseDate(value);
  return !!parsed && parsed.getMonth() === date.getMonth() && parsed.getFullYear() === date.getFullYear();
}

function isPreviousMonth(value: string, date = new Date()) {
  const parsed = parseDate(value);
  const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  return !!parsed && parsed.getMonth() === previous.getMonth() && parsed.getFullYear() === previous.getFullYear();
}

function dateLabel(value: string) {
  const parsed = parseDate(value);
  return parsed
    ? new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(parsed)
    : "Tanggal tidak tersedia";
}

function percentageChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / Math.abs(previous)) * 100;
}

function percentLabel(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

function DashboardContent() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [finance, setFinance] = useState<FinanceTransaction[]>([]);
  const [sales, setSales] = useState<SaleTransaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [liveNow, setLiveNow] = useState(() => new Date());

  // Jam dan tanggal mengikuti waktu lokal perangkat, diperbarui setiap detik.
  useEffect(() => {
    const timer = window.setInterval(() => setLiveNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      setFinance([]);
      setSales([]);
      setProducts([]);
      setMovements([]);
      setLoading(false);
      setErrors(["Sesi login tidak ditemukan. Silakan login kembali."]);
      return;
    }

    setLoading(true);
    setErrors([]);
    let completed = 0;
    const finished = new Set<string>();
    const markFinished = (name: string) => {
      if (finished.has(name)) return;
      finished.add(name);
      completed += 1;
      if (completed >= 4) setLoading(false);
    };

    const subscribe = <T,>(
      collectionName: string,
      setter: (rows: T[]) => void,
      mapDocument: (id: string, data: Record<string, unknown>) => T,
    ) => onSnapshot(
      query(collection(db, collectionName), where("ownerUid", "==", user.uid)),
      (snapshot) => {
        setter(snapshot.docs.map((doc) => mapDocument(doc.id, doc.data() as Record<string, unknown>)));
        markFinished(collectionName);
      },
      (error) => {
        console.error(`Gagal membaca ${collectionName}:`, error);
        setErrors((current) => current.includes(collectionName) ? current : [...current, collectionName]);
        markFinished(collectionName);
      },
    );

    const stopFinance = subscribe<FinanceTransaction>("financeTransactions", setFinance, (id, data) => ({
      id,
      type: String(data.type ?? "") as FinanceTransaction["type"],
      description: String(data.description ?? ""),
      category: String(data.category ?? "Lainnya"),
      amount: Number(data.amount ?? 0),
      date: String(data.date ?? ""),
      createdAt: data.createdAt,
      status: String(data.status ?? ""),
      isDeleted: data.isDeleted === true,
      deletedAt: data.deletedAt,
    }));

    const stopSales = subscribe<SaleTransaction>("salesTransactions", setSales, (id, data) => ({
      id,
      productName: String(data.productName ?? "Produk tanpa nama"),
      quantity: Number(data.quantity ?? 0),
      unitPrice: Number(data.unitPrice ?? 0),
      totalAmount: Number(data.totalAmount ?? 0),
      date: String(data.date ?? ""),
      customerName: String(data.customerName ?? ""),
      createdAt: data.createdAt,
      status: String(data.status ?? ""),
      isDeleted: data.isDeleted === true,
      deletedAt: data.deletedAt,
    }));

    const stopProducts = subscribe<Product>("products", setProducts, (id, data) => ({
      id,
      name: String(data.name ?? "Produk tanpa nama"),
      category: String(data.category ?? "Lainnya"),
      costPrice: Number(data.costPrice ?? 0),
      sellingPrice: Number(data.sellingPrice ?? 0),
      stock: Number(data.stock ?? 0),
      minimumStock: Number(data.minimumStock ?? 5),
      status: String(data.status ?? ""),
      isDeleted: data.isDeleted === true,
      deletedAt: data.deletedAt,
    }));

    const stopMovements = subscribe<StockMovement>("stockMovements", setMovements, (id, data) => ({
      id,
      productId: String(data.productId ?? ""),
      productName: String(data.productName ?? ""),
      type: String(data.type ?? "") as StockMovement["type"],
      quantity: Number(data.quantity ?? 0),
      reason: String(data.reason ?? ""),
      date: String(data.date ?? ""),
      status: String(data.status ?? ""),
      isDeleted: data.isDeleted === true,
      deletedAt: data.deletedAt,
    }));

    return () => {
      stopFinance();
      stopSales();
      stopProducts();
      stopMovements();
    };
  }, [user, authReady, refreshKey]);

  const summary = useMemo(() => {
    const now = liveNow;
    const validDate = (value: string) => {
      const parsed = parseDate(value);
      return !!parsed && parsed.getTime() <= new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    };
    const invalidStatus = (status?: string) =>
      ["deleted", "inactive", "invalid", "cancelled", "canceled", "void", "rejected"].includes((status ?? "").trim().toLowerCase());
    const cleanFinance = finance.filter((item) =>
      !item.isDeleted && !item.deletedAt && !invalidStatus(item.status) &&
      Number.isFinite(item.amount) && item.amount > 0 && validDate(item.date) &&
      ["income", "expense"].includes(item.type)
    );
    const cleanSales = sales.filter((item) =>
      !item.isDeleted && !item.deletedAt && !invalidStatus(item.status) &&
      Number.isSafeInteger(item.quantity) && item.quantity > 0 &&
      Number.isSafeInteger(item.unitPrice) && item.unitPrice > 0 &&
      Number.isFinite(item.totalAmount) && item.totalAmount === item.quantity * item.unitPrice &&
      validDate(item.date) && item.productName.trim().length > 0
    );
    const cleanProducts = products.filter((item) =>
      !item.isDeleted && !item.deletedAt && !invalidStatus(item.status) &&
      item.name.trim().length > 0 && Number.isFinite(item.stock) && item.stock >= 0
    );
    const cleanMovements = movements.filter((item) => {
      const movementType = item.type.trim().toLowerCase();
      const deletionType = ["delete", "deleted", "remove", "removed", "product_deleted", "product-deleted"].includes(movementType);
      const linkedProduct = item.productId
        ? cleanProducts.some((product) => product.id === item.productId)
        : cleanProducts.some((product) => product.name.trim().toLocaleLowerCase("id-ID") === item.productName.trim().toLocaleLowerCase("id-ID"));
      return !item.isDeleted && !item.deletedAt && !invalidStatus(item.status) &&
        !deletionType && ["in", "out"].includes(movementType) &&
        Number.isFinite(item.quantity) && item.quantity > 0 &&
        validDate(item.date) && linkedProduct;
    });
    const monthFinance = cleanFinance.filter((item) => isSameMonth(item.date, now));
    const previousFinance = cleanFinance.filter((item) => isPreviousMonth(item.date, now));
    const monthSales = cleanSales.filter((item) => isSameMonth(item.date, now));
    const previousSales = cleanSales.filter((item) => isPreviousMonth(item.date, now));

    const income = monthFinance.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
    const expense = monthFinance.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
    const previousIncome = previousFinance.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
    const previousExpense = previousFinance.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
    const profit = income - expense;
    const previousProfit = previousIncome - previousExpense;
    const salesTotal = monthSales.reduce((sum, item) => sum + item.totalAmount, 0);
    const previousSalesTotal = previousSales.reduce((sum, item) => sum + item.totalAmount, 0);
    const lowStock = cleanProducts.filter((item) => item.stock <= item.minimumStock);
    const activeProducts = cleanProducts.length;
    const margin = income > 0 ? (profit / income) * 100 : 0;

    const incomeTrend = percentageChange(income, previousIncome);
    const expenseTrend = percentageChange(expense, previousExpense);
    const profitTrend = percentageChange(profit, previousProfit);
    const salesTrend = percentageChange(salesTotal, previousSalesTotal);

    const positiveFactors = [
      profit >= 0,
      margin >= 20,
      lowStock.length === 0 || activeProducts === 0,
      salesTrend >= 0,
    ].filter(Boolean).length;
    const health = cleanFinance.length === 0 && cleanSales.length === 0 && cleanProducts.length === 0
      ? 0
      : Math.max(0, Math.min(100, Math.round(48 + positiveFactors * 11 - Math.min(lowStock.length * 3, 20) - (profit < 0 ? 15 : 0))));

    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const rows = cleanFinance.filter((item) => item.date.slice(0, 7) === monthKey);
      return {
        key: monthKey,
        label: new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date),
        income: rows.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0),
        expense: rows.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0),
      };
    });
    const maxChart = Math.max(1, ...months.flatMap((item) => [item.income, item.expense]));

    const recentActivities: Activity[] = [
      ...cleanFinance.map((item) => ({
        id: `finance-${item.id}`,
        title: item.type === "income" ? "Pemasukan dicatat" : "Pengeluaran dicatat",
        detail: `${item.description || item.category} · ${dateLabel(item.date)}`,
        date: item.date,
        amount: item.amount * (item.type === "expense" ? -1 : 1),
        kind: item.type,
      })),
      ...cleanSales.map((item) => ({
        id: `sale-${item.id}`,
        title: "Transaksi penjualan",
        detail: `${item.productName} · ${item.quantity} item · ${dateLabel(item.date)}`,
        date: item.date,
        amount: item.totalAmount,
        kind: "sale" as const,
      })),
      ...cleanMovements.map((item) => ({
        id: `stock-${item.id}`,
        title: item.type === "in" ? "Stok masuk" : "Stok keluar",
        detail: `${item.productName || "Produk"} · ${item.quantity} item · ${dateLabel(item.date)}`,
        date: item.date,
        kind: "stock" as const,
      })),
    ].sort((a, b) => (parseDate(b.date)?.getTime() ?? 0) - (parseDate(a.date)?.getTime() ?? 0)).slice(0, 5);

    return {
      income, expense, profit, previousIncome, previousExpense, previousProfit,
      salesTotal, previousSalesTotal, monthSalesCount: monthSales.length,
      salesTrend, incomeTrend, expenseTrend, profitTrend, margin, lowStock,
      activeProducts, health, months, maxChart, recentActivities,
    };
  }, [finance, sales, products, movements, liveNow]);

  const insights = useMemo(() => {
    const items: { title: string; description: string; tone: "gold" | "dark" | "red" }[] = [];
    if (summary.profit < 0) {
      items.push({ title: "Pengeluaran melebihi pemasukan", description: `Selisih bulan ini ${currency(Math.abs(summary.profit))}. Evaluasi pengeluaran dan prioritas biaya.`, tone: "red" });
    } else if (summary.profit > 0) {
      items.push({ title: "Bisnis menghasilkan laba", description: `Laba bersih dari pencatatan bulan ini sebesar ${currency(summary.profit)}.`, tone: "gold" });
    }
    if (summary.lowStock.length > 0) {
      items.push({ title: `${summary.lowStock.length} produk perlu dicek`, description: "Stok berada pada atau di bawah batas minimum. Periksa kebutuhan pengadaan sebelum kehabisan.", tone: "red" });
    }
    if (summary.salesTrend > 5) {
      items.push({ title: "Penjualan meningkat", description: `Nilai transaksi penjualan naik ${percentLabel(summary.salesTrend)} dibanding bulan sebelumnya.`, tone: "gold" });
    } else if (summary.salesTrend < -5) {
      items.push({ title: "Penjualan menurun", description: `Nilai transaksi penjualan turun ${percentLabel(Math.abs(summary.salesTrend))}. Tinjau produk dan pola penjualan.`, tone: "dark" });
    }
    if (items.length === 0) {
      items.push({ title: "Lengkapi data bisnis", description: "Catat transaksi keuangan, penjualan, dan stok agar ringkasan serta rekomendasi semakin relevan.", tone: "dark" });
    }
    return items.slice(0, 3);
  }, [summary]);

  const monthName = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(liveNow);
  const healthTitle = summary.health === 0 ? "Data bisnis belum tersedia" : summary.health >= 80 ? "Bisnis Anda dalam kondisi baik" : summary.health >= 60 ? "Bisnis cukup stabil" : "Bisnis perlu perhatian";
  const healthDescription = summary.health === 0
    ? "Mulai catat transaksi dan produk untuk melihat kondisi bisnis Anda."
    : summary.health >= 80
      ? "Indikator berdasarkan data yang tercatat menunjukkan kondisi relatif sehat."
      : summary.health >= 60
        ? "Beberapa indikator perlu dipantau agar kondisi bisnis tetap terjaga."
        : "Periksa arus keuangan, stok, dan tren penjualan untuk menentukan prioritas perbaikan.";

  return (
    <main className="min-h-screen bg-[#FAFAF8] text-[#171717]">
      <header className="border-b border-black/[0.07] bg-white">
        <div className="flex min-h-[88px] items-center justify-between gap-4 px-5 sm:px-6 lg:px-10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#B38735]">Overview</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight lg:text-3xl">Dashboard</h1>
            <p className="mt-1 text-sm text-black/45">Pahami kondisi bisnis Anda hari ini.</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden h-10 items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-3 sm:flex">
              <FiCalendar size={15} className="text-black/45" />
              <div>
                <span className="block text-xs font-medium capitalize text-black/60">{monthName}</span>
                <span className="mt-0.5 block text-[10px] tabular-nums text-black/35">
                  {new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(liveNow)} WIB
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              className="flex h-10 items-center gap-2 rounded-xl border border-black/[0.08] px-3 text-xs font-medium text-black/60 transition hover:border-[#D6B36A]/60 hover:text-black"
              aria-label="Muat ulang data dashboard"
            >
              <FiRefreshCw size={14} />
              <span className="hidden sm:inline">Muat ulang</span>
            </button>
          </div>
        </div>
      </header>

      <div className="px-5 py-6 sm:px-6 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-[1500px]">
          {errors.length > 0 && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <FiAlertCircle className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Sebagian data belum dapat dimuat.</p>
                <p className="mt-1 text-xs leading-5">Periksa Firestore Rules untuk koleksi: {errors.join(", ")}. Data yang berhasil dibaca tetap ditampilkan.</p>
              </div>
            </div>
          )}

          <section className="rounded-2xl border border-black/[0.07] bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.025)] lg:p-7">
            <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#D6B36A]/10"><FiTrendingUp size={16} className="text-[#B38735]" /></span>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45">Business Health</p>
                </div>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight">{loading ? "Menghitung kondisi bisnis..." : healthTitle}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-black/45">{healthDescription}</p>
                <p className="mt-3 text-[11px] text-black/35">Skor indikator berbasis data tercatat, bukan penilaian otomatis oleh AI.</p>
              </div>
              <div className="flex items-center gap-5">
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full" style={{ background: `conic-gradient(${GOLD} ${summary.health * 3.6}deg, #D6B36A33 0deg)` }}>
                  <div className="absolute inset-[8px] flex items-center justify-center rounded-full bg-white">
                    <div className="text-center">
                      <p className="text-3xl font-semibold tabular-nums">{loading ? "—" : summary.health}</p>
                      <p className="text-[9px] uppercase tracking-[0.15em] text-black/40">Score / 100</p>
                    </div>
                  </div>
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs text-black/40">Periode</p>
                  <p className="mt-1 text-sm font-semibold capitalize">{monthName}</p>
                  <p className="mt-1 text-[11px] text-black/35">Diperbarui langsung dari data</p>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-3">
            <MetricCard title="Money In" value={compactCurrency(summary.income)} trend={summary.incomeTrend} icon={<FiArrowDownRight size={17} />} note="pemasukan bulan ini" loading={loading} />
            <MetricCard title="Money Out" value={compactCurrency(summary.expense)} trend={summary.expenseTrend} icon={<FiArrowUpRight size={17} />} note="pengeluaran bulan ini" loading={loading} expense />
            <MetricCard title="Profit" value={compactCurrency(summary.profit)} trend={summary.profitTrend} icon={<FiDollarSign size={17} />} note="pemasukan dikurangi pengeluaran" loading={loading} highlighted />
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.7fr_1fr]">
            <div className="rounded-2xl border border-black/[0.07] bg-white p-5 sm:p-6 lg:p-7">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">Financial Overview</p>
                  <h2 className="mt-2 text-lg font-semibold">Arus keuangan</h2>
                  <p className="mt-1 text-xs text-black/40">Enam bulan terakhir berdasarkan transaksi keuangan.</p>
                </div>
                <Link href="/dashboard/laporan" className="flex shrink-0 items-center gap-1 text-xs font-medium text-[#B38735] transition hover:text-[#8E6927]">Lihat laporan <FiChevronRight size={14} /></Link>
              </div>
              <div className="mt-7">
                <div className="relative h-[230px]">
                  <div className="absolute inset-0 flex flex-col justify-between">
                    {[1, 2, 3, 4, 5].map((item) => <div key={item} className="border-t border-black/[0.055]" />)}
                  </div>
                  <div className="absolute inset-0 flex items-end gap-2 px-1 pb-1 pt-3 sm:gap-4">
                    {summary.months.map((item) => (
                      <div key={item.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                        <div className="flex h-full w-full items-end justify-center gap-1">
                          <div title={`Pemasukan ${item.label}: ${currency(item.income)}`} className="w-3 max-w-[22px] rounded-t-md bg-[#D6B36A] transition-all sm:w-5" style={{ height: `${Math.max(item.income > 0 ? 3 : 0, item.income / summary.maxChart * 100)}%` }} />
                          <div title={`Pengeluaran ${item.label}: ${currency(item.expense)}`} className="w-3 max-w-[22px] rounded-t-md bg-black/15 transition-all sm:w-5" style={{ height: `${Math.max(item.expense > 0 ? 3 : 0, item.expense / summary.maxChart * 100)}%` }} />
                        </div>
                        <span className="mt-3 text-[10px] capitalize text-black/40">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-5">
                  <Legend color="#D6B36A" label="Money In" />
                  <Legend color="#D4D4D4" label="Money Out" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#D6B36A]/25 bg-white p-5 sm:p-6 lg:p-7">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D6B36A]/10"><FiBarChart2 size={18} className="text-[#B38735]" /></div>
                <div>
                  <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-[#B38735]">LUMA</p>
                  <h2 className="mt-0.5 text-sm font-semibold">Ringkasan insight</h2>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {insights.map((item, index) => (
                  <div key={`${item.title}-${index}`} className={`rounded-xl border p-4 ${item.tone === "red" ? "border-red-100 bg-red-50/60" : "border-black/[0.06] bg-[#FAFAF8]"}`}>
                    <div className="flex gap-3">
                      <div className={`mt-0.5 ${item.tone === "red" ? "text-red-600" : item.tone === "gold" ? "text-[#B38735]" : "text-black/45"}`}>
                        {item.tone === "red" ? <FiAlertCircle size={16} /> : item.tone === "gold" ? <FiTrendingUp size={16} /> : <FiActivity size={16} />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold">{item.title}</p>
                        <p className="mt-1 text-[11px] leading-5 text-black/50">{item.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/dashboard/analisis-bisnis" className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-black/[0.08] py-3 text-xs font-semibold text-black/60 transition hover:border-[#D6B36A]/40 hover:bg-[#D6B36A]/5 hover:text-[#8E6927]">
                Lihat analisis bisnis <FiChevronRight size={14} />
              </Link>
            </div>
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-3">
            <OperationalCard icon={<FiShoppingBag size={17} />} title="Penjualan" value={`${summary.monthSalesCount} transaksi`} note={`${compactCurrency(summary.salesTotal)} nilai penjualan bulan ini`} href="/dashboard/penjualan" />
            <OperationalCard icon={<FiPackage size={17} />} title="Produk" value={`${summary.activeProducts} produk`} note={summary.lowStock.length ? `${summary.lowStock.length} produk perlu dicek stoknya` : "Tidak ada stok di bawah batas minimum"} href="/dashboard/produk" warning={summary.lowStock.length > 0} />
            <OperationalCard icon={<FiBarChart2 size={17} />} title="Margin tercatat" value={`${summary.margin.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`} note="Laba keuangan dibanding pemasukan bulan ini" href="/dashboard/laporan" />
          </section>

          <section className="mt-6 rounded-2xl border border-black/[0.07] bg-white">
            <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-5 sm:px-6">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-black/35">Activity</p>
                <h2 className="mt-1 text-sm font-semibold">Aktivitas terbaru</h2>
              </div>
              <Link href="/dashboard/laporan" className="text-xs font-medium text-[#B38735] hover:text-[#8E6927]">Lihat laporan</Link>
            </div>
            {summary.recentActivities.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-black/[0.035]"><FiActivity className="text-black/35" size={18} /></div>
                <p className="mt-3 text-sm font-medium">Belum ada aktivitas</p>
                <p className="mt-1 text-xs text-black/40">Aktivitas transaksi dan stok akan muncul di sini setelah data dicatat.</p>
              </div>
            ) : (
              <div className="divide-y divide-black/[0.05]">
                {summary.recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${activity.kind === "income" || activity.kind === "sale" ? "bg-[#D6B36A]/10 text-[#B38735]" : activity.kind === "expense" ? "bg-red-50 text-red-500" : "bg-black/[0.035] text-black/45"}`}>
                        {activity.kind === "stock" ? <FiPackage size={16} /> : activity.kind === "expense" ? <FiArrowUpRight size={16} /> : <FiDollarSign size={16} />}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium">{activity.title}</p>
                        <p className="mt-0.5 truncate text-[10px] text-black/40">{activity.detail}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {typeof activity.amount === "number" && <p className={`text-xs font-semibold ${activity.amount < 0 ? "text-red-600" : "text-black"}`}>{activity.amount > 0 ? "+" : ""}{currency(activity.amount)}</p>}
                      <p className="mt-1 text-[10px] text-black/35">{dateLabel(activity.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="mt-8 flex items-center justify-center gap-2 pb-4 text-center">
            <FiInfo size={13} className="shrink-0 text-black/25" />
            <p className="text-[10px] text-black/35">Ringkasan dihitung dari data yang tersedia pada akun Anda. LUMA membantu analisis; keputusan bisnis tetap berada pada pemilik usaha.</p>
          </div>
        </div>
      </div>
    </main>
  );
}

function MetricCard({
  title, value, trend, icon, note, loading, expense = false, highlighted = false,
}: {
  title: string;
  value: string;
  trend: number;
  icon: React.ReactNode;
  note: string;
  loading: boolean;
  expense?: boolean;
  highlighted?: boolean;
}) {
  const positive = expense ? trend <= 0 : trend >= 0;
  return (
    <div className={`group rounded-2xl border p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.04)] ${highlighted ? "border-[#D6B36A]/25 bg-[#D6B36A]/[0.045]" : "border-black/[0.07] bg-white"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-black/40">{title}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight">{loading ? "Memuat..." : value}</p>
        </div>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${highlighted ? "bg-[#D6B36A]/15 text-[#B38735]" : "bg-black/[0.035] text-black/50"}`}>{icon}</div>
      </div>
      <div className="mt-5 flex items-center gap-2">
        <span className={`flex items-center gap-1 text-[11px] font-semibold ${positive ? "text-[#8E6927]" : "text-red-600"}`}>
          {trend >= 0 ? <FiArrowUpRight size={12} /> : <FiArrowDownRight size={12} />}
          {loading ? "—" : percentLabel(trend)}
        </span>
        <span className="text-[11px] text-black/35">vs bulan lalu</span>
      </div>
      <p className="mt-2 text-[10px] text-black/35">{note}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /><span className="text-[10px] text-black/45">{label}</span></div>;
}

function OperationalCard({
  icon, title, value, note, href, warning = false,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  note: string;
  href: string;
  warning?: boolean;
}) {
  return (
    <Link href={href} className="block rounded-2xl border border-black/[0.07] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[0.035] text-black/50">{icon}</div>
        <div>
          <p className="text-[11px] text-black/40">{title}</p>
          <p className="mt-0.5 text-sm font-semibold">{value}</p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className={`text-[10px] ${warning ? "text-red-600" : "text-black/40"}`}>{note}</span>
        <FiChevronRight size={14} className="shrink-0 text-black/30" />
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <DashboardContent />
      </DashboardLayout>
    </AuthGuard>
  );
}
