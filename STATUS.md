# Project status

Updated: 2026-09-13. Working copy: /home/mihir/Plumbline.

## Phase 1 exit criteria satisfied
- Live authenticated `substreams run` returned three Sepolia blocks; hashes independently matched RPC. Evidence: docs/phase-1/provider-gate.json.
- Both user-supplied test wallets have positive Sepolia ETH balances. Evidence: docs/phase-1/wallets.json. No transfers or wallet creation performed.
- Intent/fill/mandate interface v1 accepted by the user and frozen by hashes: docs/phase-1/schema-v1-lock.json and INTERFACE.md.
- Monorepo and CI scaffolding exist. Node/pnpm, Foundry/Solidity, Rust/WASM, Buf, Substreams, and ENSjs/viem checks passed locally. ENSv2 deployment ABIs pinned and code presence verified.
- Final checks passed: pnpm check (type checks, 3 boundary tests, SDK imports), pnpm proto:check, pnpm build, forge build, cargo check --locked --target wasm32-unknown-unknown.
- Premature styled frontend removed; frontend now contains only scaffold/layout and a blank route. Complete frontend belongs to Phase 10.

## Phase 2 — in progress, not deployed
- Approved setup: plumbline.eth, fund owner 0x89cE79730f8a1F4B05B4EF9334ef4f53E237dE20, agent owner 0x33a4De190Ffa59deC8260880bc96744D8Ac38177.
- Read-only Sepolia preflight found plumbline.eth available at block 11690690; availability must be checked again before registration.
- Implemented unsigned transaction builders for UserRegistry factory deployment, parent links, child registration, and agent-owned PermissionedResolver initialization with address and ENSIP-26 agent-context.
- Backend typecheck and local Sepolia fork integration passed. Evidence: docs/phase-2/fork-test.txt. The test exercises actual pinned ENSv2 contracts with locally impersonated accounts; it sends no live Sepolia transactions.
- Pending: MetaMask signing handoff and registration duration selection; complete one-command mint orchestration; live root/strategy/agent registration and universal resolution checks. Phase 2 exit criteria are NOT yet satisfied.
- Root commit/reveal and exact mock-token payment implemented and tested on the fork, including premature reveal rejection and canonical universal resolution. Accepted live identity: agent-01.momentum.plumbline.eth; wallet app: MetaMask.
- No Phase 3 authority or mandate implementation started.

## Limits
CI workflow is configured and its local checks pass; a remote GitHub Actions run has not been verified. ENS code presence does not establish all Phase 2 permissions/proxy behavior. No trades, fund allocation, model training, or reward predicates implemented. Further agent wallets can be assigned as the population is defined; no final population count inferred from the two supplied addresses.

Issue history: docs/ISSUES.md. Original idea and phase plan unchanged. Commits remain manual.
