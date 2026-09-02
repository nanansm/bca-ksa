# bc-ksa — Broadcast WhatsApp Kampung Sumber Alam

Halaman internal untuk tim KSA mengirim promo WhatsApp ke tamu lama. Empat langkah, dipakai dari HP.

Live: https://bc.kampungsumberalam.com

## Cara kerjanya

```
Browser  ──►  Cloudflare Pages Functions  ──►  n8n  ──►  Meta WhatsApp Cloud API
              (login, cookie, progres)         (token Meta + Google Sheets)
```

Browser tidak pernah memegang token Meta maupun URL n8n. Halaman hanya bicara ke `/api/*` di
domainnya sendiri.

## Rahasia

Tidak ada rahasia di repo ini. Semuanya Cloudflare secret:

| Nama | Isi |
|---|---|
| `APP_USER` / `APP_PASS` | login bersama tim KSA |
| `COOKIE_SECRET` | kunci tanda tangan cookie sesi |
| `N8N_URL` | base URL webhook n8n |
| `N8N_SECRET` | header bersama antara Pages Functions dan n8n |

Binding KV `BC_STATE` menyimpan progres tiap pengiriman dan hitungan gagal login.

## Pengembangan

```bash
npm install
npm run dev        # UI saja
npm run typecheck  # src + functions
npm run build
```

Push ke `main` men-deploy sendiri lewat Cloudflare Pages.
