# Tower Chain

Prototype tower-defense / chain-reaction roguelite.

## Core loop
- One evolving tower protects a cupcake under a glass dome.
- Enemies arrive from the dark forest on the right and move toward the cupcake.
- The tower fires automatically.
- Every wave offers 3 random upgrades that combine into increasingly absurd builds.
- A short-lived crystal powerup grants an extra upgrade draft.
- Wave 60 ends with an oversized black dragon boss.

## Art pipeline
Generated master art is separated from runtime assets. Runtime atlases live in `assets/generated/` and are bootstrapped by `.github/workflows/towerchain-assets.yml` without recompressing them inside ChatGPT/GitHub tooling.

Current prototype: v0.1.1.
