# SuperCETES Wallet MVP

Minimal TypeScript web app that authenticates users with Privy (Google login) and spins up a Stellar wallet once they authenticate. Built with Vite + React to keep the stack light and framework-free.

## Prerequisites

- Node.js 18+
- npm (or pnpm/yarn if you prefer)
- A [Privy](https://www.privy.io/) application with Google login enabled

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure your env vars (Vite only exposes keys prefixed with `VITE_` to the client). Example `.env.local`:
   ```bash
   cat <<'EOF' > .env.local
   VITE_PRIVY_APP_ID=your_privy_app_id
   VITE_PRIVY_CLIENT_APP_ID=your_privy_client_id
   VITE_STELLAR_SECRET_KEY=your_stellar_secret
   VITE_STELLAR_PUBLIC_KEY=your_stellar_public
   EOF
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

Open the printed URL (default http://localhost:5173) to view the app. Use the "Sign in with Google" button to authenticate. On first login the app generates a Stellar keypair locally and displays the public and secret keys.

## Notes & Next Steps

- The generated Stellar keys are stored only in memory for demo purposes. Wire them into Privy embedded wallets or secure backend storage before shipping to production.
- Add persistence (e.g. Privy KV, database, or encrypted storage) and funding/faucet logic for real-world usage.
- Bring in a proper design system and routing once more screens are needed.
