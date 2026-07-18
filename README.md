# Trailer Watcher

Pantau channel YouTube → filter judul trailer/MV → kirim ke Discord. Otomatis tiap 15 menit, gratis (GitHub Actions).

## Setup (5 menit)

1. Buat repo GitHub baru, upload semua file di folder ini (struktur folder harus tetap sama).
2. Buat Discord Webhook: Server Settings → Integrations → Webhooks → New Webhook → copy URL.
3. Di repo GitHub: Settings → Secrets and variables → Actions → New repository secret.
   - Name: `DISCORD_WEBHOOK_URL`
   - Value: (URL webhook tadi)
4. Edit `channels.json` — isi channel yang mau dipantau. Cara ambil `channelId`:
   - Buka channel YouTube-nya → klik kanan → View Page Source → cari `"channelId":"UC..."`
   - Atau: `https://www.youtube.com/@NamaChannel` lalu lihat sumber halaman.
5. Selesai. Workflow otomatis jalan tiap 15 menit. Bisa dites manual: tab Actions → Watch Trailers → Run workflow.

## Edit kata kunci filter

Buka `scripts/watch.js`, cari `KEYWORDS`, tambah/kurangi sesuai kebutuhan.

## Catatan

- `seen.json` jangan dihapus manual — itu yang mencegah notif dobel.
- Repo publik: GitHub Actions gratis unlimited. Repo private: ada kuota bulanan (masih jauh cukup buat cron 15 menit).
