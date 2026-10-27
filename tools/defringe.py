"""Remove the blue backdrop halo that the AI cutout left around a sprite.

Flood-fills inward from the transparent outside through halo-coloured pixels
(navy / light-blue, not the fully saturated blue of Vegeta's suit), then
feathers the new edge."""
import sys, numpy as np
from PIL import Image
from scipy import ndimage
src, dst = sys.argv[1], sys.argv[2]
sat_max = float(sys.argv[3]) if len(sys.argv) > 3 else 0.88
im = np.array(Image.open(src).convert('RGBA')).astype(float)
rgb, a = im[..., :3] / 255, im[..., 3]
mx, mn = rgb.max(-1), rgb.min(-1)
v = mx; s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
blueish = (b >= r + 0.04) & (b >= g - 0.02)
halo_col = blueish & (s < sat_max) & (s > 0.22) & (v > 0.08)
outside = a < 20
candidate = halo_col | outside
lab, _ = ndimage.label(candidate)
touching = np.unique(lab[outside])
halo = np.isin(lab, touching[touching > 0]) & ~outside
# Semi-transparent edge pixels next to the halo go too.
halo |= ndimage.binary_dilation(halo, iterations=1) & (a < 200)
alpha = np.where(halo, 0, a)
# Feather: soften the new boundary by one pixel.
soft = ndimage.uniform_filter(alpha, size=3)
alpha = np.where(ndimage.binary_dilation(halo, iterations=1) & ~halo, np.minimum(alpha, soft), alpha)
# Drop leftover specks: opaque islands much smaller than the character.
lab2, n2 = ndimage.label(alpha > 40)
if n2 > 1:
    sizes = ndimage.sum(np.ones_like(alpha), lab2, range(1, n2 + 1))
    keep = np.isin(lab2, 1 + np.nonzero(sizes >= sizes.max() * 0.01)[0])
    alpha = np.where(keep | (alpha <= 40), alpha, 0)
    alpha = np.where(ndimage.binary_dilation(keep, iterations=1), alpha, 0)
im[..., 3] = alpha
out = Image.fromarray(im.clip(0, 255).astype(np.uint8))
out = out.crop(out.getbbox())
out.save(dst, optimize=True)
