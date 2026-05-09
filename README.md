# VYNX

**The ultimate Solana-native Creator Card platform.**

A beautiful, powerful and fully decentralized Linktree + OnlyFans + Gumroad built on Solana. Creators get their own personal page where fans can subscribe, book video calls, buy digital content, and tip — all through lightning-fast Solana Blinks.

---

## ✨ Features

- **Creator Cards** — Personal pages (`vynx.me/@username`) with full customization
- **Subscriptions** — Recurring payments powered by Streamflow
- **Book Video Calls** — Paid appointments with instant Blink checkout
- **Digital Store** — Sell photos, videos, packs, presets, courses, etc.
- **Instant Tips** — One-click tipping via Blinks
- **Gated Access** — NFT-based or subscription-gated content
- **Viral Blinks** — Every product, subscription and booking slot has a shareable Solana Action
- **Wallet-first experience** — No emails, no passwords, no Stripe

---

## 🛠 Tech Stack

- **Frontend** — Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **UI** — shadcn/ui + Framer Motion
- **Blockchain** — Solana + Anchor
- **Blinks & Actions** — Solana Actions + Dialect
- **Payments** — Streamflow (subscriptions) + Native SOL/USDC transfers
- **Database** — Supabase (Postgres)
- **Storage** — Shadow Drive + Arweave
- **NFTs** — Metaplex Core
- **Video Calls** — Solchat + Daily.co integration
- **Authentication** — Solana Wallet Adapter

---

## 🚀 Quick Start

```bash
git clone https://github.com/zuyux/vynx.git
cd vynx
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

### Smart Contracts (Anchor)

```bash
cd programs/vynx
anchor build
anchor test
```

---

## 📁 Project Structure

```
vynx/
├── frontend/              # Next.js application
├── programs/              # Anchor Solana programs
├── packages/              # Shared utilities & SDK
├── actions/               # Solana Actions & Blinks
└── docs/
```

---

## ✨ Core Philosophy

- **Creator-first**: Maximum revenue (near 95-98% goes to creators)
- **Mobile & Social native**: Designed to go viral on X, Telegram and Instagram
- **Composability**: Everything is built as reusable Solana Actions
- **Ownership**: Fans can own access as NFTs

---

## Roadmap

### MVP (Current)
- Creator profile & customizable card
- Digital product sales via Blinks
- Subscription system (Streamflow)
- Booking system for video calls
- Basic analytics

### V2
- Advanced creator dashboard
- Tiered memberships with benefits
- Community features
- Affiliate system
- Mobile app (Solana Mobile Stack)

### V3
- Full decentralized storage
- On-chain escrow for high-value bookings
- Creator token launches
- AI-powered recommendation system

---

## Contributing

We welcome contributions! Feel free to open issues or submit PRs.

1. Fork the repo
2. Create a feature branch
3. Commit your changes
4. Open a Pull Request

---

## Authors

- **@anthozg** — Developer, Product & Design
- **@fabohax** — Lead Developer

---

## License

This project is licensed under the **GNU AGPLv3** — see [LICENSE](LICENSE) for details.

---

## Links

- Website: [vynx.me](https://vynx.me)
- X / Twitter: [@vynx_sol](https://x.com/vynxme)

---

**Built with open ❤️**
```
