#!/usr/bin/env python3
"""R59 ART-2: build art/doll/*.webp (+ frames, backdrop) from the Art Studio batches.
Sources are searched newest first, so dropping a batch2c folder with the same filenames and re-running
`python3 tools/build-doll-art.py` swaps the art in. Writes data/doll.json (layer index)."""
import os, json, sys
from PIL import Image
ART = os.environ.get("ART", "/workspace/art/heirs")
SRC = [f"{ART}/batch2c/doll", f"{ART}/batch2c/fixes", f"{ART}/batch2b/doll", f"{ART}/batch2/fixes", f"{ART}/batch2/doll"]
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = f"{ROOT}/art/doll"; os.makedirs(OUT, exist_ok=True)
CROP = (112, 64, 400, 768)   # 288x704 of the 512x768 canvas (all figures fit; feet at y=752)
SCALE = 0.5                  # -> 144x352 webp
Q = int(os.environ.get("Q", "50"))
BASES = [f"{r}-{g}{a}" for r in ("human", "dwarf") for g in ("male", "female") for a in ("", "-elder", "-child")]
HAIR = {"male": ["curly-crop", "long-loose", "shag", "undercut-knot"], "female": ["long-straight", "bob", "twin-braids", "curly-halfup"]}
ARMOR = ["clothes", "leather", "chain", "plate-helm"]
def find(name):
    for d in SRC:
        p = f"{d}/{name}.png"
        if os.path.exists(p): return p
    return None
NORM = ("-hair-", "-beard-forked", "-beard-ringed-plait.", "-tabard")  # grey layers tinted by colour: mean of opaque pixels -> 216
def norm(im):
    import numpy as np
    a = np.asarray(im).astype(float); al = a[..., 3] > 200
    if not al.any(): return im
    g = a[..., :3] @ [0.299, 0.587, 0.114]; k = 216.0 / max(1.0, g[al].mean())
    g = np.clip(g * k, 0, 255); out = np.dstack([g, g, g, a[..., 3]]).astype("uint8")
    return Image.fromarray(out, "RGBA")
def conv(name, mask=False):
    p = find(name)
    if not p: return None
    im = Image.open(p)
    im = im.convert("L") if mask else im.convert("RGBA")
    im = im.crop(CROP); im = im.resize((round(im.width * SCALE), round(im.height * SCALE)), Image.LANCZOS)
    if not mask and any(k in name + "." for k in NORM) and not name.endswith("-rings"): im = norm(im)
    if mask:  # coif masks: store as alpha so the renderer can use them directly
        a = im; im = Image.new("RGBA", im.size, (255, 255, 255, 0)); im.putalpha(a)
    im.save(f"{OUT}/{name}.webp", "WEBP", quality=Q, alpha_quality=Q, method=6)
    return f"art/doll/{name}.webp"
idx = {"w": round(CROP[2] - CROP[0]) * SCALE, "h": round(CROP[3] - CROP[1]) * SCALE, "skinRef": 216, "bases": {}, "sources": SRC}
missing = []
for b in BASES:
    sex = "female" if "-female" in b else "male"; adult = b.count("-") == 1
    e = {"base": conv(f"{b}-base"), "skin": conv(f"{b}-skin"), "eyes": conv(f"{b}-sea-touched-eyes"),
         "marks": conv(f"{b}-sea-touched-marks"), "tabard": conv(f"{b}-tabard"),
         "hair": {h: conv(f"{b}-hair-{h}") for h in HAIR[sex]}}
    bim = Image.open(f"{OUT}/{b}-base.webp"); bb = bim.getbbox(); al = bim.split()[3]
    import numpy as np
    A = np.asarray(al)[bb[1]:bb[1] + 30]; xs = np.nonzero(A.max(0) > 128)[0]; cx = int((xs.min() + xs.max()) / 2) if len(xs) else 72
    S = round((bb[3] - bb[1]) * 0.36); e["pb"] = [cx - S // 2, max(0, bb[1] - 6), S]
    if sex == "female": e["bun"] = conv(f"{b}-hair-bun")
    if b.startswith("dwarf-male") and "child" not in b:
        e["beard"] = {k: conv(f"{b}-beard-{k}") for k in ("forked", "ringed-plait")}
        e["rings"] = {"ringed-plait": conv(f"{b}-beard-ringed-plait-rings")}
    if adult:
        e["armor"] = {k: conv(f"{b}-armor-{k}") for k in ARMOR}
        e["coif"] = {k: conv(f"{b}-coifmask-{k}", mask=True) for k in ("chain", "plate-helm")}
    def walk(o, path):
        for k, v in (o.items() if isinstance(o, dict) else []):
            if v is None: missing.append(path + k)
            elif isinstance(v, dict): walk(v, path + k + ".")
    walk(e, b + ".")
    idx["bases"][b] = e
# frames (96/48/32) and backdrop
FR = [f"{ART}/batch2c/frames", f"{ART}/batch2b/frames", f"{ART}/batch2/frames"]
os.makedirs(f"{ROOT}/art/frames", exist_ok=True); idx["frames"] = {}
for k in ("common", "uncommon", "rare", "epic", "legendary", "hydra"):
    for sz in (96, 48, 32):
        p = next((f"{d}/frame-{k}-{sz}.png" for d in FR if os.path.exists(f"{d}/frame-{k}-{sz}.png")), None)
        if p:
            Image.open(p).convert("RGBA").save(f"{ROOT}/art/frames/frame-{k}-{sz}.webp", "WEBP", quality=85, method=6)
            idx["frames"].setdefault(k, {})[sz] = f"art/frames/frame-{k}-{sz}.webp"
BD = [f"{ART}/batch2c/backdrop", f"{ART}/batch2b/backdrop", f"{ART}/batch2/backdrop"]
p = next((f"{d}/creation-backdrop-960x540.png" for d in BD if os.path.exists(f"{d}/creation-backdrop-960x540.png")), None)
Image.open(p).convert("RGB").resize((720, 405), Image.LANCZOS).save(f"{ROOT}/art/backdrop.webp", "WEBP", quality=70, method=6); idx["backdrop"] = "art/backdrop.webp"
p = next((f"{d}/backdrop-banners-tint.png" for d in BD if os.path.exists(f"{d}/backdrop-banners-tint.png")), None)
if p:
    Image.open(p).convert("RGBA").resize((720, 405), Image.LANCZOS).save(f"{ROOT}/art/backdrop-banners.webp", "WEBP", quality=70, method=6); idx["banners"] = "art/backdrop-banners.webp"
idx["missing"] = missing
json.dump(idx, open(f"{ROOT}/data/doll.json", "w"), indent=1)
print("layers", sum(1 for _ in os.scandir(OUT)), "missing", missing)
