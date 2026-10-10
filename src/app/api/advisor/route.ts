
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatHistory = {
  role: "user" | "model";
  text: string;
};

type GeminiResponse = {
  candidates?: {
    content?: {
      parts?: { text?: string }[];
    };
    finishReason?: string;
  }[];
  error?: {
    code?: number;
    status?: string;
    message?: string;
  };
};

const SYSTEM_INSTRUCTION = `
Kamu adalah LUMA Business Advisor, asisten bisnis digital yang
membantu pemilik usaha dari berbagai tingkat pengalaman.

TUJUAN UTAMA
Bantu pengguna memahami bisnisnya, menemukan masalah, mengambil
keputusan yang masuk akal, dan menjalankan langkah perbaikan.

GAYA KOMUNIKASI
- Selalu gunakan bahasa Indonesia yang sederhana, alami, dan ramah.
- Jelaskan istilah bisnis dengan bahasa sehari-hari.
- Anggap pengguna bisa saja belum memiliki pengetahuan bisnis.
- Jangan terlalu formal, bertele-tele, atau menggunakan jargon.
- Jawab langsung pertanyaan pengguna sebelum memberikan penjelasan.
- Gunakan contoh sederhana bila membantu pemahaman.
- Jangan selalu menjawab dengan format laporan yang kaku.
- Untuk pertanyaan sederhana, berikan jawaban singkat.
- Untuk masalah kompleks, berikan analisis dan langkah yang terstruktur.

TOPIK YANG BOLEH DIBAHAS
Kamu boleh menjawab pertanyaan tentang berbagai aspek bisnis, termasuk:
1. Keuangan, modal, arus kas, pengeluaran, laba, dan harga pokok.
2. Penjualan, omzet, target, strategi promosi, dan pemasaran digital.
3. Produk, penentuan harga, stok, kualitas, dan pengembangan produk.
4. Pelanggan, pelayanan, loyalitas, dan target pasar.
5. Operasional, produktivitas, pemasok, dan efisiensi kerja.
6. Karyawan, pembagian tugas, kepemimpinan, dan pengelolaan tim.
7. Persaingan, peluang pasar, strategi bisnis, dan ekspansi.
8. UMKM, bisnis online, toko fisik, dan usaha jasa.
9. Ide bisnis, evaluasi ide, perencanaan, serta pemecahan masalah.
10. Pertanyaan bisnis umum lain yang relevan.

ATURAN SINKRONISASI DATA
Kamu menerima DATA BISNIS dari aplikasi LUMA.
Gunakan data tersebut ketika pertanyaan berkaitan dengan kondisi
bisnis pengguna, transaksi, produk, penjualan, atau persediaannya.

- Jangan mengarang transaksi, angka, produk, pelanggan, atau kondisi bisnis.
- Jangan menganggap data yang tidak tersedia berarti nilainya nol.
- Jika data tersedia, gunakan angka yang relevan dan jelaskan artinya.
- Jika pengguna bertanya tentang periode tertentu, perhatikan periode
  yang tercantum dalam konteks data.
- Jika data tidak cukup, jelaskan keterbatasannya secara sederhana.
- Jika perlu, tanyakan informasi tambahan yang benar-benar diperlukan.
- Bedakan fakta dari data, perkiraan, dan saran.
- Jangan mengatakan sudah memeriksa data yang sebenarnya tidak diberikan.
- Jangan mengklaim memiliki akses langsung ke seluruh database.
- Data ringkasan mungkin tidak mencakup seluruh transaksi historis.

PENANGANAN PERTANYAAN UMUM
Jika pengguna bertanya tentang strategi, ide, teori, atau cara
menjalankan bisnis secara umum, tetap jawab dengan pengetahuan bisnis
yang relevan meskipun data pengguna tidak tersedia.

Jika pertanyaan menggabungkan kondisi bisnis pribadi dan pengetahuan
umum, gunakan data yang tersedia terlebih dahulu lalu berikan saran
umum yang sesuai.

CARA MEMBERIKAN SARAN
Untuk masalah bisnis, usahakan menjelaskan:
1. Apa masalah atau situasinya.
2. Apa kemungkinan penyebabnya, jika ada dasar yang cukup.
3. Apa yang sebaiknya dilakukan.
4. Langkah pertama yang realistis untuk dikerjakan.
5. Apa yang perlu dipantau untuk menilai hasilnya.

Jangan memaksakan semua poin untuk pertanyaan sederhana.
Prioritaskan tindakan yang realistis dan sesuai kemampuan usaha.
Jangan menjanjikan hasil penjualan atau keuntungan tertentu.
Jangan memberikan kepastian jika hasil masih bergantung pada kondisi pasar.

PERHITUNGAN
Periksa angka dan satuan sebelum menghitung.
Jelaskan rumus dengan bahasa sederhana jika diperlukan.
Bedakan omzet, laba kotor, dan laba bersih.
Jangan menyebut selisih pendapatan dan pengeluaran sebagai laba bersih
akuntansi jika biaya lain belum diperhitungkan.

PERCAKAPAN
- Pahami pertanyaan berdasarkan riwayat percakapan yang diberikan.
- Ingat konteks percakapan sebelumnya selama masih tersedia.
- Jika pengguna berkata "bisnis saya", gunakan konteks bisnis LUMA.
- Jangan meminta pengguna mengulang informasi yang sudah tersedia.
- Jika pertanyaan ambigu dan jawabannya sangat bergantung pada konteks,
  ajukan satu pertanyaan klarifikasi yang singkat.
- Jangan mengaku dapat melakukan tindakan di aplikasi jika tidak tersedia.

FORMAT JAWABAN
Gunakan bahasa yang mudah dipahami semua kalangan.
Pakai paragraf pendek atau daftar jika membantu.
Hindari jawaban terlalu panjang jika tidak dibutuhkan.
Akhiri dengan langkah praktis jika memang relevan.

Kamu adalah penasihat yang membantu pengguna berpikir lebih baik,
bukan pengganti keputusan pemilik bisnis.
`.trim();

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "API key belum terbaca. Periksa GEMINI_API_KEY di file .env.local.",
          code: "MISSING_API_KEY",
        },
        { status: 500 }
      );
    }

    const body = (await request.json()) as {
      message?: string;
      context?: unknown;
      history?: ChatHistory[];
    };

    const message = String(body.message ?? "").trim();

    if (!message) {
      return NextResponse.json(
        {
          error: "Silakan tulis pertanyaan terlebih dahulu.",
          code: "EMPTY_MESSAGE",
        },
        { status: 400 }
      );
    }

    if (message.length > 10000) {
      return NextResponse.json(
        {
          error: "Pertanyaan terlalu panjang. Silakan ringkas pertanyaan.",
          code: "MESSAGE_TOO_LONG",
        },
        { status: 413 }
      );
    }

    let contextText = "{}";

    try {
      contextText = JSON.stringify(body.context ?? {});
    } catch {
      return NextResponse.json(
        {
          error: "Data bisnis tidak dapat dibaca. Muat ulang halaman Advisor.",
          code: "INVALID_CONTEXT",
        },
        { status: 400 }
      );
    }

    if (contextText.length > 50000) {
      return NextResponse.json(
        {
          error:
            "Ringkasan data bisnis terlalu besar untuk diproses sekaligus.",
          code: "CONTEXT_TOO_LARGE",
        },
        { status: 413 }
      );
    }

    const history = Array.isArray(body.history)
      ? body.history
          .filter(
            (item): item is ChatHistory =>
              !!item &&
              (item.role === "user" || item.role === "model") &&
              typeof item.text === "string" &&
              item.text.trim().length > 0
          )
          .slice(-8)
          .map((item) => ({
            role: item.role,
            parts: [{ text: item.text.slice(0, 4000) }],
          }))
      : [];

    // Data bisnis dan pertanyaan terbaru selalu disertakan.
    const prompt = `
RINGKASAN DATA BISNIS DARI APLIKASI LUMA:
${contextText}

PERTANYAAN PENGGUNA:
${message}

Jawab pertanyaan pengguna secara langsung.
Jika relevan, hubungkan jawaban dengan data bisnis yang tersedia.
Jika pertanyaan bersifat umum, tetap berikan jawaban yang bermanfaat.
Jangan mengarang data yang tidak ada dalam ringkasan.
`.trim();

    // Gunakan nama model yang disarankan oleh pesan error API pengguna.
    const model = "gemini-3.8-flash";

    let response: Response;

    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: SYSTEM_INSTRUCTION }],
            },
            contents: [
              ...history,
              {
                role: "user",
                parts: [{ text: prompt }],
              },
            ],
            generationConfig: {
              maxOutputTokens: 1600,
              thinkingConfig: {
                thinkingLevel: "low",
              },
            },
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(45000),
        }
      );
    } catch (error) {
      const err = error as Error & {
        cause?: {
          code?: string;
          message?: string;
        };
      };

      console.error("LUMA Gemini connection error:", {
        name: err.name,
        message: err.message,
        cause: err.cause?.message,
        code: err.cause?.code,
      });

      const isTimeout = err.name === "TimeoutError";

      return NextResponse.json(
        {
          error: isTimeout
            ? "Koneksi ke AI terlalu lama. Silakan coba kembali."
            : "LUMA tidak dapat terhubung ke layanan AI. Periksa koneksi internet, DNS, atau konfigurasi jaringan server.",
          code: err.cause?.code ?? err.name ?? "FETCH_FAILED",
        },
        { status: 502 }
      );
    }

    const result = (await response.json()) as GeminiResponse;

    if (!response.ok) {
      console.error("LUMA Gemini API response error:", {
        httpStatus: response.status,
        apiStatus: result.error?.status,
        message: result.error?.message,
      });

      let errorMessage =
        result.error?.message ?? "AI gagal memproses pertanyaan.";

      if (response.status === 400) {
        errorMessage =
          "Permintaan tidak dapat diproses. Periksa format permintaan API.";
      } else if (
        response.status === 401 ||
        response.status === 403
      ) {
        errorMessage =
          "API key tidak valid atau belum memiliki izin mengakses model AI.";
      } else if (response.status === 404) {
        errorMessage =
          "Model AI tidak tersedia untuk API key ini. Periksa daftar model yang didukung.";
      } else if (response.status === 429) {
        errorMessage =
          "Kuota atau batas permintaan AI tercapai. Periksa penggunaan API.";
      } else if (response.status >= 500) {
        errorMessage =
          "Layanan AI sedang mengalami gangguan. Coba kembali beberapa saat lagi.";
      }

      return NextResponse.json(
        {
          error: errorMessage,
          code: result.error?.status ?? "GEMINI_API_ERROR",
        },
        { status: 502 }
      );
    }

    const candidate = result.candidates?.[0];

    const answer = candidate?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim();

    if (!answer) {
      console.error("LUMA Gemini empty response:", {
        finishReason: candidate?.finishReason,
      });

      return NextResponse.json(
        {
          error:
            "AI belum menghasilkan jawaban. Coba tulis pertanyaan dengan cara berbeda.",
          code: candidate?.finishReason ?? "EMPTY_RESPONSE",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ answer });
  } catch (error) {
    console.error(
      "LUMA Advisor server error:",
      error instanceof Error ? error.message : error
    );

    return NextResponse.json(
      {
        error:
          "Terjadi kesalahan saat memproses permintaan. Silakan coba kembali.",
        code: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 }
    );
  }
}
