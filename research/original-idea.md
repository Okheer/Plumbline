3. Verifiable-Process-Reward trading firm — dense on-chain oracles as the learning signal

Core: The Graph (Substreams = the process-reward oracle) · Privy (MPC experiment sleeves) · ENS (meritocratic org tree)

A self-improving multi-strategy fund where agents are trained/selected by verifiable process rewards, not self-reported P&L — a deployable company of agents whose improvement loop is cryptographically grounded.

Hard core:

Substreams as the symbolic reward oracle. Instead of sparse outcome P&L, a Substreams pipeline computes dense, intermediate, objectively-checkable signals per the VPR result: did the hedge actually neutralize delta, did realized slippage stay inside the model, did the quoted spread respect the risk limit? Each is an algorithmic oracle producing per-step reward, solving long-horizon credit assignment for the trading agents.
Hybrid reward = VPR + relative judge. Combine the verifiable process rewards (for checkable steps) with a RULER/LLM-as-judge relative ranking across N parallel trajectories (for the non-checkable reasoning quality) — the GRPO-style "only relative rankings matter" trick — into one training/selection signal.
Drift-gated capital. Monitor agent drift (behavioral degradation over long horizons) on live sleeves; a drift or drawdown breach triggers deallocation. Capital is routed by a bandit over process-reward-weighted, verified performance.
Custody + org chart. Each agent is a Privy MPC wallet with hard mandate caps (notional, instrument, venue), so a rogue agent can't exceed its sleeve and the allocator can't override signing. The fund→sleeve→agent hierarchy is an ENSv2 subname tree; "graduating" an agent mints a broader Enhanced-Access-Control role, "retiring" it revokes the role — which, wired to Privy, instantly kills its signing authority.

Company thesis: the platform to spin up and run an autonomous fund where capital provably flows to agents that are verifiably good, with on-chain-reconstructed attribution for LPs. The VPR-over-on-chain-oracles fusion is the genuinely new primitive.

Stretch — adversarial-debate decision desk with confidential adjudication
1inch Aqua/SwapVM · Chainlink CRE (TEE) · Arc (USDC)
Multiple adversarial agents debate a trade thesis (multi-agent debate, framed as negotiation-via-RLVR for adversarial surplus extraction); a judge adjudicates inside a TEE so the debate transcript and the winning strategy can't be copied or gamed, and the verdict executes via a custom SwapVM settlement rule with Arc settling. Highest conceptual novelty (auction-theoretic view of the agents' competing bids), highest execution risk — offered as a direction, not a 48-hour target.

Honest read against your two axes. #1 is the strongest standalone company — verifiable inference with correct incentives is broadly useful beyond trading — and the mechanism (repeated-game slashing) is a paper-grade contribution you can demo with a small bond simulation. #2 is the most impressive to a cryptographically literate judge because it closes a gap in a named 2026 result (tool-trace integrity), and a vertical slice — one attested price read + one SwapVM fill + HCS ordering — is buildable in the weekend. #3 is the best "deployable agent company" story and the VPR-via-Substreams reward oracle is the freshest idea here, though a convincing demo means faking the training loop and showing the reward oracle + drift-gated allocation live.

Tell me which one you're committing to and your sharpest axis — TEE/attestation, mechanism design/game theory, streaming-systems/Substreams, or RL/reward-modeling — and I'll give you the component-level architecture, the exact mock/real line for the demo, and a 48-hour build sequence.

Expand more on 3

Here's the full build-out of the Verifiable-Process-Reward trading firm — the architecture, the reward oracle that makes it novel, the training/selection loop, and the honest mock/real line for a 48-hour demo. Three sponsors stay at the core: The Graph (Substreams) is the reward oracle, Privy is custody + enforcement, ENS is the org chart and lifecycle. Execution venue is deliberately peripheral so it doesn't dilute the core.

The thesis in one line

A population of trading-agent policies that are selected and improved by rewards which are recomputable by anyone from on-chain state — so the fund's entire improvement loop is verifiable, and capital provably flows to agents that are good rather than agents that claim to be good. That last property is the moat: an off-chain agent fund can show you a P&L curve, but it can't hand you a reward signal you can independently reproduce.

Layer 1 — The policy model (what an "agent" actually is)

Each agent is a policy π: observation → trade intent. The observation is a feature vector derived from indexed market state; the intent is a structured, checkable object — instrument, side, size, and explicit self-declared limits (max slippage δ, target post-trade delta, risk cap). The structure matters: because the agent commits to limits before acting, those commitments become the things the reward oracle later checks against reality. An LLM sits inside the policy (reasoning over the context, emitting the structured intent), wrapped so the output is deterministic to parse.

Be clear-eyed about "training": you have two timescales, and only the fast one is live in a hackathon. Fast loop = selection/allocation (no weight changes — capital routing over a live population). Slow loop = policy improvement (offline GRPO-style updates or prompt/tool-policy evolution over logged trajectories). Full RLVR weight training on a frontier model in 48h is not real; the demo runs the fast loop live and shows one offline update to prove the loop closes.

Layer 2 — The Verifiable Process Reward oracle (the novel core)

This is where the freshness lives. The VPR result says: instead of a single sparse outcome reward, densely reward intermediate actions that a symbolic or algorithmic oracle can objectively check — which is what fixes long-horizon credit assignment, where a trajectory can fail despite many correct steps or succeed despite flawed ones. On-chain state is a perfect algorithmic oracle, and Substreams is how you compute it deterministically.

Define a set of per-step verifiable predicates, each a pure function of indexed on-chain data:

Hedge efficacy — after a hedging step, reconstructed portfolio delta must sit within ε of the agent's declared target. Reward scales with −|Δ_post − Δ_target|.
Slippage adherence — realized fill price vs. the executable price implied by pool/orderbook state at submission block, checked against the agent's own declared δ. Penalize breach.
Risk-limit respect — post-trade notional / leverage / VaR against the mandate cap; a breach is both negative reward and a mandate event (see Layer 6).
Route regret — chosen execution path vs. best path reconstructable from indexed liquidity; reward is a bounded regret term.
Staleness discipline — did the agent act on a fresh oracle (deviation < δ, age < τ) or a stale one.

The critical property: any judge re-running the same Substreams module over the same block range gets the identical reward vector. Determinism is verifiability. Concretely the module graph is map_fills (extract fills per agent wallet) → store_positions (maintain running position state) → map_marks (oracle prices per block) → map_process_rewards (join the above, emit a reward vector keyed by (agent_id, step_id)). Because Substreams modules are deterministic and composable, the reward oracle is reproducible infrastructure — and that composability is what lets the predicate library become a standard other funds build on.

Aggregate the dense per-step rewards into a discounted trajectory return, and keep the per-step decomposition for advantages.

Layer 3 — The hybrid reward (anti-reward-hacking)

VPR only covers what's checkable. Reasoning quality — was the thesis sound, not just the execution clean — isn't a pure predicate, so layer a RULER-style LLM-as-judge relative ranking on top: generate N trajectories for the same scenario, have a judge rank them 0–1 relative to each other, and use the group-normalized advantage (the GRPO trick where only relative rankings matter). For the training method itself, the Flow-GRPO / in-the-flow approach fits: break the trajectory into single-turn updates and propagate a verifiable trajectory-level signal back to each step.

The important design point: r_total = α·r_VPR + β·r_judge, with VPR as the anchor. A pure LLM-judge reward is hackable — an agent can learn to write a beautiful losing thesis. Grounding the reward in verifiable on-chain outcomes means the judge only ever breaks ties among trajectories that already passed reality's checks. VPR is the thing that keeps the soft reward honest.

Layer 4 — Capital allocation as online optimization

Allocation is a non-stationary, adversarial bandit — agent returns are correlated and drift over time — so a plain UCB is the wrong tool. Use EXP3 or discounted Thompson sampling: each agent is an arm, its reward is the risk-adjusted, process-reward-weighted verified return, and new/unproven agents get an explicit exploration budget (allocate-to-learn, then concentrate). Wrap the whole thing in a portfolio constraint — risk-parity or fractional-Kelly sizing over the agents' realized return covariance (with shrinkage, because the covariance estimate is noisy with few agents) under a hard fund-level drawdown cap. A drawdown breach deallocates immediately.

Run agent-drift monitoring as a safety layer: track the behavioral-degradation metric on each live sleeve, and treat a drift breach as a retire signal even if recent P&L looks fine — degradation typically precedes losses.

Layer 5 — Execution (peripheral)

Intents route to a DEX/venue for fills. Keep this thin and swappable; it's plumbing, not the contribution. (If you want it to earn a fourth prize, a custom SwapVM opcode enforcing the declared risk limit in bytecode is a clean bolt-on — but it's not part of the three-sponsor core.)

Layer 6 — Custody and enforcement (Privy)

Each agent controls a Privy MPC wallet — key material exists only as threshold shares, never reconstructed — governed by a policy engine encoding the mandate: max notional, instrument whitelist, venue whitelist, rate limits, cooldowns, human-in-the-loop above a value threshold. The structural guarantee is a separation of powers: the allocator can move capital between sleeves but is cryptographically incapable of overriding an agent's signing policy, and an agent is incapable of exceeding its mandate. So a rogue allocator can't drain a sleeve and a rogue agent can't blow its cap — neither failure is a single point. Session keys are scoped and time-boxed per mandate.

Layer 7 — Org chart and lifecycle (ENS)

The firm's structure is an ENSv2 subname tree: fund.eth → momentum.fund.eth → agent-07.momentum.fund.eth. Each agent's mandate lives as an Enhanced Access Control role on its subname, with limits as role parameters. The lifecycle maps to role operations:

Hire = mint a subname with a bounded role (small caps, exploration budget).
Promote = widen the role (bigger caps, more instruments) as the agent accumulates verified process-reward history.
Fire = revoke the role — and because the role is wired to the Privy policy, revocation instantly kills the agent's signing authority.

The agent's verified track record attaches to its ENS name as a portable, queryable artifact (ERC-8004-style), so a graduated agent carries provable history rather than resetting to zero.

End-to-end data flow

Substreams-derived features → policy (LLM) emits structured intent with declared limits → Privy policy check → MPC sign → venue execution → on-chain fills → Substreams process-reward oracle emits per-step reward vector → {fast: EXP3 allocator reweights capital; slow: Flow-GRPO offline update} + drift monitor → ENS role changes → Privy policy re-sync. The loop is closed and every reward in it is reproducible.

The demo slice — where to draw the mock/real line

Real, on stage:

The Substreams process-reward oracle running on a testnet with 2–3 live agents trading a couple of instruments.
The showpiece: re-run the reward module over the same block range and show it produces a byte-identical reward vector — verifiable reward, live.
The EXP3 allocator visibly reweighting capital toward the agent with better verified process rewards.
The lifecycle: revoke an ENS role and show the corresponding Privy wallet's next signing attempt fail in real time.

Mocked / compressed (say so openly):

The weight-level RLVR fine-tune — show a single offline Flow-GRPO update on logged trajectories, or prompt evolution, rather than a full training run.
Population size (3–4 agents, not hundreds) and long-horizon drift (compress the timescale).

That line is defensible: you're demonstrating a working, verifiable reward-and-allocation loop, and being honest that the training flywheel is shown as one turn of the crank.

A 48-hour sequence
H0–8: Substreams modules — fills, positions, marks, and one or two process-reward predicates on a testnet. Prove determinism (same range → same output) first, because it's the whole thesis.
H8–16: policy wrapper (LLM → structured intent), Privy MPC wallets + policy caps, execution against a testnet venue.
H16–28: reward join + hybrid judge; EXP3 allocator over the live agents.
H28–40: ENS subname tree + role→Privy policy sync; hire/promote/fire; drift-monitor stub.
H40–48: the reproducibility demo, a dashboard, and a dry run.
Failure modes to preempt (judges will probe these)

Reward hacking — an agent games a single predicate — is blunted by anchoring to real fills, using adversarial predicates, and cross-checking with the judge. Oracle manipulation feeding the rewards is handled by the staleness/deviation predicate itself. Bandit instability under correlated agents is handled by covariance shrinkage and EXP3's non-stationarity guarantees. And the honest limitation: verifiable process rewards only cover the checkable portion of behavior; open-ended reasoning still leans on the softer judge signal, which is exactly why VPR anchors it rather than the other way around.

If you commit to this, tell me your sharpest axis — Substreams/streaming-systems, RL/reward-modeling, or MPC/key-management — and I'll take that one sub-component down to a component-level spec and starter scaffold so you can start building the critical path first.