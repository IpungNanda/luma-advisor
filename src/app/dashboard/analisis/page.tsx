"use client";

import { useEffect, useMemo, useState } from "react";
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
  FiArrowDownRight,
  FiArrowUpRight,
  FiBarChart2,
  FiCheckCircle,
  FiDollarSign,
  FiPackage,
  FiRefreshCw,
  FiTrendingDown,
  FiTrendingUp,
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
};

type Product = {
  id: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minimumStock: number;
};

type StockMovement = {
  productId?: string;
  productName: string;
  type: string;
  quantity: number;
  date: string;
  reason: string;
  isDeleted?: boolean;
  status?: string;
};

type Period = "30" | "90" | "all";

const money = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);

const number = (value: number) =>
  new Intl.NumberFormat("id-ID").format(Number.isFinite(value) ? value : 0);

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function MetricCard({
  label,
  value,
  note,
  icon,
  tone = "gold",
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  tone?: "gold" | "green" | "red" | "black";
}) {
  const tones = {
    gold: "bg-[#F8F3E8] text-[#947331]",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-rose-50 text-rose-700",
    black: "bg-[#171717] text-[#D7B66D]",
  };

  return (
    <article className="min-w-0 rounded-2xl border border-black/10 bg-white p-4 transition hover:border-[#C6A15B]/70 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium leading-5 text-black/55">{label}</p>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          {icon}
        </span>
      </div>
      <p className="mt-5 break-words text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-black/40">{note}</p>
    </article>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#A8843D]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-lg font-semibold tracking-tight text-[#171717]">{title}</h2>
      {description && <p className="mt-1 text-xs leading-5 text-black/45">{description}</p>}
    </div>
  );
}

export default function AnalisisBisnisPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <AnalisisBisnisDashboard />
      </DashboardLayout>
    </AuthGuard>
  );
}

function AnalisisBisnisDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [finance, setFinance] = useState<Finance[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState("");
  const [period, setPeriod] = useState<Period>("30");

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!authReady) return;

    if (!user) {
      setLoading(false);
      setWarning("Sesi login tidak ditemukan. Silakan login kembali.");
      return;
    }

    setLoading(true);
    setWarning("");
    let completed = 0;
    const markDone = () => {
      completed += 1;
      if (completed >= 4) setLoading(false);
    };

    const unsubs = [
      onSnapshot(
        query(collection(db, "financeTransactions"), where("ownerUid", "==", user.uid)),
        (snapshot) => {
          setFinance(
            snapshot.docs.map((doc) => {
              const item = doc.data();
              return {
                type: String(item.type ?? "income"),
                amount: Number(item.amount ?? 0),
                date: String(item.date ?? ""),
                category: String(item.category ?? "Lainnya"),
                description: String(item.description ?? ""),
              };
            }),
          );
          markDone();
        },
        (error) => {
          console.error("Analisis bisnis finance:", error);
          setWarning("Data keuangan tidak dapat dibaca. Periksa Firestore Rules.");
          markDone();
        },
      ),
      onSnapshot(
        query(collection(db, "salesTransactions"), where("ownerUid", "==", user.uid)),
        (snapshot) => {
          setSales(
            snapshot.docs.map((doc) => {
              const item = doc.data();
              return {
                productName: String(item.productName ?? "Produk tanpa nama"),
                quantity: Number(item.quantity ?? 0),
                unitPrice: Number(item.unitPrice ?? 0),
                totalAmount: Number(item.totalAmount ?? 0),
                date: String(item.date ?? ""),
              };
            }),
          );
          markDone();
        },
        (error) => {
          console.error("Analisis bisnis sales:", error);
          setWarning("Data penjualan tidak dapat dibaca. Periksa Firestore Rules.");
          markDone();
        },
      ),
      onSnapshot(
        query(collection(db, "products"), where("ownerUid", "==", user.uid)),
        (snapshot) => {
          setProducts(
            snapshot.docs.map((doc) => {
              const item = doc.data();
              return {
                id: doc.id,
                name: String(item.name ?? "Produk tanpa nama"),
                category: String(item.category ?? "Lainnya"),
                costPrice: Number(item.costPrice ?? 0),
                sellingPrice: Number(item.sellingPrice ?? 0),
                stock: Number(item.stock ?? 0),
                minimumStock: Number(item.minimumStock ?? 5),
              };
            }),
          );
          markDone();
        },
        (error) => {
          console.error("Analisis bisnis products:", error);
          setWarning("Data produk tidak dapat dibaca. Periksa Firestore Rules.");
          markDone();
        },
      ),
      onSnapshot(
        query(collection(db, "stockMovements"), where("ownerUid", "==", user.uid)),
        (snapshot) => {
          setMovements(
            snapshot.docs.map((doc) => {
              const item = doc.data();
              return {
                productId: String(item.productId ?? item.productID ?? item.product_id ?? ""),
                productName: String(item.productName ?? item.name ?? "Produk tanpa nama"),
                type: String(item.type ?? "in"),
                quantity: Number(item.quantity ?? 0),
                date: String(item.date ?? ""),
                reason: String(item.reason ?? ""),
                isDeleted: item.isDeleted === true || item.deleted === true,
                status: String(item.status ?? ""),
              };
            }),
          );
          markDone();
        },
        (error) => {
          console.error("Analisis bisnis stock movements:", error);
          setWarning("Data pergerakan stok tidak dapat dibaca. Periksa Firestore Rules.");
          markDone();
        },
      ),
    ];

    return () => unsubs.forEach((unsubscribe) => unsubscribe());
  }, [user, authReady]);

  const analysis = useMemo(() => {
    const today = new Date();
    const todayString = dateKey(today);
    const startDate =
      period === "all"
        ? "0000-00-00"
        : dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - Number(period)));

    const selectedFinance = finance.filter((item) => item.date >= startDate && item.date <= todayString);
    const selectedSales = sales.filter((item) => item.date >= startDate && item.date <= todayString);

    const income = selectedFinance
      .filter((item) => item.type.toLowerCase() === "income")
      .reduce((sum, item) => sum + item.amount, 0);
    const expenses = selectedFinance
      .filter((item) => item.type.toLowerCase() === "expense")
      .reduce((sum, item) => sum + item.amount, 0);
    const revenue = selectedSales.reduce((sum, item) => sum + item.totalAmount, 0);
    const unitsSold = selectedSales.reduce((sum, item) => sum + item.quantity, 0);
    const net = income - expenses;

    const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();
    selectedSales.forEach((sale) => {
      const name = sale.productName || "Produk tanpa nama";
      const current = productSales.get(name) ?? { name, quantity: 0, revenue: 0 };
      current.quantity += sale.quantity;
      current.revenue += sale.totalAmount;
      productSales.set(name, current);
    });

    const expenseMap = new Map<string, number>();
    selectedFinance
      .filter((item) => item.type.toLowerCase() === "expense")
      .forEach((item) => {
        const category = item.category || "Lainnya";
        expenseMap.set(category, (expenseMap.get(category) ?? 0) + item.amount);
      });

    const productMargins = products
      .map((product) => ({
        ...product,
        unitMargin: product.sellingPrice - product.costPrice,
        marginPercent:
          product.sellingPrice > 0
            ? ((product.sellingPrice - product.costPrice) / product.sellingPrice) * 100
            : 0,
      }))
      .filter((product) => product.sellingPrice > 0 && product.costPrice >= 0)
      .sort((a, b) => a.unitMargin - b.unitMargin);

    const lowStock = products.filter((product) => product.stock > 0 && product.stock <= product.minimumStock);
    const outOfStock = products.filter((product) => product.stock <= 0);
    const totalInventoryCost = products.reduce((sum, product) => sum + product.stock * product.costPrice, 0);
    const bestProducts = [...productSales.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const expensesByCategory = [...expenseMap.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const alerts: { title: string; detail: string; level: "warning" | "info" }[] = [];
    if (selectedFinance.length === 0 && selectedSales.length === 0) {
      alerts.push({
        title: "Data pada periode ini masih terbatas",
        detail: "Catat transaksi keuangan dan penjualan agar analisis lebih relevan. Data kosong tidak berarti bisnis tidak memiliki aktivitas.",
        level: "info",
      });
    }
    if (net < 0) {
      alerts.push({
        title: "Pengeluaran tercatat melebihi pendapatan keuangan",
        detail: `Selisih yang tercatat adalah ${money(net)}. Periksa transaksi dan kategori pengeluaran terbesar.`,
        level: "warning",
      });
    }
    if (outOfStock.length > 0) {
      alerts.push({
        title: `${outOfStock.length} produk kehabisan stok`,
        detail: `Contoh: ${outOfStock.slice(0, 3).map((product) => product.name).join(", ")}. Periksa kebutuhan pengadaan berdasarkan permintaan.`,
        level: "warning",
      });
    }
    if (lowStock.length > 0) {
      alerts.push({
        title: `${lowStock.length} produk mendekati stok minimum`,
        detail: `Pantau ${lowStock.slice(0, 3).map((product) => product.name).join(", ")}.`,
        level: "warning",
      });
    }
    if (productMargins.some((product) => product.unitMargin <= 0)) {
      alerts.push({
        title: "Ada produk dengan margin per unit nol atau negatif",
        detail: "Bandingkan harga jual dan harga modal. Margin ini belum memperhitungkan seluruh biaya operasional.",
        level: "warning",
      });
    }
    if (selectedSales.length === 0 && finance.length > 0) {
      alerts.push({
        title: "Belum ada transaksi penjualan pada periode terpilih",
        detail: "Pastikan transaksi penjualan sudah dicatat dan tanggalnya sesuai periode analisis.",
        level: "info",
      });
    }
    if (alerts.length === 0) {
      alerts.push({
        title: "Tidak ditemukan peringatan dari indikator dasar",
        detail: "Ini bukan jaminan bisnis bebas risiko. Periksa data dan kondisi operasional secara berkala.",
        level: "info",
      });
    }

    let health = 100;
    if (net < 0) health -= 25;
    if (income === 0 && expenses > 0) health -= 15;
    health -= Math.min(15, lowStock.length * 3);
    health -= Math.min(20, outOfStock.length * 5);
    if (selectedSales.length === 0) health -= 10;
    if (products.length === 0) health -= 10;

    return {
      periodLabel: period === "all" ? "seluruh periode" : `${period} hari terakhir`,
      income,
      expenses,
      net,
      revenue,
      unitsSold,
      financeCount: selectedFinance.length,
      salesCount: selectedSales.length,
      health: Math.max(0, Math.min(100, health)),
      lowStock,
      outOfStock,
      totalInventoryCost,
      productCount: products.length,
      bestProducts,
      expensesByCategory,
      productMargins: productMargins.slice(0, 5),
      alerts,
      // Tampilkan pergerakan hanya untuk produk yang masih ada/valid.
      // Riwayat produk yang sudah dihapus dan event penghapusan tidak ditampilkan.
      movements: movements
        .filter((movement) => {
          const movementType = movement.type.toLowerCase().trim();
          const movementStatus = (movement.status ?? "").toLowerCase().trim();

          const isDeletionEvent = [
            "delete",
            "deleted",
            "remove",
            "removed",
            "product_deleted",
            "product-deleted",
          ].includes(movementType);

          const isInvalidStatus = [
            "deleted",
            "inactive",
            "invalid",
            "cancelled",
            "canceled",
          ].includes(movementStatus);

          if (movement.isDeleted || isDeletionEvent || isInvalidStatus) return false;
          if (!Number.isFinite(movement.quantity) || movement.quantity <= 0) return false;

          const linkedProductExists = movement.productId
            ? products.some((product) => product.id === movement.productId)
            : products.some(
                (product) =>
                  product.name.trim().toLocaleLowerCase("id-ID") ===
                  movement.productName.trim().toLocaleLowerCase("id-ID"),
              );

          return (
            linkedProductExists &&
            movement.date >= startDate &&
            movement.date <= todayString
          );
        })
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 5),
    };
  }, [finance, sales, products, movements, period]);

  const maxExpense = Math.max(...analysis.expensesByCategory.map((item) => item.amount), 1);
  const maxProductRevenue = Math.max(...analysis.bestProducts.map((item) => item.revenue), 1);

  if (!authReady || loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#FAFAF8] px-4">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#E7DFD0] border-t-[#D6B36A]" />
          <p className="mt-4 text-sm text-black/45">Menganalisis data bisnis...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full min-w-0 overflow-x-clip bg-[#FAFAF8] px-3 py-5 text-[#171717] sm:px-5 sm:py-6 lg:px-8 lg:py-9 xl:px-10">
      <div className="mx-auto w-full max-w-[1600px] min-w-0 space-y-6 sm:space-y-8">
        <header className="flex min-w-0 flex-col justify-between gap-5 border-b border-black/10 pb-6 xl:flex-row xl:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-[#A8843D]">
              <span className="h-px w-8 bg-[#C6A15B]" />
              LUMA / BUSINESS INTELLIGENCE
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">
              Analisis Bisnis<span className="text-[#C6A15B]">.</span>
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/55">
              Pahami kondisi usaha melalui data keuangan, penjualan, produk, dan persediaan.
            </p>
          </div>
          <div className="flex w-full items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 sm:w-auto">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#171717] text-[#D7B66D]">
              <FiRefreshCw size={16} />
            </span>
            <div>
              <label htmlFor="analysis-period" className="block text-[10px] font-medium uppercase tracking-wider text-black/45">
                Periode analisis
              </label>
              <select
                id="analysis-period"
                value={period}
                onChange={(event) => setPeriod(event.target.value as Period)}
                className="mt-0.5 max-w-[180px] bg-transparent text-sm font-semibold outline-none"
              >
                <option value="30">30 hari terakhir</option>
                <option value="90">90 hari terakhir</option>
                <option value="all">Semua data</option>
              </select>
            </div>
          </div>
        </header>

        {warning && (
          <div role="alert" className="flex gap-3 rounded-xl border border-[#C6A15B]/50 bg-[#FBF8F0] p-4 text-sm text-[#5E4A25]">
            <FiAlertTriangle className="mt-0.5 shrink-0" size={18} />
            <p>{warning}</p>
          </div>
        )}

        <section className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Pendapatan keuangan" value={money(analysis.income)} note={`${number(analysis.financeCount)} transaksi keuangan`} icon={<FiArrowUpRight size={18} />} tone="green" />
          <MetricCard label="Pengeluaran keuangan" value={money(analysis.expenses)} note="Total biaya tercatat" icon={<FiArrowDownRight size={18} />} tone="red" />
          <MetricCard label="Selisih keuangan" value={money(analysis.net)} note="Pendapatan dikurangi pengeluaran" icon={<FiDollarSign size={18} />} tone={analysis.net < 0 ? "red" : "gold"} />
          <MetricCard label="Omzet penjualan" value={money(analysis.revenue)} note={`${number(analysis.unitsSold)} unit terjual`} icon={<FiTrendingUp size={18} />} tone="black" />
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <article className="relative overflow-hidden rounded-2xl bg-[#171717] p-6 text-white sm:p-7">
            <div className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full border border-[#C6A15B]/20" />
            <div className="pointer-events-none absolute -right-2 -top-6 h-28 w-28 rounded-full border border-[#C6A15B]/25" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#D7B66D]">Business health</p>
                <p className="mt-5 text-5xl font-semibold tracking-[-0.05em]">{analysis.health}<span className="ml-1 text-base font-normal tracking-normal text-white/45">/100</span></p>
              </div>
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#D7B66D]/35 bg-white/5 text-[#D7B66D]">
                <FiActivity size={21} />
              </span>
            </div>
            <div className="relative mt-6 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-[#D7B66D] transition-all duration-500" style={{ width: `${analysis.health}%` }} />
            </div>
            <p className="relative mt-4 text-xs leading-5 text-white/60">
              Indikator awal berdasarkan data yang tersedia, bukan audit bisnis menyeluruh.
            </p>
            <div className="relative mt-6 flex items-center gap-2 border-t border-white/10 pt-4 text-[11px] text-white/65">
              <FiCheckCircle className="text-[#D7B66D]" />
              Periode: {analysis.periodLabel}
            </div>
          </article>

          <article className="min-w-0 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
            <SectionTitle eyebrow="Business overview" title="Ringkasan operasional" description="Gambaran indikator utama pada periode terpilih." />
            <div className="mt-5 divide-y divide-black/[0.07]">
              {[
                ["Transaksi penjualan", number(analysis.salesCount)],
                ["Produk terdaftar", number(analysis.productCount)],
                ["Nilai stok berdasarkan harga modal", money(analysis.totalInventoryCost)],
                ["Produk dengan stok menipis", number(analysis.lowStock.length)],
                ["Produk kehabisan stok", number(analysis.outOfStock.length)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-4 py-3">
                  <span className="text-xs leading-5 text-black/55">{label}</span>
                  <span className="text-right text-sm font-semibold">{value}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <article className="min-w-0 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
            <SectionTitle eyebrow="Sales performance" title="Produk berdasarkan omzet" description="Produk dengan kontribusi omzet terbesar pada periode terpilih." />
            {analysis.bestProducts.length === 0 ? (
              <p className="mt-5 rounded-xl bg-[#FAFAF8] p-4 text-sm leading-6 text-black/50">Belum ada data penjualan pada periode ini.</p>
            ) : (
              <div className="mt-5 space-y-5">
                {analysis.bestProducts.map((product, index) => (
                  <div key={product.name}>
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F8F3E8] text-xs font-semibold text-[#947331]">{index + 1}</span>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium">{product.name}</p>
                          <p className="mt-0.5 text-[11px] text-black/40">{number(product.quantity)} unit terjual</p>
                        </div>
                      </div>
                      <p className="shrink-0 text-right text-sm font-semibold">{money(product.revenue)}</p>
                    </div>
                    <div className="ml-10 h-2 overflow-hidden rounded-full bg-black/[0.05]">
                      <div className="h-full rounded-full bg-[#C6A15B]" style={{ width: `${(product.revenue / maxProductRevenue) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="min-w-0 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
            <SectionTitle eyebrow="Expense breakdown" title="Pengeluaran berdasarkan kategori" description="Kategori dengan jumlah pengeluaran tertinggi." />
            {analysis.expensesByCategory.length === 0 ? (
              <p className="mt-5 rounded-xl bg-[#FAFAF8] p-4 text-sm leading-6 text-black/50">Belum ada pengeluaran tercatat pada periode ini.</p>
            ) : (
              <div className="mt-5 space-y-5">
                {analysis.expensesByCategory.map((item) => (
                  <div key={item.category}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="break-words text-sm font-medium">{item.category}</p>
                      <p className="shrink-0 text-sm font-semibold">{money(item.amount)}</p>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-black/[0.05]">
                      <div className="h-full rounded-full bg-[#171717]" style={{ width: `${(item.amount / maxExpense) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <article className="min-w-0 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
            <SectionTitle eyebrow="Product profitability" title="Produk dengan margin terendah" description="Margin per unit dihitung dari harga jual dikurangi harga modal." />
            {analysis.productMargins.length === 0 ? (
              <p className="mt-5 rounded-xl bg-[#FAFAF8] p-4 text-sm leading-6 text-black/50">Data harga produk belum cukup untuk menghitung margin.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[440px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-black/10 text-black/45">
                      <th className="py-3 pr-3 font-medium">Produk</th>
                      <th className="py-3 pr-3 font-medium">Margin/unit</th>
                      <th className="py-3 font-medium">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.productMargins.map((product) => (
                      <tr key={product.name} className="border-b border-black/[0.06] last:border-0">
                        <td className="max-w-[180px] break-words py-3 pr-3 font-medium">{product.name}</td>
                        <td className={`py-3 pr-3 font-semibold ${product.unitMargin <= 0 ? "text-rose-700" : "text-black"}`}>{money(product.unitMargin)}</td>
                        <td className={`py-3 font-medium ${product.marginPercent <= 0 ? "text-rose-700" : "text-black/65"}`}>{product.marginPercent.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-3 text-[10px] leading-5 text-black/40">Perhitungan belum memasukkan biaya operasional, pajak, atau biaya lain yang belum tercatat.</p>
          </article>

          <article className="min-w-0 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
            <SectionTitle eyebrow="Business alerts" title="Temuan dan prioritas tindakan" description="Peringatan berdasarkan indikator sederhana dari data yang tersedia." />
            <div className="mt-4 space-y-3">
              {analysis.alerts.map((alert, index) => (
                <div key={`${alert.title}-${index}`} className="rounded-xl border border-black/[0.07] p-3.5">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${alert.level === "warning" ? "bg-[#F8F3E8] text-[#947331]" : "bg-black/[0.04] text-black/55"}`}>
                      {alert.level === "warning" ? <FiAlertTriangle size={15} /> : <FiCheckCircle size={15} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold leading-5">{alert.title}</p>
                      <p className="mt-1 break-words text-xs leading-5 text-black/55">{alert.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <article className="min-w-0 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
            <SectionTitle eyebrow="Inventory" title="Status persediaan" description="Daftar produk yang perlu diperiksa." />
            {analysis.lowStock.length === 0 && analysis.outOfStock.length === 0 ? (
              <div className="mt-5 flex gap-3 rounded-xl bg-[#F8F3E8] p-4 text-sm text-[#5E4A25]">
                <FiPackage className="mt-0.5 shrink-0" size={18} />
                <p>Tidak ada produk yang terdeteksi menipis atau habis berdasarkan batas stok yang tersimpan.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {[...analysis.outOfStock, ...analysis.lowStock].slice(0, 8).map((product) => (
                  <div key={product.name} className="flex items-center justify-between gap-4 rounded-xl border border-black/[0.07] p-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F8F3E8] text-[#947331]"><FiPackage size={16} /></span>
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium">{product.name}</p>
                        <p className="text-[11px] text-black/40">Batas minimum: {number(product.minimumStock)}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${product.stock <= 0 ? "bg-rose-50 text-rose-700" : "bg-[#F8F3E8] text-[#947331]"}`}>
                      Stok: {number(product.stock)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="min-w-0 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
            <SectionTitle eyebrow="Stock activity" title="Pergerakan stok terbaru" description="Aktivitas stok yang tercatat pada periode terpilih." />
            {analysis.movements.length === 0 ? (
              <p className="mt-5 rounded-xl bg-[#FAFAF8] p-4 text-sm leading-6 text-black/50">Belum ada data pergerakan stok pada periode ini.</p>
            ) : (
              <div className="mt-4 divide-y divide-black/[0.07]">
                {analysis.movements.map((movement, index) => {
                  const isIn = ["in", " masuk", "stock-in", "restock"].includes(movement.type.toLowerCase().trim());
                  return (
                    <div key={`${movement.productName}-${movement.date}-${index}`} className="flex items-start justify-between gap-4 py-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isIn ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                          {isIn ? <FiTrendingUp size={15} /> : <FiTrendingDown size={15} />}
                        </span>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium">{movement.productName}</p>
                          <p className="mt-1 break-words text-[11px] leading-4 text-black/45">{movement.reason || "Tidak ada keterangan"} · {movement.date || "Tanggal tidak tersedia"}</p>
                        </div>
                      </div>
                      <span className="shrink-0 text-xs font-semibold">{isIn ? "+" : "−"}{number(movement.quantity)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </section>

        <footer className="flex items-start gap-3 rounded-2xl bg-[#F8F3E8] p-4 sm:p-5">
          <FiBarChart2 className="mt-0.5 shrink-0 text-[#947331]" size={18} />
          <div>
            <p className="text-xs font-semibold text-[#5E4A25]">Catatan analisis</p>
            <p className="mt-1 text-xs leading-5 text-[#5E4A25]/80">
              Omzet penjualan berbeda dari pendapatan keuangan. Selisih pendapatan dan pengeluaran bukan otomatis laba bersih akuntansi. Skor kesehatan adalah indikator awal dan tidak menggantikan evaluasi bisnis menyeluruh.
            </p>
          </div>
        </footer>
      </div>
    </main>
  );
}
