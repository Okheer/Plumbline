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
- Wrapped receipt matching tests passed. Phase 3 progress is tracked below.

## Limits
CI workflow is configured and its local checks pass; a remote GitHub Actions run has not been verified. The only trade is the Phase 4 manual Sepolia exit-criteria fill; automated agent execution begins in Phase 5. Fund allocation, model training, and reward predicates are not implemented. Further agent wallets can be assigned as the population is defined; no final population count inferred from the two supplied addresses.

Issue history: docs/ISSUES.md. Original idea and phase plan unchanged. Commits remain manual.

## Phase 3 — exit criteria satisfied
- The fund wallet is the initial allocator/admin. Live mandate version 2 sets 50 bps maximum slippage, a 200 quote-token maximum notional encoded at E18, ENS Sepolia MockUSDC as the demonstration whitelist, and a 300-second maximum oracle age.
- The strategy registry was migrated to one initialized with the `AGENT_ACTIVE` admin role. The migration preserved the public ENS hierarchy, agent owner, resolver and expiry. All five migration receipts succeeded. Evidence: `docs/phase-3/migration-verification.json`.
- `ENSAuthorityAdapter` is deployed at `0x9e1b5fcbee4f10298b1b0243fc31dbecb3c1640c`, and `agent-01.momentum.plumbline.eth` is enrolled. The adapter resolves the current hierarchy and binds authorization to the current owner, registry resource and resolver.
- The live lifecycle was verified at each receipt block: mandate version 1/inactive, hire/active, promotion to version 2 and a 200-token cap/active, then fire/inactive. The final on-chain state is inactive. Evidence: `docs/phase-3/final-verification.json` and `demo-step-{0,1,2,3}.json`.
- Live read simulations confirm the allocator can edit mandate keys while both the agent and an unrelated address are rejected. The agent retains scoped control of its identity keys.
- Six adapter unit tests pass. The pinned Sepolia fork integration passes actual ENS registry migration, grant/revoke/regrant, versioned promotion, resolver permission separation, transfer invalidation and expiry invalidation. Evidence: `docs/phase-3/fork-test.txt`.
- Final checks passed: `pnpm authority:verify`, strict TypeScript checks, `pnpm identity:receipt-test`, and `forge test --root packages/contracts` (6 Phase 3 tests).

## Phase 4 — exit criteria satisfied
- The live Sepolia Aqua registry at `0x1111113ccf1426a8e30e2bff5e005d929bf6a90a` has 5,619 bytes of runtime code. Its code hash exactly matches the official mainnet Aqua deployment. Evidence: `docs/phase-4/aqua-source.json`.
- The selected test instruments are pWETH `0xD2C72019eAA18019B07c286b7421f549f4D56DBC` and ENS MockUSDC `0x768F42455A2D082E23ceeF7d51e5787C82d67a39`. The market is `0xb4ef510ABb71aeaCe4128B58Df54f62c042b6CF1` with a 30 bps fee.
- The fund wallet used Aqua SDK 0.3.4 to `ship()` virtual liquidity of 10 pWETH and 20,000 MockUSDC while the tokens remained in its wallet under Aqua allowances. The live strategy hash is `0x6f5bdcc1d384c891249e6bd43e0b96fae596ffb1222fdaf3b1124fa5101e4c0b`.
- The agent wallet manually swapped 0.1 pWETH for 197.431606 MockUSDC in transaction `0x03dd4e748f5e7b317fa53a33a40c7fca5e6f4471494274dad91da39ddce4fdc9`. Final Aqua virtual balances are 10.1 pWETH and 19,802.568394 MockUSDC, exactly matching wallet movement and the emitted swap event.
- `pnpm aqua:verify` independently checks all ten receipts, deployed code, market-to-Aqua binding, token metadata, strategy balances, wallet balances, and the swap event. The exact flow also passed against a Sepolia fork; two focused local market tests cover movement and minimum-output rejection. Evidence: `docs/phase-4/live-market.json` and `packages/contracts/deployments/sepolia.phase4.json`.
- Phase 5 remains separate: the manual Phase 4 swap calls the Aqua market directly. No SwapVM router or ENS opcode is claimed yet.
