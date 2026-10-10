

"use client";

import {

  type FormEvent,

  useEffect,

  useMemo,

  useRef,

  useState,

} from "react";

import { onAuthStateChanged, type User } from "firebase/auth";

import {

  collection,

  onSnapshot,

  query,

  where,

} from "firebase/firestore";

import {

  FiActivity,

  FiAlertTriangle,

  FiArrowUpRight,

  FiBarChart2,

  FiCheckCircle,

  FiChevronRight,

  FiMessageCircle,

  FiRefreshCw,

  FiSend,

  FiShield,

  FiTrendingDown,

} from "react-icons/fi";

import { auth, db } from "@/lib/firebase";

import AuthGuard from "@/components/auth/AuthGuard";

import DashboardLayout from "@/components/dashboard/DashboardLayout";

type Finance = {

  type: string;

  amount: number;

  date: string;

  category: string;

  description: string;

};

type Sale = {

  productName: string;

  quantity: number;

  unitPrice: number;

  totalAmount: number;

  date: string;

  customerName: string;

};

type Product = {

  name: string;

  category: string;

  costPrice: number;

  sellingPrice: number;

  stock: number;

  minimumStock: number;

};

type Movement = {

  productName: string;

  type: string;

  quantity: number;

  date: string;

  reason: string;

};

type ChatMessage = {

  role: "user" | "model";

  text: string;

};

const money = (n: number) =>

  new Intl.NumberFormat("id-ID", {

    style: "currency",

    currency: "IDR",

    maximumFractionDigits: 0,

  }).format(Number.isFinite(n) ? n : 0);

const count = (n: number) =>

  new Intl.NumberFormat("id-ID").format(n || 0);

const isoDate = (date: Date) =>

  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const QUICK_PROMPTS = [

  "Bagaimana kondisi bisnis saya saat ini?",

  "Apa masalah bisnis yang paling perlu saya perhatikan?",

  "Analisis pengeluaran dan potensi kebocoran laba saya.",

  "Apa langkah yang bisa saya lakukan untuk meningkatkan penjualan?",

];

export default function AdvisorPage() {

  return (

    <AuthGuard>

      <DashboardLayout>

        <AdvisorDashboard />

      </DashboardLayout>

    </AuthGuard>

  );

}

function AdvisorDashboard() {

  const [user, setUser] = useState<User | null>(null);

  const [authReady, setAuthReady] = useState(false);

  const [finance, setFinance] = useState<Finance[]>([]);

  const [sales, setSales] = useState<Sale[]>([]);

  const [products, setProducts] = useState<Product[]>([]);

  const [movements, setMovements] = useState<Movement[]>([]);

  const [loadingData, setLoadingData] = useState(true);

  const [dataWarning, setDataWarning] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([

    {

      role: "model",

      text: "Halo, saya LUMA Advisor. Saya siap membantu Anda memahami kondisi bisnis berdasarkan data yang tersedia. Anda bisa mulai dengan pertanyaan di bawah atau tanyakan masalah yang sedang dihadapi.",

    },

  ]);

  const [input, setInput] = useState("");

  const [sending, setSending] = useState(false);

  const [period, setPeriod] = useState<"30" | "90" | "all">("30");

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {

    return onAuthStateChanged(auth, (current) => {

      setUser(current);

      setAuthReady(true);

    });

  }, []);

  useEffect(() => {

    if (!authReady) return;

    if (!user) {

      setLoadingData(false);

      setDataWarning("Sesi login tidak ditemukan. Silakan login kembali.");

      return;

    }

    setLoadingData(true);

    setDataWarning("");

    let completed = 0;

    const done = () => {

      completed += 1;

      if (completed >= 4) setLoadingData(false);

    };

    const unsubs = [

      onSnapshot(

        query(

          collection(db, "financeTransactions"),

          where("ownerUid", "==", user.uid),

        ),

        (snap) => {

          setFinance(

            snap.docs.map((d) => {

              const x = d.data();

              return {

                type: String(x.type ?? "income"),

                amount: Number(x.amount ?? 0),

                date: String(x.date ?? ""),

                category: String(x.category ?? "Lainnya"),

                description: String(x.description ?? ""),

              };

            }),

          );

          done();

        },

        (error) => {

          console.error(error);

          setDataWarning(

            "Sebagian data keuangan tidak dapat dibaca. Periksa Firestore Rules.",

          );

          done();

        },

      ),

      onSnapshot(

        query(

          collection(db, "salesTransactions"),

          where("ownerUid", "==", user.uid),

        ),

        (snap) => {

          setSales(

            snap.docs.map((d) => {

              const x = d.data();

              return {

                productName: String(x.productName ?? "Produk tanpa nama"),

                quantity: Number(x.quantity ?? 0),

                unitPrice: Number(x.unitPrice ?? 0),

                totalAmount: Number(x.totalAmount ?? 0),

                date: String(x.date ?? ""),

                customerName: String(x.customerName ?? ""),

              };

            }),

          );

          done();

        },

        (error) => {

          console.error(error);

          setDataWarning(

            "Sebagian data penjualan tidak dapat dibaca. Periksa Firestore Rules.",

          );

          done();

        },

      ),

      onSnapshot(

        query(

          collection(db, "products"),

          where("ownerUid", "==", user.uid),

        ),

        (snap) => {

          setProducts(

            snap.docs.map((d) => {

              const x = d.data();

              return {

                name: String(x.name ?? "Produk tanpa nama"),

                category: String(x.category ?? "Lainnya"),

                costPrice: Number(x.costPrice ?? 0),

                sellingPrice: Number(x.sellingPrice ?? 0),

                stock: Number(x.stock ?? 0),

                minimumStock: Number(x.minimumStock ?? 5),

              };

            }),

          );

          done();

        },

        (error) => {

          console.error(error);

          setDataWarning(

            "Sebagian data produk tidak dapat dibaca. Periksa Firestore Rules.",

          );

          done();

        },

      ),

      onSnapshot(

        query(

          collection(db, "stockMovements"),

          where("ownerUid", "==", user.uid),

        ),

        (snap) => {

          setMovements(

            snap.docs.map((d) => {

              const x = d.data();

              return {

                productName: String(x.productName ?? "Produk tanpa nama"),

                type: String(x.type ?? "in"),

                quantity: Number(x.quantity ?? 0),

                date: String(x.date ?? ""),

                reason: String(x.reason ?? ""),

              };

            }),

          );

          done();

        },

        (error) => {

          console.error(error);

          setDataWarning(

            "Sebagian data pergerakan stok tidak dapat dibaca. Periksa Firestore Rules.",

          );

          done();

        },

      ),

    ];

    return () => unsubs.forEach((unsubscribe) => unsubscribe());

  }, [user, authReady]);

  const analytics = useMemo(() => {

    const today = new Date();

    const start =

      period === "all"

        ? "0000-00-00"

        : isoDate(

            new Date(

              today.getFullYear(),

              today.getMonth(),

              today.getDate() - Number(period),

            ),

          );

    const todayString = isoDate(today);

    const f = finance.filter(

      (x) => x.date >= start && x.date <= todayString,

    );

    const s = sales.filter(

      (x) => x.date >= start && x.date <= todayString,

    );

    const income = f

      .filter((x) => x.type === "income")

      .reduce((sum, x) => sum + x.amount, 0);

    const expense = f

      .filter((x) => x.type === "expense")

      .reduce((sum, x) => sum + x.amount, 0);

    const revenue = s.reduce(

      (sum, x) => sum + x.totalAmount,

      0,

    );

    const lowStock = products.filter(

      (x) => x.stock > 0 && x.stock <= x.minimumStock,

    );

    const outOfStock = products.filter(

      (x) => x.stock <= 0,

    );

    const productMargins = products

      .map((x) => ({

        name: x.name,

        margin: x.sellingPrice - x.costPrice,

        stock: x.stock,

        costPrice: x.costPrice,

        sellingPrice: x.sellingPrice,

      }))

      .filter(

        (x) => x.sellingPrice > 0 && x.costPrice >= 0,

      )

      .sort((a, b) => a.margin - b.margin);

    const expenseCategories = new Map<string, number>();

    f.filter((x) => x.type === "expense").forEach((x) => {

      const category = x.category || "Lainnya";

      expenseCategories.set(

        category,

        (expenseCategories.get(category) ?? 0) + x.amount,

      );

    });

    const productSales: Record<

      string,

      { name: string; revenue: number; quantity: number }

    > = {};

    s.forEach((x) => {

      const key = x.productName || "Produk tanpa nama";

      productSales[key] ??= {

        name: key,

        revenue: 0,

        quantity: 0,

      };

      productSales[key].revenue += x.totalAmount;

      productSales[key].quantity += x.quantity;

    });

    return {

      periodLabel:

        period === "all"

          ? "seluruh periode"

          : `${period} hari terakhir`,

      income,

      expense,

      net: income - expense,

      revenue,

      financeCount: f.length,

      salesCount: s.length,

      unitsSold: s.reduce((sum, x) => sum + x.quantity, 0),

      lowStock,

      outOfStock,

      inventoryValueAtCost: products.reduce(

        (sum, x) => sum + x.stock * x.costPrice,

        0,

      ),

      productCount: products.length,

      expenseCategories: [...expenseCategories.entries()]

        .map(([category, amount]) => ({ category, amount }))

        .sort((a, b) => b.amount - a.amount)

        .slice(0, 5),

      lowMarginProducts: productMargins.slice(0, 5),

      topProducts: Object.values(productSales)

        .sort((a, b) => b.revenue - a.revenue)

        .slice(0, 5),

      recentSales: [...s]

        .sort((a, b) => b.date.localeCompare(a.date))

        .slice(0, 10),

      recentFinance: [...f]

        .sort((a, b) => b.date.localeCompare(a.date))

        .slice(0, 10),

      recentMovements: [...movements]

        .sort((a, b) => b.date.localeCompare(a.date))

        .slice(0, 10),

    };

  }, [finance, sales, products, movements, period]);

  const health = useMemo(() => {

    let score = 100;

    if (analytics.net < 0) score -= 25;

    if (analytics.income === 0 && analytics.expense > 0) {

      score -= 15;

    }

    if (analytics.lowStock.length > 0) {

      score -= Math.min(15, analytics.lowStock.length * 3);

    }

    if (analytics.outOfStock.length > 0) {

      score -= Math.min(20, analytics.outOfStock.length * 5);

    }

    if (analytics.salesCount === 0) score -= 10;

    if (analytics.productCount === 0) score -= 10;

    return Math.max(0, Math.min(100, score));

  }, [analytics]);

  const flags = useMemo(() => {

    const items: {

      title: string;

      detail: string;

      level: "warning" | "info";

    }[] = [];

    if (analytics.net < 0) {

      items.push({

        title: "Pengeluaran melebihi pendapatan keuangan",

        detail: `Selisih periode ini ${money(analytics.net)}. Periksa transaksi dan kategori pengeluaran terbesar.`,

        level: "warning",

      });

    }

    if (analytics.outOfStock.length) {

      items.push({

        title: `${analytics.outOfStock.length} produk kehabisan stok`,

        detail: `Contoh: ${analytics.outOfStock

          .slice(0, 3)

          .map((p) => p.name)

          .join(", ")}. Pertimbangkan prioritas pengadaan berdasarkan permintaan.`,

        level: "warning",

      });

    }

    if (analytics.lowStock.length) {

      items.push({

        title: `${analytics.lowStock.length} produk mendekati batas stok minimum`,

        detail: `Pantau ${analytics.lowStock

          .slice(0, 3)

          .map((p) => p.name)

          .join(", ")}${analytics.lowStock.length > 3 ? ", dan lainnya" : ""}.`,

        level: "warning",

      });

    }

    if (!analytics.salesCount) {

      items.push({

        title: "Belum ada penjualan pada periode terpilih",

        detail:

          "Jika transaksi memang belum terjadi, catat penjualan terbaru agar analisis lebih relevan.",

        level: "info",

      });

    }

    if (analytics.lowMarginProducts.some((p) => p.margin <= 0)) {

      items.push({

        title: "Ada produk dengan margin kotor per unit nol atau negatif",

        detail:

          "Bandingkan harga jual dengan harga modal. Biaya operasional lain belum termasuk dalam hitungan ini.",

        level: "warning",

      });

    }

    if (!items.length) {

      items.push({

        title: "Tidak ada tanda peringatan sederhana dari indikator yang tersedia",

        detail:

          "Ini bukan jaminan bahwa bisnis bebas masalah. Gunakan Advisor untuk meninjau data dan risiko lain.",

        level: "info",

      });

    }

    return items;

  }, [analytics]);

  const context = useMemo(

    () => ({

      reportGeneratedAt: new Date().toISOString(),

      period: analytics.periodLabel,

      definitions: {

        financeNet:

          "pendapatan keuangan dikurangi pengeluaran keuangan; bukan otomatis laba bersih akuntansi",

        productUnitMargin:

          "harga jual dikurangi harga modal; belum memperhitungkan seluruh biaya operasional",

        healthScore:

          "heuristik transparan berdasarkan indikator dasar, bukan audit atau skor akuntansi tervalidasi",

      },

      summary: {

        income: analytics.income,

        expenses: analytics.expense,

        financeNet: analytics.net,

        salesRevenue: analytics.revenue,

        financeTransactionCount: analytics.financeCount,

        salesTransactionCount: analytics.salesCount,

        unitsSold: analytics.unitsSold,

        productCount: analytics.productCount,

        inventoryValueAtCost: analytics.inventoryValueAtCost,

        healthScore: health,

      },

      alerts: flags,

      expenseCategories: analytics.expenseCategories,

      productsWithLowestUnitMargin: analytics.lowMarginProducts,

      bestSellingProductsByRevenue: analytics.topProducts,

      recentSales: analytics.recentSales,

      recentFinance: analytics.recentFinance,

      recentStockMovements: analytics.recentMovements,

      stock: {

        low: analytics.lowStock,

        out: analytics.outOfStock,

      },

    }),

    [analytics, flags, health],

  );

  useEffect(() => {

    bottomRef.current?.scrollIntoView({

      behavior: "smooth",

      block: "end",

    });

  }, [messages, sending]);

  async function sendMessage(

    event?: FormEvent,

    suggested?: string,

  ) {

    event?.preventDefault();

    const text = (suggested ?? input).trim();

    if (!text || sending) return;

    const previous = messages;

    setMessages([

      ...previous,

      { role: "user", text },

    ]);

    setInput("");

    setSending(true);

    try {

      const response = await fetch("/api/advisor", {

        method: "POST",

        headers: {

          "Content-Type": "application/json",

        },

        body: JSON.stringify({

          message: text,

          context,

          history: previous.slice(-8),

        }),

      });

      const result = await response.json();

      if (!response.ok) {

        throw new Error(

          result.error || "LUMA gagal memproses pertanyaan.",

        );

      }

      setMessages((current) => [

        ...current,

        {

          role: "model",

          text: String(result.answer),

        },

      ]);

    } catch (error) {

      setMessages((current) => [

        ...current,

        {

          role: "model",

          text: `Maaf, saya belum dapat menjawab saat ini. ${

            error instanceof Error

              ? error.message

              : "Periksa koneksi dan konfigurasi API."

          }`,

        },

      ]);

    } finally {

      setSending(false);

    }

  }

  if (!authReady || loadingData) {

    return (

      <main className="flex min-h-[70vh] items-center justify-center bg-[#FAFAF8]">

        <div className="text-center">

          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#E7DFD0] border-t-[#D6B36A]" />

          <p className="mt-4 text-sm text-black/45">

            Menyiapkan Advisor bisnis...

          </p>

        </div>

      </main>

    );

  }

  return (
    <main className="min-h-screen w-full min-w-0 overflow-x-clip bg-white px-3 py-4 text-[#171717] sm:px-5 sm:py-6 lg:px-7 lg:py-8">
      <div className="mx-auto w-full max-w-[1480px] min-w-0 space-y-5 sm:space-y-7">
        <header className="flex min-w-0 flex-col justify-between gap-4 border-b border-black/10 pb-5 sm:gap-5 sm:pb-6 xl:flex-row xl:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-[#A8843D]">
              <span className="h-px w-8 bg-[#C6A15B]" />
              LUMA / BUSINESS INTELLIGENCE
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              Business Advisor<span className="text-[#C6A15B]">.</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55">
              Satu ruang untuk memahami kondisi bisnis, menemukan peluang, dan menentukan langkah berikutnya.
            </p>
          </div>
          <div className="flex w-full min-w-0 flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#171717] text-[#D7B66D]">
                <FiRefreshCw size={16} />
              </span>
              <div>
                <label htmlFor="advisor-period" className="block text-[10px] font-medium uppercase tracking-wider text-black/45">
                  Periode analisis
                </label>
                <select
                  id="advisor-period"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as "30" | "90" | "all")}
                  className="mt-0.5 max-w-[145px] bg-transparent text-sm font-semibold outline-none"
                >
                  <option value="30">30 hari terakhir</option>
                  <option value="90">90 hari terakhir</option>
                  <option value="all">Semua data</option>
                </select>
              </div>
            </div>
          </div>
        </header>

        {dataWarning && (
          <div role="alert" className="flex gap-3 rounded-xl border border-[#C6A15B]/50 bg-[#FBF8F0] p-4 text-sm text-[#5E4A25]">
            <FiAlertTriangle className="mt-0.5 shrink-0" size={18} />
            <p>{dataWarning}</p>
          </div>
        )}

        <section className="grid min-w-0 grid-cols-1 gap-4 lg:gap-5 2xl:grid-cols-[minmax(260px,0.82fr)_minmax(0,2fr)]">
          <div className="relative overflow-hidden rounded-2xl bg-[#171717] p-6 text-white sm:p-7">
            <div className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full border border-[#C6A15B]/20" />
            <div className="pointer-events-none absolute -right-2 -top-6 h-28 w-28 rounded-full border border-[#C6A15B]/25" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#D7B66D]">Business health</p>
                <p className="mt-5 text-5xl font-semibold tracking-[-0.05em]">{health}<span className="ml-1 text-base font-normal tracking-normal text-white/45">/100</span></p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D7B66D]/35 bg-white/5 text-[#D7B66D]">
                <FiActivity size={21} />
              </span>
            </div>
            <div className="relative mt-6 h-1.5 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-[#D7B66D] transition-all duration-500" style={{ width: `${health}%` }} />
            </div>
            <p className="relative mt-4 text-xs leading-5 text-white/60">
              Indikator awal berdasarkan data yang tersedia, bukan audit bisnis menyeluruh.
            </p>
            <div className="relative mt-6 flex items-center gap-2 border-t border-white/10 pt-4 text-[11px] text-white/65">
              <FiShield className="text-[#D7B66D]" />
              Analisis sebagai bahan pertimbangan
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Pendapatan keuangan", value: money(analytics.income), icon: <FiArrowUpRight />, note: "Pemasukan tercatat" },
              { label: "Pengeluaran keuangan", value: money(analytics.expense), icon: <FiTrendingDown />, note: "Biaya tercatat" },
              { label: "Selisih keuangan", value: money(analytics.net), icon: <FiBarChart2 />, note: "Pendapatan − pengeluaran" },
              { label: "Omzet penjualan", value: money(analytics.revenue), icon: <FiActivity />, note: "Total transaksi penjualan" },
            ].map((card) => (
              <div key={card.label} className="flex min-w-0 flex-col rounded-2xl border border-black/10 bg-white p-4 transition hover:border-[#C6A15B]/70 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium leading-4 text-black/50">{card.label}</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F8F3E8] text-[#947331]">{card.icon}</span>
                </div>
                <p className="mt-5 break-words text-lg font-semibold tracking-tight sm:text-xl">{card.value}</p>
                <p className="mt-1 text-[10px] leading-4 text-black/40">{card.note}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid min-w-0 grid-cols-1 items-start gap-4 sm:gap-5 2xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <div className="min-w-0 space-y-4 sm:space-y-5">
            <section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#A8843D]">Business overview</p>
                  <h2 className="mt-2 text-lg font-semibold tracking-tight">Ringkasan bisnis</h2>
                  <p className="mt-1 text-xs leading-5 text-black/45">Gambaran operasional pada {analytics.periodLabel}.</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/10 text-[#947331]"><FiBarChart2 size={18} /></span>
              </div>
              <div className="mt-5 divide-y divide-black/[0.07]">
                {[
                  ["Transaksi penjualan", count(analytics.salesCount)],
                  ["Produk terjual", `${count(analytics.unitsSold)} unit`],
                  ["Produk terdaftar", count(analytics.productCount)],
                  ["Nilai stok berdasarkan harga modal", money(analytics.inventoryValueAtCost)],
                  ["Produk dengan stok menipis", count(analytics.lowStock.length)],
                  ["Produk kehabisan stok", count(analytics.outOfStock.length)],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 py-3">
                    <span className="text-xs leading-5 text-black/55">{label}</span>
                    <span className="text-right text-sm font-semibold">{value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#A8843D]">Needs attention</p>
                  <h2 className="mt-2 text-lg font-semibold tracking-tight">Hal yang perlu diperhatikan</h2>
                </div>
                <FiAlertTriangle className="shrink-0 text-[#A8843D]" size={19} />
              </div>
              <div className="mt-4 space-y-3">
                {flags.map((flag, i) => (
                  <div key={`${flag.title}-${i}`} className="rounded-xl border border-black/[0.07] p-3.5">
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${flag.level === "warning" ? "bg-[#F8F3E8] text-[#947331]" : "bg-black/[0.04] text-black/55"}`}>
                        {flag.level === "warning" ? <FiAlertTriangle size={14} /> : <FiCheckCircle size={14} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-sm font-semibold leading-5">{flag.title}</p>
                        <p className="mt-1 break-words text-xs leading-5 text-black/55">{flag.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex gap-3 rounded-2xl bg-[#F8F3E8] p-4">
              <FiShield className="mt-0.5 shrink-0 text-[#947331]" size={17} />
              <div>
                <p className="text-xs font-semibold text-[#5E4A25]">Catatan transparansi</p>
                <p className="mt-1 text-xs leading-5 text-[#5E4A25]/80">
                  Selisih keuangan bukan otomatis laba bersih. Margin produk hanya menghitung harga jual dikurangi harga modal, belum termasuk seluruh biaya operasional.
                </p>
              </div>
            </div>
          </div>

          <section className="flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_12px_50px_rgba(0,0,0,0.045)] sm:min-h-[650px] 2xl:sticky 2xl:top-6 2xl:h-[calc(100dvh-48px)] 2xl:min-h-[600px]">
            <div className="flex items-center gap-3 border-b border-black/10 px-5 py-4 sm:px-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#171717] text-[#D7B66D]">
                <FiMessageCircle size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold tracking-tight">Tanya LUMA</h2>
                <p className="mt-1 text-xs text-black/45">Asisten bisnis pribadi Anda</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C6A15B]/45 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#8B6B2D]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#C6A15B]" />
                AI Advisor
              </span>
            </div>

            <div className="min-h-[220px] min-w-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-[#FCFBF8] p-3 sm:space-y-5 sm:p-5 lg:p-6">
              {messages.map((message, i) => (
                <div key={`${message.role}-${i}`} className={`flex min-w-0 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.role === "model" && (
                    <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#171717] text-[10px] font-semibold text-[#D7B66D]">L</div>
                  )}
                  <div className={`min-w-0 max-w-[88%] overflow-hidden rounded-2xl px-3 py-3 text-sm leading-6 sm:px-4 sm:py-3.5 ${message.role === "user" ? "rounded-br-md bg-[#171717] text-white" : "rounded-bl-md border border-black/[0.07] bg-white text-[#242424] shadow-sm"}`}>
                    {message.role === "model" && <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#A8843D]">LUMA Advisor</p>}
                    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.text}</p>
                  </div>
                </div>
              ))}

              {sending && (
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#171717] text-[10px] font-semibold text-[#D7B66D]">L</div>
                  <div className="rounded-xl border border-black/[0.07] bg-white px-4 py-3 text-xs text-black/50">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#C6A15B]" />
                      LUMA sedang menyusun jawaban...
                    </span>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {messages.length <= 1 && (
              <div className="border-t border-black/[0.07] bg-white px-4 pt-4 sm:px-5">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-black/40">Mulai dari sini</p>
                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendMessage(undefined, prompt)}
                      disabled={sending}
                      className="group flex min-h-[54px] min-w-0 items-center justify-between gap-2 rounded-xl border border-black/10 px-3 py-3 text-left text-xs leading-5 text-black/65 transition hover:border-[#C6A15B]/70 hover:bg-[#FBF8F0] disabled:opacity-50 sm:gap-3 sm:px-3.5"
                    >
                      <span>{prompt}</span>
                      <FiChevronRight className="shrink-0 text-[#A8843D] transition group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={(e) => void sendMessage(e)} className="min-w-0 border-t border-black/10 bg-white p-3 sm:p-5">
              <div className="rounded-2xl border border-black/15 bg-white p-2 transition focus-within:border-[#C6A15B] focus-within:ring-2 focus-within:ring-[#C6A15B]/10">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendMessage();
                    }
                  }}
                  rows={2}
                  placeholder="Tanyakan apa saja tentang bisnis Anda..."
                  className="max-h-36 min-h-[52px] w-full min-w-0 resize-y bg-transparent px-2 py-2 text-sm leading-6 outline-none placeholder:text-black/35 sm:px-3"
                />
                <div className="flex items-center justify-between gap-3 px-1 pb-1">
                  <p className="min-w-0 px-1 text-[10px] leading-4 text-black/35">Enter untuk mengirim · Shift + Enter untuk baris baru</p>
                  <button
                    type="submit"
                    disabled={!input.trim() || sending}
                    aria-label="Kirim pertanyaan"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#171717] text-[#D7B66D] transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <FiSend size={16} />
                  </button>
                </div>
              </div>
              <p className="mt-3 text-[10px] leading-4 text-black/35">
                Jawaban LUMA adalah bahan pertimbangan. Hindari memasukkan kata sandi atau informasi pribadi yang tidak diperlukan.
              </p>
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}
