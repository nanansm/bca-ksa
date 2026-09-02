/**
 * Progres sekarang disimpan di D1 (lihat './db.ts'), bukan lagi KV — satu run bisa
 * dikunci dengan indeks unik, sesuatu yang tidak bisa dilakukan KV. File ini dipertahankan
 * sebagai titik impor lama supaya tipe `StatusRun`/`Progres` tetap satu sumber di './db.ts'.
 */
export type { StatusRun, Progres } from './db'
