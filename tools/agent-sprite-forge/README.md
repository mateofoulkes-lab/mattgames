# Agent Sprite Forge — Matt Games adaptation

Auxiliary deterministic sprite-processing pipeline inspired by `0x0funky/agent-sprite-forge` (MIT).

Workflow used by Sprite Tester:
1. Approve a generated master sheet once. The art is frozen after approval.
2. Split the master into a known grid.
3. Select exact source cells with explicit `action:start:count` layout; blank cells may be skipped.
4. Use alpha bounds to isolate each frame.
5. Resize with nearest-neighbor only.
6. Place every frame on a fixed transparent canvas using a bottom-center pivot.
7. Export per-action sprite sheets or small sheet segments plus `metadata.json`.
8. Validate motion, scale and pivot in `/sprite-tester/`.

Current target sizes:
- Rabbit bazooka: 96x96 px
- Carrot projectile: 32x32 px
- Plasma ball: 16x16 px

Example rabbit command:
`python process_sheet.py master.png out --cols 4 --rows 6 --size 96 --id rabbit --layout walk:0:8,shoot:8:6,death:16:7 --segment-size 2`

Original project: https://github.com/0x0funky/agent-sprite-forge
License: MIT. See LICENSE.
