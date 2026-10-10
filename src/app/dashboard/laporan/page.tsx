"use client";

import {

  useCallback,

  useEffect,

  useMemo,

  useState,

  type ReactNode,

} from "react";

import {

  collection,

  onSnapshot,

  query,

  where,

} from "firebase/firestore";

import { onAuthStateChanged, type User } from "firebase/auth";

import {

  FiActivity,

  FiAlertCircle,

  FiCalendar,

  FiDownload,

  FiDollarSign,

  FiPackage,

  FiPrinter,

  FiRefreshCw,

  FiShoppingBag,

  FiTrendingDown,

  FiTrendingUp,

  FiUsers,

} from "react-icons/fi";

import { auth, db } from "@/lib/firebase";

import AuthGuard from "@/components/auth/AuthGuard";

import DashboardLayout from "@/components/dashboard/DashboardLayout";

type FinanceTransaction = {

  id: string;

  ownerUid: string;

  type: "income" | "expense";

  description: string;

  category: string;

  amount: number;

  date: string;

  createdAt?: unknown;

};

type SaleTransaction = {

  id: string;

  ownerUid: string;

  productName: string;

  quantity: number;

  unitPrice: number;

  totalAmount: number;

  date: string;

  customerName: string;

  paymentMethod: string;

  createdAt?: unknown;

};

type Product = {

  id: string;

  ownerUid: string;

  name: string;

  category: string;

  costPrice: number;

  sellingPrice: number;

  stock: number;

  minimumStock: number;

};

type Customer = {

  id: string;

  ownerUid: string;

  name: string;

  createdAt?: unknown;

};

type StockMovement = {

  id: string;

  ownerUid: string;

  productId: string;

  productName: string;

  type: "in" | "out";

  quantity: number;

  reason: string;

  date: string;

};

type Period = "7days" | "30days" | "thisMonth" | "lastMonth" | "thisYear" | "all" | "custom";

const GOLD = "#D6B36A";

const PAGE_BG = "#FAFAF8";

function toDateInput(date: Date) {

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;

}

function dateStart(date: Date) {

  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  return result;

}

function dateEnd(date: Date) {

  const result = new Date(date);

  result.setHours(23, 59, 59, 999);

  return result;

}

function parseDate(value: string) {

  if (!value) return null;

  const parsed = new Date(`${value}T00:00:00`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;

}

function dateInRange(value: string, start: Date | null, end: Date | null) {

  const parsed = parseDate(value);

  if (!parsed) return false;

  const time = parsed.getTime();

  return (!start || time >= dateStart(start).getTime()) &&

    (!end || time <= dateEnd(end).getTime());

}

function rupiah(value: number) {

  return new Intl.NumberFormat("id-ID", {

    style: "currency",

    currency: "IDR",

    maximumFractionDigits: 0,

  }).format(Number.isFinite(value) ? value : 0);

}

function numberLabel(value: number) {

  return new Intl.NumberFormat("id-ID").format(value || 0);

}

function compactDate(value: string) {

  const parsed = parseDate(value);

  if (!parsed) return value || "—";

  return parsed.toLocaleDateString("id-ID", {

    day: "2-digit",

    month: "short",

    year: "numeric",

  });

}

function monthKey(value: string) {

  return value && value.length >= 7 ? value.slice(0, 7) : "";

}

function monthLabel(value: string) {

  const parsed = parseDate(`${value}-01`);

  return parsed

    ? parsed.toLocaleDateString("id-ID", { month: "short", year: "2-digit" })

    : value;

}

function errorText(error: unknown) {

  if (typeof error === "object" && error !== null && "code" in error) {

    const code = String(error.code);

    if (code === "permission-denied") {

      return "Akses laporan ditolak. Pastikan Firestore Rules mengizinkan pengguna membaca data miliknya.";

    }

    if (code === "unauthenticated") return "Sesi login berakhir. Silakan login kembali.";

    if (code === "unavailable") return "Database tidak tersedia. Periksa koneksi internet.";

  }

  return error instanceof Error ? error.message : "Terjadi kesalahan saat memuat laporan.";

}

function csvCell(value: string | number) {

  return `"${String(value ?? "").replace(/"/g, '""')}"`;

}

function resolvePeriod(period: Period, customStart: string, customEnd: string) {

  const now = new Date();

  const today = dateStart(now);

  if (period === "all") return { start: null as Date | null, end: null as Date | null };

  if (period === "custom") {

    return {

      start: customStart ? parseDate(customStart) : null,

      end: customEnd ? parseDate(customEnd) : null,

    };

  }

  if (period === "thisMonth") {

    return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: now };

  }

  if (period === "lastMonth") {

    return {

      start: new Date(now.getFullYear(), now.getMonth() - 1, 1),

      end: new Date(now.getFullYear(), now.getMonth(), 0),

    };

  }

  if (period === "thisYear") {

    return { start: new Date(now.getFullYear(), 0, 1), end: now };

  }

  const days = period === "7days" ? 6 : 29;

  const start = new Date(today);

  start.setDate(start.getDate() - days);

  return { start, end: now };

}

/**
 * Filter soft-deleted records from every report subscription.
 * Hard-deleted documents are automatically removed by Firestore onSnapshot;
 * this helper also handles common soft-delete fields and cancellation statuses.
 */
function isActiveRecord(data: Record<string, unknown>): boolean {
  if (data.isDeleted === true || data.deleted === true || data.archived === true) return false;
  if (data.deletedAt !== undefined && data.deletedAt !== null && data.deletedAt !== "") return false;
  if (data.archivedAt !== undefined && data.archivedAt !== null && data.archivedAt !== "") return false;

  const status = String(data.status ?? "").trim().toLowerCase();
  if (["deleted", "delete", "removed", "cancelled", "canceled", "void", "voided", "archived", "inactive"].includes(status)) return false;

  const type = String(data.type ?? "").trim().toLowerCase();
  if (["delete", "deleted", "remove", "removed", "cancel", "cancelled", "canceled"].includes(type)) return false;

  return true;
}

export default function LaporanPage() {

  return (

    <AuthGuard>

      <DashboardLayout>

        <ReportsDashboard />

      </DashboardLayout>

    </AuthGuard>

  );

}

function ReportsDashboard() {

  const [user, setUser] = useState<User | null>(null);

  const [authReady, setAuthReady] = useState(false);

  const [finance, setFinance] = useState<FinanceTransaction[]>([]);

  const [sales, setSales] = useState<SaleTransaction[]>([]);

  const [products, setProducts] = useState<Product[]>([]);

  const [customers, setCustomers] = useState<Customer[]>([]);

  const [movements, setMovements] = useState<StockMovement[]>([]);

  const [loading, setLoading] = useState(true);

  const [pageError, setPageError] = useState("");

  const [period, setPeriod] = useState<Period>("thisMonth");

  const [customStart, setCustomStart] = useState(toDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));

  const [customEnd, setCustomEnd] = useState(toDateInput(new Date()));

  const [refreshKey, setRefreshKey] = useState(0);

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

      setCustomers([]);

      setMovements([]);

      setLoading(false);

      setPageError("Sesi login tidak ditemukan. Silakan login kembali.");

      return;

    }

    setLoading(true);

    setPageError("");

    let financeDone = false;

    let salesDone = false;

    let productsDone = false;

    let customersDone = false;

    let movementsDone = false;

    const finish = () => {

      if (financeDone && salesDone && productsDone && customersDone && movementsDone) {

        setLoading(false);

      }

    };

    const subscribe = <T,>(

      collectionName: string,

      setRows: (rows: T[]) => void,

      mapDocument: (id: string, data: Record<string, unknown>) => T,

      done: () => void,

    ) => onSnapshot(

      query(collection(db, collectionName), where("ownerUid", "==", user.uid)),

      (snapshot) => {

        setRows(
          snapshot.docs
            .filter((item) => isActiveRecord(item.data() as Record<string, unknown>))
            .map((item) => mapDocument(item.id, item.data() as Record<string, unknown>)),
        );

        done();

        finish();

      },

      (error) => {

        console.error(`Gagal memuat ${collectionName}:`, error);

        setPageError((current) => current || errorText(error));

        done();

        finish();

      },

    );

    const stopFinance = subscribe<FinanceTransaction>(

      "financeTransactions",

      setFinance,

      (id, data) => ({

        id,

        ownerUid: String(data.ownerUid ?? ""),

        type: data.type === "expense" ? "expense" : "income",

        description: String(data.description ?? ""),

        category: String(data.category ?? "Lainnya"),

        amount: Number(data.amount ?? 0),

        date: String(data.date ?? ""),

        createdAt: data.createdAt,

      }),

      () => { financeDone = true; },

    );

    const stopSales = subscribe<SaleTransaction>(

      "salesTransactions",

      setSales,

      (id, data) => ({

        id,

        ownerUid: String(data.ownerUid ?? ""),

        productName: String(data.productName ?? ""),

        quantity: Number(data.quantity ?? 0),

        unitPrice: Number(data.unitPrice ?? 0),

        totalAmount: Number(data.totalAmount ?? 0),

        date: String(data.date ?? ""),

        customerName: String(data.customerName ?? ""),

        paymentMethod: String(data.paymentMethod ?? ""),

        createdAt: data.createdAt,

      }),

      () => { salesDone = true; },

    );

    const stopProducts = subscribe<Product>(

      "products",

      setProducts,

      (id, data) => ({

        id,

        ownerUid: String(data.ownerUid ?? ""),

        name: String(data.name ?? ""),

        category: String(data.category ?? "Lainnya"),

        costPrice: Number(data.costPrice ?? 0),

        sellingPrice: Number(data.sellingPrice ?? 0),

        stock: Number(data.stock ?? 0),

        minimumStock: Number(data.minimumStock ?? 5),

      }),

      () => { productsDone = true; },

    );

    const stopCustomers = subscribe<Customer>(

      "customers",

      setCustomers,

      (id, data) => ({

        id,

        ownerUid: String(data.ownerUid ?? ""),

        name: String(data.name ?? ""),

        createdAt: data.createdAt,

      }),

      () => { customersDone = true; },

    );

    const stopMovements = subscribe<StockMovement>(

      "stockMovements",

      setMovements,

      (id, data) => ({

        id,

        ownerUid: String(data.ownerUid ?? ""),

        productId: String(data.productId ?? ""),

        productName: String(data.productName ?? ""),

        type: data.type === "out" ? "out" : "in",

        quantity: Number(data.quantity ?? 0),

        reason: String(data.reason ?? ""),

        date: String(data.date ?? ""),

      }),

      () => { movementsDone = true; },

    );

    return () => {

      stopFinance();

      stopSales();

      stopProducts();

      stopCustomers();

      stopMovements();

    };

  }, [user, authReady, refreshKey]);

  const range = useMemo(

    () => resolvePeriod(period, customStart, customEnd),

    [period, customStart, customEnd],

  );

  const financeInRange = useMemo(

    () => finance.filter((item) => dateInRange(item.date, range.start, range.end)),

    [finance, range],

  );

  const salesInRange = useMemo(

    () => sales.filter((item) => dateInRange(item.date, range.start, range.end)),

    [sales, range],

  );

  // Riwayat stok hanya dihitung jika masih terhubung dengan produk yang benar-benar
  // ada dan masih memiliki stok saat ini. Gerakan stok yatim (produknya dihapus),
  // tipe tidak valid, tanggal tidak valid, dan kuantitas tidak masuk akal dikecualikan.
  const movementsInRange = useMemo(() => {
    const activeProducts = products.filter(
      (product) =>
        product.name.trim().length > 0 &&
        Number.isFinite(product.stock) &&
        product.stock > 0,
    );

    const activeProductIds = new Set(activeProducts.map((product) => product.id));
    const activeProductNames = new Set(
      activeProducts.map((product) => product.name.trim().toLocaleLowerCase("id-ID")),
    );

    return movements.filter((item) => {
      const validQuantity =
        Number.isFinite(item.quantity) &&
        Number.isSafeInteger(item.quantity) &&
        item.quantity > 0;
      const validType = item.type === "in" || item.type === "out";
      const linkedToExistingProduct =
        (item.productId.trim() !== "" && activeProductIds.has(item.productId)) ||
        (item.productName.trim() !== "" &&
          activeProductNames.has(item.productName.trim().toLocaleLowerCase("id-ID")));

      return (
        validQuantity &&
        validType &&
        linkedToExistingProduct &&
        dateInRange(item.date, range.start, range.end)
      );
    });
  }, [movements, products, range]);

  const summary = useMemo(() => {

    const income = financeInRange.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);

    const expenses = financeInRange.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);

    const salesRevenue = salesInRange.reduce((sum, item) => sum + item.totalAmount, 0);

    const totalItemsSold = salesInRange.reduce((sum, item) => sum + item.quantity, 0);

    const lowStock = products.filter((item) => item.stock > 0 && item.stock <= item.minimumStock).length;

    const outOfStock = products.filter((item) => item.stock <= 0).length;

    const inventoryValue = products.reduce((sum, item) => sum + item.stock * item.costPrice, 0);

    return {

      income,

      expenses,

      net: income - expenses,

      salesRevenue,

      salesCount: salesInRange.length,

      totalItemsSold,

      averageSale: salesInRange.length ? salesRevenue / salesInRange.length : 0,

      financeCount: financeInRange.length,

      lowStock,

      outOfStock,

      inventoryValue,

      customers: customers.length,

      stockIn: movementsInRange.filter((item) => item.type === "in").reduce((sum, item) => sum + item.quantity, 0),

      stockOut: movementsInRange.filter((item) => item.type === "out").reduce((sum, item) => sum + item.quantity, 0),

    };

  }, [financeInRange, salesInRange, products, customers, movementsInRange]);

  const monthlyChart = useMemo(() => {

    const now = new Date();

    const months: { key: string; label: string; income: number; expense: number; sales: number }[] = [];

    for (let offset = 5; offset >= 0; offset--) {

      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      months.push({ key, label: monthLabel(key), income: 0, expense: 0, sales: 0 });

    }

    const map = new Map(months.map((month) => [month.key, month]));

    finance.forEach((item) => {

      const month = map.get(monthKey(item.date));

      if (!month) return;

      if (item.type === "income") month.income += item.amount;

      else month.expense += item.amount;

    });

    sales.forEach((item) => {

      const month = map.get(monthKey(item.date));

      if (month) month.sales += item.totalAmount;

    });

    return months;

  }, [finance, sales]);

  const categoryBreakdown = useMemo(() => {

    const totals = new Map<string, number>();

    financeInRange.filter((item) => item.type === "expense").forEach((item) => {

      const category = item.category.trim() || "Lainnya";

      totals.set(category, (totals.get(category) ?? 0) + item.amount);

    });

    return [...totals.entries()]

      .map(([category, amount]) => ({ category, amount }))

      .sort((a, b) => b.amount - a.amount)

      .slice(0, 6);

  }, [financeInRange]);

  const topProducts = useMemo(() => {

    const totals = new Map<string, { name: string; quantity: number; revenue: number }>();

    salesInRange.forEach((item) => {

      const key = item.productName || "Produk tanpa nama";

      const current = totals.get(key) ?? { name: key, quantity: 0, revenue: 0 };

      current.quantity += item.quantity;

      current.revenue += item.totalAmount;

      totals.set(key, current);

    });

    return [...totals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  }, [salesInRange]);

  const maxChartValue = Math.max(1, ...monthlyChart.flatMap((item) => [item.income, item.expense, item.sales]));

  const maxExpenseCategory = Math.max(1, ...categoryBreakdown.map((item) => item.amount));

  const maxTopProduct = Math.max(1, ...topProducts.map((item) => item.revenue));

  const rangeLabel = useMemo(() => {

    if (period === "all") return "Seluruh periode";

    if (range.start && range.end) return `${compactDate(toDateInput(range.start))} – ${compactDate(toDateInput(range.end))}`;

    if (range.start) return `Mulai ${compactDate(toDateInput(range.start))}`;

    return "Periode laporan";

  }, [period, range]);

  const exportReport = useCallback(() => {

    // Semua baris memakai 9 kolom yang sama agar tidak bergeser saat dibuka di Excel.

    const headers = [

      "Bagian", "Tanggal", "Jenis / Indikator", "Produk / Kategori",

      "Pelanggan / Keterangan", "Jumlah / Qty", "Harga Satuan", "Total / Nilai", "Metode Pembayaran",

    ];

    const rows: (string | number)[][] = [

      ["LUMA BUSINESS ADVISOR - LAPORAN BISNIS"],

      ["Periode laporan", rangeLabel],

      [],

      ["RINGKASAN KEUANGAN"],

      ["Ringkasan Keuangan", "", "Pendapatan keuangan", "", "", "", "", summary.income],

      ["Ringkasan Keuangan", "", "Pengeluaran keuangan", "", "", "", "", summary.expenses],

      ["Ringkasan Keuangan", "", "Selisih pendapatan - pengeluaran", "", "", "", "", summary.net],

      ["Ringkasan Keuangan", "", "Omzet penjualan", "", "", "", "", summary.salesRevenue],

      ["Ringkasan Keuangan", "", "Jumlah transaksi penjualan", "", "", "", "", summary.salesCount],

      ["Ringkasan Keuangan", "", "Rata-rata transaksi", "", "", "", "", Math.round(summary.averageSale)],

      [],

      ["RINGKASAN PERSEDIAAN"],

      ["Ringkasan Persediaan", "", "Jumlah produk", "", "", "", "", products.length],

      ["Ringkasan Persediaan", "", "Nilai persediaan (harga modal)", "", "", "", "", summary.inventoryValue],

      ["Ringkasan Persediaan", "", "Produk stok menipis", "", "", "", "", summary.lowStock],

      ["Ringkasan Persediaan", "", "Produk stok habis", "", "", "", "", summary.outOfStock],

      ["Ringkasan Persediaan", "", "Unit stok masuk pada periode", "", "", "", "", summary.stockIn],

      ["Ringkasan Persediaan", "", "Unit stok keluar pada periode", "", "", "", "", summary.stockOut],

      [],

      ["TRANSAKSI PENJUALAN"],

      headers,

      ...[...salesInRange]

        .sort((a, b) => b.date.localeCompare(a.date))

        .map((item) => [

          "Transaksi Penjualan", item.date, "Penjualan", item.productName || "—",

          item.customerName || "—", item.quantity, item.unitPrice, item.totalAmount,

          item.paymentMethod || "—",

        ]),

      [],

      ["TRANSAKSI KEUANGAN"],

      headers,

      ...[...financeInRange]

        .sort((a, b) => b.date.localeCompare(a.date))

        .map((item) => [

          "Transaksi Keuangan", item.date,

          item.type === "income" ? "Pendapatan" : "Pengeluaran",

          item.category || "Lainnya", item.description || "—", "", "", item.amount, "",

        ]),

    ];

    const normalizedRows = rows.map((row) => {

      const padded = [...row];

      while (padded.length < headers.length) padded.push("");

      return padded.map((cell) => csvCell(cell));

    });

    // Baris sep=; membantu Excel dengan pengaturan regional Indonesia memisahkan kolom dengan benar.

    const csv = "\uFEFFsep=;\r\n" + normalizedRows.map((row) => row.join(";")).join("\r\n");

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));

    const link = document.createElement("a");

    link.href = url;

    link.download = `luma-laporan-${toDateInput(new Date())}.csv`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  }, [rangeLabel, summary, products.length, salesInRange, financeInRange]);

  if (!authReady || loading) {

    return (

      <main className="flex min-h-[70vh] items-center justify-center bg-[#FAFAF8]">

        <div className="text-center">

          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#E7DFD0] border-t-[#D6B36A]" />

          <p className="mt-4 text-sm text-black/45">Menyiapkan laporan bisnis...</p>

        </div>

      </main>

    );

  }

  return (

    <main className="min-h-screen w-full min-w-0 overflow-x-clip bg-[#FAFAF8] px-3 py-5 text-[#171717] sm:px-5 sm:py-6 md:px-6 lg:px-8 lg:py-9 xl:px-10">

      <div className="mx-auto w-full min-w-0 max-w-[1600px] space-y-5 sm:space-y-7">

        <header className="flex min-w-0 flex-col justify-between gap-4 sm:gap-5 lg:flex-row lg:items-end">

          <div>

            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-[#9A7A3C]">

              <span className="h-px w-7 bg-[#D6B36A]" />

              LUMA BUSINESS ADVISOR

            </div>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">

              Laporan<span className="text-[#9A7A3C]">.</span>

            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">

              Ringkasan keuangan, penjualan, dan persediaan berdasarkan data yang tersimpan di LUMA.

            </p>

          </div>

          <div className="flex w-full flex-wrap gap-2 sm:w-auto">

            <button

              type="button"

              onClick={() => setRefreshKey((value) => value + 1)}

              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-medium transition hover:border-[#D6B36A]"

            >

              <FiRefreshCw size={15} /> Muat ulang

            </button>

            <button

              type="button"

              onClick={() => window.print()}

              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-medium transition hover:border-[#D6B36A]"

            >

              <FiPrinter size={15} /> Cetak

            </button>

            <button

              type="button"

              onClick={exportReport}

              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#D6B36A] px-4 text-sm font-semibold text-black transition hover:bg-[#C49A4A]"

            >

              <FiDownload size={15} /> Ekspor CSV

            </button>

          </div>

        </header>

        {pageError && (

          <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">

            <FiAlertCircle className="mt-0.5 shrink-0" />

            <div>

              <p className="font-semibold">Sebagian data laporan gagal dimuat</p>

              <p className="mt-1">{pageError}</p>

            </div>

          </div>

        )}

        <section className="min-w-0 rounded-2xl border border-black/[0.08] bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.02)] sm:p-5">

          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">

            <div>

              <div className="flex items-center gap-2 text-sm font-semibold">

                <FiCalendar className="text-[#A4864A]" /> Periode laporan

              </div>

              <p className="mt-1 text-xs text-black/45">Pilih periode untuk menyaring transaksi dan ringkasan laporan.</p>

            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:flex xl:items-end">

              <label className="block">

                <span className="mb-1.5 block text-xs font-medium text-black/55">Rentang waktu</span>

                <select

                  value={period}

                  onChange={(event) => setPeriod(event.target.value as Period)}

                  className="h-11 w-full min-w-[190px] rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#B89552]"

                >

                  <option value="7days">7 hari terakhir</option>

                  <option value="30days">30 hari terakhir</option>

                  <option value="thisMonth">Bulan ini</option>

                  <option value="lastMonth">Bulan lalu</option>

                  <option value="thisYear">Tahun ini</option>

                  <option value="all">Seluruh periode</option>

                  <option value="custom">Pilih tanggal sendiri</option>

                </select>

              </label>

              {period === "custom" && (

                <>

                  <label className="block">

                    <span className="mb-1.5 block text-xs font-medium text-black/55">Dari tanggal</span>

                    <input

                      type="date"

                      value={customStart}

                      max={customEnd || undefined}

                      onChange={(event) => setCustomStart(event.target.value)}

                      className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#B89552]"

                    />

                  </label>

                  <label className="block">

                    <span className="mb-1.5 block text-xs font-medium text-black/55">Sampai tanggal</span>

                    <input

                      type="date"

                      value={customEnd}

                      min={customStart || undefined}

                      onChange={(event) => setCustomEnd(event.target.value)}

                      className="h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[#B89552]"

                    />

                  </label>

                </>

              )}

            </div>

          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] pt-4">

            <p className="text-xs text-black/45">Periode aktif</p>

            <p className="text-sm font-semibold">{rangeLabel}</p>

          </div>

        </section>

        <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">

          <MetricCard title="Pendapatan keuangan" value={rupiah(summary.income)} caption={`${numberLabel(financeInRange.filter((item) => item.type === "income").length)} transaksi pendapatan`} icon={<FiTrendingUp />} />

          <MetricCard title="Pengeluaran keuangan" value={rupiah(summary.expenses)} caption={`${numberLabel(financeInRange.filter((item) => item.type === "expense").length)} transaksi pengeluaran`} icon={<FiTrendingDown />} />

          <MetricCard title="Selisih keuangan" value={rupiah(summary.net)} caption="Pendapatan dikurangi pengeluaran" icon={<FiDollarSign />} tone={summary.net < 0 ? "danger" : "gold"} />

          <MetricCard title="Omzet penjualan" value={rupiah(summary.salesRevenue)} caption={`${numberLabel(summary.salesCount)} transaksi penjualan`} icon={<FiShoppingBag />} />

        </section>

        <section className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1.55fr)\_minmax(0,1fr)]">

          <div className="min-w-0 rounded-2xl border border-black/[0.08] bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.02)] sm:p-5 lg:p-6">

            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">

              <div>

                <h2 className="text-base font-semibold">Tren 6 bulan terakhir</h2>

                <p className="mt-1 text-xs text-black/45">Perbandingan data pendapatan, pengeluaran, dan omzet penjualan.</p>

              </div>

              <div className="flex flex-wrap gap-3 text-[11px] text-black/55">

                <Legend color="#D6B36A" label="Pendapatan" />

                <Legend color="#171717" label="Pengeluaran" />

                <Legend color="#B8C7B4" label="Omzet" />

              </div>

            </div>

            <div className="mt-6 grid grid-cols-6 gap-2 sm:gap-4">

              {monthlyChart.map((item) => (

                <div key={item.key} className="min-w-0">

                  <div className="flex h-36 items-end justify-center gap-0.5 border-b border-black/[0.07] pb-2 xs:h-40 sm:h-48 sm:gap-1.5">

                    <Bar value={item.income} max={maxChartValue} color="#D6B36A" title={`Pendapatan ${rupiah(item.income)}`} />

                    <Bar value={item.expense} max={maxChartValue} color="#171717" title={`Pengeluaran ${rupiah(item.expense)}`} />

                    <Bar value={item.sales} max={maxChartValue} color="#B8C7B4" title={`Omzet ${rupiah(item.sales)}`} />

                  </div>

                  <p className="mt-2 truncate text-center text-[10px] font-medium text-black/50 sm:text-xs">{item.label}</p>

                </div>

              ))}

            </div>

            <p className="mt-4 text-[11px] leading-5 text-black/40">

              Grafik menggunakan data per bulan kalender. Filter periode di atas memengaruhi kartu ringkasan dan tabel, bukan rentang grafik ini.

            </p>

          </div>

          <div className="min-w-0 rounded-2xl border border-black/[0.08] bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.02)] sm:p-5 lg:p-6">

            <div className="flex items-center gap-3">

              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF8F2] text-[#A4864A]"><FiActivity size={18} /></span>

              <div>

                <h2 className="text-base font-semibold">Ikhtisar operasional</h2>

                <p className="mt-1 text-xs text-black/45">Ringkasan aktivitas pada periode terpilih.</p>

              </div>

            </div>

            <div className="mt-5 divide-y divide-black/[0.06]">

              <SummaryRow label="Jumlah transaksi penjualan" value={numberLabel(summary.salesCount)} />

              <SummaryRow label="Unit produk terjual" value={`${numberLabel(summary.totalItemsSold)} unit`} />

              <SummaryRow label="Rata-rata nilai transaksi" value={rupiah(summary.averageSale)} />

              <SummaryRow label="Transaksi keuangan" value={numberLabel(summary.financeCount)} />

              <SummaryRow label="Database pelanggan" value={numberLabel(summary.customers)} />

              <SummaryRow label="Nilai persediaan (harga modal)" value={rupiah(summary.inventoryValue)} />

              <SummaryRow label="Stok masuk pada periode" value={`${numberLabel(summary.stockIn)} unit`} />

              <SummaryRow label="Stok keluar pada periode" value={`${numberLabel(summary.stockOut)} unit`} />

            </div>

          </div>

        </section>

        <section className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2">

          <div className="min-w-0 rounded-2xl border border-black/[0.08] bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.02)] sm:p-5 lg:p-6">

            <div>

              <h2 className="text-base font-semibold">Pengeluaran berdasarkan kategori</h2>

              <p className="mt-1 text-xs text-black/45">Kategori dengan jumlah pengeluaran terbesar dalam periode laporan.</p>

            </div>

            {categoryBreakdown.length === 0 ? (

              <EmptyState message="Belum ada data pengeluaran pada periode ini." />

            ) : (

              <div className="mt-5 space-y-4">

                {categoryBreakdown.map((item) => (

                  <div key={item.category}>

                    <div className="mb-2 flex items-center justify-between gap-3 text-xs">

                      <span className="min-w-0 truncate font-medium">{item.category}</span>

                      <span className="shrink-0 text-black/55">{rupiah(item.amount)}</span>

                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-[#F2F0EA]">

                      <div className="h-full rounded-full bg-[#D6B36A]" style={{ width: `${Math.max(2, (item.amount / maxExpenseCategory) * 100)}%` }} />

                    </div>

                  </div>

                ))}

              </div>

            )}

          </div>

          <div className="min-w-0 rounded-2xl border border-black/[0.08] bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.02)] sm:p-5 lg:p-6">

            <div>

              <h2 className="text-base font-semibold">Produk dengan omzet tertinggi</h2>

              <p className="mt-1 text-xs text-black/45">Produk yang menghasilkan omzet terbesar pada periode laporan.</p>

            </div>

            {topProducts.length === 0 ? (

              <EmptyState message="Belum ada transaksi penjualan pada periode ini." />

            ) : (

              <div className="mt-5 space-y-4">

                {topProducts.map((item, index) => (

                  <div key={item.name}>

                    <div className="mb-2 flex items-center gap-3">

                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#FAF8F2] text-xs font-semibold text-[#8E6927]">{String(index + 1).padStart(2, "0")}</span>

                      <div className="min-w-0 flex-1">

                        <p className="truncate text-xs font-semibold">{item.name}</p>

                        <p className="mt-1 text-[10px] text-black/40">{numberLabel(item.quantity)} unit terjual</p>

                      </div>

                      <p className="shrink-0 text-xs font-semibold">{rupiah(item.revenue)}</p>

                    </div>

                    <div className="ml-11 h-1.5 overflow-hidden rounded-full bg-[#F2F0EA]">

                      <div className="h-full rounded-full bg-[#171717]" style={{ width: `${Math.max(2, (item.revenue / maxTopProduct) * 100)}%` }} />

                    </div>

                  </div>

                ))}

              </div>

            )}

          </div>

        </section>

        <section className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">

          <MetricCard title="Jenis produk" value={numberLabel(products.length)} caption="Produk terdaftar saat ini" icon={<FiPackage />} />

          <MetricCard title="Stok menipis" value={numberLabel(summary.lowStock)} caption="Stok positif mencapai batas minimum" icon={<FiAlertCircle />} tone={summary.lowStock ? "warning" : "normal"} />

          <MetricCard title="Stok habis" value={numberLabel(summary.outOfStock)} caption="Produk yang perlu diisi ulang" icon={<FiPackage />} tone={summary.outOfStock ? "danger" : "normal"} />

          <MetricCard title="Nilai persediaan" value={rupiah(summary.inventoryValue)} caption="Jumlah stok × harga modal" icon={<FiDollarSign />} />

        </section>

        <section className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.02)]">

          <div className="border-b border-black/[0.06] p-5 sm:p-6">

            <h2 className="text-base font-semibold">Rincian transaksi penjualan</h2>

            <p className="mt-1 text-xs text-black/45">{numberLabel(salesInRange.length)} transaksi pada {rangeLabel.toLocaleLowerCase("id-ID")}</p>

          </div>

          {salesInRange.length === 0 ? (

            <EmptyState message="Tidak ada transaksi penjualan pada periode yang dipilih." />

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full min-w-[760px] text-left">

                <thead className="bg-[#FAF8F2] text-[10px] uppercase tracking-wider text-black/50">

                  <tr>

                    <th className="px-5 py-3.5 font-semibold">Tanggal</th>

                    <th className="px-5 py-3.5 font-semibold">Produk</th>

                    <th className="px-5 py-3.5 font-semibold">Pelanggan</th>

                    <th className="px-5 py-3.5 text-right font-semibold">Qty</th>

                    <th className="px-5 py-3.5 text-right font-semibold">Total</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-black/[0.06]">

                  {[...salesInRange].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20).map((item) => (

                    <tr key={item.id} className="transition hover:bg-[#FAFAF8]">

                      <td className="whitespace-nowrap px-5 py-4 text-xs text-black/55">{compactDate(item.date)}</td>

                      <td className="px-5 py-4 text-xs font-medium">{item.productName || "—"}</td>

                      <td className="px-5 py-4 text-xs text-black/55">{item.customerName || "—"}</td>

                      <td className="px-5 py-4 text-right text-xs">{numberLabel(item.quantity)}</td>

                      <td className="whitespace-nowrap px-5 py-4 text-right text-xs font-semibold">{rupiah(item.totalAmount)}</td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

          {salesInRange.length > 20 && (

            <p className="border-t border-black/[0.06] px-5 py-3 text-xs text-black/45">

              Menampilkan 20 transaksi terbaru. Ekspor CSV memuat seluruh transaksi pada periode terpilih.

            </p>

          )}

        </section>

        <footer className="flex flex-col justify-between gap-2 border-t border-black/[0.08] pt-5 text-[11px] text-black/40 sm:flex-row sm:items-center">

          <p>LUMA BUSINESS ADVISOR · Laporan dihasilkan dari data akun yang sedang login.</p>

          <p>Diperbarui secara realtime dari Firestore.</p>

        </footer>

      </div>

      <style jsx global>{`

        @page {

          size: A4 landscape;

          margin: 12mm;

        }

        @media print {

          html, body {

            width: 100% !important;

            min-width: 0 !important;

            margin: 0 !important;

            padding: 0 !important;

            background: #fff !important;

            color: #171717 !important;

            font-size: 10pt !important;

            print-color-adjust: exact;

            -webkit-print-color-adjust: exact;

          }

          body * { visibility: visible !important; }

          aside, nav, header button, button, select, input,

          [role="alert"] { display: none !important; }

          main {

            width: 100% !important;

            min-height: 0 !important;

            margin: 0 !important;

            padding: 0 !important;

            background: #fff !important;

          }

          main > div {

            width: 100% !important;

            max-width: none !important;

            margin: 0 !important;

            gap: 12px !important;

          }

          header { margin-bottom: 8px !important; }

          header h1 { font-size: 24pt !important; }

          header p { font-size: 9pt !important; }

          section, footer {

            box-shadow: none !important;

            border-color: #d8d8d8 !important;

          }

          section { margin-bottom: 10px !important; }

          section > div { break-inside: auto; }

          table {

            width: 100% !important;

            min-width: 0 !important;

            border-collapse: collapse !important;

            font-size: 8pt !important;

          }

          thead { display: table-header-group; }

          tr, td, th { break-inside: avoid !important; }

          th, td { padding: 6px 7px !important; }

          .overflow-x-auto { overflow: visible !important; }

          .grid { gap: 8px !important; }

          footer { padding-top: 8px !important; }

          * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }

        }

      `}</style>

    </main>

  );

}

function MetricCard({

  title,

  value,

  caption,

  icon,

  tone = "normal",

}: {

  title: string;

  value: string;

  caption: string;

  icon: ReactNode;

  tone?: "normal" | "gold" | "warning" | "danger";

}) {

  const toneClass = {

    normal: "border-black/[0.08] bg-white",

    gold: "border-[#D6B36A]/60 bg-[#D6B36A]/15",

    warning: "border-amber-200 bg-amber-50",

    danger: "border-red-200 bg-red-50",

  }[tone];

  const iconClass = {

    normal: "border-[#D6B36A]/40 bg-[#FAF8F2] text-[#A4864A]",

    gold: "bg-[#D6B36A] text-black",

    warning: "bg-amber-100 text-amber-700",

    danger: "bg-red-100 text-red-700",

  }[tone];

  return (

    <div className={`min-w-0 rounded-2xl border p-4 shadow-[0_8px_30px_rgba(0,0,0,0.02)] sm:p-5 ${toneClass}`}>

      <div className="flex items-center justify-between gap-3">

        <p className="text-xs font-medium text-black/50">{title}</p>

        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${iconClass}`}>{icon}</span>

      </div>

      <p className="mt-4 break-words text-xl font-semibold tracking-tight [overflow-wrap:anywhere] sm:mt-5 sm:text-[27px]">{value}</p>

      <p className="mt-2 text-[11px] leading-5 text-black/45">{caption}</p>

    </div>

  );

}

function Legend({ color, label }: { color: string; label: string }) {

  return (

    <span className="inline-flex items-center gap-1.5">

      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color }} />

      {label}

    </span>

  );

}

function Bar({ value, max, color, title }: { value: number; max: number; color: string; title: string }) {

  const height = value <= 0 ? 2 : Math.max(3, (value / max) * 100);

  return (

    <div

      title={title}

      className="w-full max-w-[18px] rounded-t-sm transition-all"

      style={{ height: `${height}%`, backgroundColor: color, minHeight: 2 }}

    />

  );

}

function SummaryRow({ label, value }: { label: string; value: string }) {

  return (

    <div className="flex items-start justify-between gap-4 py-3">

      <span className="text-xs text-black/55">{label}</span>

      <span className="text-right text-xs font-semibold">{value}</span>

    </div>

  );

}

function EmptyState({ message }: { message: string }) {

  return (

    <div className="px-5 py-10 text-center">

      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[#D6B36A]/40 bg-[#FAF8F2] text-[#A4864A]">

        <FiActivity size={18} />

      </span>

      <p className="mt-3 text-xs text-black/45">{message}</p>

    </div>

  );

}
