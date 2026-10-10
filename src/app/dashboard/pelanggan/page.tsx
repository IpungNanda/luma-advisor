"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
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
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  FiActivity,
  FiDownload,
  FiEdit2,
  FiMail,
  FiMapPin,
  FiMoreHorizontal,
  FiPhone,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiUsers,
  FiX,
  FiShoppingBag,
  FiArrowUpRight,
} from "react-icons/fi";
import { auth, db } from "@/lib/firebase";
import AuthGuard from "@/components/auth/AuthGuard";
import DashboardLayout from "@/components/dashboard/DashboardLayout";

type Customer = {
  id: string;
  ownerUid: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  createdAt?: { toDate: () => Date; toMillis: () => number } | null;
  updatedAt?: unknown;
};

type Sale = {
  id: string;
  ownerUid: string;
  customerName: string;
  totalAmount: number;
  date: string;
};

type CustomerForm = {
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};

const GOLD = "#B89552";
const EMPTY_FORM: CustomerForm = {
  name: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
};

const inputClass =
  "w-full rounded-xl border border-black/[0.10] bg-white px-4 py-3 text-sm text-[#171717] outline-none transition placeholder:text-black/30 focus:border-[#D6B36A] focus:ring-4 focus:ring-[#D6B36A]/15";

function rupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function dateLabel(value?: Customer["createdAt"]) {
  if (!value) return "—";
  try {
    return value.toDate().toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase();
}

function normalizedName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

function getErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = String(error.code);
    if (code === "permission-denied") return "Akses database ditolak. Periksa Firestore Security Rules.";
    if (code === "unauthenticated") return "Sesi login berakhir. Silakan login kembali.";
    if (code === "unavailable") return "Database tidak tersedia. Periksa koneksi internet.";
  }
  return error instanceof Error ? error.message : "Terjadi kesalahan. Silakan coba kembali.";
}

function csvCell(value: string | number) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export default function PelangganPage() {
  return (
    <AuthGuard>
      <DashboardLayout>
        <CustomersDashboard />
      </DashboardLayout>
    </AuthGuard>
  );
}

function CustomersDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "name">("newest");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CustomerForm>(EMPTY_FORM);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [detailTarget, setDetailTarget] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setCustomers([]);
      setSales([]);
      setLoading(false);
      setPageError("Sesi login tidak ditemukan. Silakan login kembali.");
      return;
    }

    setLoading(true);
    setPageError("");
    let customersReady = false;
    let salesReady = false;
    let customerFailed = false;
    let salesFailed = false;
    const finish = () => {
      if ((customersReady || customerFailed) && (salesReady || salesFailed)) setLoading(false);
    };

    const customersQuery = query(collection(db, "customers"), where("ownerUid", "==", user.uid));
    const salesQuery = query(collection(db, "salesTransactions"), where("ownerUid", "==", user.uid));

    const stopCustomers = onSnapshot(
      customersQuery,
      (snapshot) => {
        setCustomers(snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            ownerUid: String(data.ownerUid ?? ""),
            name: String(data.name ?? ""),
            phone: String(data.phone ?? ""),
            email: String(data.email ?? ""),
            address: String(data.address ?? ""),
            notes: String(data.notes ?? ""),
            createdAt: (data.createdAt ?? null) as Customer["createdAt"],
            updatedAt: data.updatedAt,
          };
        }));
        customersReady = true;
        finish();
      },
      (error) => {
        console.error("Gagal memuat pelanggan:", error);
        customerFailed = true;
        setPageError(getErrorMessage(error));
        finish();
      }
    );

    const stopSales = onSnapshot(
      salesQuery,
      (snapshot) => {
        setSales(snapshot.docs.map((item) => {
          const data = item.data();
          return {
            id: item.id,
            ownerUid: String(data.ownerUid ?? ""),
            customerName: String(data.customerName ?? ""),
            totalAmount: Number(data.totalAmount ?? 0),
            date: String(data.date ?? ""),
          };
        }));
        salesReady = true;
        finish();
      },
      (error) => {
        console.error("Gagal memuat transaksi pelanggan:", error);
        salesFailed = true;
        setPageError((current) => current || getErrorMessage(error));
        finish();
      }
    );

    return () => {
      stopCustomers();
      stopSales();
    };
  }, [user, authReady]);

  const salesMap = useMemo(() => {
    const map = new Map<string, { count: number; total: number; lastDate: string }>();
    for (const sale of sales) {
      const key = normalizedName(sale.customerName);
      if (!key || key === "-") continue;
      const current = map.get(key) ?? { count: 0, total: 0, lastDate: "" };
      current.count += 1;
      current.total += Number(sale.totalAmount) || 0;
      if (sale.date > current.lastDate) current.lastDate = sale.date;
      map.set(key, current);
    }
    return map;
  }, [sales]);

  const stats = useMemo(() => {
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = customers.filter((customer) => {
      try {
        return Boolean(customer.createdAt && customer.createdAt.toDate() >= startMonth);
      } catch {
        return false;
      }
    }).length;
    const active = customers.filter((customer) => salesMap.has(normalizedName(customer.name))).length;
    const linkedRevenue = customers.reduce((total, customer) => total + (salesMap.get(normalizedName(customer.name))?.total ?? 0), 0);
    return { total: customers.length, newThisMonth, active, linkedRevenue };
  }, [customers, salesMap]);

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("id-ID");
    return customers
      .filter((customer) => {
        const matchesSearch = !term || [customer.name, customer.phone, customer.email, customer.address]
          .some((value) => value.toLocaleLowerCase("id-ID").includes(term));
        const hasSales = salesMap.has(normalizedName(customer.name));
        const matchesFilter = filter === "all" || (filter === "active" && hasSales) || (filter === "inactive" && !hasSales);
        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name, "id");
        const aTime = a.createdAt?.toMillis() ?? 0;
        const bTime = b.createdAt?.toMillis() ?? 0;
        return sort === "oldest" ? aTime - bTime : bTime - aTime;
      });
  }, [customers, search, filter, sort, salesMap]);

  function startCreate() {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setPageError("");
    setShowForm(true);
  }

  function startEdit(customer: Customer) {
    setEditTarget(customer);
    setForm({
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      notes: customer.notes,
    });
    setFormError("");
    setShowForm(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || saving) return;
    setFormError("");
    setNotice("");

    const payload = {
      ownerUid: user.uid,
      name: form.name.trim().replace(/\s+/g, " "),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
    };

    if (!payload.name) {
      setFormError("Nama pelanggan wajib diisi.");
      return;
    }
    if (payload.name.length > 120 || payload.phone.length > 30 || payload.email.length > 120 || payload.address.length > 250 || payload.notes.length > 500) {
      setFormError("Ada kolom yang melebihi batas panjang karakter.");
      return;
    }
    const duplicate = customers.some((customer) =>
      customer.id !== editTarget?.id &&
      (normalizedName(customer.name) === normalizedName(payload.name) ||
        (payload.phone.replace(/\D/g, "").length > 0 &&
          customer.phone.replace(/\D/g, "") === payload.phone.replace(/\D/g, "")))
    );
    if (duplicate) {
      setFormError("Nama atau nomor telepon tersebut sudah terdaftar.");
      return;
    }

    setSaving(true);
    try {
      if (editTarget) {
        if (editTarget.ownerUid !== user.uid) throw new Error("Akses untuk mengubah pelanggan ini ditolak.");
        await updateDoc(doc(db, "customers", editTarget.id), {
          ...payload,
          updatedAt: serverTimestamp(),
        });
        setNotice("Data pelanggan berhasil diperbarui.");
      } else {
        await addDoc(collection(db, "customers"), {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setNotice("Pelanggan berhasil ditambahkan.");
      }
      setShowForm(false);
      setEditTarget(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      console.error("Gagal menyimpan pelanggan:", error);
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!user || !deleteTarget || deleting) return;
    if (deleteTarget.ownerUid !== user.uid) {
      setPageError("Kamu tidak memiliki akses untuk menghapus pelanggan ini.");
      return;
    }
    setDeleting(true);
    setPageError("");
    try {
      await deleteDoc(doc(db, "customers", deleteTarget.id));
      if (detailTarget?.id === deleteTarget.id) setDetailTarget(null);
      setDeleteTarget(null);
      setNotice("Data pelanggan berhasil dihapus. Riwayat transaksi tetap tersimpan.");
    } catch (error) {
      console.error("Gagal menghapus pelanggan:", error);
      setPageError(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  function exportCsv() {
    const headers = ["Nama", "Telepon", "Email", "Alamat", "Catatan", "Jumlah Transaksi", "Total Belanja"];
    const rows = filteredCustomers.map((customer) => {
      const history = salesMap.get(normalizedName(customer.name));
      return [customer.name, customer.phone, customer.email, customer.address, customer.notes, history?.count ?? 0, history?.total ?? 0];
    });
    const csv = "\uFEFF" + [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `luma-pelanggan-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (!authReady || loading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#FAFAF9]">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#E7DFD0] border-t-[#D6B36A]" />
          <p className="mt-4 text-sm text-black/45">Menyiapkan database pelanggan...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAFAF8] px-5 py-7 text-black sm:px-8 lg:px-10 lg:py-9">
      <div className="mx-auto w-full max-w-[1600px] space-y-7">
        <header className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-[#9A7A3C]">
              <span className="h-px w-7 bg-[#D6B36A]" /> LUMA BUSINESS ADVISOR
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Pelanggan<span className="text-[#9A7A3C]">.</span></h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-black/45">
              Bangun hubungan pelanggan yang lebih kuat melalui data kontak dan riwayat pembelian yang terorganisasi.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportCsv} disabled={!filteredCustomers.length} className="inline-flex items-center justify-center gap-2 h-11 rounded-xl border border-black/10 bg-white px-4 text-sm font-medium transition hover:border-[#D6B36A] disabled:cursor-not-allowed disabled:opacity-40">
              <FiDownload size={16} /> Ekspor CSV
            </button>
            <button type="button" onClick={startCreate} className="inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#D6B36A] px-5 text-sm font-semibold text-black transition hover:bg-[#C49A4A]">
              <FiPlus size={17} className="text-black" /> Tambah pelanggan
            </button>
          </div>
        </header>

        {pageError && <Alert tone="error" message={pageError} onClose={() => setPageError("")} />}
        {notice && <Alert tone="success" message={notice} onClose={() => setNotice("")} />}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric title="Total pelanggan" value={stats.total.toLocaleString("id-ID")} caption="Seluruh kontak terdaftar" icon={<FiUsers />} />
          <Metric title="Pelanggan baru" value={stats.newThisMonth.toLocaleString("id-ID")} caption="Terdaftar bulan ini" icon={<FiActivity />} />
          <Metric title="Pelanggan aktif" value={stats.active.toLocaleString("id-ID")} caption="Memiliki transaksi tercatat" icon={<FiShoppingBag />} />
          <div className="rounded-2xl border border-[#D6B36A]/60 bg-[#D6B36A]/15 p-5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-[#8E6927]">Penjualan terhubung</p>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D6B36A] text-sm font-semibold text-white">Rp</span>
            </div>
            <p className="mt-5 break-words text-2xl font-semibold tracking-tight">{rupiah(stats.linkedRevenue)}</p>
            <p className="mt-2 text-[11px] text-black/45">Cocok berdasarkan nama pelanggan</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.025)]">
          <div className="flex flex-col justify-between gap-4 border-b border-black/[0.07] p-5 sm:p-6 xl:flex-row xl:items-center">
            <div>
              <h2 className="text-base font-semibold">Database pelanggan</h2>
              <p className="mt-1 text-xs text-black/45">Kelola profil dan pantau aktivitas pembelian pelanggan.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:min-w-[650px]">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-black/35" size={16} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau kontak..." aria-label="Cari pelanggan" className={`${inputClass} py-[11px] pl-9`} />
              </div>
              <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filter pelanggan" className={`${inputClass} py-[11px]`}>
                <option value="all">Semua pelanggan</option>
                <option value="active">Pernah bertransaksi</option>
                <option value="inactive">Belum bertransaksi</option>
              </select>
              <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Urutkan pelanggan" className={`${inputClass} py-[11px]`}>
                <option value="newest">Terbaru ditambahkan</option>
                <option value="oldest">Terlama ditambahkan</option>
                <option value="name">Nama A–Z</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
            <p className="text-xs text-black/45">Menampilkan <span className="font-semibold text-black">{filteredCustomers.length}</span> dari {customers.length} pelanggan</p>
            <span className="inline-flex items-center gap-2 rounded-full border border-[#D6B36A]/40 bg-[#FAF8F2] px-3 py-1.5 text-[9px] font-semibold tracking-[0.16em] text-[#8E6927]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#D6B36A]" /> REALTIME
            </span>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D6B36A]/40 bg-[#FAF8F2] text-2xl text-[#A4864A]"><FiUsers /></span>
              <h3 className="mt-4 text-sm font-semibold">{customers.length === 0 ? "Belum ada pelanggan" : "Pelanggan tidak ditemukan"}</h3>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-6 text-black/45">{customers.length === 0 ? "Tambahkan pelanggan pertama untuk mulai membangun database bisnis." : "Ubah kata kunci atau filter untuk menemukan pelanggan."}</p>
              {customers.length === 0 && <button onClick={startCreate} className="mt-5 rounded-xl bg-[#171717] px-5 py-3 text-xs font-semibold text-white hover:bg-black"><span className="mr-2 text-black">+</span>Tambah pelanggan pertama</button>}
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[900px] text-left">
                  <thead className="border-y border-black/[0.06] bg-[#F7F4ED]">
                    <tr className="text-[10px] font-semibold uppercase tracking-[0.13em] text-black/45">
                      <th className="px-6 py-4">Pelanggan</th>
                      <th className="px-5 py-4">Kontak</th>
                      <th className="px-5 py-4">Transaksi</th>
                      <th className="px-5 py-4">Total belanja</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.06]">
                    {filteredCustomers.map((customer) => {
                      const history = salesMap.get(normalizedName(customer.name));
                      const active = Boolean(history?.count);
                      return (
                        <tr key={customer.id} className="transition hover:bg-[#FAF8F2]">
                          <td className="px-6 py-4">
                            <button type="button" onClick={() => setDetailTarget(customer)} className="flex items-center gap-3 text-left">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D6B36A]/60 bg-[#D6B36A]/15 text-xs font-bold text-[#8E6927]">{initials(customer.name)}</span>
                              <span><span className="block text-xs font-semibold">{customer.name}</span><span className="mt-1 block text-[10px] text-black/40">Terdaftar {dateLabel(customer.createdAt)}</span></span>
                            </button>
                          </td>
                          <td className="px-5 py-4"><p className="text-xs">{customer.phone || "Telepon —"}</p><p className="mt-1 max-w-[200px] truncate text-[10px] text-black/40">{customer.email || "Email belum tersedia"}</p></td>
                          <td className="px-5 py-4 text-xs">{history?.count ?? 0} transaksi</td>
                          <td className="whitespace-nowrap px-5 py-4 text-xs font-semibold">{rupiah(history?.total ?? 0)}</td>
                          <td className="px-5 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[10px] font-medium ${active ? "border-[#D6B36A]/60 bg-[#D6B36A]/15 text-[#8E6927]" : "border-black/[0.08] bg-white text-black/45"}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-[#D6B36A]" : "bg-black/20"}`} />{active ? "Pernah transaksi" : "Belum transaksi"}</span></td>
                          <td className="px-6 py-4"><div className="flex justify-end gap-1.5">
                            <button type="button" onClick={() => setDetailTarget(customer)} title="Detail" aria-label="Detail pelanggan" className="rounded-lg border border-black/[0.09] p-2 text-black/50 transition hover:border-[#D6B36A] hover:text-[#8E6927]"><FiMoreHorizontal size={15} /></button>
                            <button type="button" onClick={() => startEdit(customer)} title="Edit" aria-label="Edit pelanggan" className="rounded-lg border border-black/[0.09] p-2 text-black/50 transition hover:border-[#D6B36A] hover:text-[#8E6927]"><FiEdit2 size={15} /></button>
                            <button type="button" onClick={() => setDeleteTarget(customer)} title="Hapus" aria-label="Hapus pelanggan" className="rounded-lg border border-black/[0.09] p-2 text-black/45 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"><FiTrash2 size={15} /></button>
                          </div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 p-4 md:hidden">
                {filteredCustomers.map((customer) => {
                  const history = salesMap.get(normalizedName(customer.name));
                  return <article key={customer.id} className="rounded-xl border border-black/[0.08] p-4">
                    <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#D6B36A]/60 bg-[#D6B36A]/15 text-xs font-bold text-[#8E6927]">{initials(customer.name)}</span><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{customer.name}</p><p className="mt-1 break-words text-xs text-black/45">{customer.phone || "Nomor belum tersedia"}</p><p className="mt-1 break-words text-xs text-black/40">{customer.email || "Email belum tersedia"}</p></div></div>
                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#F7F4ED] p-3"><div><p className="text-[10px] text-black/45">Transaksi</p><p className="mt-1 text-sm font-semibold">{history?.count ?? 0}</p></div><div><p className="text-[10px] text-black/45">Total belanja</p><p className="mt-1 break-words text-xs font-semibold">{rupiah(history?.total ?? 0)}</p></div></div>
                    <div className="mt-3 flex gap-2"><button onClick={() => setDetailTarget(customer)} className="flex-1 rounded-lg border border-black/[0.10] px-3 py-2.5 text-xs font-semibold">Detail</button><button onClick={() => startEdit(customer)} className="flex-1 rounded-lg border border-black/[0.10] px-3 py-2.5 text-xs font-semibold">Edit</button><button onClick={() => setDeleteTarget(customer)} className="rounded-lg border border-black/[0.10] px-3 py-2.5 text-xs font-semibold text-black/55">Hapus</button></div>
                  </article>;
                })}
              </div>
            </>
          )}
          <div className="border-t border-black/[0.06] px-5 py-4 text-[10px] leading-5 text-black/40 sm:px-6">
            LUMA CUSTOMER MANAGEMENT · Riwayat transaksi dicocokkan berdasarkan nama pelanggan pada data penjualan.
          </div>
        </section>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setShowForm(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="customer-form-title" className="my-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-black/[0.08] bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-black/[0.07] px-6 py-5">
              <div><p className="text-[9px] font-bold tracking-[0.22em] text-[#A4864A]">LUMA / CUSTOMER DATABASE</p><h2 id="customer-form-title" className="mt-2 text-xl font-semibold">{editTarget ? "Edit pelanggan" : "Tambah pelanggan"}</h2><p className="mt-1 text-xs text-black/45">Lengkapi informasi pelanggan di bawah ini.</p></div>
              <button type="button" onClick={() => setShowForm(false)} disabled={saving} aria-label="Tutup formulir" className="rounded-lg p-2 text-black/40 hover:bg-black/5 disabled:opacity-40"><FiX size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="space-y-4 p-6">
              <Field label="Nama pelanggan *"><input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Budi Santoso" className={inputClass} /></Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nomor telepon"><input type="tel" maxLength={30} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="08xxxxxxxxxx" className={inputClass} /></Field>
                <Field label="Email"><input type="email" maxLength={120} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nama@email.com" className={inputClass} /></Field>
              </div>
              <Field label="Alamat"><textarea rows={2} maxLength={250} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Alamat pelanggan" className={inputClass} /></Field>
              <Field label="Catatan tambahan"><textarea rows={3} maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Preferensi atau catatan pelanggan" className={inputClass} /></Field>
              {formError && <Alert tone="error" message={formError} />}
              <div className="flex flex-col-reverse gap-3 border-t border-black/[0.07] pt-5 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setShowForm(false)} disabled={saving} className="rounded-xl border border-black/[0.12] px-5 py-3 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-50">Batal</button>
                <button type="submit" disabled={saving} className="h-11 rounded-xl bg-[#D6B36A] px-5 text-sm font-semibold text-black transition hover:bg-[#C49A4A] disabled:opacity-50">{saving ? "Menyimpan..." : editTarget ? "Simpan perubahan" : "Simpan pelanggan"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {detailTarget && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setDetailTarget(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="customer-detail-title" className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-2xl">
            <div className="bg-[#171717] px-6 py-6 text-white"><div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-full border border-[#D6B36A]/50 bg-[#D6B36A]/15 text-sm font-bold text-black">{initials(detailTarget.name)}</span><div><p className="text-[9px] font-bold tracking-[0.2em] text-black">CUSTOMER PROFILE</p><h2 id="customer-detail-title" className="mt-1 text-lg font-semibold">{detailTarget.name}</h2><p className="mt-1 text-[11px] text-white/50">Terdaftar {dateLabel(detailTarget.createdAt)}</p></div></div><button type="button" onClick={() => setDetailTarget(null)} aria-label="Tutup detail" className="rounded-lg p-2 text-white/60 hover:bg-white/10"><FiX size={19} /></button></div></div>
            <div className="space-y-5 p-6">
              {(() => { const history = salesMap.get(normalizedName(detailTarget.name)); return <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border border-black/[0.08] p-4"><p className="text-[10px] text-black/45">Jumlah transaksi</p><p className="mt-2 text-2xl font-semibold">{history?.count ?? 0}</p></div><div className="rounded-xl border border-[#D6B36A]/60 bg-[#D6B36A]/15 p-4"><p className="text-[10px] text-[#8E6927]">Total belanja</p><p className="mt-2 break-words text-lg font-semibold">{rupiah(history?.total ?? 0)}</p></div></div>; })()}
              <DetailRow icon={<FiPhone />} label="Nomor telepon" value={detailTarget.phone} />
              <DetailRow icon={<FiMail />} label="Email" value={detailTarget.email} />
              <DetailRow icon={<FiMapPin />} label="Alamat" value={detailTarget.address} />
              <div><p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">Catatan</p><p className="mt-1 whitespace-pre-wrap break-words text-sm">{detailTarget.notes || "Belum ada catatan."}</p></div>
              <div className="flex gap-3 border-t border-black/[0.07] pt-5"><button type="button" onClick={() => { const customer = detailTarget; setDetailTarget(null); startEdit(customer); }} className="flex-1 rounded-xl bg-[#171717] px-4 py-3 text-sm font-medium text-white hover:bg-black"><FiEdit2 className="mr-2 inline" />Edit pelanggan</button><button type="button" onClick={() => setDetailTarget(null)} className="rounded-xl border border-black/[0.12] px-4 py-3 text-sm font-medium">Tutup</button></div>
            </div>
          </section>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="delete-customer-title" className="w-full max-w-md rounded-2xl border border-black/[0.08] bg-white p-6 shadow-2xl">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#D6B36A]/15 text-[#8E6927]"><FiTrash2 size={19} /></span>
            <h2 id="delete-customer-title" className="mt-4 text-lg font-semibold">Hapus pelanggan?</h2>
            <p className="mt-2 text-sm leading-6 text-black/55">Data <strong className="text-black">{deleteTarget.name}</strong> akan dihapus dari database pelanggan. Riwayat penjualan tidak ikut dihapus.</p>
            <div className="mt-6 flex justify-end gap-3"><button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)} className="rounded-xl border border-black/[0.12] px-4 py-2.5 text-sm font-medium">Batal</button><button type="button" disabled={deleting} onClick={handleDelete} className="rounded-xl bg-[#171717] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{deleting ? "Menghapus..." : "Ya, hapus"}</button></div>
          </section>
        </div>
      )}
    </main>
  );
}

function Metric({ title, value, caption, icon }: { title: string; value: string; caption: string; icon: React.ReactNode }) {
  return <div className="rounded-2xl border border-black/[0.08] bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
    <div className="flex items-center justify-between"><p className="text-xs font-medium text-black/45">{title}</p><span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D6B36A]/40 bg-[#FAF8F2] text-lg text-[#A4864A]">{icon}</span></div>
    <p className="mt-5 text-3xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-[11px] text-black/40">{caption}</p>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold text-black">{label}</span>{children}</label>;
}

function Alert({ tone, message, onClose }: { tone: "error" | "success"; message: string; onClose?: () => void }) {
  const style = tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-[#D6B36A]/60 bg-[#FAF8F2] text-[#8E6927]";
  return <div role={tone === "error" ? "alert" : "status"} className={`flex items-start justify-between gap-3 rounded-xl border p-3 text-sm ${style}`}><span>{message}</span>{onClose && <button type="button" onClick={onClose} aria-label="Tutup pesan" className="shrink-0 font-semibold">×</button>}</div>;
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-start gap-3"><span className="mt-0.5 text-[#A4864A]">{icon}</span><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-wider text-black/40">{label}</p><p className="mt-1 break-words text-sm">{value || "—"}</p></div></div>;
}
