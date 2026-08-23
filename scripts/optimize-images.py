from pathlib import Path
from PIL import Image

ASSET_DIR = Path(__file__).resolve().parents[1] / "public" / "assets"

for source in sorted(ASSET_DIR.glob("*.png")):
    target = source.with_suffix(".webp")
    with Image.open(source) as image:
        image.save(target, "WEBP", quality=82, method=6)
    print(f"{source.name} -> {target.name}")
