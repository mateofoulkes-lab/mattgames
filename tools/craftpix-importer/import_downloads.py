#!/usr/bin/env python3
"""Private CraftPix ZIP importer.

This tool is intentionally for private/local processing only. It does not scrape,
automate login, or download CraftPix assets. Put ZIPs you downloaded through your
browser into an input folder, then run this script to extract and catalogue them.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import zipfile
from pathlib import Path

ANIM_WORDS = [
    "idle", "walk", "walking", "run", "running", "jump", "fall", "attack",
    "shoot", "fire", "hurt", "hit", "death", "dead", "die", "cast", "spell",
    "block", "dash", "roll", "climb", "swim", "fly", "flying", "turn",
]
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def slug(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-") or "pack"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def detect_animation(path: Path) -> str | None:
    s = " ".join([path.stem, *path.parts]).lower().replace("_", " ").replace("-", " ")
    for word in ANIM_WORDS:
        if re.search(rf"\b{re.escape(word)}\b", s):
            aliases = {"walking": "walk", "running": "run", "dead": "death", "die": "death", "fire": "shoot"}
            return aliases.get(word, word)
    return None


def safe_extract(zf: zipfile.ZipFile, target: Path) -> None:
    target = target.resolve()
    for member in zf.infolist():
        dest = (target / member.filename).resolve()
        if not str(dest).startswith(str(target)):
            raise ValueError(f"Unsafe ZIP path: {member.filename}")
    zf.extractall(target)


def process_zip(zip_path: Path, output_root: Path) -> dict:
    pack_id = slug(zip_path.stem)
    pack_dir = output_root / pack_id
    if pack_dir.exists():
        shutil.rmtree(pack_dir)
    pack_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zip_path) as zf:
        safe_extract(zf, pack_dir)

    files = []
    animations: dict[str, list[str]] = {}
    for p in sorted(pack_dir.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(pack_dir).as_posix()
        item = {
            "path": rel,
            "size": p.stat().st_size,
            "sha256": sha256(p),
            "type": p.suffix.lower().lstrip("."),
        }
        if p.suffix.lower() in IMAGE_EXTS:
            anim = detect_animation(p)
            item["animation"] = anim
            if anim:
                animations.setdefault(anim, []).append(rel)
        files.append(item)

    return {
        "id": pack_id,
        "sourceZip": zip_path.name,
        "fileCount": len(files),
        "animations": animations,
        "files": files,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path, help="Folder containing CraftPix ZIPs")
    ap.add_argument("output", type=Path, help="PRIVATE output folder")
    ap.add_argument("--manifest", type=Path, default=None)
    args = ap.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    packs = []
    for z in sorted(args.input.glob("*.zip")):
        try:
            packs.append(process_zip(z, args.output))
            print(f"OK  {z.name}")
        except Exception as exc:
            print(f"ERR {z.name}: {exc}")

    manifest_path = args.manifest or (args.output / "catalog.json")
    manifest_path.write_text(json.dumps({"packs": packs}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\nCatalog: {manifest_path}")
    print(f"Packs: {len(packs)}")


if __name__ == "__main__":
    main()
