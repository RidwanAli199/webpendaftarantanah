// Isi dengan konfigurasi dari Firebase Console:
// Project settings (ikon roda gigi) > General > Your apps > Web app > SDK setup and configuration.
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDpk65EBWIzwzowYVX8u7-thtL4b5MTa3U",
  authDomain: "pendaftarantanah-c297e.firebaseapp.com",
  projectId: "pendaftarantanah-c297e",
  storageBucket: "pendaftarantanah-c297e.firebasestorage.app",
  messagingSenderId: "765992627360",
  appId: "1:765992627360:web:3854015e8217ea4965adc5",
  measurementId: "G-SNHTHW632Q"
};

export const COLLECTION = "bidang";

// Tampilan awal peta (Bandar Lampung). Setelah data termuat, peta otomatis zoom ke seluruh bidang.
export const MAP_CENTER = [-5.43, 105.26];
export const MAP_ZOOM = 13;

// Daftar status kepemilikan + warna di peta. Ubah sesuai kebutuhan.
export const STATUS_COLORS = {
  "Hak Milik": "#16a34a",
  "HGB": "#2563eb",
  "Hak Pakai": "#f59e0b",
  "Wakaf": "#9333ea",
  "Belum Bersertipikat": "#dc2626"
};
export const DEFAULT_COLOR = "#6b7280";
