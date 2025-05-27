# WA Sales AI Bot

WhatsApp bot yang menggunakan pelbagai API AI untuk berfungsi sebagai wakil jualan AI. Bot ini direka untuk membantu dalam proses jualan dengan memberikan maklumat produk, mengendalikan pertanyaan pelanggan, dan mengumpul maklumat lead secara automatik.

## Ciri-ciri

- 🤖 Integrasi dengan pelbagai model AI:
  - OpenAI (GPT-3.5, GPT-4)
  - Google Gemini
  - Anthropic Claude
  - Grok
  - Dan banyak lagi melalui OpenRouter API
- 💬 Komunikasi dalam Bahasa Malaysia
- 📊 Sistem CRM untuk mengesan dan menguruskan leads
- 📱 Sokongan untuk imej QR code pembayaran
- 👥 Sistem pentadbir untuk akses terhad
- 📈 Laporan harian automatik untuk leads
- 🔄 Keupayaan untuk menukar model AI secara dinamik
- 🎯 Penyesuaian prompt untuk setiap model AI

## Model AI yang Disokong

Bot ini menyokong pelbagai model AI melalui OpenRouter API:

### OpenAI
- GPT-3.5 Turbo
- GPT-4
- GPT-4 Turbo

### Google
- Gemini Pro
- Gemini Ultra

### Anthropic
- Claude 2
- Claude Instant

### X.AI
- Grok-1

### Lain-lain
- Mixtral 8x7B
- Llama 2
- Mistral
- Dan banyak lagi...

## Keperluan Sistem

- [Node.js v20.9.0](https://nodejs.org/en/blog/release/v20.9.0) atau lebih tinggi
- Akaun WhatsApp
- API key dari [OpenRouter](https://openrouter.ai/)

## Pemasangan

1. Clone repositori ini:
```bash
git clone https://github.com/xhanafix/wa-sales-ai.bot.git
cd wa-sales-ai-bot
```

2. Pasang dependencies:
```bash
npm install
```

3. Salin fail `.env-sample.txt` ke `.env` dan konfigurasi:
```bash
cp .env-sample.txt .env
```

4. Edit fail `.env` dan tambah:
- OPENROUTER_API_KEY anda
- Nombor telefon pentadbir
- Konfigurasi model AI yang dikehendaki

5. Tambah fail `company_info.txt` dengan maklumat syarikat anda

6. Tambah imej QR code pembayaran di `assets/payment-qr.png`

## Penggunaan

1. Mulakan bot:
```bash
node app.js
```

2. Imbaskan kod QR yang dipaparkan di terminal menggunakan WhatsApp di telefon anda

3. Bot akan mula berfungsi dan bersedia untuk berinteraksi dengan pelanggan

## Arahan Bot

### Untuk Semua Pengguna
- `/products` - Lihat senarai produk
- `/product [nama]` - Lihat maklumat produk tertentu
- `/payment` - Dapatkan QR code pembayaran

### Untuk Pentadbir
- `/leads` - Lihat statistik leads
- `/leadstats` - Lihat statistik terperinci leads
- `/viewlead [nombor]` - Lihat maklumat lead tertentu
- `/models` - Lihat senarai model AI yang tersedia
- `/switchmodel [model]` - Tukar model AI
- `/prompt` - Lihat prompt semasa
- `/setprompt [model] [prompt]` - Tetapkan prompt untuk model tertentu

## Struktur Projek

```
wa-sales-ai-bot/
├── app.js              # Fail utama bot
├── .env               # Konfigurasi (tidak disertakan dalam git)
├── .env-sample.txt    # Contoh konfigurasi
├── company_info.txt   # Maklumat syarikat dan produk
├── leads.json         # Data leads
├── assets/           # Folder untuk aset (QR code, dll)
└── README.md         # Dokumentasi
```

## Keselamatan

- Jangan kongsi fail `.env` anda
- Pastikan nombor pentadbir ditambah dengan betul
- Simpan API key anda dengan selamat
- Backup data leads secara berkala

## Sokongan

Jika anda menghadapi masalah atau mempunyai soalan, sila buat isu di [GitHub Issues](https://github.com/xhanafix/wa-sales-ai.bot/issues).

## Lesen

MIT License

## Pengarang

- [xhanafix](https://github.com/xhanafix)
