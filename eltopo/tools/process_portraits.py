from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'portraitspng'
OUT = ROOT / 'portraits'
OUT.mkdir(parents=True, exist_ok=True)

MAPPING = {
    '1.jpg': ['monja-gladys', 'kenji-turista', 'braian-9', 'actor-dramatico'],
    '2.jpg': ['chef-bigotes', 'taxista-canchero', 'influencer-fachero', 'mago-elegante'],
    '3.jpg': ['policia-retirado', 'profesor-loquito', 'metalero', 'senora-cheta'],
    '4.jpg': ['gamer-feliz', 'astrologo-mistico', 'runner-intenso', 'vendedor-ambulante'],
    '5.jpg': ['empresario-sonrisa', 'tia-conspiranoica', 'dj-neon', 'personal-trainer'],
    '6.jpg': ['cosplayer-heroina', 'jubilado-aventurero', 'guia-turismo', 'cantante-fiesta'],
}

# Borra únicamente restos generados por esta herramienta. Los portraits manuales
# con otros nombres no se tocan.
generated_names = {name for names in MAPPING.values() for name in names}
for old in OUT.glob('*.jpg'):
    if old.stem in generated_names or old.stem.replace('-', '').isdigit():
        old.unlink()

manifest = []
for filename, names in MAPPING.items():
    src = SRC / filename
    if not src.exists():
        print(f'Skipping missing source: {filename}')
        continue

    image = Image.open(src).convert('RGB')
    w, h = image.size
    boxes = [
        (0, 0, w // 2, h // 2),
        (w // 2, 0, w, h // 2),
        (0, h // 2, w // 2, h),
        (w // 2, h // 2, w, h),
    ]

    for slot, (name, box) in enumerate(zip(names, boxes), 1):
        out = OUT / f'{name}.jpg'
        crop = image.crop(box)
        crop.save(out, 'JPEG', quality=96, subsampling=0, optimize=True)
        manifest.append({
            'source': filename,
            'slot': slot,
            'name': name,
            'size': list(crop.size),
            'file': f'portraits/{out.name}'
        })

(ROOT / 'avatar-manifest.json').write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2),
    encoding='utf-8'
)
print(f'Processed {len(manifest)} high-quality portraits from {len(MAPPING)} mosaics')
