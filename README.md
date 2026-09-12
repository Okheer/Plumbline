# Verifiable-Process-Reward Fund

Working descriptive title; the user has not selected a final brand name.

A self-improving multi-strategy trading fund in which agents commit to structured trade intents, execution enforces authority and limits, and on-chain activity produces independently recomputable process rewards. A hybrid off-chain judge, capital allocator, and drift monitor close the improvement and lifecycle loop.

## Start here
- `AGENTS.md`: instructions for working on this project.
- `STATUS.md`: current progress, blockers, and next step.
- `docs/IDEA.md`: faithful concept summary and boundaries.
- `docs/MVP.md`: all ten phases and their acceptance checklist.
- `docs/vpr-fund-10-phase-plan.md`: exact user-supplied implementation plan.
- `docs/DECISIONS.md`: source differences, fixed constraints, and open choices.
- `docs/REFERENCES.md`: source provenance and external verification queue.
- `research/original-idea.md`: exact original pasted proposal, including its conversational context.

## Planned implementation
All layers run on Sepolia. The Graph/Substreams computes the reward oracle and supplies live data; 1inch Aqua and a custom SwapVM provide execution; ENSv2 provides hierarchical identity and trade authority. Per-agent backend signers/KMS supply the custody component under the phase plan. Supporting services provide LLM policies and judging, allocation, storage, and a React/Next.js dashboard.

The complete ten-phase plan is the build scope. Begin with Phase 1's Sepolia Substreams provider gate, then follow the phases in order. No contracts, services, toolchains, deployments, or application tests have been created by this documentation task. Setup and run commands will be added when implemented.

## Phase 1 setup in progress
Working directory: `/home/mihir/Plumbline`. See STATUS.md and docs/ISSUES.md for blockers and evidence.

After creating a Graph Market API key, save its JWT privately from your own terminal:

```bash
python3 /home/mihir/Plumbline/scripts/configure-substreams-token.py
```

The prompt hides input. Local credentials and downloaded tools are excluded from Git. Never put keys in documentation or screenshots. No authenticated provider test has passed yet.
