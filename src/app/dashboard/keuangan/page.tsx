
"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  FiActivity,
  FiArrowDownLeft,
  FiArrowUpRight,
  FiCalendar,
  FiCheck,
  FiChevronDown,
  FiClock,
  FiDownload,
  FiEdit2,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiTrendingUp,
  FiX,
} from "react-icons/fi";

import { auth, db } from "@/lib/firebase";
import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

type TransactionType = "income" | "expense";

interface Transaction {
  id: string;
  ownerUid: string;
  type: TransactionType;
  description: string;
  category: string;
  amount: number;
  date: string;
  createdAt?: unknown;
}

const incomeCategories = [
  "Penjualan",
  "Jasa",
  "Pendapatan Lainnya",
];

const expenseCategories = [
  "Bahan Baku",
  "Operasional",
  "Transportasi",
  "Gaji",
  "Sewa",
  "Pemasaran",
  "Utilitas",
  "Pengeluaran Lainnya",
];

const periods = [
  { label: "7 Hari", value: "7" },
  { label: "30 Hari", value: "30" },
  { label: "90 Hari", value: "90" },
];

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);

  return localDateString(date);
}

function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompact(amount: number) {
  if (amount >= 1_000_000) {
    return `Rp${(amount / 1_000_000)
      .toFixed(1)
      .replace(".", ",")} jt`;
  }

  if (amount >= 1_000) {
    return `Rp${Math.round(amount / 1_000)} rb`;
  }

  return formatRupiah(amount);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function errorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    const code = String(error.code);

    if (code === "permission-denied") {
      return "Akses database ditolak. Periksa Firestore Security Rules.";
    }

    if (code === "unavailable") {
      return "Database sedang tidak tersedia. Periksa koneksi internet.";
    }

    if (code === "unauthenticated") {
      return "Sesi login berakhir. Silakan login kembali.";
    }
  }

  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan. Silakan coba kembali.";
}

export default function KeuanganPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <FinanceDashboard />
      </DashboardLayout>
    </AuthGuard>
  );
}

function FinanceDashboard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState("");

  const [period, setPeriod] = useState("7");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [formType, setFormType] =
    useState<TransactionType>("income");

  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Penjualan");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(localDateString());

  // Data transaksi yang sedang diedit.
  const [editTarget, setEditTarget] =
    useState<Transaction | null>(null);

  // State khusus untuk modal konfirmasi hapus.
  const [deleteTarget, setDeleteTarget] =
    useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Mengambil data Firestore dan memperbarui tampilan secara real-time.
  useEffect(() => {
    const user = auth.currentUser;

    if (!user) {
      setLoading(false);
      setDatabaseError(
        "Sesi login tidak ditemukan. Silakan login kembali."
      );
      return;
    }

    setLoading(true);
    setDatabaseError("");

    const transactionsQuery = query(
      collection(db, "financeTransactions"),
      where("ownerUid", "==", user.uid)
    );

    const unsubscribe = onSnapshot(
      transactionsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((document) => {
          const value = document.data();

          return {
            id: document.id,
            ownerUid: value.ownerUid as string,
            type: value.type as TransactionType,
            description: value.description as string,
            category: value.category as string,
            amount: value.amount as number,
            date: value.date as string,
            createdAt: value.createdAt,
          };
        });

        setTransactions(data);
        setDatabaseError("");
        setLoading(false);
      },
      (error) => {
        console.error("Firestore finance error:", error);
        setDatabaseError(errorMessage(error));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const startDate = dateDaysAgo(Number(period) - 1);
  const endDate = localDateString();

  const periodTransactions = useMemo(() => {
    return transactions.filter(
      (item) => item.date >= startDate && item.date <= endDate
    );
  }, [transactions, startDate, endDate]);

  const summary = useMemo(() => {
    const income = periodTransactions
      .filter((item) => item.type === "income")
      .reduce((total, item) => total + item.amount, 0);

    const expense = periodTransactions
      .filter((item) => item.type === "expense")
      .reduce((total, item) => total + item.amount, 0);

    return {
      income,
      expense,
      profit: income - expense,
      count: periodTransactions.length,
    };
  }, [periodTransactions]);

  const filteredTransactions = useMemo(() => {
    return [...periodTransactions]
      .filter((item) => {
        const matchesSearch = [
          item.description,
          item.category,
          item.id,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase());

        const matchesType =
          typeFilter === "all" || item.type === typeFilter;

        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        const dateComparison = b.date.localeCompare(a.date);

        if (dateComparison !== 0) return dateComparison;

        return b.id.localeCompare(a.id);
      });
  }, [periodTransactions, search, typeFilter]);

  const chartData = useMemo(() => {
    const result: {
      date: string;
      income: number;
      expense: number;
    }[] = [];

    for (let i = Number(period) - 1; i >= 0; i--) {
      const day = dateDaysAgo(i);

      const daily = periodTransactions.filter(
        (item) => item.date === day
      );

      result.push({
        date: day,
        income: daily
          .filter((item) => item.type === "income")
          .reduce((total, item) => total + item.amount, 0),
        expense: daily
          .filter((item) => item.type === "expense")
          .reduce((total, item) => total + item.amount, 0),
      });
    }

    return result;
  }, [period, periodTransactions]);

  const chartMax = Math.max(
    ...chartData.map((item) =>
      Math.max(item.income, item.expense)
    ),
    100_000
  );

  // Membuka formulir untuk transaksi baru.
  function openForm(type: TransactionType = "income") {
    setEditTarget(null);
    setFormType(type);
    setDescription("");
    setCategory(
      type === "income" ? "Penjualan" : "Bahan Baku"
    );
    setAmount("");
    setDate(localDateString());
    setFormError("");
    setShowForm(true);
  }

  // Membuka formulir dengan data transaksi yang dipilih.
  function openEditForm(transaction: Transaction) {
    setEditTarget(transaction);
    setFormType(transaction.type);
    setDescription(transaction.description);
    setCategory(transaction.category);
    setAmount(String(transaction.amount));
    setDate(transaction.date);
    setFormError("");
    setShowForm(true);
  }

  function changeType(type: TransactionType) {
    setFormType(type);

    const categories =
      type === "income" ? incomeCategories : expenseCategories;

    if (!categories.includes(category)) {
      setCategory(categories[0]);
    }
  }

  // Menambah transaksi baru atau menyimpan perubahan transaksi.
  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setFormError("");

    const user = auth.currentUser;
    const parsedAmount = Number(amount);

    if (!user) {
      setFormError(
        "Sesi login berakhir. Silakan login kembali."
      );
      return;
    }

    if (!description.trim()) {
      setFormError("Keterangan transaksi wajib diisi.");
      return;
    }

    if (
      !Number.isSafeInteger(parsedAmount) ||
      parsedAmount <= 0
    ) {
      setFormError(
        "Nominal harus berupa bilangan bulat lebih dari nol."
      );
      return;
    }

    if (!date || date > localDateString()) {
      setFormError("Tanggal transaksi tidak valid.");
      return;
    }

    setSaving(true);

    const transactionData = {
      type: formType,
      description: description.trim(),
      category,
      amount: parsedAmount,
      date,
    };

    try {
      if (editTarget) {
        if (editTarget.ownerUid !== user.uid) {
          throw new Error(
            "Anda tidak memiliki akses untuk mengubah transaksi ini."
          );
        }

        await updateDoc(
          doc(db, "financeTransactions", editTarget.id),
          transactionData
        );
      } else {
        await addDoc(collection(db, "financeTransactions"), {
          ownerUid: user.uid,
          ...transactionData,
          createdAt: serverTimestamp(),
        });
      }

      setShowForm(false);
      setEditTarget(null);
      setSearch("");
      setTypeFilter("all");
      setPeriod("30");
    } catch (error) {
      console.error("Gagal menyimpan transaksi:", error);
      setFormError(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  // Tombol hapus hanya membuka modal; belum menghapus data.
  function handleDelete(transaction: Transaction) {
    setDeleteError("");
    setDeleteTarget(transaction);
  }

  // Penghapusan hanya dijalankan setelah konfirmasi pengguna.
  async function confirmDelete() {
    if (!deleteTarget || !auth.currentUser || deleting) return;

    const user = auth.currentUser;

    if (deleteTarget.ownerUid !== user.uid) {
      setDeleteError(
        "Anda tidak memiliki akses untuk menghapus transaksi ini."
      );
      return;
    }

    setDeleting(true);
    setDeleteError("");

    try {
      await deleteDoc(
        doc(db, "financeTransactions", deleteTarget.id)
      );

      setDeleteTarget(null);
      setDeleteError("");
    } catch (error) {
      console.error("Gagal menghapus transaksi:", error);
      setDeleteError(errorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  function exportCsv() {
    const headers = [
      "Tanggal",
      "Jenis",
      "Keterangan",
      "Kategori",
      "Nominal",
    ];

    const rows = filteredTransactions.map((item) => [
      item.date,
      item.type === "income" ? "Pemasukan" : "Pengeluaran",
      item.description,
      item.category,
      String(item.amount),
    ]);

    const escapeCsv = (value: string) =>
      `"${value.replace(/"/g, '""')}"`;

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `luma-keuangan-${localDateString()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const categoryOptions = [
    ...new Set([
      ...(formType === "income"
        ? incomeCategories
        : expenseCategories),
      ...(category ? [category] : []),
    ]),
  ];

  return (
    <main className="min-h-screen bg-[#FAFAF8] text-black">
      <div className="mx-auto w-full max-w-[1600px] px-5 py-7 sm:px-8 lg:px-10 lg:py-9">
        {/* Header */}
        <header className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-[#9A7A3C]">
              <span className="h-px w-7 bg-[#D6B36A]" />
              Financial Overview
            </div>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Keuangan
            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-black/50">
              Pantau pemasukan, pengeluaran, dan hasil keuangan
              bisnis Anda.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={exportCsv}
              disabled={loading || filteredTransactions.length === 0}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-sm font-medium transition hover:border-[#D6B36A] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <FiDownload size={16} />
              Ekspor CSV
            </button>

            <button
              type="button"
              onClick={() => openForm()}
              disabled={loading || Boolean(databaseError)}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#D6B36A] px-5 text-sm font-semibold transition hover:bg-[#C49A4A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FiPlus size={17} />
              Tambah Transaksi
            </button>
          </div>
        </header>

        {/* Status database */}
        {loading && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white p-4 text-sm text-black/55">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#D6B36A] border-t-transparent" />
            Mengambil data keuangan...
          </div>
        )}

        {databaseError && (
          <div
            role="alert"
            className="mb-5 rounded-xl border border-black/10 bg-white p-5"
          >
            <p className="text-sm font-semibold">
              Data keuangan belum dapat dimuat
            </p>
            <p className="mt-2 text-sm leading-6 text-black/55">
              {databaseError}
            </p>
            <p className="mt-2 text-xs leading-5 text-black/40">
              Periksa koneksi Firebase, status autentikasi, dan
              Firestore Security Rules.
            </p>
          </div>
        )}

        {/* Filter periode */}
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold">
              Ringkasan Keuangan
            </h2>
            <p className="mt-1 text-xs text-black/45">
              {formatDate(startDate)} – {formatDate(endDate)}
            </p>
          </div>

          <div className="inline-flex w-fit items-center gap-1 rounded-xl border border-black/[0.06] bg-white p-1">
            {periods.map((item) => (
              <button
                type="button"
                key={item.value}
                onClick={() => setPeriod(item.value)}
                className={`rounded-lg px-3.5 py-2 text-xs font-medium transition ${
                  period === item.value
                    ? "bg-black text-white"
                    : "text-black/50 hover:bg-[#F7F4ED] hover:text-black"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ringkasan */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SummaryCard
            title="Total Uang Masuk"
            amount={formatRupiah(summary.income)}
            description={`${summary.count} transaksi dalam periode aktif`}
            icon={<FiArrowDownLeft size={19} />}
            iconStyle="bg-[#F8F2E5] text-[#9A7A3C]"
          />

          <SummaryCard
            title="Total Uang Keluar"
            amount={formatRupiah(summary.expense)}
            description="Total pengeluaran dalam periode aktif"
            icon={<FiArrowUpRight size={19} />}
            iconStyle="bg-[#F1F1EF] text-black/70"
          />

          <SummaryCard
            title="Selisih Keuangan"
            amount={formatRupiah(summary.profit)}
            description="Pemasukan dikurangi pengeluaran"
            icon={<FiTrendingUp size={19} />}
            iconStyle="bg-[#D6B36A]/20 text-[#8E6927]"
            highlight
          />
        </div>

        {/* Grafik arus keuangan */}
        <section className="mt-6 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] sm:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-base font-semibold">
                Arus Keuangan
              </h2>
              <p className="mt-1 text-xs leading-5 text-black/45">
                Perbandingan pemasukan dan pengeluaran harian.
              </p>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-black/60">
              <Legend color="bg-[#D6B36A]" label="Pemasukan" />
              <Legend color="bg-black" label="Pengeluaran" />
            </div>
          </div>

          {loading ? (
            <div className="mt-7 h-56 animate-pulse rounded-xl bg-[#F7F7F4]" />
          ) : (
            <div className="mt-7 flex h-64 gap-3">
              <div className="flex flex-col justify-between pb-7 text-right text-[10px] text-black/35 sm:text-xs">
                {[1, 0.75, 0.5, 0.25, 0].map((fraction) => (
                  <span key={fraction}>
                    {formatCompact(chartMax * fraction)}
                  </span>
                ))}
              </div>

              <div className="relative min-w-0 flex-1">
                <div className="absolute inset-0 flex flex-col justify-between pb-7">
                  {[0, 1, 2, 3, 4].map((line) => (
                    <div
                      key={line}
                      className="border-t border-dashed border-black/[0.07]"
                    />
                  ))}
                </div>

                <div
                  className="relative z-10 grid h-full items-end gap-1 pb-7 sm:gap-2"
                  style={{
                    gridTemplateColumns: `repeat(${chartData.length}, minmax(0, 1fr))`,
                  }}
                >
                  {chartData.map((item, index) => {
                    const incomeHeight =
                      (item.income / chartMax) * 100;
                    const expenseHeight =
                      (item.expense / chartMax) * 100;

                    const labelEvery = Math.ceil(
                      chartData.length / 7
                    );

                    const showLabel =
                      chartData.length <= 7 ||
                      index % labelEvery === 0 ||
                      index === chartData.length - 1;

                    return (
                      <div
                        key={item.date}
                        className="flex h-full min-w-0 flex-col justify-end"
                        title={`${formatDate(item.date)} | Pemasukan: ${formatRupiah(item.income)} | Pengeluaran: ${formatRupiah(item.expense)}`}
                      >
                        <div className="flex h-full items-end justify-center gap-0.5 sm:gap-1">
                          <div
                            className="w-[42%] max-w-5 rounded-t-sm bg-[#D6B36A] transition-all"
                            style={{
                              height: `${incomeHeight}%`,
                              minHeight: item.income > 0 ? 3 : 0,
                            }}
                          />
                          <div
                            className="w-[42%] max-w-5 rounded-t-sm bg-black transition-all"
                            style={{
                              height: `${expenseHeight}%`,
                              minHeight: item.expense > 0 ? 3 : 0,
                            }}
                          />
                        </div>

                        <span className="mt-2 h-5 text-center text-[9px] text-black/40 sm:text-[10px]">
                          {showLabel
                            ? new Intl.DateTimeFormat("id-ID", {
                                day: "2-digit",
                                month:
                                  chartData.length <= 7
                                    ? "short"
                                    : undefined,
                              }).format(
                                new Date(`${item.date}T12:00:00`)
                              )
                            : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Riwayat transaksi */}
        <section className="mt-6 overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col justify-between gap-4 border-b border-black/[0.06] p-5 sm:flex-row sm:items-center sm:p-7">
            <div>
              <h2 className="text-base font-semibold">
                Riwayat Transaksi
              </h2>
              <p className="mt-1 text-xs text-black/45">
                Catatan keuangan bisnis Anda
              </p>
            </div>

            <button
              type="button"
              onClick={() => openForm()}
              disabled={loading || Boolean(databaseError)}
              className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-xl border border-[#D6B36A]/70 px-4 text-xs font-semibold transition hover:bg-[#FCFAF5] disabled:opacity-40 sm:self-auto"
            >
              <FiPlus size={15} />
              Transaksi Baru
            </button>
          </div>

          {/* Pencarian dan filter jenis */}
          <div className="flex flex-col gap-3 border-b border-black/[0.06] p-4 sm:flex-row sm:p-5">
            <div className="relative flex-1">
              <FiSearch
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/35"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari keterangan atau kategori..."
                className="h-11 w-full rounded-xl border border-black/[0.08] bg-[#FCFCFB] pl-10 pr-4 text-sm outline-none transition placeholder:text-black/35 focus:border-[#D6B36A]"
              />
            </div>

            <div className="relative">
              <FiChevronDown
                size={15}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-black/45"
              />
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                className="h-11 w-full appearance-none rounded-xl border border-black/[0.08] bg-white pl-3.5 pr-9 text-sm outline-none focus:border-[#D6B36A] sm:w-48"
              >
                <option value="all">Semua Transaksi</option>
                <option value="income">Pemasukan</option>
                <option value="expense">Pengeluaran</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] border-collapse text-left">
              <thead>
                <tr className="bg-[#FAFAF8] text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40">
                  <th className="px-6 py-4">Transaksi</th>
                  <th className="px-5 py-4">Kategori</th>
                  <th className="px-5 py-4">Tanggal</th>
                  <th className="px-5 py-4">Jenis</th>
                  <th className="px-6 py-4 text-right">Nominal</th>
                  <th className="px-5 py-4 text-center">Aksi</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-black/[0.05]">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-14 text-center text-sm text-black/45"
                    >
                      Memuat transaksi...
                    </td>
                  </tr>
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map((item) => (
                    <tr
                      key={item.id}
                      className="transition hover:bg-[#FCFBF8]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                              item.type === "income"
                                ? "bg-[#F8F2E5] text-[#9A7A3C]"
                                : "bg-[#F3F3F1] text-black/65"
                            }`}
                          >
                            {item.type === "income" ? (
                              <FiArrowDownLeft size={18} />
                            ) : (
                              <FiArrowUpRight size={18} />
                            )}
                          </div>

                          <div>
                            <p className="text-sm font-medium">
                              {item.description}
                            </p>
                            <p className="mt-1 text-[10px] text-black/35">
                              {item.id.slice(0, 12)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-black/60">
                        {item.category}
                      </td>

                      <td className="px-5 py-4 text-xs text-black/55">
                        <span className="inline-flex items-center gap-2">
                          <FiCalendar size={13} />
                          {formatDate(item.date)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                            item.type === "income"
                              ? "bg-[#F8F2E5] text-[#8E6927]"
                              : "bg-[#F2F2F0] text-black/65"
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {item.type === "income"
                            ? "Pemasukan"
                            : "Pengeluaran"}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
                          {item.type === "income" ? "+" : "−"}
                          {formatRupiah(item.amount)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(item)}
                            title="Edit transaksi"
                            aria-label={`Edit ${item.description}`}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/[0.08] bg-white text-black/55 transition hover:border-[#D6B36A] hover:bg-[#FCF8EF] hover:text-[#8E6927]"
                          >
                            <FiEdit2 size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            title="Hapus transaksi"
                            aria-label={`Hapus ${item.description}`}
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/[0.08] bg-white text-black/55 transition hover:border-[#D6B36A] hover:bg-[#F8F2E5] hover:text-[#8E6927]"
                          >
                            <FiTrash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F8F2E5] text-[#9A7A3C]">
                        <FiActivity size={20} />
                      </div>

                      <p className="mt-4 text-sm font-medium">
                        {transactions.length === 0
                          ? "Belum ada transaksi"
                          : "Transaksi tidak ditemukan"}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-black/45">
                        {transactions.length === 0
                          ? "Tambahkan pemasukan atau pengeluaran pertama bisnis Anda."
                          : "Coba ubah periode, kata kunci, atau filter."}
                      </p>

                      {transactions.length === 0 && (
                        <button
                          type="button"
                          onClick={() => openForm()}
                          className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-[#D6B36A] px-4 text-xs font-semibold transition hover:bg-[#C49A4A]"
                        >
                          <FiPlus size={15} />
                          Catat Transaksi Pertama
                        </button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col justify-between gap-2 border-t border-black/[0.06] px-5 py-4 text-xs text-black/45 sm:flex-row sm:items-center sm:px-6">
            <span>
              Menampilkan {filteredTransactions.length} transaksi
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FiClock size={13} />
              Periode {period} hari
            </span>
          </div>
        </section>

        {/* Modal tambah/edit transaksi */}
        {showForm && (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[3px]"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget &&
                !saving
              ) {
                setShowForm(false);
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="transaction-modal-title"
              className="my-auto w-full max-w-lg rounded-2xl border border-black/[0.06] bg-white p-6 shadow-2xl sm:p-8"
            >
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9A7A3C]">
                    Financial Records
                  </p>
                  <h2
                    id="transaction-modal-title"
                    className="mt-2 text-xl font-semibold"
                  >
                    {editTarget
                      ? "Edit Transaksi"
                      : "Tambah Transaksi"}
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-black/45">
                    {editTarget
                      ? "Perbarui informasi transaksi bisnis Anda."
                      : "Catat transaksi agar ringkasan keuangan diperbarui."}
                  </p>
                </div>

                <button
                  type="button"
                  aria-label="Tutup formulir"
                  disabled={saving}
                  onClick={() => setShowForm(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/[0.08] text-black/50 transition hover:bg-[#F7F7F5] disabled:opacity-40"
                >
                  <FiX size={17} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-xs font-medium text-black/65">
                    Jenis transaksi
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => changeType("income")}
                      className={`flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition ${
                        formType === "income"
                          ? "border-[#D6B36A] bg-[#FCF8EF] text-[#8E6927]"
                          : "border-black/[0.08] text-black/50"
                      }`}
                    >
                      <FiArrowDownLeft size={17} />
                      Pemasukan
                      {formType === "income" && (
                        <FiCheck size={14} />
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => changeType("expense")}
                      className={`flex h-12 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition ${
                        formType === "expense"
                          ? "border-black/30 bg-[#F4F4F1] text-black"
                          : "border-black/[0.08] text-black/50"
                      }`}
                    >
                      <FiArrowUpRight size={17} />
                      Pengeluaran
                      {formType === "expense" && (
                        <FiCheck size={14} />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="transaction-description"
                    className="mb-2 block text-xs font-medium text-black/65"
                  >
                    Keterangan
                  </label>
                  <input
                    id="transaction-description"
                    value={description}
                    onChange={(event) =>
                      setDescription(event.target.value)
                    }
                    placeholder="Contoh: Penjualan produk"
                    maxLength={120}
                    disabled={saving}
                    required
                    className="h-12 w-full rounded-xl border border-black/[0.1] px-4 text-sm outline-none transition placeholder:text-black/30 focus:border-[#D6B36A]"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="transaction-category"
                      className="mb-2 block text-xs font-medium text-black/65"
                    >
                      Kategori
                    </label>
                    <select
                      id="transaction-category"
                      value={category}
                      onChange={(event) =>
                        setCategory(event.target.value)
                      }
                      disabled={saving}
                      className="h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3 text-sm outline-none focus:border-[#D6B36A]"
                    >
                      {categoryOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="transaction-date"
                      className="mb-2 block text-xs font-medium text-black/65"
                    >
                      Tanggal
                    </label>
                    <input
                      id="transaction-date"
                      type="date"
                      value={date}
                      max={localDateString()}
                      onChange={(event) =>
                        setDate(event.target.value)
                      }
                      disabled={saving}
                      required
                      className="h-12 w-full rounded-xl border border-black/[0.1] bg-white px-3 text-sm outline-none focus:border-[#D6B36A]"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="transaction-amount"
                    className="mb-2 block text-xs font-medium text-black/65"
                  >
                    Nominal (Rupiah)
                  </label>
                  <div className="flex h-12 items-center overflow-hidden rounded-xl border border-black/[0.1] transition focus-within:border-[#D6B36A]">
                    <span className="border-r border-black/[0.08] px-4 text-sm font-medium text-black/50">
                      Rp
                    </span>
                    <input
                      id="transaction-amount"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={amount}
                      onChange={(event) =>
                        setAmount(event.target.value)
                      }
                      placeholder="0"
                      disabled={saving}
                      required
                      className="h-full min-w-0 flex-1 px-3 text-sm outline-none"
                    />
                  </div>
                </div>

                {formError && (
                  <p
                    role="alert"
                    className="rounded-xl border border-black/10 bg-[#FAFAF8] px-3 py-3 text-xs leading-5 text-black/70"
                  >
                    {formError}
                  </p>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setShowForm(false)}
                    className="h-12 flex-1 rounded-xl border border-black/[0.1] text-sm font-medium transition hover:bg-[#FAFAF8] disabled:opacity-40"
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#D6B36A] text-sm font-semibold transition hover:bg-[#C49A4A] disabled:cursor-wait disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <FiCheck size={17} />
                        {editTarget
                          ? "Simpan Perubahan"
                          : "Simpan Transaksi"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Premium Delete Confirmation Modal */}
        {deleteTarget && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
            onMouseDown={(event) => {
              if (
                event.target === event.currentTarget &&
                !deleting
              ) {
                setDeleteTarget(null);
                setDeleteError("");
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-modal-title"
              className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#D4AF70]/30 bg-white shadow-[0_25px_80px_rgba(0,0,0,0.18)]"
            >
              {/* Aksen emas di bagian atas */}
              <div className="h-1 w-full bg-gradient-to-r from-white via-[#C6A15B] to-white" />

              {/* Tombol tutup */}
              <button
                type="button"
                onClick={() => {
                  if (!deleting) {
                    setDeleteTarget(null);
                    setDeleteError("");
                  }
                }}
                disabled={deleting}
                aria-label="Tutup dialog"
                className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-black disabled:opacity-40"
              >
                <FiX size={18} />
              </button>

              <div className="px-7 pb-7 pt-9 sm:px-9">
                {/* Ikon premium */}
                <div className="mx-auto flex h-[76px] w-[76px] items-center justify-center rounded-[26px] border border-[#D4AF70]/40 bg-gradient-to-br from-[#FBF7EF] to-[#F2E6CD] shadow-[0_8px_24px_rgba(198,161,91,0.12)]">
                  <FiTrash2
                    className="text-[#94733A]"
                    size={30}
                  />
                </div>

                {/* Judul modal */}
                <div className="mt-6 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#A4864D]">
                    LUMA BUSINESS ADVISOR
                  </p>

                  <h2
                    id="delete-modal-title"
                    className="mt-3 text-2xl font-semibold tracking-tight text-[#171717]"
                  >
                    Hapus transaksi?
                  </h2>

                  <p className="mx-auto mt-3 max-w-[300px] text-sm leading-6 text-gray-500">
                    Transaksi ini akan dihapus secara permanen
                    dari catatan keuangan bisnis Anda. Tindakan
                    ini tidak dapat dibatalkan.
                  </p>
                </div>

                {/* Detail transaksi yang akan dihapus */}
                <div className="mt-6 rounded-2xl border border-[#E9E3D8] bg-[#FCFBF8] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-[#202020]">
                        {deleteTarget.description}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {deleteTarget.category} ·{" "}
                        {formatDate(deleteTarget.date)}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
                        Nominal
                      </p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-[#202020]">
                        {formatRupiah(deleteTarget.amount)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-[#E9E3D8] pt-3">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold ${
                        deleteTarget.type === "income"
                          ? "bg-[#F2E9D7] text-[#80632E]"
                          : "bg-[#EDEBE7] text-[#45413A]"
                      }`}
                    >
                      {deleteTarget.type === "income"
                        ? "Pendapatan"
                        : "Pengeluaran"}
                    </span>
                  </div>
                </div>

                {/* Pesan error apabila penghapusan gagal */}
                {deleteError && (
                  <p
                    role="alert"
                    className="mt-4 rounded-xl border border-[#D4AF70]/40 bg-[#FCF8EF] px-3 py-3 text-xs leading-5 text-[#6F5528]"
                  >
                    {deleteError}
                  </p>
                )}

                {/* Tombol aksi */}
                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => {
                      if (!deleting) {
                        setDeleteTarget(null);
                        setDeleteError("");
                      }
                    }}
                    disabled={deleting}
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-5 py-3.5 text-sm font-semibold text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Batal
                  </button>

                  <button
                    type="button"
                    onClick={confirmDelete}
                    disabled={deleting}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#171717] px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-black/10 transition hover:bg-[#303030] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deleting ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Menghapus...
                      </>
                    ) : (
                      <>
                        <FiTrash2 size={16} />
                        Ya, hapus transaksi
                      </>
                    )}
                  </button>
                </div>

                <p className="mt-5 text-center text-[10px] tracking-wide text-gray-400">
                  YOUR BUSINESS ADVISOR
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  title,
  amount,
  description,
  icon,
  iconStyle,
  highlight = false,
}: {
  title: string;
  amount: string;
  description: string;
  icon: ReactNode;
  iconStyle: string;
  highlight?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border p-5 shadow-[0_4px_24px_rgba(0,0,0,0.02)] transition hover:-translate-y-0.5 sm:p-6 ${
        highlight
          ? "border-[#D6B36A]/45 bg-[#FFFEFA]"
          : "border-black/[0.06] bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-black/55">
            {title}
          </p>
          <p className="mt-4 break-words text-2xl font-semibold tracking-tight tabular-nums sm:text-[28px]">
            {amount}
          </p>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconStyle}`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-5 border-t border-black/[0.06] pt-4">
        <p className="text-xs leading-5 text-black/45">
          {description}
        </p>
      </div>
    </article>
  );
}

function Legend({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </div>
  );
}
