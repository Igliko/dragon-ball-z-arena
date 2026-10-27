"""Make Super Saiyan style hair-colour variants of a sprite.

Run tools/defringe.py on the raw cutout first.
Usage: python3 tools/make-forms.py media/art/goku.png <out_dir> goku
Needs Pillow, numpy and scipy. The ssj2 output is not used (SSJ2 reuses the SSJ art).
"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage
src, out_dir, name = sys.argv[1], sys.argv[2], sys.argv[3]
img = Image.open(src).convert('RGBA')
im = np.array(img).astype(float)
rgb, a = im[..., :3], im[..., 3]
h = im.shape[0]
lum = rgb @ [0.299, 0.587, 0.114]
sat = rgb.max(-1) - rgb.min(-1)
rows = np.arange(h)[:, None] < h * 0.62
dark = (a > 40) & (lum < 95) & (sat < 60) & rows
lab, n = ndimage.label(dark)
sizes = ndimage.sum(dark, lab, range(1, n + 1))
order = np.argsort(sizes)[::-1]
hair = np.zeros_like(dark)
for i, idx in enumerate(order):
    comp = lab == idx + 1
    if i == 0 or (sizes[idx] > 60 and np.nonzero(comp)[0].mean() < h * 0.45):
        hair |= comp
hair = ndimage.binary_dilation(hair, iterations=1) & (a > 0) & (lum < 140) & rows
FORMS = {
    'ssj':  ((214, 140, 10), (255, 246, 140)),
    'ssj2': ((240, 170, 0), (255, 255, 190)),
    'god':  ((150, 10, 45), (255, 95, 100)),
    'blue': ((0, 85, 190), (125, 230, 255)),
}
t = (np.clip(lum / 120.0, 0, 1) ** 0.8)[..., None]
for form, (c0, c1) in FORMS.items():
    o = im.copy()
    col = np.array(c0) * (1 - t) + np.array(c1) * t
    o[..., :3][hair] = col[hair]
    out = Image.fromarray(o.clip(0, 255).astype(np.uint8))
    out.save(f'{out_dir}/{name}-{form}.png', optimize=True)
