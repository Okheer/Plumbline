# Project status

Updated: 2026-09-13. Working copy: /home/mihir/Plumbline.

## Phase 1 exit criteria satisfied
- Live authenticated `substreams run` returned three Sepolia blocks; hashes independently matched RPC. Evidence: docs/phase-1/provider-gate.json.
- Both user-supplied test wallets have positive Sepolia ETH balances. Evidence: docs/phase-1/wallets.json. No transfers or wallet creation performed.
- Intent/fill/mandate interface v1 accepted by the user and frozen by hashes: docs/phase-1/schema-v1-lock.json and INTERFACE.md.
- Monorepo and CI scaffolding exist. Node/pnpm, Foundry/Solidity, Rust/WASM, Buf, Substreams, and ENSjs/viem checks passed locally. ENSv2 deployment ABIs pinned and code presence verified.
- Final checks passed: pnpm check (type checks, 3 boundary tests, SDK imports), pnpm proto:check, pnpm build, forge build, cargo check --locked --target wasm32-unknown-unknown.
- Premature styled frontend removed; frontend now contains only scaffold/layout and a blank route. Complete frontend belongs to Phase 10.

## Phase 2 — exit criteria satisfied
- All 13 user-signed Sepolia transactions succeeded. At block 11691042, Universal Resolver resolved plumbline.eth and momentum.plumbline.eth to the fund wallet and agent-01.momentum.plumbline.eth to the agent wallet.
- Decoded identity records matched each name, role and chain. Evidence: docs/phase-2/live-registration.json. Recheck with pnpm identity:verify.
- Registry proxies and separate PermissionedResolvers are deployed. The pinned local fork test passed root registration, hierarchy resolution and unauthorized agent-record update rejection.
- Reusable mint command: pnpm identity:mint --mint-agent <label> --agent-owner <public-address>. It prepares two MetaMask transactions under momentum.plumbline.eth. Unsigned preparation passed; underlying deployment and registration operations passed on the fork. No additional live agent was minted for testing.
- Wrapped receipt matching tests passed. No Phase 3 implementation started.

## Limits
CI workflow is configured and its local checks pass; a remote GitHub Actions run has not been verified. No trades, fund allocation, model training, or reward predicates implemented. Further agent wallets can be assigned as the population is defined; no final population count inferred from the two supplied addresses.

Issue history: docs/ISSUES.md. Original idea and phase plan unchanged. Commits remain manual.

## Phase 3 — implementation in progress
- Fund wallet selected as initial allocator/admin. Demo defaults: 50 bps slippage, 100 quote tokens (E18), 300-second oracle age. Actual instrument whitelist remains Phase 4; no live mandate or active role set.
- Implemented ENSAuthorityAdapter, lifecycle grant/revoke builders, scoped identity/mandate permissions and mandate record encoding.
- Six adapter unit tests pass with registry fixtures. Separate pinned Sepolia fork test passes actual ENS role grant/revoke, allocator-only mandate editing, retained agent identity edits, and rejected allocator identity edits. Evidence: docs/phase-3/fork-test.txt.
- Live migration required: existing strategy registry lacks AGENT_ACTIVE admin, and existing resolver grants broad text permissions. Replace the strategy registry while preserving names/resolver and migrate records to scoped permissions. Agent token ID/registry address will change; source namehash remains the same.
- Remaining: promotion semantics and tests; adapter integration against real ENS transfer/expiry behavior; reviewable migration/deployment signing flow; live adapter and grant/revoke evidence. Phase 3 is not complete.
