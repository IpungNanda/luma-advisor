

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { ChangeEvent, FormEvent } from "react";

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

  writeBatch,

} from "firebase/firestore";

import {

  FiActivity,

  FiAlertTriangle,

  FiArrowDownCircle,

  FiArrowUpCircle,

  FiDownload,

  FiEdit2,

  FiFilter,

  FiPackage,

  FiPlus,

  FiSearch,

  FiTrash2,

  FiUpload,

  FiX,

} from "react-icons/fi";

import { auth, db } from "@/lib/firebase";

import AuthGuard from "@/components/auth/AuthGuard";

import DashboardLayout from "@/components/dashboard/DashboardLayout";

type Product = {

  id: string;

  ownerUid: string;

  name: string;

  sku: string;

  category: string;

  costPrice: number;

  sellingPrice: number;

  stock: number;

  minimumStock: number;

  createdAt?: unknown;

};

type Movement = {

  id: string;

  ownerUid: string;

  productId: string;

  productName: string;

  type: "in" | "out";

  quantity: number;

  reason: string;

  date: string;

  createdAt?: unknown;

};

type ProductForm = {

  name: string;

  sku: string;

  category: string;

  costPrice: string;

  sellingPrice: string;

  stock: string;

  minimumStock: string;

};

const GOLD = "#D6B36A";

const EMPTY_FORM: ProductForm = {

  name: "",

  sku: "",

  category: "",

  costPrice: "",

  sellingPrice: "",

  stock: "0",

  minimumStock: "5",

};

const CATEGORIES = [

  "Makanan & Minuman",

  "Fashion",

  "Kecantikan",

  "Elektronik",

  "Perlengkapan",

  "Lainnya",

];

function todayString() {

  const date = new Date();

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;

}

function rupiah(value: number) {

  return new Intl.NumberFormat("id-ID", {

    style: "currency",

    currency: "IDR",

    maximumFractionDigits: 0,

  }).format(value);

}

function errorMessage(error: unknown) {

  if (

    typeof error === "object" &&

    error !== null &&

    "code" in error

  ) {

    const code = String(error.code);

    if (code === "permission-denied") {

      return "Akses ditolak. Periksa Firestore Security Rules.";

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

function stockStatus(product: Product) {

  if (product.stock <= 0) {

    return {

      label: "Stok habis",

      className: "bg-red-50 text-red-700",

    };

  }

  if (product.stock <= product.minimumStock) {

    return {

      label: "Stok menipis",

      className: "bg-amber-50 text-amber-700",

    };

  }

  return {

    label: "Tersedia",

    className: "bg-emerald-50 text-emerald-700",

  };

}

// Membaca CSV dengan dukungan tanda kutip dan koma di dalam teks.

function parseCsvLine(line: string): string[] {

  const result: string[] = [];

  let current = "";

  let quoted = false;

  for (let i = 0; i < line.length; i++) {

    const char = line[i];

    if (char === '"') {

      if (quoted && line[i + 1] === '"') {

        current += '"';

        i++;

      } else {

        quoted = !quoted;

      }

    } else if ((char === "," || char === ";") && !quoted) {

      result.push(current.trim());

      current = "";

    } else {

      current += char;

    }

  }

  result.push(current.trim());

  return result;

}

function csvCell(value: string | number) {

  return `"${String(value).replace(/"/g, '""')}"`;

}

export default function ProductsPage() {

  return (

    <AuthGuard>

      <DashboardLayout>

        <ProductsDashboard />

      </DashboardLayout>

    </AuthGuard>

  );

}

function ProductsDashboard() {

  const [products, setProducts] = useState<Product[]>([]);

  const [movements, setMovements] = useState<Movement[]>([]);

  const [loading, setLoading] = useState(true);

  const [pageError, setPageError] = useState("");

  const [actionMessage, setActionMessage] = useState("");

  const [search, setSearch] = useState("");

  const [categoryFilter, setCategoryFilter] = useState("all");

  const [stockFilter, setStockFilter] = useState("all");

  const [activeTab, setActiveTab] = useState<"products" | "history">(

    "products"

  );

  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);

  const [editTarget, setEditTarget] = useState<Product | null>(null);

  const [saving, setSaving] = useState(false);

  const [formError, setFormError] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const [deleting, setDeleting] = useState(false);

  const [stockTarget, setStockTarget] = useState<Product | null>(null);

  const [stockAction, setStockAction] = useState<"in" | "out">("in");

  const [stockQuantity, setStockQuantity] = useState("1");

  const [stockReason, setStockReason] = useState("");

  const [adjusting, setAdjusting] = useState(false);

  const [stockError, setStockError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importing, setImporting] = useState(false);

  useEffect(() => {

    const user = auth.currentUser;

    if (!user) {

      setLoading(false);

      setPageError("Sesi login tidak ditemukan. Silakan login kembali.");

      return;

    }

    setLoading(true);

    setPageError("");

    const productsQuery = query(

      collection(db, "products"),

      where("ownerUid", "==", user.uid)

    );

    const movementsQuery = query(

      collection(db, "stockMovements"),

      where("ownerUid", "==", user.uid)

    );

    const unsubscribeProducts = onSnapshot(

      productsQuery,

      (snapshot) => {

        const rows: Product[] = snapshot.docs.map((item) => {

          const data = item.data();

          return {

            id: item.id,

            ownerUid: String(data.ownerUid ?? ""),

            name: String(data.name ?? ""),

            sku: String(data.sku ?? ""),

            category: String(data.category ?? "Lainnya"),

            costPrice: Number(data.costPrice ?? 0),

            sellingPrice: Number(data.sellingPrice ?? 0),

            stock: Number(data.stock ?? 0),

            minimumStock: Number(data.minimumStock ?? 5),

            createdAt: data.createdAt,

          };

        });

        setProducts(rows);

        setLoading(false);

      },

      (error) => {

        console.error("Gagal memuat produk:", error);

        setPageError(errorMessage(error));

        setLoading(false);

      }

    );

    const unsubscribeMovements = onSnapshot(

      movementsQuery,

      (snapshot) => {

        const rows: Movement[] = snapshot.docs.map((item) => {

          const data = item.data();

          return {

            id: item.id,

            ownerUid: String(data.ownerUid ?? ""),

            productId: String(data.productId ?? ""),

            productName: String(data.productName ?? ""),

            type: data.type === "out" ? "out" : "in",

            quantity: Number(data.quantity ?? 0),

            reason: String(data.reason ?? ""),

            date: String(data.date ?? ""),

            createdAt: data.createdAt,

          };

        });

        rows.sort((a, b) => b.date.localeCompare(a.date));

        setMovements(rows);

      },

      (error) => {

        console.error("Gagal memuat riwayat stok:", error);

      }

    );

    return () => {

      unsubscribeProducts();

      unsubscribeMovements();

    };

  }, []);

  const summary = useMemo(() => {

    const totalUnits = products.reduce((sum, p) => sum + p.stock, 0);

    const inventoryValue = products.reduce(

      (sum, p) => sum + p.stock * p.costPrice,

      0

    );

    return {

      totalProducts: products.length,

      totalUnits,

      lowStock: products.filter(

        (p) => p.stock > 0 && p.stock <= p.minimumStock

      ).length,

      outOfStock: products.filter((p) => p.stock <= 0).length,

      inventoryValue,

    };

  }, [products]);

  const filteredProducts = useMemo(() => {

    return products

      .filter((product) => {

        const searchText = [

          product.name,

          product.sku,

          product.category,

        ]

          .join(" ")

          .toLowerCase();

        const matchesSearch = searchText.includes(search.toLowerCase());

        const matchesCategory =

          categoryFilter === "all" ||

          product.category === categoryFilter;

        const matchesStock =

          stockFilter === "all" ||

          (stockFilter === "available" &&

            product.stock > product.minimumStock) ||

          (stockFilter === "low" &&

            product.stock > 0 &&

            product.stock <= product.minimumStock) ||

          (stockFilter === "empty" && product.stock <= 0);

        return matchesSearch && matchesCategory && matchesStock;

      })

      .sort((a, b) => a.name.localeCompare(b.name));

  }, [products, search, categoryFilter, stockFilter]);

  function updateForm<K extends keyof ProductForm>(

    key: K,

    value: ProductForm[K]

  ) {

    setForm((previous) => ({ ...previous, [key]: value }));

  }

  function openCreateForm() {

    setEditTarget(null);

    setForm({ ...EMPTY_FORM });

    setFormError("");

    setShowForm(true);

  }

  function openEditForm(product: Product) {

    setEditTarget(product);

    setForm({

      name: product.name,

      sku: product.sku,

      category: product.category,

      costPrice: String(product.costPrice),

      sellingPrice: String(product.sellingPrice),

      stock: String(product.stock),

      minimumStock: String(product.minimumStock),

    });

    setFormError("");

    setShowForm(true);

  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    setFormError("");

    setActionMessage("");

    const user = auth.currentUser;

    if (!user) {

      setFormError("Sesi login tidak ditemukan.");

      return;

    }

    const name = form.name.trim();

    const sku = form.sku.trim();

    const category = form.category.trim() || "Lainnya";

    const costPrice = Number(form.costPrice);

    const sellingPrice = Number(form.sellingPrice);

    const stock = Number(form.stock);

    const minimumStock = Number(form.minimumStock);

    if (!name) {

      setFormError("Nama produk wajib diisi.");

      return;

    }

    if (

      !Number.isSafeInteger(costPrice) ||

      costPrice < 0 ||

      !Number.isSafeInteger(sellingPrice) ||

      sellingPrice < 0

    ) {

      setFormError("Harga harus berupa bilangan bulat dan tidak negatif.");

      return;

    }

    if (

      !Number.isSafeInteger(stock) ||

      stock < 0 ||

      !Number.isSafeInteger(minimumStock) ||

      minimumStock < 0

    ) {

      setFormError("Stok dan batas minimum harus bilangan bulat nonnegatif.");

      return;

    }

    if (editTarget && editTarget.ownerUid !== user.uid) {

      setFormError("Kamu tidak memiliki akses untuk mengubah produk ini.");

      return;

    }

    const duplicateSku = products.some(

      (product) =>

        product.sku &&

        sku &&

        product.sku.toLowerCase() === sku.toLowerCase() &&

        product.id !== editTarget?.id

    );

    if (duplicateSku) {

      setFormError("SKU tersebut sudah digunakan oleh produk lain.");

      return;

    }

    const productData = {

      ownerUid: user.uid,

      name,

      sku,

      category,

      costPrice,

      sellingPrice,

      stock,

      minimumStock,

    };

    setSaving(true);

    try {

      if (editTarget) {

        // Perubahan stok melalui form edit juga dicatat dalam riwayat.

        const batch = writeBatch(db);

        batch.update(doc(db, "products", editTarget.id), productData);

        if (stock !== editTarget.stock) {

          batch.set(doc(collection(db, "stockMovements")), {

            ownerUid: user.uid,

            productId: editTarget.id,

            productName: name,

            type: stock > editTarget.stock ? "in" : "out",

            quantity: Math.abs(stock - editTarget.stock),

            reason: "Penyesuaian stok melalui edit produk",

            date: todayString(),

            createdAt: serverTimestamp(),

          });

        }

        await batch.commit();

        setActionMessage("Produk berhasil diperbarui.");

      } else {

        const newProduct = await addDoc(collection(db, "products"), {

          ...productData,

          createdAt: serverTimestamp(),

        });

        if (stock > 0) {

          await addDoc(collection(db, "stockMovements"), {

            ownerUid: user.uid,

            productId: newProduct.id,

            productName: name,

            type: "in",

            quantity: stock,

            reason: "Stok awal produk",

            date: todayString(),

            createdAt: serverTimestamp(),

          });

        }

        setActionMessage("Produk berhasil ditambahkan.");

      }

      setShowForm(false);

      setEditTarget(null);

      setForm({ ...EMPTY_FORM });

    } catch (error) {

      console.error("Gagal menyimpan produk:", error);

      setFormError(errorMessage(error));

    } finally {

      setSaving(false);

    }

  }

  async function handleDelete() {

    const user = auth.currentUser;

    if (!user || !deleteTarget || deleting) return;

    if (deleteTarget.ownerUid !== user.uid) {

      setPageError("Kamu tidak memiliki akses untuk menghapus produk ini.");

      return;

    }

    setDeleting(true);

    setPageError("");

    try {

      await deleteDoc(doc(db, "products", deleteTarget.id));

      setDeleteTarget(null);

      setActionMessage("Produk berhasil dihapus.");

    } catch (error) {

      console.error("Gagal menghapus produk:", error);

      setPageError(errorMessage(error));

    } finally {

      setDeleting(false);

    }

  }

  function openStockForm(product: Product, type: "in" | "out") {

    setStockTarget(product);

    setStockAction(type);

    setStockQuantity("1");

    setStockReason("");

    setStockError("");

  }

  async function handleStockAdjustment(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    const user = auth.currentUser;

    const product = stockTarget;

    const quantity = Number(stockQuantity);

    if (!user || !product || adjusting) return;

    if (product.ownerUid !== user.uid) {

      setStockError("Kamu tidak memiliki akses ke produk ini.");

      return;

    }

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {

      setStockError("Jumlah stok harus bilangan bulat positif.");

      return;

    }

    const nextStock =

      stockAction === "in"

        ? product.stock + quantity

        : product.stock - quantity;

    if (stockAction === "out" && quantity > product.stock) {

      setStockError("Stok keluar melebihi jumlah stok yang tersedia.");

      return;

    }

    if (!Number.isSafeInteger(nextStock)) {

      setStockError("Jumlah stok terlalu besar.");

      return;

    }

    setAdjusting(true);

    setStockError("");

    try {

      // Stok dan riwayat perubahan disimpan dalam satu batch.

      const batch = writeBatch(db);

      batch.update(doc(db, "products", product.id), {

        stock: nextStock,

      });

      batch.set(doc(collection(db, "stockMovements")), {

        ownerUid: user.uid,

        productId: product.id,

        productName: product.name,

        type: stockAction,

        quantity,

        reason: stockReason.trim() || (

          stockAction === "in" ? "Penambahan stok" : "Pengurangan stok"

        ),

        date: todayString(),

        createdAt: serverTimestamp(),

      });

      await batch.commit();

      setStockTarget(null);

      setActionMessage(

        stockAction === "in"

          ? "Stok berhasil ditambahkan."

          : "Stok berhasil dikurangi."

      );

    } catch (error) {

      console.error("Gagal memperbarui stok:", error);

      setStockError(errorMessage(error));

    } finally {

      setAdjusting(false);

    }

  }

  function exportCsv() {

    if (filteredProducts.length === 0) {

      window.alert("Tidak ada produk untuk diekspor.");

      return;

    }

    const headers = [

      "Nama Produk",

      "SKU",

      "Kategori",

      "Harga Modal",

      "Harga Jual",

      "Stok",

      "Minimum Stok",

    ];

    const rows = filteredProducts.map((product) => [

      product.name,

      product.sku,

      product.category,

      product.costPrice,

      product.sellingPrice,

      product.stock,

      product.minimumStock,

    ]);

    const csv =

      "\uFEFF" +

      [headers, ...rows]

        .map((row) => row.map(csvCell).join(";"))

        .join("\r\n");

    const blob = new Blob([csv], {

      type: "text/csv;charset=utf-8;",

    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = `luma-produk-${todayString()}.csv`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);

  }

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {

    const file = event.target.files?.[0];

    const user = auth.currentUser;

    if (!file || !user) return;

    setImporting(true);

    setPageError("");

    setActionMessage("");

    try {

      const text = (await file.text()).replace(/^\uFEFF/, "");

      const lines = text.split(/\r?\n/).filter((line) => line.trim());

      if (lines.length < 2) {

        throw new Error("File CSV tidak memiliki data produk.");

      }

      const headers = parseCsvLine(lines[0]).map((header) =>

        header.trim().toLowerCase()

      );

      const indexOf = (...names: string[]) =>

        headers.findIndex((header) => names.includes(header));

      const nameIndex = indexOf("nama produk", "name", "nama");

      const skuIndex = indexOf("sku", "kode produk");

      const categoryIndex = indexOf("kategori", "category");

      const costIndex = indexOf("harga modal", "costprice", "harga beli");

      const sellingIndex = indexOf("harga jual", "sellingprice");

      const stockIndex = indexOf("stok", "stock");

      const minimumIndex = indexOf("minimum stok", "minimumstock", "stok minimum");

      if (

        nameIndex < 0 ||

        costIndex < 0 ||

        sellingIndex < 0 ||

        stockIndex < 0

      ) {

        throw new Error(

          "Kolom wajib: Nama Produk, Harga Modal, Harga Jual, dan Stok."

        );

      }

      const parsed = lines.slice(1).map((line, index) => {

        const columns = parseCsvLine(line);

        const name = columns[nameIndex]?.trim() ?? "";

        const costPrice = Number(columns[costIndex] ?? "");

        const sellingPrice = Number(columns[sellingIndex] ?? "");

        const stock = Number(columns[stockIndex] ?? "");

        const minimumStock =

          minimumIndex >= 0 && columns[minimumIndex] !== ""

            ? Number(columns[minimumIndex])

            : 5;

        if (

          !name ||

          !Number.isSafeInteger(costPrice) ||

          costPrice < 0 ||

          !Number.isSafeInteger(sellingPrice) ||

          sellingPrice < 0 ||

          !Number.isSafeInteger(stock) ||

          stock < 0 ||

          !Number.isSafeInteger(minimumStock) ||

          minimumStock < 0

        ) {

          throw new Error(`Data pada baris ${index + 2} tidak valid.`);

        }

        return {

          ownerUid: user.uid,

          name,

          sku: skuIndex >= 0 ? columns[skuIndex]?.trim() ?? "" : "",

          category:

            categoryIndex >= 0

              ? columns[categoryIndex]?.trim() || "Lainnya"

              : "Lainnya",

          costPrice,

          sellingPrice,

          stock,

          minimumStock,

          createdAt: serverTimestamp(),

        };

      });

      // Batasi jumlah per batch agar tidak melewati batas operasi Firestore.

      for (let start = 0; start < parsed.length; start += 400) {

        const batch = writeBatch(db);

        parsed.slice(start, start + 400).forEach((product) => {

          batch.set(doc(collection(db, "products")), product);

        });

        await batch.commit();

      }

      setActionMessage(`${parsed.length} produk berhasil diimpor.`);

    } catch (error) {

      console.error("Gagal mengimpor produk:", error);

      setPageError(errorMessage(error));

    } finally {

      setImporting(false);

      event.target.value = "";

    }

  }

  return (

    <main className="min-h-screen bg-[#FAFAF8] px-4 py-6 text-black sm:px-6 sm:py-7 lg:px-8 lg:py-8 xl:px-10">

      <div className="mx-auto w-full max-w-[1600px] space-y-8">

        <header className="mb-2 flex flex-col justify-between gap-6 md:flex-row md:items-end">

          <div>

            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.2em] text-[#9A7A3C]">

              <FiActivity />

              LUMA BUSINESS ADVISOR

            </div>

            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">

              Produk & Stok

            </h1>

            <p className="mt-2 max-w-xl text-sm leading-6 text-black/50">

              Kelola produk, pantau persediaan, dan kendalikan pergerakan stok

              dalam satu tempat.

            </p>

          </div>

          <button

            type="button"

            onClick={openCreateForm}

            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#D6B36A] px-5 text-sm font-semibold transition hover:bg-[#C49A4A]"

          >

            <FiPlus />

            Tambah Produk

          </button>

        </header>

        {pageError && (

          <div

            role="alert"

            className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"

          >

            <span>{pageError}</span>

            <button

              type="button"

              aria-label="Tutup pesan error"

              onClick={() => setPageError("")}

            >

              <FiX />

            </button>

          </div>

        )}

        {actionMessage && (

          <div

            role="status"

            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"

          >

            <span>{actionMessage}</span>

            <button

              type="button"

              aria-label="Tutup pesan"

              onClick={() => setActionMessage("")}

            >

              <FiX />

            </button>

          </div>

        )}

        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">

          <MetricCard

            title="Total Produk"

            value={summary.totalProducts.toLocaleString("id-ID")}

            description="Jenis produk terdaftar"

            icon={<FiPackage />}

            loading={loading}

          />

          <MetricCard

            title="Total Unit Stok"

            value={summary.totalUnits.toLocaleString("id-ID")}

            description="Jumlah seluruh unit"

            icon={<FiActivity />}

            loading={loading}

          />

          <MetricCard

            title="Perlu Perhatian"

            value={(summary.lowStock + summary.outOfStock).toLocaleString("id-ID")}

            description={`${summary.lowStock} menipis · ${summary.outOfStock} habis`}

            icon={<FiAlertTriangle />}

            loading={loading}

          />

          <MetricCard

            title="Nilai Persediaan"

            value={rupiah(summary.inventoryValue)}

            description="Stok × harga modal"

            icon={<FiPackage />}

            loading={loading}

          />

        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 lg:p-7">

          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

            <div>

              <h2 className="text-base font-semibold">Ringkasan Persediaan</h2>

              <p className="mt-1 text-sm text-gray-500">

                Kondisi stok produk saat ini.

              </p>

            </div>

            <div className="rounded-xl bg-[#FAF8F3] px-4 py-3">

              <p className="text-xs text-gray-500">Estimasi nilai modal</p>

              <p className="mt-1 text-lg font-semibold">

                {rupiah(summary.inventoryValue)}

              </p>

            </div>

          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">

            <div className="rounded-xl border border-gray-100 p-4">

              <div className="flex items-center gap-2 text-emerald-700">

                <FiPackage />

                <span className="text-sm font-medium">Stok tersedia</span>

              </div>

              <p className="mt-3 text-2xl font-semibold">

                {products.filter((p) => p.stock > p.minimumStock).length}

              </p>

              <p className="mt-1 text-xs text-gray-400">Jenis produk</p>

            </div>

            <div className="rounded-xl border border-gray-100 p-4">

              <div className="flex items-center gap-2 text-amber-700">

                <FiAlertTriangle />

                <span className="text-sm font-medium">Stok menipis</span>

              </div>

              <p className="mt-3 text-2xl font-semibold">{summary.lowStock}</p>

              <p className="mt-1 text-xs text-gray-400">

                Sudah mencapai batas minimum

              </p>

            </div>

            <div className="rounded-xl border border-gray-100 p-4">

              <div className="flex items-center gap-2 text-red-700">

                <FiX />

                <span className="text-sm font-medium">Stok habis</span>

              </div>

              <p className="mt-3 text-2xl font-semibold">{summary.outOfStock}</p>

              <p className="mt-1 text-xs text-gray-400">

                Perlu pengadaan stok

              </p>

            </div>

          </div>

        </section>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">

          <div className="flex flex-col gap-5 border-b border-gray-100 p-5 sm:p-6 lg:p-7">

            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

              <div>

                <h2 className="text-base font-semibold">Manajemen Persediaan</h2>

                <p className="mt-1 text-sm text-gray-500">

                  Kelola data produk dan riwayat perubahan stok.

                </p>

              </div>

              <div className="flex flex-wrap gap-3">

                <input

                  ref={fileInputRef}

                  type="file"

                  accept=".csv,text/csv"

                  className="hidden"

                  onChange={importCsv}

                />

                <button

                  type="button"

                  disabled={importing}

                  onClick={() => fileInputRef.current?.click()}

                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-medium transition hover:bg-gray-50 disabled:opacity-50"

                >

                  <FiUpload />

                  {importing ? "Mengimpor..." : "Impor CSV"}

                </button>

                <button

                  type="button"

                  onClick={exportCsv}

                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#D7C8A8] bg-[#FAF8F3] px-3 py-2.5 text-sm font-medium text-[#80652F] transition hover:bg-[#F4EFE3]"

                >

                  <FiDownload />

                  Ekspor CSV

                </button>

              </div>

            </div>

            <div className="flex flex-wrap gap-3 border-b border-gray-100">

              <button

                type="button"

                onClick={() => setActiveTab("products")}

                className={`border-b-2 px-3 py-3 text-sm font-medium ${

                  activeTab === "products"

                    ? "border-[#B89552] text-[#80652F]"

                    : "border-transparent text-gray-500 hover:text-gray-800"

                }`}

              >

                Daftar Produk ({filteredProducts.length})

              </button>

              <button

                type="button"

                onClick={() => setActiveTab("history")}

                className={`border-b-2 px-3 py-3 text-sm font-medium ${

                  activeTab === "history"

                    ? "border-[#B89552] text-[#80652F]"

                    : "border-transparent text-gray-500 hover:text-gray-800"

                }`}

              >

                Riwayat Stok ({movements.length})

              </button>

            </div>

            {activeTab === "products" && (

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">

                <div className="relative sm:col-span-2 xl:col-span-2">

                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

                  <input

                    value={search}

                    onChange={(event) => setSearch(event.target.value)}

                    placeholder="Cari nama produk, SKU, kategori..."

                    className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[#B89552]"

                  />

                </div>

                <div className="relative">

                  <FiFilter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

                  <select

                    value={categoryFilter}

                    onChange={(event) => setCategoryFilter(event.target.value)}

                    className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#B89552]"

                  >

                    <option value="all">Semua kategori</option>

                    {Array.from(

                      new Set([

                        ...CATEGORIES,

                        ...products.map((product) => product.category),

                      ])

                    ).map((category) => (

                      <option key={category} value={category}>

                        {category}

                      </option>

                    ))}

                  </select>

                </div>

                <select

                  value={stockFilter}

                  onChange={(event) => setStockFilter(event.target.value)}

                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#B89552]"

                >

                  <option value="all">Semua kondisi stok</option>

                  <option value="available">Stok tersedia</option>

                  <option value="low">Stok menipis</option>

                  <option value="empty">Stok habis</option>

                </select>

              </div>

            )}

          </div>

          {activeTab === "products" ? (

            <div className="overflow-x-auto">

              <table className="w-full min-w-[1050px] text-left">

                <thead className="bg-[#FAFAF9]">

                  <tr className="text-xs font-medium uppercase tracking-wider text-gray-500">

                    <th className="px-6 py-4">Produk</th>

                    <th className="px-6 py-4">Kategori</th>

                    <th className="px-6 py-4">Harga Modal</th>

                    <th className="px-6 py-4">Harga Jual</th>

                    <th className="px-6 py-4">Stok</th>

                    <th className="px-6 py-4">Status</th>

                    <th className="px-6 py-4 text-right">Aksi</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-100">

                  {loading ? (

                    <tr>

                      <td colSpan={7} className="px-5 py-14 text-center text-sm text-gray-400">

                        Memuat data produk...

                      </td>

                    </tr>

                  ) : filteredProducts.length === 0 ? (

                    <tr>

                      <td colSpan={7} className="px-5 py-14 text-center">

                        <FiPackage className="mx-auto text-3xl text-gray-300" />

                        <p className="mt-3 text-sm font-medium text-gray-600">

                          Belum ada produk yang sesuai

                        </p>

                        <p className="mt-1 text-xs text-gray-400">

                          Tambahkan produk atau ubah filter pencarian.

                        </p>

                      </td>

                    </tr>

                  ) : (

                    filteredProducts.map((product) => {

                      const status = stockStatus(product);

                      return (

                        <tr key={product.id} className="transition hover:bg-gray-50/70">

                          <td className="px-6 py-4">

                            <p className="font-medium text-gray-900">{product.name}</p>

                            <p className="mt-1 text-xs text-gray-400">

                              SKU: {product.sku || "-"}

                            </p>

                          </td>

                          <td className="px-6 py-4 text-sm text-gray-600">

                            {product.category}

                          </td>

                          <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">

                            {rupiah(product.costPrice)}

                          </td>

                          <td className="whitespace-nowrap px-6 py-4 text-sm font-medium">

                            {rupiah(product.sellingPrice)}

                          </td>

                          <td className="px-6 py-4">

                            <p className="text-sm font-semibold">{product.stock} unit</p>

                            <p className="mt-1 text-xs text-gray-400">

                              Minimum {product.minimumStock}

                            </p>

                          </td>

                          <td className="px-6 py-4">

                            <span className={`inline-flex whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium ${status.className}`}>

                              {status.label}

                            </span>

                          </td>

                          <td className="px-6 py-4">

                            <div className="flex justify-end gap-2">

                              <button

                                type="button"

                                title="Tambah stok"

                                aria-label={`Tambah stok ${product.name}`}

                                onClick={() => openStockForm(product, "in")}

                                className="rounded-lg border border-gray-200 p-2 text-emerald-700 transition hover:bg-emerald-50"

                              >

                                <FiArrowUpCircle size={16} />

                              </button>

                              <button

                                type="button"

                                title="Kurangi stok"

                                aria-label={`Kurangi stok ${product.name}`}

                                onClick={() => openStockForm(product, "out")}

                                className="rounded-lg border border-gray-200 p-2 text-amber-700 transition hover:bg-amber-50"

                              >

                                <FiArrowDownCircle size={16} />

                              </button>

                              <button

                                type="button"

                                title="Edit produk"

                                aria-label={`Edit ${product.name}`}

                                onClick={() => openEditForm(product)}

                                className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-[#D6B36A] hover:text-[#92753F]"

                              >

                                <FiEdit2 size={15} />

                              </button>

                              <button

                                type="button"

                                title="Hapus produk"

                                aria-label={`Hapus ${product.name}`}

                                onClick={() => setDeleteTarget(product)}

                                className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"

                              >

                                <FiTrash2 size={15} />

                              </button>

                            </div>

                          </td>

                        </tr>

                      );

                    })

                  )}

                </tbody>

              </table>

            </div>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full min-w-[750px] text-left">

                <thead className="bg-[#FAFAF9]">

                  <tr className="text-xs font-medium uppercase tracking-wider text-gray-500">

                    <th className="px-6 py-4">Tanggal</th>

                    <th className="px-6 py-4">Produk</th>

                    <th className="px-6 py-4">Jenis</th>

                    <th className="px-6 py-4">Jumlah</th>

                    <th className="px-6 py-4">Keterangan</th>

                  </tr>

                </thead>

                <tbody className="divide-y divide-gray-100">

                  {movements.length === 0 ? (

                    <tr>

                      <td colSpan={5} className="px-5 py-14 text-center text-sm text-gray-400">

                        Belum ada riwayat pergerakan stok.

                      </td>

                    </tr>

                  ) : (

                    movements.map((movement) => (

                      <tr key={movement.id} className="hover:bg-gray-50/70">

                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">

                          {movement.date}

                        </td>

                        <td className="px-6 py-4 text-sm font-medium">

                          {movement.productName}

                        </td>

                        <td className="px-6 py-4">

                          <span className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${

                            movement.type === "in"

                              ? "bg-emerald-50 text-emerald-700"

                              : "bg-amber-50 text-amber-700"

                          }`}>

                            {movement.type === "in" ? "Stok masuk" : "Stok keluar"}

                          </span>

                        </td>

                        <td className="px-6 py-4 text-sm font-semibold">

                          {movement.type === "in" ? "+" : "-"}{movement.quantity} unit

                        </td>

                        <td className="px-6 py-4 text-sm text-gray-600">

                          {movement.reason || "-"}

                        </td>

                      </tr>

                    ))

                  )}

                </tbody>

              </table>

            </div>

          )}

          <div className="border-t border-gray-100 px-6 py-4 text-xs text-gray-500">

            {activeTab === "products"

              ? `Menampilkan ${filteredProducts.length} dari ${products.length} produk`

              : `Total ${movements.length} catatan pergerakan stok`}

          </div>

        </section>

        {/* Modal tambah/edit produk */}

        {showForm && (

          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm">

            <div

              role="dialog"

              aria-modal="true"

              aria-labelledby="product-form-title"

              className="my-auto w-full max-w-xl rounded-2xl bg-white shadow-2xl"

            >

              <div className="flex items-start justify-between border-b border-gray-100 p-5 sm:p-6">

                <div>

                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A4864A]">

                    LUMA INVENTORY

                  </p>

                  <h2 id="product-form-title" className="mt-2 text-xl font-semibold">

                    {editTarget ? "Edit Produk" : "Tambah Produk"}

                  </h2>

                  <p className="mt-1 text-sm text-gray-500">

                    Lengkapi informasi produk dan persediaannya.

                  </p>

                </div>

                <button

                  type="button"

                  disabled={saving}

                  onClick={() => setShowForm(false)}

                  aria-label="Tutup formulir"

                  className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100"

                >

                  <FiX size={20} />

                </button>

              </div>

              <form onSubmit={handleSave} className="space-y-5 p-5 sm:p-6">

                <Field label="Nama produk *">

                  <input

                    required

                    maxLength={120}

                    value={form.name}

                    onChange={(e) => updateForm("name", e.target.value)}

                    placeholder="Contoh: Roti Cokelat"

                    className={inputClass}

                  />

                </Field>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                  <Field label="SKU / Kode produk">

                    <input

                      maxLength={60}

                      value={form.sku}

                      onChange={(e) => updateForm("sku", e.target.value)}

                      placeholder="Contoh: ROT-001"

                      className={inputClass}

                    />

                  </Field>

                  <Field label="Kategori">

                    <select

                      value={form.category}

                      onChange={(e) => updateForm("category", e.target.value)}

                      className={inputClass}

                    >

                      <option value="">Pilih kategori</option>

                      {CATEGORIES.map((category) => (

                        <option key={category} value={category}>{category}</option>

                      ))}

                    </select>

                  </Field>

                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                  <Field label="Harga modal (Rp)">

                    <input

                      required

                      type="number"

                      min="0"

                      step="1"

                      value={form.costPrice}

                      onChange={(e) => updateForm("costPrice", e.target.value)}

                      placeholder="10000"

                      className={inputClass}

                    />

                  </Field>

                  <Field label="Harga jual (Rp)">

                    <input

                      required

                      type="number"

                      min="0"

                      step="1"

                      value={form.sellingPrice}

                      onChange={(e) => updateForm("sellingPrice", e.target.value)}

                      placeholder="15000"

                      className={inputClass}

                    />

                  </Field>

                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                  <Field label="Jumlah stok">

                    <input

                      required

                      type="number"

                      min="0"

                      step="1"

                      value={form.stock}

                      onChange={(e) => updateForm("stock", e.target.value)}

                      className={inputClass}

                    />

                  </Field>

                  <Field label="Batas minimum stok">

                    <input

                      required

                      type="number"

                      min="0"

                      step="1"

                      value={form.minimumStock}

                      onChange={(e) => updateForm("minimumStock", e.target.value)}

                      className={inputClass}

                    />

                  </Field>

                </div>

                <div className="rounded-xl bg-[#FAF8F3] p-4">

                  <p className="text-xs text-gray-500">Estimasi nilai stok</p>

                  <p className="mt-1 text-xl font-semibold">

                    {rupiah(

                      Math.max(0, Number(form.stock) || 0) *

                      Math.max(0, Number(form.costPrice) || 0)

                    )}

                  </p>

                  <p className="mt-1 text-xs text-gray-400">

                    Jumlah stok × harga modal

                  </p>

                </div>

                {formError && (

                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">

                    {formError}

                  </div>

                )}

                <div className="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:justify-end">

                  <button

                    type="button"

                    disabled={saving}

                    onClick={() => setShowForm(false)}

                    className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"

                  >

                    Batal

                  </button>

                  <button

                    type="submit"

                    disabled={saving}

                    className="rounded-xl bg-[#171717] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#333333] disabled:opacity-60"

                  >

                    {saving ? "Menyimpan..." : "Simpan Produk"}

                  </button>

                </div>

              </form>

            </div>

          </div>

        )}

        {/* Modal penyesuaian stok */}

        {stockTarget && (

          <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">

            <div

              role="dialog"

              aria-modal="true"

              aria-labelledby="stock-modal-title"

              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"

            >

              <div className="flex items-start justify-between gap-3">

                <div>

                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A4864A]">

                    LUMA INVENTORY

                  </p>

                  <h2 id="stock-modal-title" className="mt-2 text-lg font-semibold">

                    {stockAction === "in" ? "Tambah Stok" : "Kurangi Stok"}

                  </h2>

                  <p className="mt-1 text-sm text-gray-500">{stockTarget.name}</p>

                </div>

                <button

                  type="button"

                  disabled={adjusting}

                  onClick={() => setStockTarget(null)}

                  aria-label="Tutup"

                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"

                >

                  <FiX size={20} />

                </button>

              </div>

              <div className="mt-5 rounded-xl bg-[#FAF8F3] p-4">

                <p className="text-xs text-gray-500">Stok saat ini</p>

                <p className="mt-1 text-2xl font-semibold">{stockTarget.stock} unit</p>

              </div>

              <form onSubmit={handleStockAdjustment} className="mt-6 space-y-5">

                <Field label="Jumlah unit">

                  <input

                    required

                    type="number"

                    min="1"

                    step="1"

                    value={stockQuantity}

                    onChange={(e) => setStockQuantity(e.target.value)}

                    className={inputClass}

                  />

                </Field>

                <Field label="Keterangan">

                  <input

                    maxLength={200}

                    value={stockReason}

                    onChange={(e) => setStockReason(e.target.value)}

                    placeholder={

                      stockAction === "in"

                        ? "Contoh: Pembelian dari pemasok"

                        : "Contoh: Barang rusak atau terjual"

                    }

                    className={inputClass}

                  />

                </Field>

                {stockError && (

                  <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">

                    {stockError}

                  </div>

                )}

                <div className="flex flex-col-reverse gap-3 pt-3 sm:flex-row sm:justify-end">

                  <button

                    type="button"

                    disabled={adjusting}

                    onClick={() => setStockTarget(null)}

                    className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium hover:bg-gray-50"

                  >

                    Batal

                  </button>

                  <button

                    type="submit"

                    disabled={adjusting}

                    className="rounded-xl bg-[#171717] px-4 py-3 text-sm font-medium text-white hover:bg-[#333333] disabled:opacity-60"

                  >

                    {adjusting ? "Menyimpan..." : "Simpan Perubahan Stok"}

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

              aria-labelledby="delete-product-title"

              className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"

            >

              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">

                <FiTrash2 size={22} />

              </div>

              <h2 id="delete-product-title" className="mt-5 text-lg font-semibold">

                Hapus produk?

              </h2>

              <p className="mt-2 text-sm leading-6 text-gray-500">

                Produk <strong className="text-gray-800">{deleteTarget.name}</strong>{" "}

                akan dihapus dari daftar produk. Riwayat pergerakan stok yang

                sudah tercatat tidak ikut dihapus.

              </p>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

                <button

                  type="button"

                  disabled={deleting}

                  onClick={() => setDeleteTarget(null)}

                  className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium hover:bg-gray-50"

                >

                  Batal

                </button>

                <button

                  type="button"

                  disabled={deleting}

                  onClick={handleDelete}

                  className="rounded-xl bg-[#171717] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#333333] disabled:opacity-60"

                >

                  {deleting ? "Menghapus..." : "Ya, Hapus"}

                </button>

              </div>

            </div>

          </div>

        )}

      </div>

    </main>

  );

}

const inputClass =

  "w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#B89552] focus:ring-2 focus:ring-[#B89552]/10";

function Field({

  label,

  children,

}: {

  label: string;

  children: React.ReactNode;

}) {

  return (

    <div>

      <label className="mb-2 block text-sm font-medium text-gray-700">

        {label}

      </label>

      {children}

    </div>

  );

}

function MetricCard({

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

    <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 transition hover:border-[#D7C8A8]">

      <div className="flex items-start justify-between gap-3">

        <div className="min-w-0">

          <p className="text-sm text-gray-500">{title}</p>

          {loading ? (

            <div className="mt-3 h-7 w-32 animate-pulse rounded-md bg-gray-100" />

          ) : (

            <p className="mt-3 break-words text-xl font-semibold tracking-tight sm:text-2xl">

              {value}

            </p>

          )}

          <p className="mt-2 text-xs leading-5 text-gray-400">{description}</p>

        </div>

        <div className="shrink-0 rounded-xl bg-[#FAF8F3] p-3 text-[#A4864A]">

          {icon}

        </div>

      </div>

    </div>

  );

}
