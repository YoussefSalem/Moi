import os
import glob
from PIL import Image

def upscale_image(src_path, dst_path, scale=2.0):
    with Image.open(src_path) as img:
        w, h = img.size
        new_w = int(w * scale)
        new_h = int(h * scale)
        img = img.convert("RGB") if img.mode in ("RGBA", "P", "L") else img
        upscaled = img.resize((new_w, new_h), Image.LANCZOS)
        ext = os.path.splitext(dst_path)[1].lower()
        if ext == ".jpg" or ext == ".jpeg":
            upscaled.save(dst_path, quality=95, optimize=True)
        elif ext == ".png":
            upscaled.save(dst_path, optimize=True)
        else:
            upscaled.save(dst_path)
        return new_w, new_h

src_dir = "artifacts/moi/src/assets/images"
jpeg_files = glob.glob(os.path.join(src_dir, "*.jpg"))
png_files = glob.glob(os.path.join(src_dir, "*.png"))
all_files = jpeg_files + png_files

print(f"Found {len(all_files)} images to upscale")

for src in sorted(all_files):
    name = os.path.basename(src)
    with Image.open(src) as img:
        w, h = img.size
    print(f"  {name}: {w}x{h} -> {int(w*2)}x{int(h*2)} ... ", end="")
    upscale_image(src, src, scale=2.0)
    print("done")

print(f"\nUpscaled {len(all_files)} images to 2x resolution")
