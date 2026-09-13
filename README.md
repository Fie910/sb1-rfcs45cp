# sb1-rfcs45cp

This project was created and pushed to GitHub using [Bolt to GitHub](https://github.com/mamertofabian/bolt-to-github) Chrome Extension.

## Description

[Add your project description here]

## Installation

[Add installation instructions here]

## Usage

[Add usage instructions here]

## Contributing

[Add contribution guidelines here]

## License

[Add license information here]

## Setup Push Notification
1. VAPID keys di Supabase Secret: `WEB_PUSH_VAPID_KEYS` (format JWK)
2. VAPID public key di `.env`: `VITE_WEB_PUSH_PUBLIC_KEY` (format base64url)
3. Database Webhook: INSERT `notifikasi` → Edge Function `send-push`
4. Test: insert row di `notifikasi` → push muncul dalam 1-3 detik