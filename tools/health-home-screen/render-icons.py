"""Render the reviewed vector into opaque app icons (PyMuPDF + Pillow)."""
from io import BytesIO
from pathlib import Path

import fitz
from PIL import Image

root = Path(__file__).resolve().parent
document = fitz.open(stream=(root / "health-icon.svg").read_bytes(), filetype="svg")
page = document[0]
for size, name in [(180, "icon-180.png"), (192, "icon-192.png"),
                   (512, "icon-512.png"), (512, "icon-maskable-512.png")]:
    pixmap = page.get_pixmap(matrix=fitz.Matrix(size / 512, size / 512), alpha=False)
    image = Image.open(BytesIO(pixmap.tobytes("png"))).convert("RGB")
    assert image.size == (size, size)
    image.save(root / "icons" / name, optimize=True)
print("Rendered four opaque RGB health icons from the vector source.")
