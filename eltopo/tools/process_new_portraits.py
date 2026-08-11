from pathlib import Path
from PIL import Image, ImageOps
import json

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'portraitspng'
OUT = ROOT / 'portraits'
OUT.mkdir(parents=True, exist_ok=True)

NEW_PORTRAITS = {
    '7.jpeg': 'conductora-tv',
    '8.jpg': 'cumbiero-keytar',
    '9.jpg': 'maquilladora-funeraria',
    '10.jpg': 'empleada-municipal',
}
TARGET = (627, 627)

for filename, name in NEW_PORTRAITS.items():
    source = SRC / filename
    if not source.exists():
        print(f'Missing: {filename}')
        continue
    image = Image.open(source).convert('RGB')
    print(f'{filename}: {image.size} -> {name}.jpg {TARGET}')
    image = ImageOps.fit(image, TARGET, method=Image.Resampling.LANCZOS)
    image.save(OUT / f'{name}.jpg', 'JPEG', quality=96, subsampling=0, optimize=True)

manifest_path = ROOT / 'avatar-manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else []
manifest = [item for item in manifest if item.get('name') not in NEW_PORTRAITS.values()]
for filename, name in NEW_PORTRAITS.items():
    if (OUT / f'{name}.jpg').exists():
        manifest.append({'source': filename, 'slot': 1, 'type': 'single', 'name': name, 'size': list(TARGET), 'file': f'portraits/{name}.jpg'})
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')

print('New portrait batch processed.')
