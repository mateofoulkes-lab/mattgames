# Agent Sprite Forge — Matt Games adaptation

Auxiliary deterministic sprite-processing pipeline inspired by `0x0funky/agent-sprite-forge` (MIT).

Workflow used by Sprite Tester:
1. Approve a generated master sheet.
2. Split the master into a known grid.
3. Use alpha bounds to isolate each frame.
4. Resize with nearest-neighbor only.
5. Place every frame on a fixed transparent canvas using a bottom-center pivot.
6. Export per-action sprite sheets and `metadata.json`.
7. Validate in `/sprite-tester/`.

Current target sizes:
- Rabbit bazooka: 96x96 px
- Carrot projectile: 32x32 px
- Plasma ball: 16x16 px

Original project: https://github.com/0x0funky/agent-sprite-forge
License: MIT. See LICENSE.
