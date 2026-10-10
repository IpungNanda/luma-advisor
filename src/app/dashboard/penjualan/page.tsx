

"use client";



import {

  type FormEvent,

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

  FiCalendar,

  FiCheckCircle,

  FiClock,

  FiDownload,

  FiEdit2,

  FiPackage,

  FiPlus,

  FiSearch,

  FiShoppingBag,

  FiTrendingUp,

  FiTrash2,

  FiX,

} from "react-icons/fi";



import { auth, db } from "@/lib/firebase";

import AuthGuard from "@/components/auth/AuthGuard";

import DashboardLayout from "@/components/dashboard/DashboardLayout";



type Sale = {

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



type SaleForm = {

  productName: string;

  quantity: string;

  unitPrice: string;

  date: string;

  customerName: string;

  paymentMethod: string;

};



const GOLD = "#D6B36A";



const PERIODS = [

  { label: "7 Hari", value: "7" },

  { label: "30 Hari", value: "30" },

  { label: "90 Hari", value: "90" },

];



const PAYMENT_METHODS = [

  "Tunai",

  "Transfer Bank",

  "QRIS",

  "E-Wallet",

  "Lainnya",

];



function localDateString(date = new Date()) {

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");



  return `${year}-${month}-${day}`;

}



function getDateAgo(days: number) {

  const date = new Date();

  date.setDate(date.getDate() - days);

  return localDateString(date);

}



function formatRupiah(value: number) {

  return new Intl.NumberFormat("id-ID", {

    style: "currency",

    currency: "IDR",

    maximumFractionDigits: 0,

  }).format(value);

}



function formatCompact(value: number) {

  if (value >= 1_000_000) {

    return `Rp${(value / 1_000_000)

      .toFixed(1)

      .replace(".", ",")} jt`;

  }



  if (value >= 1_000) {

    return `Rp${Math.round(value / 1_000)} rb`;

  }



  return formatRupiah(value);

}



function formatDate(value: string) {

  if (!value) return "-";



  return new Intl.DateTimeFormat("id-ID", {

    day: "2-digit",

    month: "short",

    year: "numeric",

  }).format(new Date(`${value}T12:00:00`));

}



function getErrorMessage(error: unknown) {

  if (

    typeof error === "object" &&

    error !== null &&

    "code" in error

  ) {

    const code = String(error.code);



    if (code === "permission-denied") {

      return "Akses database ditolak. Periksa Firestore Security Rules.";

    }



    if (code === "unauthenticated") {

      return "Sesi login berakhir. Silakan login kembali.";

    }



    if (code === "unavailable") {

      return "Database tidak tersedia. Periksa koneksi internet.";

    }

  }



  return error instanceof Error

    ? error.message

    : "Terjadi kesalahan. Silakan coba kembali.";

}



const EMPTY_FORM: SaleForm = {

  productName: "",

  quantity: "1",

  unitPrice: "",

  date: localDateString(),

  customerName: "",

  paymentMethod: "Tunai",

};



export default function PenjualanPage() {

  return (

    <AuthGuard>

      <DashboardLayout>

        <SalesDashboard />

      </DashboardLayout>

    </AuthGuard>

  );

}



function SalesDashboard() {

  const [sales, setSales] = useState<Sale[]>([]);

  const [loading, setLoading] = useState(true);

  const [databaseError, setDatabaseError] = useState("");



  const [period, setPeriod] = useState("7");

  const [search, setSearch] = useState("");

  const [startFilter, setStartFilter] = useState("");

  const [endFilter, setEndFilter] = useState("");

  const [paymentFilter, setPaymentFilter] = useState("all");



  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState<SaleForm>(EMPTY_FORM);

  const [editTarget, setEditTarget] = useState<Sale | null>(null);

  const [saving, setSaving] = useState(false);

  const [formError, setFormError] = useState("");



  const [deleteTarget, setDeleteTarget] = useState<Sale | null>(null);

  const [deleting, setDeleting] = useState(false);

  const [deleteError, setDeleteError] = useState("");



  // Mengambil data penjualan pengguna yang sedang login.

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



    const salesQuery = query(

      collection(db, "salesTransactions"),

      where("ownerUid", "==", user.uid)

    );



    const unsubscribe = onSnapshot(

      salesQuery,

      (snapshot) => {

        const rows: Sale[] = snapshot.docs.map((item) => {

          const data = item.data();



          return {

            id: item.id,

            ownerUid: String(data.ownerUid ?? ""),

            productName: String(data.productName ?? ""),

            quantity: Number(data.quantity ?? 0),

            unitPrice: Number(data.unitPrice ?? 0),

            totalAmount: Number(

              data.totalAmount ??

                Number(data.quantity ?? 0) *

                  Number(data.unitPrice ?? 0)

            ),

            date: String(data.date ?? ""),

            customerName: String(data.customerName ?? ""),

            paymentMethod: String(data.paymentMethod ?? "Tunai"),

            createdAt: data.createdAt,

          };

        });



        setSales(rows);

        setDatabaseError("");

        setLoading(false);

      },

      (error) => {

        console.error("Firestore sales error:", error);

        setDatabaseError(getErrorMessage(error));

        setLoading(false);

      }

    );



    return () => unsubscribe();

  }, []);



  const periodStart = getDateAgo(Number(period) - 1);

  const today = localDateString();



  const periodSales = useMemo(

    () =>

      sales.filter(

        (sale) =>

          sale.date >= periodStart && sale.date <= today

      ),

    [sales, periodStart, today]

  );



  const summary = useMemo(() => {

    const revenue = periodSales.reduce(

      (total, sale) => total + sale.totalAmount,

      0

    );



    const units = periodSales.reduce(

      (total, sale) => total + sale.quantity,

      0

    );



    return {

      revenue,

      transactions: periodSales.length,

      units,

      average:

        periodSales.length > 0

          ? Math.round(revenue / periodSales.length)

          : 0,

    };

  }, [periodSales]);



  const filteredSales = useMemo(() => {

    return [...sales]

      .filter((sale) => {

        const matchesSearch = [

          sale.productName,

          sale.customerName,

          sale.paymentMethod,

        ]

          .join(" ")

          .toLowerCase()

          .includes(search.toLowerCase());



        const matchesStart =

          !startFilter || sale.date >= startFilter;



        const matchesEnd =

          !endFilter || sale.date <= endFilter;



        const matchesPayment =

          paymentFilter === "all" ||

          sale.paymentMethod === paymentFilter;



        return (

          matchesSearch &&

          matchesStart &&

          matchesEnd &&

          matchesPayment

        );

      })

      .sort((a, b) => {

        const comparison = b.date.localeCompare(a.date);



        if (comparison !== 0) return comparison;



        return b.id.localeCompare(a.id);

      });

  }, [sales, search, startFilter, endFilter, paymentFilter]);



  // Ringkasan grafik omzet harian.

  const chartData = useMemo(() => {

    const result: { date: string; amount: number }[] = [];



    for (let i = Number(period) - 1; i >= 0; i--) {

      const date = getDateAgo(i);



      const amount = periodSales

        .filter((sale) => sale.date === date)

        .reduce((total, sale) => total + sale.totalAmount, 0);



      result.push({ date, amount });

    }



    return result;

  }, [period, periodSales]);



  const chartMax = Math.max(

    ...chartData.map((item) => item.amount),

    1

  );



  const chartStep = Math.max(1, Math.ceil(chartData.length / 7));



  // Produk terlaris berdasarkan jumlah unit.

  const topProducts = useMemo(() => {

    const grouped = new Map<

      string,

      { name: string; quantity: number; revenue: number }

    >();



    periodSales.forEach((sale) => {

      const name = sale.productName.trim() || "Produk tanpa nama";

      const current = grouped.get(name) ?? {

        name,

        quantity: 0,

        revenue: 0,

      };



      current.quantity += sale.quantity;

      current.revenue += sale.totalAmount;



      grouped.set(name, current);

    });



    return Array.from(grouped.values())

      .sort((a, b) => b.quantity - a.quantity)

      .slice(0, 5);

  }, [periodSales]);



  const maxProductQuantity = Math.max(

    ...topProducts.map((product) => product.quantity),

    1

  );



  function openCreateForm() {

    setEditTarget(null);

    setForm({

      ...EMPTY_FORM,

      date: localDateString(),

    });

    setFormError("");

    setShowForm(true);

  }



  function openEditForm(sale: Sale) {

    setEditTarget(sale);



    setForm({

      productName: sale.productName,

      quantity: String(sale.quantity),

      unitPrice: String(sale.unitPrice),

      date: sale.date,

      customerName: sale.customerName,

      paymentMethod: sale.paymentMethod,

    });



    setFormError("");

    setShowForm(true);

  }



  function updateForm<K extends keyof SaleForm>(

    key: K,

    value: SaleForm[K]

  ) {

    setForm((previous) => ({

      ...previous,

      [key]: value,

    }));

  }



  async function handleSubmit(

    event: FormEvent<HTMLFormElement>

  ) {

    event.preventDefault();

    setFormError("");



    const user = auth.currentUser;



    if (!user) {

      setFormError("Sesi login tidak ditemukan.");

      return;

    }



    const productName = form.productName.trim();

    const quantity = Number(form.quantity);

    const unitPrice = Number(form.unitPrice);



    if (!productName) {

      setFormError("Nama produk wajib diisi.");

      return;

    }



    if (!Number.isSafeInteger(quantity) || quantity <= 0) {

      setFormError("Jumlah produk harus berupa bilangan bulat positif.");

      return;

    }



    if (!Number.isSafeInteger(unitPrice) || unitPrice <= 0) {

      setFormError("Harga satuan harus berupa bilangan bulat positif.");

      return;

    }



    if (

      !form.date ||

      form.date > localDateString() ||

      Number.isNaN(new Date(`${form.date}T12:00:00`).getTime())

    ) {

      setFormError("Tanggal penjualan tidak valid.");

      return;

    }



    const totalAmount = quantity * unitPrice;



    if (!Number.isSafeInteger(totalAmount)) {

      setFormError("Total penjualan terlalu besar.");

      return;

    }



    const saleData = {

      productName,

      quantity,

      unitPrice,

      totalAmount,

      date: form.date,

      customerName: form.customerName.trim(),

      paymentMethod: form.paymentMethod,

    };



    setSaving(true);



    try {

      if (editTarget) {

        if (editTarget.ownerUid !== user.uid) {

          throw new Error(

            "Anda tidak memiliki akses untuk mengubah transaksi ini."

          );

        }



        await updateDoc(

          doc(db, "salesTransactions", editTarget.id),

          saleData

        );

      } else {

        await addDoc(collection(db, "salesTransactions"), {

          ownerUid: user.uid,

          ...saleData,

          createdAt: serverTimestamp(),

        });

      }



      setShowForm(false);

      setEditTarget(null);

      setForm({ ...EMPTY_FORM, date: localDateString() });

    } catch (error) {

      console.error("Gagal menyimpan penjualan:", error);

      setFormError(getErrorMessage(error));

    } finally {

      setSaving(false);

    }

  }



  function askDelete(sale: Sale) {

    setDeleteTarget(sale);

    setDeleteError("");

  }



  async function confirmDelete() {

    const user = auth.currentUser;



    if (!user || !deleteTarget || deleting) return;



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

        doc(db, "salesTransactions", deleteTarget.id)

      );



      setDeleteTarget(null);

    } catch (error) {

      console.error("Gagal menghapus penjualan:", error);

      setDeleteError(getErrorMessage(error));

    } finally {

      setDeleting(false);

    }

  }



  // Ekspor CSV tanpa ExcelJS atau library tambahan.

  function exportCsv() {

    if (filteredSales.length === 0) {

      window.alert("Tidak ada transaksi untuk diekspor.");

      return;

    }



    const headers = [

      "Tanggal",

      "Nama Produk",

      "Jumlah",

      "Harga Satuan",

      "Total Penjualan",

      "Nama Pelanggan",

      "Metode Pembayaran",

    ];



    const escapeCsv = (value: string | number) => {

      const text = String(value);

      return `"${text.replace(/"/g, '""')}"`;

    };



    const rows = filteredSales.map((sale) => [

      sale.date,

      sale.productName,

      sale.quantity,

      sale.unitPrice,

      sale.totalAmount,

      sale.customerName,

      sale.paymentMethod,

    ]);



    // BOM dan delimiter titik koma membantu Excel dengan locale Indonesia.

    const csv = "\uFEFF" +

      [headers, ...rows]

        .map((row) => row.map(escapeCsv).join(";"))

        .join("\r\n");



    const blob = new Blob([csv], {

      type: "text/csv;charset=utf-8;",

    });



    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");



    link.href = url;

    link.download = `luma-penjualan-${localDateString()}.csv`;



    document.body.appendChild(link);

    link.click();

    link.remove();



    URL.revokeObjectURL(url);

  }



  return (

    <main className="min-h-screen bg-[#FAFAF8] px-5 py-7 text-black sm:px-8 lg:px-10 lg:py-9">

      <div className="mx-auto w-full max-w-[1600px] space-y-7">

        {/* Header */}

        <header className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">

          <div>

            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-[#9A7A3C]">

              <FiActivity />

              LUMA BUSINESS ADVISOR

            </div>



            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">

              Dashboard Penjualan

            </h1>



            <p className="mt-2 max-w-xl text-sm leading-6 text-black/50">

              Pantau omzet, transaksi, dan produk yang paling diminati

              dalam satu tempat.

            </p>

          </div>



          <button

            type="button"

            onClick={openCreateForm}

            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D6B36A] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#C49A4A]"

          >

            <FiPlus />

            Tambah Penjualan

          </button>

        </header>



        {/* Error database */}

        {databaseError && (

          <div

            role="alert"

            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"

          >

            <FiX className="mt-0.5 shrink-0" />

            <div>

              <p className="font-semibold">

                Gagal memuat data penjualan

              </p>

              <p className="mt-1">{databaseError}</p>

            </div>

          </div>

        )}



        {/* Periode */}

        <section className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">

          <div>

            <p className="text-sm font-semibold">Ringkasan penjualan</p>

            <p className="mt-1 text-xs text-black/50">

              {formatDate(periodStart)} – {formatDate(today)}

            </p>

          </div>



          <div className="inline-flex w-fit rounded-xl bg-[#F7F7F4] p-1">

            {PERIODS.map((item) => (

              <button

                key={item.value}

                type="button"

                onClick={() => setPeriod(item.value)}

                className={`rounded-lg px-4 py-2 text-xs font-medium transition ${

                  period === item.value

                    ? "bg-white text-[#171717] shadow-sm"

                    : "text-black/50 hover:text-black"

                }`}

              >

                {item.label}

              </button>

            ))}

          </div>

        </section>



        {/* KPI */}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <StatCard

            title="Total Omzet"

            value={formatRupiah(summary.revenue)}

            description={`Dalam ${period} hari terakhir`}

            icon={<FiTrendingUp />}

            loading={loading}

          />



          <StatCard

            title="Total Transaksi"

            value={summary.transactions.toLocaleString("id-ID")}

            description="Jumlah transaksi tercatat"

            icon={<FiShoppingBag />}

            loading={loading}

          />



          <StatCard

            title="Produk Terjual"

            value={summary.units.toLocaleString("id-ID")}

            description="Total unit yang terjual"

            icon={<FiPackage />}

            loading={loading}

          />



          <StatCard

            title="Rata-rata Transaksi"

            value={formatRupiah(summary.average)}

            description="Omzet dibagi jumlah transaksi"

            icon={<FiActivity />}

            loading={loading}

          />

        </section>



        {/* Grafik dan produk terlaris */}

        <section className="grid grid-cols-1 gap-5 xl:grid-cols-3">

          <div className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6 xl:col-span-2">

            <div className="flex flex-wrap items-start justify-between gap-3">

              <div>

                <h2 className="text-base font-semibold">

                  Tren Omzet

                </h2>

                <p className="mt-1 text-sm text-black/50">

                  Pergerakan penjualan harian

                </p>

              </div>



              <div className="flex items-center gap-2 text-xs text-black/50">

                <span

                  className="h-2.5 w-2.5 rounded-full"

                  style={{ backgroundColor: GOLD }}

                />

                Omzet

              </div>

            </div>



            {loading ? (

              <div className="mt-8 flex h-64 items-center justify-center text-sm text-black/40">

                Memuat grafik...

              </div>

            ) : (

              <div className="mt-8">

                <div className="flex h-56 items-end gap-1.5 sm:gap-2">

                  {chartData.map((item, index) => {

                    const height =

                      item.amount > 0

                        ? Math.max(

                            5,

                            (item.amount / chartMax) * 100

                          )

                        : 0;



                    const showLabel =

                      index % chartStep === 0 ||

                      index === chartData.length - 1;



                    return (

                      <div

                        key={item.date}

                        className="group relative flex h-full min-w-0 flex-1 flex-col justify-end"

                        title={`${formatDate(item.date)}: ${formatRupiah(item.amount)}`}

                      >

                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#171717] px-3 py-2 text-xs text-white shadow-lg group-hover:block">

                          <p>{formatDate(item.date)}</p>

                          <p className="mt-1 font-semibold">

                            {formatRupiah(item.amount)}

                          </p>

                        </div>



                        <div

                          className="w-full rounded-t-md transition-all duration-300 group-hover:opacity-75"

                          style={{

                            height: `${height}%`,

                            minHeight: item.amount > 0 ? "4px" : "0",

                            backgroundColor: GOLD,

                          }}

                        />

                      </div>

                    );

                  })}

                </div>



                <div className="mt-3 flex gap-1.5 border-t border-black/[0.06] pt-3 sm:gap-2">

                  {chartData.map((item, index) => (

                    <div

                      key={item.date}

                      className="min-w-0 flex-1 text-center text-[9px] text-black/40 sm:text-[10px]"

                    >

                      {index % chartStep === 0 ||

                      index === chartData.length - 1

                        ? new Date(

                            `${item.date}T12:00:00`

                          ).getDate()

                        : ""}

                    </div>

                  ))}

                </div>



                <div className="mt-5 flex items-center justify-between rounded-xl bg-[#F7F4ED] p-4">

                  <div>

                    <p className="text-xs text-black/50">

                      Total omzet periode ini

                    </p>

                    <p className="mt-1 text-lg font-semibold">

                      {formatRupiah(summary.revenue)}

                    </p>

                  </div>

                  <div className="rounded-lg bg-white p-3 text-[#9A7A3C]">

                    <FiTrendingUp size={20} />

                  </div>

                </div>

              </div>

            )}

          </div>



          <div className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">

            <div className="flex items-start justify-between gap-3">

              <div>

                <h2 className="text-base font-semibold">

                  Produk Terlaris

                </h2>

                <p className="mt-1 text-sm text-black/50">

                  Berdasarkan jumlah unit

                </p>

              </div>

              <span className="rounded-lg bg-[#F7F4ED] p-2 text-[#9A7A3C]">

                <FiPackage size={18} />

              </span>

            </div>



            {loading ? (

              <p className="py-12 text-center text-sm text-black/40">

                Memuat produk...

              </p>

            ) : topProducts.length === 0 ? (

              <div className="py-12 text-center">

                <FiPackage className="mx-auto text-3xl text-black/25" />

                <p className="mt-3 text-sm font-medium text-black/60">

                  Belum ada penjualan

                </p>

                <p className="mt-1 text-xs text-black/40">

                  Data produk terlaris akan muncul di sini.

                </p>

              </div>

            ) : (

              <div className="mt-6 space-y-5">

                {topProducts.map((product, index) => (

                  <div key={product.name}>

                    <div className="mb-2 flex items-start justify-between gap-3">

                      <div className="flex min-w-0 items-center gap-3">

                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F6F3EC] text-sm font-semibold text-[#92753F]">

                          {index + 1}

                        </div>



                        <div className="min-w-0">

                          <p className="truncate text-sm font-medium">

                            {product.name}

                          </p>

                          <p className="mt-1 text-xs text-black/40">

                            {product.quantity} unit

                          </p>

                        </div>

                      </div>



                      <p className="shrink-0 text-xs font-semibold">

                        {formatCompact(product.revenue)}

                      </p>

                    </div>



                    <div className="h-1.5 overflow-hidden rounded-full bg-[#F7F7F4]">

                      <div

                        className="h-full rounded-full transition-all"

                        style={{

                          width: `${(product.quantity / maxProductQuantity) * 100}%`,

                          backgroundColor: GOLD,

                        }}

                      />

                    </div>

                  </div>

                ))}

              </div>

            )}



            <div className="mt-7 rounded-xl border border-black/[0.06] p-4">

              <div className="flex items-center gap-2 text-[#9A7A3C]">

                <FiActivity />

                <p className="text-xs font-semibold">

                  Insight Penjualan

                </p>

              </div>



              <p className="mt-2 text-sm leading-6 text-black/60">

                {topProducts.length > 0

                  ? `${topProducts[0].name} menjadi produk dengan unit terjual terbanyak pada periode ini.`

                  : "Tambahkan transaksi penjualan untuk mulai melihat produk yang paling diminati."}

              </p>

            </div>

          </div>

        </section>



        {/* Daftar transaksi */}

        <section className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white">

          <div className="flex flex-col gap-4 border-b border-black/[0.06] p-5 sm:p-6">

            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

              <div>

                <h2 className="text-base font-semibold">

                  Riwayat Penjualan

                </h2>

                <p className="mt-1 text-sm text-black/50">

                  Kelola dan periksa seluruh transaksi penjualan.

                </p>

              </div>



              <button

                type="button"

                onClick={exportCsv}

                className="inline-flex items-center justify-center gap-2 rounded-xl border border-black/[0.06] px-4 py-2.5 text-sm font-medium transition hover:bg-gray-50"

              >

                <FiDownload />

                Ekspor CSV

              </button>

            </div>



            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

              <div className="relative sm:col-span-2 xl:col-span-1">

                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />

                <input

                  value={search}

                  onChange={(event) => setSearch(event.target.value)}

                  placeholder="Cari produk atau pelanggan..."

                  className="w-full rounded-xl border border-black/[0.06] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#B89552]"

                />

              </div>



              <div className="relative">

                <FiCalendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />

                <input

                  type="date"

                  value={startFilter}

                  max={endFilter || today}

                  onChange={(event) =>

                    setStartFilter(event.target.value)

                  }

                  aria-label="Tanggal awal filter"

                  className="w-full rounded-xl border border-black/[0.06] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#B89552]"

                />

              </div>



              <div className="relative">

                <FiCalendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-black/40" />

                <input

                  type="date"

                  value={endFilter}

                  min={startFilter || undefined}

                  max={today}

                  onChange={(event) =>

                    setEndFilter(event.target.value)

                  }

                  aria-label="Tanggal akhir filter"

                  className="w-full rounded-xl border border-black/[0.06] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#B89552]"

                />

              </div>



              <select

                value={paymentFilter}

                onChange={(event) =>

                  setPaymentFilter(event.target.value)

                }

                aria-label="Filter metode pembayaran"

                className="w-full rounded-xl border border-black/[0.06] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#B89552]"

              >

                <option value="all">Semua pembayaran</option>

                {PAYMENT_METHODS.map((method) => (

                  <option key={method} value={method}>

                    {method}

                  </option>

                ))}

              </select>

            </div>



            {(search ||

              startFilter ||

              endFilter ||

              paymentFilter !== "all") && (

              <button

                type="button"

                onClick={() => {

                  setSearch("");

                  setStartFilter("");

                  setEndFilter("");

                  setPaymentFilter("all");

                }}

                className="w-fit text-xs font-medium text-[#92753F] hover:underline"

              >

                Reset filter

              </button>

            )}

          </div>



          <div className="overflow-x-auto">

            <table className="w-full min-w-[850px] text-left">

              <thead className="bg-[#FAFAF9]">

                <tr className="text-xs font-medium uppercase tracking-wider text-black/50">

                  <th className="px-5 py-4">Produk</th>

                  <th className="px-5 py-4">Tanggal</th>

                  <th className="px-5 py-4">Jumlah</th>

                  <th className="px-5 py-4">Harga Satuan</th>

                  <th className="px-5 py-4">Total</th>

                  <th className="px-5 py-4">Pembayaran</th>

                  <th className="px-5 py-4 text-right">Aksi</th>

                </tr>

              </thead>



              <tbody className="divide-y divide-gray-100">

                {loading ? (

                  <tr>

                    <td

                      colSpan={7}

                      className="px-5 py-14 text-center text-sm text-black/40"

                    >

                      Memuat data penjualan...

                    </td>

                  </tr>

                ) : filteredSales.length === 0 ? (

                  <tr>

                    <td colSpan={7} className="px-5 py-14">

                      <div className="text-center">

                        <FiShoppingBag className="mx-auto text-3xl text-black/25" />

                        <p className="mt-3 text-sm font-medium text-black/60">

                          Belum ada transaksi yang sesuai

                        </p>

                        <p className="mt-1 text-xs text-black/40">

                          Tambahkan penjualan atau ubah filter pencarian.

                        </p>

                      </div>

                    </td>

                  </tr>

                ) : (

                  filteredSales.map((sale) => (

                    <tr

                      key={sale.id}

                      className="transition hover:bg-gray-50/70"

                    >

                      <td className="px-5 py-4">

                        <p className="font-medium text-black">

                          {sale.productName}

                        </p>

                        <p className="mt-1 text-xs text-black/40">

                          {sale.customerName || "Pelanggan umum"}

                        </p>

                      </td>



                      <td className="whitespace-nowrap px-5 py-4 text-sm text-black/60">

                        {formatDate(sale.date)}

                      </td>



                      <td className="px-5 py-4 text-sm text-black/60">

                        {sale.quantity} unit

                      </td>



                      <td className="whitespace-nowrap px-5 py-4 text-sm text-black/60">

                        {formatRupiah(sale.unitPrice)}

                      </td>



                      <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-black">

                        {formatRupiah(sale.totalAmount)}

                      </td>



                      <td className="px-5 py-4">

                        <span className="inline-flex whitespace-nowrap rounded-lg bg-[#F7F7F4] px-2.5 py-1.5 text-xs text-black/60">

                          {sale.paymentMethod}

                        </span>

                      </td>



                      <td className="px-5 py-4">

                        <div className="flex justify-end gap-2">

                          <button

                            type="button"

                            onClick={() => openEditForm(sale)}

                            aria-label={`Edit penjualan ${sale.productName}`}

                            title="Edit transaksi"

                            className="rounded-lg border border-black/[0.06] p-2 text-black/50 transition hover:border-[#B89552] hover:text-[#92753F]"

                          >

                            <FiEdit2 size={15} />

                          </button>



                          <button

                            type="button"

                            onClick={() => askDelete(sale)}

                            aria-label={`Hapus penjualan ${sale.productName}`}

                            title="Hapus transaksi"

                            className="rounded-lg border border-black/[0.06] p-2 text-black/50 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"

                          >

                            <FiTrash2 size={15} />

                          </button>

                        </div>

                      </td>

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>



          <div className="flex flex-col justify-between gap-2 border-t border-black/[0.06] px-5 py-4 text-xs text-black/50 sm:flex-row sm:items-center">

            <span>

              Menampilkan {filteredSales.length} dari {sales.length} transaksi

            </span>

            <span>

              Total hasil filter:{" "}

              <strong className="text-gray-800">

                {formatRupiah(

                  filteredSales.reduce(

                    (total, sale) => total + sale.totalAmount,

                    0

                  )

                )}

              </strong>

            </span>

          </div>

        </section>

      </div>



      {/* Modal tambah / edit */}

      {showForm && (

        <div

          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"

          onMouseDown={(event) => {

            if (event.target === event.currentTarget && !saving) {

              setShowForm(false);

            }

          }}

        >

          <div

            role="dialog"

            aria-modal="true"

            aria-labelledby="sale-form-title"

            className="my-auto w-full max-w-lg rounded-2xl bg-white shadow-2xl"

          >

            <div className="flex items-start justify-between border-b border-black/[0.06] p-5 sm:p-6">

              <div>

                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9A7A3C]">

                  LUMA SALES

                </p>

                <h2

                  id="sale-form-title"

                  className="mt-2 text-xl font-semibold"

                >

                  {editTarget

                    ? "Edit Penjualan"

                    : "Tambah Penjualan"}

                </h2>

                <p className="mt-1 text-sm text-black/50">

                  Lengkapi informasi transaksi di bawah ini.

                </p>

              </div>



              <button

                type="button"

                onClick={() => setShowForm(false)}

                disabled={saving}

                aria-label="Tutup formulir"

                className="rounded-lg p-2 text-black/40 transition hover:bg-[#F7F7F4] hover:text-black/70"

              >

                <FiX size={20} />

              </button>

            </div>



            <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6">

              <div>

                <label

                  htmlFor="productName"

                  className="mb-2 block text-sm font-medium text-black/70"

                >

                  Nama produk <span className="text-red-500">*</span>

                </label>

                <input

                  id="productName"

                  required

                  maxLength={120}

                  value={form.productName}

                  onChange={(event) =>

                    updateForm("productName", event.target.value)

                  }

                  placeholder="Contoh: Roti Cokelat"

                  className="w-full rounded-xl border border-black/[0.06] px-4 py-3 text-sm outline-none transition focus:border-[#B89552] focus:ring-2 focus:ring-[#B89552]/10"

                />

              </div>



              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <div>

                  <label

                    htmlFor="quantity"

                    className="mb-2 block text-sm font-medium text-black/70"

                  >

                    Jumlah unit <span className="text-red-500">*</span>

                  </label>

                  <input

                    id="quantity"

                    type="number"

                    required

                    min="1"

                    step="1"

                    value={form.quantity}

                    onChange={(event) =>

                      updateForm("quantity", event.target.value)

                    }

                    className="w-full rounded-xl border border-black/[0.06] px-4 py-3 text-sm outline-none focus:border-[#B89552]"

                  />

                </div>



                <div>

                  <label

                    htmlFor="unitPrice"

                    className="mb-2 block text-sm font-medium text-black/70"

                  >

                    Harga satuan (Rp){" "}

                    <span className="text-red-500">*</span>

                  </label>

                  <input

                    id="unitPrice"

                    type="number"

                    required

                    min="1"

                    step="1"

                    value={form.unitPrice}

                    onChange={(event) =>

                      updateForm("unitPrice", event.target.value)

                    }

                    placeholder="15000"

                    className="w-full rounded-xl border border-black/[0.06] px-4 py-3 text-sm outline-none focus:border-[#B89552]"

                  />

                </div>

              </div>



              <div className="rounded-xl bg-[#F7F4ED] p-4">

                <p className="text-xs text-black/50">Total penjualan</p>

                <p className="mt-1 text-xl font-semibold">

                  {formatRupiah(

                    Math.max(0, Number(form.quantity) || 0) *

                      Math.max(0, Number(form.unitPrice) || 0)

                  )}

                </p>

                <p className="mt-1 text-xs text-black/40">

                  Jumlah unit × harga satuan

                </p>

              </div>



              <div>

                <label

                  htmlFor="saleDate"

                  className="mb-2 block text-sm font-medium text-black/70"

                >

                  Tanggal penjualan{" "}

                  <span className="text-red-500">*</span>

                </label>

                <input

                  id="saleDate"

                  type="date"

                  required

                  max={localDateString()}

                  value={form.date}

                  onChange={(event) =>

                    updateForm("date", event.target.value)

                  }

                  className="w-full rounded-xl border border-black/[0.06] px-4 py-3 text-sm outline-none focus:border-[#B89552]"

                />

              </div>



              <div>

                <label

                  htmlFor="customerName"

                  className="mb-2 block text-sm font-medium text-black/70"

                >

                  Nama pelanggan

                </label>

                <input

                  id="customerName"

                  maxLength={120}

                  value={form.customerName}

                  onChange={(event) =>

                    updateForm("customerName", event.target.value)

                  }

                  placeholder="Opsional"

                  className="w-full rounded-xl border border-black/[0.06] px-4 py-3 text-sm outline-none focus:border-[#B89552]"

                />

              </div>



              <div>

                <label

                  htmlFor="paymentMethod"

                  className="mb-2 block text-sm font-medium text-black/70"

                >

                  Metode pembayaran

                </label>

                <select

                  id="paymentMethod"

                  value={form.paymentMethod}

                  onChange={(event) =>

                    updateForm("paymentMethod", event.target.value)

                  }

                  className="w-full rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-sm outline-none focus:border-[#B89552]"

                >

                  {PAYMENT_METHODS.map((method) => (

                    <option key={method} value={method}>

                      {method}

                    </option>

                  ))}

                </select>

              </div>



              {formError && (

                <div

                  role="alert"

                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"

                >

                  {formError}

                </div>

              )}



              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">

                <button

                  type="button"

                  disabled={saving}

                  onClick={() => setShowForm(false)}

                  className="rounded-xl border border-black/[0.06] px-5 py-3 text-sm font-medium transition hover:bg-gray-50 disabled:opacity-50"

                >

                  Batal

                </button>



                <button

                  type="submit"

                  disabled={saving}

                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D6B36A] px-5 py-3 text-sm font-semibold text-black transition hover:bg-[#C49A4A] disabled:cursor-not-allowed disabled:opacity-60"

                >

                  {saving ? (

                    <>

                      <FiClock className="animate-spin" />

                      Menyimpan...

                    </>

                  ) : (

                    <>

                      <FiCheckCircle />

                      {editTarget

                        ? "Simpan Perubahan"

                        : "Simpan Penjualan"}

                    </>

                  )}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}



      {/* Modal konfirmasi hapus */}

      {deleteTarget && (

        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">

          <div

            role="alertdialog"

            aria-modal="true"

            aria-labelledby="delete-sale-title"

            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"

          >

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">

              <FiTrash2 size={22} />

            </div>



            <h2

              id="delete-sale-title"

              className="mt-5 text-lg font-semibold"

            >

              Hapus transaksi penjualan?

            </h2>



            <p className="mt-2 text-sm leading-6 text-black/50">

              Transaksi{" "}

              <strong className="text-gray-800">

                {deleteTarget.productName}

              </strong>{" "}

              dengan total{" "}

              <strong className="text-gray-800">

                {formatRupiah(deleteTarget.totalAmount)}

              </strong>{" "}

              akan dihapus secara permanen.

            </p>



            {deleteError && (

              <div

                role="alert"

                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"

              >

                {deleteError}

              </div>

            )}



            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

              <button

                type="button"

                disabled={deleting}

                onClick={() => setDeleteTarget(null)}

                className="rounded-xl border border-black/[0.06] px-4 py-3 text-sm font-medium transition hover:bg-gray-50 disabled:opacity-50"

              >

                Batal

              </button>



              <button

                type="button"

                disabled={deleting}

                onClick={confirmDelete}

                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"

              >

                <FiTrash2 />

                {deleting ? "Menghapus..." : "Ya, Hapus"}

              </button>

            </div>

          </div>

        </div>

      )}

    </main>

  );

}



function StatCard({

  title,

  value,

  description,

  icon,

  loading,

}: {

  title: string;

  value: string;

  description: string;

  icon: React.ReactNode;

  loading: boolean;

}) {

  return (

    <div className="rounded-2xl border border-black/[0.06] bg-white p-5 transition hover:border-[#D7C8A8]">

      <div className="flex items-start justify-between gap-3">

        <div className="min-w-0">

          <p className="text-sm text-black/50">{title}</p>



          {loading ? (

            <div className="mt-3 h-7 w-32 animate-pulse rounded-md bg-[#F7F7F4]" />

          ) : (

            <p className="mt-3 break-words text-xl font-semibold tracking-tight sm:text-2xl">

              {value}

            </p>

          )}



          <p className="mt-2 text-xs leading-5 text-black/40">

            {description}

          </p>

        </div>



        <div className="shrink-0 rounded-xl bg-[#F7F4ED] p-3 text-[#9A7A3C]">

          {icon}

        </div>

      </div>

    </div>

  );

}
