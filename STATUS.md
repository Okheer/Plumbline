# Project status

Last updated: 2026-09-12

## Manual commit preparation
- User requested excluding `docs/` from Git; `.gitignore` now excludes it while preserving the files locally, along with generated output and temporary files. Documentation referenced here will therefore be absent from a fresh clone.
- No staging or commit performed. This housekeeping change does not establish any phase exit criterion.

## Current state
Project context documents created from the original idea and the user's ten-phase plan. Both source documents are preserved verbatim. Phase 1 has started with read-only provider and environment checks. No phase has passed its exit criteria.

## Phase progress
| Phase | Status |
|---|---|
| 1 — Foundations, environment, provider gate | In progress — live provider gate pending |
| 2 — ENSv2 org chart and identity | Not started |
| 3 — ENS authority and mandates | Not started |
| 4 — Aqua liquidity | Not started |
| 5 — SwapVM execution and enforcement | Not started |
| 6 — Substreams reward oracle | Not started |
| 7 — Live Graph data plane and subgraph | Not started |
| 8 — Agent policy, hybrid judge, offline improvement | Not started |
| 9 — Allocation and lifecycle automation | Not started |
| 10 — Frontend, reproducibility demo, submission | Not started |

## Next implementation step
Verify actual Sepolia Substreams/Firehose access through The Graph Market or Pinax, with a successful `substreams run` returning Sepolia blocks. Record provider, authentication method (no secret values), command, and evidence. This is the plan's hour-0 gate, not an established capability.
Then carry out remaining Phase 1 environment, funded test wallets, monorepo/CI, and agreed intent/fill/mandate schemas.

## Unresolved dependencies
Provider access, accounts, funding, current ENSv2 deployment interfaces, Aqua/SwapVM integration details, and actual sponsor qualification rules have not been verified during this task. These are pending checks, not observed failures. Backend language, model, datastore choice, instrument universe, numerical reward definitions, and mandate values remain open within the supplied plan.

## Documentation validation
See docs/SELF-CHECK.md for source preservation, coverage checks, and scope reconciliation. No application test or on-chain execution is claimed.

## Phase 1 initial findings (2026-09-12)
- User selected `/home/mihir/Plumbline` as the single working copy.
- Plan copies match the supplied download byte-for-byte (SHA-256 c2e80aa09be5745336971ca709f3655abe376abfef32d4aedc18c1c4ce27dace).
- Pinax public endpoint catalog lists Ethereum Sepolia Substreams; actual authenticated streaming remains untested.
- Substreams CLI, protoc, and buf are not found on PATH. Foundry, Rust, Node/npm/pnpm, Docker, and Git executables are present; full usability/version checks remain pending.
- SUBSTREAMS_API_TOKEN, SUBSTREAMS_API_KEY, and SEPOLIA_RPC_URL are unset in the inspected shell. No conclusion is drawn about credentials stored elsewhere.
- Asked user which provider account they already have. No provider chosen, credentials generated, or dependencies installed.
- Manual commit reminder scheduled; no git commit performed.
- Issue details: docs/ISSUES.md.

## Phase 1 continuation
- User completed Graph Market onboarding and selected existing test wallets; key creation was not visible on the inspected account (API keys page said no keys).
- Awaiting locally saved JWT, public wallet addresses/RPC provider, and backend-language decision. Plan explicitly permits Python or TypeScript; no language has been assumed.
- Confirmed installed Foundry 1.5.1, Rust 1.95.0, wasm32-unknown-unknown target, Node 20.20.2, Docker CLI 29.6.1. Docker daemon and Solidity 0.8.30 availability remain unchecked.
- Installed and executed official Substreams v1.22.0 at `.tools/bin/substreams`; archive SHA-256 matched the published checksum. Evidence: docs/phase-1/substreams-install.txt.
- Credential helper: `python3 scripts/configure-substreams-token.py`; saves JWT under ignored .secrets/ using owner-only permissions.
- Sepolia endpoint documented by Substreams: sepolia.eth.streamingfast.io:443. Authenticated run remains pending.
- ENSv2 canonical deployment source located: https://docs.ens.domains/learn/deployments/ . Addresses/ABIs are not yet frozen or checked on-chain.
- Manual commit reminder delivered and paused; no automated commits.

- Verified ethereum-common@v0.3.3 exposes all_events with sf.ethereum.type.v2.Block input; module hash 433686393b184c57628660f7dbe6cfed4d72a9e9. Local JWT file still absent at last check.

## Latest verified progress
- Backend choice resolved: TypeScript + pnpm, selected under the user's delegation after checking 1inch/ENS integrations. Rust/Substreams and Solidity/Foundry retained.
- Alchemy RPC verified as Sepolia (chain ID 11155111), block 11690532. Existing wallet balance: 0.170522785617884545 test ETH. Evidence: docs/phase-1/rpc-wallet-check.json.
- RPC URL stored only in ignored .secrets/sepolia-rpc-url with owner-only permissions. No transactions sent.
- Graph JWT still missing locally at latest check. Run `python3 scripts/configure-substreams-token.py` from the user terminal to provide it privately.
- Provider gate remains unpassed; no monorepo/application scaffold or frozen schema is claimed. Node upgrade to >=22 is required for the official 1inch SDK workspace; additional agent-wallet funding remains unresolved.
