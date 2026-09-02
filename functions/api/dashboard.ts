import { json } from '../_lib/auth'
import { ambilRunTerakhir, hitungTerpakai24Jam, terkirimSejak, type Env } from '../_lib/db'
import { analitikHarian, biayaHarian, kesehatanNomor, type AnalitikHarian } from '../_lib/meta'
import { bacaPengaturan } from '../_lib/pengaturan'
import { ringkasanRentang } from '../_lib/pesan'

// Butuh sesi login staf (bukan jalur mesin) -- tidak masuk MACHINE_PATHS di _middleware.

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000
const JUMLAH_RUN_TERAKHIR = 5

/** Awal bulan berjalan menurut kalender Asia/Jakarta (UTC+7, tanpa DST). */
function awalBulanJakarta(sekarang: Date): Date {
  const jakarta = new Date(sekarang.getTime() + JAKARTA_OFFSET_MS)
  const awalUtcJakarta = Date.UTC(jakarta.getUTCFullYear(), jakarta.getUTCMonth(), 1)
  return new Date(awalUtcJakarta - JAKARTA_OFFSET_MS)
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const sekarang = new Date()
  const mulai30Hari = new Date(sekarang.getTime() - 30 * 24 * 60 * 60 * 1000)
  const awalBulan = awalBulanJakarta(sekarang)

  const [pengaturan, terpakai24j, nomorHasil, analitikHasil, ringkasBulan, runTerakhir, terkirimBcBulanIni, biayaHasil] =
    await Promise.all([
    bacaPengaturan(env),
    hitungTerpakai24Jam(env),
    kesehatanNomor(env),
    analitikHarian(env, mulai30Hari, sekarang),
    ringkasanRentang(env, awalBulan.toISOString(), sekarang.toISOString()),
    ambilRunTerakhir(env, JUMLAH_RUN_TERAKHIR),
    terkirimSejak(env, awalBulan.toISOString()),
    biayaHarian(env, mulai30Hari, sekarang),
  ])

  const gagal: string[] = []

  const harian: AnalitikHarian[] = analitikHasil.ok ? analitikHasil.data : []
  if (!analitikHasil.ok) gagal.push(`harian: ${analitikHasil.sebab}`)

  // Biaya sebenarnya dari Meta. Kalau Meta gagal dijawab, jatuh balik ke tarif x jumlah
  // supaya kartu biaya tidak kosong -- layar diberi tahu mana yang sedang dipakai.
  const tanggalAwalBulan = awalBulan.toISOString().slice(0, 10)
  const biayaAsli = biayaHasil.ok
    ? biayaHasil.data
        .filter((b) => b.tanggal >= tanggalAwalBulan)
        .reduce((total, b) => total + b.biaya, 0)
    : null
  if (!biayaHasil.ok) gagal.push(`biaya: ${biayaHasil.sebab}`)

  const nomor = nomorHasil.ok
    ? { display: nomorHasil.data.display, kualitas: nomorHasil.data.kualitas, status: nomorHasil.data.status }
    : { display: '', kualitas: 'tidak diketahui', status: 'tidak diketahui' }
  if (!nomorHasil.ok) gagal.push(`nomor: ${nomorHasil.sebab}`)

  return json({
    ok: true,
    nomor,
    hari_ini: {
      terkirim: terpakai24j,
      sisa_kuota: Math.max(0, pengaturan.batasHarian - terpakai24j),
      batas_harian: pengaturan.batasHarian,
    },
    // Semua angka bulan ini dari D1 (khusus broadcast), bukan dari analytics Meta.
    // Angka Meta ikut menghitung percakapan CS, jadi kalau dipakai di sini "terkirim"
    // tidak akan pernah cocok dengan "perkiraan biaya" dan staf malah bingung.
    bulan_ini: {
      terkirim: terkirimBcBulanIni,
      sampai: ringkasBulan === null ? null : ringkasBulan.sampai,
      dibaca: ringkasBulan === null ? null : ringkasBulan.dibaca,
      // `biaya_asli` true berarti angkanya tagihan Meta yang sebenarnya, bukan hitungan
      // tarif x jumlah. Layar wajib mengubah labelnya sesuai penanda ini.
      biaya: biayaAsli === null ? terkirimBcBulanIni * pengaturan.tarifPerPesan : Math.round(biayaAsli),
      biaya_asli: biayaAsli !== null,
    },
    harian,
    run_terakhir: runTerakhir,
    diperbarui: sekarang.toISOString(),
    // Penyimpangan sengaja dari bentuk kontrak: field tambahan ini kosong selama Meta
    // normal, cuma terisi supaya layar bisa menandai bagian mana yang gagal alih-alih
    // diam-diam menampilkan nol yang menyesatkan.
    ...(gagal.length > 0 ? { gagal } : {}),
  })
}
