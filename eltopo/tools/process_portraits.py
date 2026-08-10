from pathlib import Path
from PIL import Image, ImageFile
import json

ImageFile.LOAD_TRUNCATED_IMAGES = True

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'portraitspng'
OUT = ROOT / 'portraits'
OUT.mkdir(parents=True, exist_ok=True)

manifest = []
for src in sorted([*SRC.glob('*.png'), *SRC.glob('*.jpg'), *SRC.glob('*.jpeg')]):
    names = src.stem.split('__')
    image = Image.open(src).convert('RGB')
    w, h = image.size
    boxes = [
        (0, 0, w // 2, h // 2),
        (w // 2, 0, w, h // 2),
        (0, h // 2, w // 2, h),
        (w // 2, h // 2, w, h),
    ]
    for i, box in enumerate(boxes, 1):
        name = names[i - 1] if len(names) == 4 else f'{src.stem}-{i}'
        out = OUT / f'{name}.jpg'
        crop = image.crop(box).resize((512, 512), Image.Resampling.LANCZOS)
        crop.save(out, 'JPEG', quality=88, optimize=True, progressive=True)
        manifest.append({'source': src.name, 'slot': i, 'name': name, 'file': f'portraits/{out.name}'})

(ROOT / 'avatar-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Processed {len(manifest)} portraits from {len(set(x["source"] for x in manifest))} mosaics')
