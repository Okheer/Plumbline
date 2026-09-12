# Plumbline

Verifiable-Process-Reward Fund. The original idea and ten-phase plan are preserved in research/original-idea.md and docs/vpr-fund-10-phase-plan.md.

## Run the Phase 1 foundation

```bash
cd /home/mihir/Plumbline
nvm use
corepack pnpm install --frozen-lockfile
corepack pnpm dev
```

Open http://127.0.0.1:3000 . Backend: http://127.0.0.1:3001 . The frontend is intentionally a blank scaffold for Phase 1. The backend /network endpoint reads live Sepolia balance and block data. POST /intents/validate validates the shared trade-intent format without trading. No agent policies, risk enforcement, or reward oracle are implemented yet; those remain in their specified phases.

The backend reads the Alchemy URL from ignored .secrets/sepolia-rpc-url or SEPOLIA_RPC_URL. Never commit credentials. Save the Graph JWT interactively using `python3 scripts/configure-substreams-token.py`.

## Verify

```bash
corepack pnpm check
corepack pnpm proto:check
corepack pnpm build
forge build --root packages/contracts
cargo check --locked --manifest-path packages/oracle/Cargo.toml --target wasm32-unknown-unknown
python3 scripts/check-provider.py
```

Provider test requires network access and saved credentials; CI deliberately runs credential-free checks. Its first run may download the pinned ethereum-common package. Substreams CLI is currently installed at .tools/bin/substreams; release/checksum evidence is in docs/phase-1/substreams-install.txt. Node 22.23.2 and pnpm 10.17.1 are pinned. Rust dependencies are locked by packages/oracle/Cargo.lock.

## Packages

- packages/shared: validated intent/fill/mandate JSON types and boundary tests.
- packages/backend: running HTTP service and real Sepolia reads.
- packages/frontend: Next.js scaffolding only; complete dashboard remains Phase 10.
- packages/contracts: Solidity 0.8.30 event interface and pinned ENSv2 deployment ABIs.
- packages/oracle: Rust/WASM foundation and protobuf schemas; predicates remain Phase 6.

See docs/phase-1/INTERFACE.md for interface semantics and acceptance, STATUS.md for phase progress, and docs/ISSUES.md for observed errors and fixes. The phase plan is unchanged. Git commits remain manual.
