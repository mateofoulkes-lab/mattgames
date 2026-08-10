from pathlib import Path
from PIL import Image

SRC = Path('portraitspng')
OUT = Path('portraits')
OUT.mkdir(parents=True, exist_ok=True)

for src in sorted(SRC.glob('*.png')):
    with Image.open(src) as im:
        im = im.convert('RGBA')
        w, h = im.size
        mid_x, mid_y = w // 2, h // 2
        boxes = [
            (0, 0, mid_x, mid_y),
            (mid_x, 0, w, mid_y),
            (0, mid_y, mid_x, h),
            (mid_x, mid_y, w, h),
        ]
        base = src.stem.lower().replace(' ', '-')
        for i, box in enumerate(boxes, start=1):
            tile = im.crop(box)
            bg = Image.new('RGB', tile.size, 'white')
            if tile.mode == 'RGBA':
                bg.paste(tile, mask=tile.getchannel('A'))
            else:
                bg.paste(tile.convert('RGB'))
            out = OUT / f'{base}-{i}.jpg'
            bg.save(out, 'JPEG', quality=92, optimize=True, progressive=True)
            print(f'{src} -> {out}')
