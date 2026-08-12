# CraftPix private importer

This helper processes CraftPix ZIP files **after they have been downloaded manually through the user's browser/account**.

It intentionally does **not** scrape, log in, automate downloads, or publish CraftPix source assets.

## Private workflow

1. Download CraftPix freebies normally in the browser.
2. Put the ZIP files in a private folder (for this project we use Google Drive `CraftPix Sprite Library/00_INCOMING_ZIPS`).
3. Run:

```bash
python import_downloads.py /path/to/incoming-zips /path/to/private-output
```

4. The script extracts each pack, hashes files, detects common animation names (`idle`, `walk`, `run`, `attack`, `shoot`, `death`, etc.) and writes `catalog.json`.
5. Keep the extracted library private. Only copy assets into a concrete game when they are actually used by that game.

## Why private?

CraftPix's freebie license permits use and modification in personal/commercial projects, but does not permit redistribution of source artwork as a reusable asset library. CraftPix also forbids using its licensed assets for training, testing, validating or improving AI systems. Check the current CraftPix license before use.

## Drive folders

- `00_INCOMING_ZIPS`: raw downloads from the browser.
- `01_PROCESSED_PRIVATE`: extracted/organized packs.
- `02_CATALOG_METADATA`: generated catalogs and metadata.
