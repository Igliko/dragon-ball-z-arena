# Generates media/scenes.css: the arena backgrounds.
# Each scene is a stack of layers inside .scene (SCENE_HTML in extension.js):
# sky, sun, stars, clouds, far, sea, mid, land, near, ground, mark, front.
# Most layers are SVG tiles that repeat sideways and scale with the arena's height,
# so a wide, short bottom panel and a tall Explorer view both look right.
# Shapes are lit from the right, where the sun is. Usage: python3 tools/scenes.py media/scenes.css
import math, random, sys
from urllib.parse import quote

def num(v):
    s = f'{v:.1f}'
    s = s[:-2] if s.endswith('.0') else s
    return '0' if s == '-0' else s
def d(pts, close=True):
    return 'M' + ' '.join(f'{num(x)} {num(y)}' for x, y in pts) + ('Z' if close else '')
def poly(pts, fill, extra=''):
    return f"<path d='{d(pts)}' fill='{fill}'{extra}/>"
def uri(s):
    # VS Code webviews are Chromium, which takes < and > as they are; % # and " must be escaped.
    return 'url("data:image/svg+xml,' + quote(s, safe="/:=' ,.-<>()") + '")'
def svg(w, h, body):
    return uri(f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {w} {h}'>{body}</svg>")

class Tile:
    """An SVG tile that repeats sideways: a shape crossing an edge is drawn again on the other side."""
    def __init__(self, w, h=100, seed=1):
        self.w, self.h, self.defs, self.items, self.n = w, h, [], [], 0
        self.rng = random.Random(seed)
    def clip(self, pts):
        self.n += 1
        self.defs.append(f"<clipPath id='k{self.n}'><path d='{d(pts)}'/></clipPath>")
        return f"clip-path='url(#k{self.n})'"
    def add(self, x0, x1, body):
        self.items.append((x0, x1, body))
    def uri(self, wrap=True):
        out = [f"<defs>{''.join(self.defs)}</defs>"] if self.defs else []
        for x0, x1, body in self.items:
            for dx in ((-self.w, 0, self.w) if wrap else (0,)):
                if not wrap or x1 + dx > 0 and x0 + dx < self.w:
                    out.append(body if dx == 0 else f"<g transform='translate({dx} 0)'>{body}</g>")
        return svg(self.w, self.h, ''.join(out))

# ---- Rocks ---------------------------------------------------------------------------------------
def butte(t, x, bw, tw, h, c, strata=2, talus=.3):
    """Flat-topped rock: a sloped foot under a cliff face with strata, a lit cap and a lit right edge."""
    r, H = t.rng, t.h
    top, ty = H - h, H - h * talus
    lx, rx = x - tw / 2, x + tw / 2
    def side(x0, s):
        return [(x0 + s * (1 - i / 3) * tw * .07 + r.uniform(-.025, .025) * tw, ty - (ty - top) * i / 3) for i in range(4)]
    L, R = side(lx, -1), side(rx, 1)
    body = [(x - bw / 2, H)] + L + R[::-1] + [(x + bw / 2, H)]
    sx = lx + tw * r.uniform(.3, .42)
    dark = [(x - bw / 2, H)] + L + [(sx, top), (sx + tw * .05, top + (ty - top) * .35), (sx - tw * .03, top + (ty - top) * .7), (sx + tw * .03, ty), (x - bw * .1, H)]
    k = t.clip(body)
    g = [poly(body, c['lit']), f"<g {k}>", poly([(x - bw / 2, H), L[0], R[0], (x + bw / 2, H)], c['talus'])]
    for i in range(strata):
        y = top + (ty - top) * (i + 1) / (strata + 1) + r.uniform(-.06, .06) * (ty - top)
        g.append(f"<rect x='{num(x - bw / 2)}' y='{num(y)}' width='{num(bw)}' height='{num(max(2.4, h * .045))}' fill='{c['strata']}'/>")
    g.append(poly(dark, c['shade']))
    g.append(f"<rect x='{num(x - bw / 2)}' y='{num(top)}' width='{num(bw)}' height='{num(max(2.4, h * .05))}' fill='{c['cap']}'/>")
    g.append(f"<rect x='{num(x - bw / 2)}' y='{num(top)}' width='{num(sx - x + bw / 2)}' height='{num(max(2.4, h * .05))}' fill='{c['capShade']}'/>")
    g.append(poly(R + [(p[0] - tw * .07, p[1]) for p in R[::-1]], c['rim']))
    g.append('</g>')
    t.add(x - bw / 2, x + bw / 2, ''.join(g))

def hoodoo(t, x, w, h, cw, c):
    """A rock column standing on a sloped foot, wearing a wider cap rock."""
    r, H = t.rng, t.h
    top = H - h
    ch = max(6, h * .2)                        # cap height
    ny = top + ch                              # neck, under the cap
    col = [(x - w * .9, H), (x - w * .5, H - h * .22), (x - w * .42, H - h * .55), (x - w * .3, ny), (x + w * .3, ny), (x + w * .42, H - h * .55), (x + w * .5, H - h * .22), (x + w * .9, H)]
    shade = [(x - w * .9, H), (x - w * .5, H - h * .22), (x - w * .42, H - h * .55), (x - w * .3, ny), (x - w * .05, ny), (x - w * .1, H - h * .5), (x - w * .02, H - h * .22), (x - w * .2, H)]
    cap = [(x - cw * .42, ny + ch * .08), (x - cw / 2, ny - ch * .4), (x - cw * .36, top + ch * .08), (x - cw * .05, top), (x + cw * .3, top + ch * .04), (x + cw * .5, ny - ch * .5), (x + cw * .44, ny + ch * .06)]
    k = t.clip(col)
    g = [poly(col, c['lit']), f"<g {k}>"]
    for i in range(2):
        y = ny + (H - h * .22 - ny) * (i + 1) / 3 + r.uniform(-2, 2)
        g.append(f"<rect x='{num(x - w)}' y='{num(y)}' width='{num(2 * w)}' height='{num(max(2.4, h * .035))}' fill='{c['strata']}'/>")
    g.append(poly(shade, c['shade']))
    g.append(poly([(x + w * .3, ny), (x + w * .42, H - h * .55), (x + w * .5, H - h * .22), (x + w * .9, H), (x + w * .74, H), (x + w * .36, H - h * .22), (x + w * .3, H - h * .55), (x + w * .2, ny)], c['rim']))
    g.append(f"<rect x='{num(x - w)}' y='{num(ny)}' width='{num(2 * w)}' height='{num(ch * .5)}' fill='{c['shade']}' opacity='.6'/>")
    g.append('</g>')
    g.append(rock(x + cw * .04, cw, ch * 1.5, c, ny + ch * .3))
    t.add(x - cw / 2 - w, x + cw / 2 + w, ''.join(g))

def rock(x, w, h, c, b):
    """A rounded rock standing on y=b, shaded on the left with a light top."""
    body = (f"M{num(x - w / 2)} {num(b)}C{num(x - w * .52)} {num(b - h * .7)} {num(x - w * .18)} {num(b - h)} {num(x + w * .08)} {num(b - h)}"
            f"C{num(x + w * .36)} {num(b - h)} {num(x + w * .52)} {num(b - h * .6)} {num(x + w / 2)} {num(b)}Z")
    shade = (f"M{num(x - w / 2)} {num(b)}C{num(x - w * .52)} {num(b - h * .7)} {num(x - w * .18)} {num(b - h)} {num(x + w * .02)} {num(b - h)}"
             f"C{num(x - w * .16)} {num(b - h * .7)} {num(x - w * .1)} {num(b - h * .3)} {num(x + w * .02)} {num(b)}Z")
    hi = (f"M{num(x - w * .02)} {num(b - h * .92)}C{num(x + w * .14)} {num(b - h * .98)} {num(x + w * .3)} {num(b - h * .9)} {num(x + w * .36)} {num(b - h * .7)}"
          f"C{num(x + w * .22)} {num(b - h * .8)} {num(x + w * .1)} {num(b - h * .84)} {num(x - w * .02)} {num(b - h * .92)}Z")
    return f"<path d='{body}' fill='{c['lit']}'/><path d='{shade}' fill='{c['shade']}'/><path d='{hi}' fill='{c['cap']}'/>"

def boulder(t, x, w, h, c, y=None):
    t.add(x - w / 2, x + w / 2, rock(x, w, h, c, t.h if y is None else y))

def mesa_range(t, base, hmin, hmax, wmin, wmax, lit, shade, gap=(10, 60)):
    """A distant row of flat-topped mesas, one tone with shaded left faces."""
    r, x = t.rng, t.rng.uniform(0, 40)
    while x < t.w:
        w, h = r.uniform(wmin, wmax), r.uniform(hmin, hmax)
        s = h * r.uniform(.35, .7)
        pts = [(x, base), (x + s * .35, base - h * .55), (x + s * .5, base - h), (x + w - s * .45, base - h), (x + w - s * .3, base - h * .5), (x + w, base)]
        sh = [(x, base), (x + s * .35, base - h * .55), (x + s * .5, base - h), (x + s * .5 + w * .12, base - h), (x + s * .3 + w * .1, base - h * .45), (x + s * .5 + w * .14, base)]
        t.add(x, x + w, poly(pts, lit) + poly(sh, shade))
        x += w * r.uniform(.55, .95) + (r.uniform(*gap) if r.random() < .45 else 0)

# ---- Sky -----------------------------------------------------------------------------------------
def cumulus(t, x, base, w, c):
    """A flat-bottomed cumulus: puffs in shadow, lit puffs shifted up and to the right."""
    r = t.rng
    n = r.randint(5, 7)
    peak = r.uniform(.35, .6)
    puffs = []
    for i in range(n):
        u = (i + .5) / n
        rad = w * (.09 + .11 * math.exp(-((u - peak) / .3) ** 2)) * r.uniform(.9, 1.1)
        puffs.append((x - w / 2 + (.12 + .76 * u) * w, base - rad * .75, rad))
    m = max(puffs, key=lambda p: p[2])
    puffs.append((m[0] + r.uniform(-.06, .08) * w, m[1] - m[2] * .5, m[2] * .72))
    k = t.clip([(x - w, base - w), (x + w, base - w), (x + w, base), (x - w, base)])
    g = [f"<g {k}>"]
    g += [f"<circle cx='{num(px)}' cy='{num(py)}' r='{num(pr)}' fill='{c[2]}'/>" for px, py, pr in puffs]
    g += [f"<circle cx='{num(px + pr * .1)}' cy='{num(py - pr * .16)}' r='{num(pr * .9)}' fill='{c[1]}'/>" for px, py, pr in puffs]
    g += [f"<circle cx='{num(px + pr * .2)}' cy='{num(py - pr * .32)}' r='{num(pr * .74)}' fill='{c[0]}'/>" for px, py, pr in puffs]
    g.append('</g>')
    t.add(x - w * .7, x + w * .7, ''.join(g))

def clouds(c, seed, spec, w=1300, h=80):
    t = Tile(w, h, seed)
    for x, base, cw in spec:
        cumulus(t, x, base, cw, c)
    return t.uri()

# ---- Ground --------------------------------------------------------------------------------------
def dirt(c, seed, w=1150):
    """Open ground seen in depth: patches, cracks and pebbles get bigger towards the front."""
    t = Tile(w, 100, seed)
    r = t.rng
    t.add(0, w, f"<rect width='{w}' height='100' fill='{c['base']}'/><rect width='{w}' height='6' fill='{c['haze']}'/>")
    for _ in range(26):
        y = r.uniform(12, 96); s = .35 + .65 * y / 100; x = r.uniform(0, w)
        rx, ry = r.uniform(30, 90) * s, r.uniform(2.5, 5) * s
        t.add(x - rx, x + rx, f"<ellipse cx='{num(x)}' cy='{num(y)}' rx='{num(rx)}' ry='{num(ry)}' fill='{c['patch']}'/>")
    for _ in range(6):
        y = r.uniform(30, 92); s = .35 + .65 * y / 100; x = r.uniform(0, w)
        pts, px, py = [], x, y
        for _ in range(r.randint(3, 5)):
            pts.append((px, py)); px += r.uniform(8, 18) * s; py += r.uniform(-3, 3) * s
        pts.append((px, py))
        t.add(x, px, f"<path d='{d(pts, False)}' fill='none' stroke='{c['crack']}' stroke-width='{num(2.6 * s)}' stroke-linejoin='round'/>")
    for _ in range(70):
        y = r.uniform(10, 98); s = .3 + .7 * y / 100; x = r.uniform(0, w)
        rx = r.uniform(2.2, 4.5) * s
        t.add(x - rx, x + rx, f"<ellipse cx='{num(x)}' cy='{num(y)}' rx='{num(rx)}' ry='{num(rx * .6)}' fill='{c['pebble']}'/>"
              f"<ellipse cx='{num(x + rx * .2)}' cy='{num(y - rx * .2)}' rx='{num(rx * .5)}' ry='{num(rx * .28)}' fill='{c['pebbleHi']}'/>")
    for x, y, bw, bh in [(140, 88, 26, 12), (610, 94, 34, 15), (905, 72, 18, 8), (380, 60, 14, 6)]:
        boulder(t, x, bw, bh, {'lit': c['rock'], 'shade': c['rockShade'], 'cap': c['rockHi']}, y)
    for _ in range(12):
        y = r.uniform(18, 96); s = .35 + .65 * y / 100; x = r.uniform(0, w)
        tuft(t, x, y, 10 * s, c['tuft'], c['tuftShade'])
    return t.uri()

def tuft(t, x, y, h, lit, shade):
    """A small clump of grass blades."""
    blades = [(-.55, .7, shade), (-.25, 1, shade), (.05, .85, lit), (.35, 1.05, lit), (.6, .7, lit)]
    g = ''.join(poly([(x + a * h * .5 - h * .09, y), (x + a * h * 1.1, y - b * h), (x + a * h * .5 + h * .09, y)], col) for a, b, col in blades)
    t.add(x - h, x + h, g)

def pod(c):
    """A Saiyan space pod sitting in its crater."""
    g = [f"<ellipse cx='85' cy='84' rx='80' ry='15' fill='{c['rim']}'/>",
         f"<ellipse cx='87' cy='86' rx='62' ry='10' fill='{c['pit']}'/>",
         f"<ellipse cx='70' cy='84' rx='38' ry='7' fill='{c['lip']}'/>",
         f"<g transform='rotate(-10 86 62)'>",
         f"<circle cx='86' cy='60' r='32' fill='{c['shell']}'/>",
         f"<path d='M86 28a32 32 0 0 0 0 64a38 38 0 0 1 0-64Z' fill='{c['shellShade']}'/>",
         f"<path d='M55 70a32 32 0 0 0 62 0' fill='none' stroke='{c['seam']}' stroke-width='3'/>",
         f"<ellipse cx='96' cy='52' rx='15' ry='16' fill='{c['frame']}'/><ellipse cx='97' cy='53' rx='11.5' ry='12.5' fill='{c['hole']}'/>",
         f"<g transform='rotate(-34 100 32)'><ellipse cx='100' cy='28' rx='17' ry='6.5' fill='{c['frame']}'/><ellipse cx='100' cy='27' rx='12.5' ry='4' fill='{c['glass']}'/></g>",
         "</g>",
         f"<path d='M5 84Q85 70 165 84A80 15 0 0 1 5 84Z' fill='{c['lip']}'/>",
         f"<path d='M5 84Q85 70 165 84Q85 76 5 84Z' fill='{c['rim']}'/>"]
    g += [rock(x, w, h, {'lit': c['rock'], 'shade': c['rockShade'], 'cap': c['rockHi']}, y) for x, y, w, h in [(20, 92, 16, 7), (150, 90, 12, 6), (130, 97, 9, 4), (44, 98, 8, 4)]]
    return svg(170, 100, ''.join(g))

def pebbles(c, seed, w=1400):
    """Loose stones along the front edge of the arena."""
    t = Tile(w, 100, seed)
    r = t.rng
    x = r.uniform(20, 80)
    while x < w:
        bw = r.uniform(18, 46)
        boulder(t, x, bw, bw * r.uniform(.35, .55), {'lit': c['rock'], 'shade': c['rockShade'], 'cap': c['rockHi']}, 104)
        if r.random() < .5:
            boulder(t, x + bw * .55, bw * .5, bw * .22, {'lit': c['rock'], 'shade': c['rockShade'], 'cap': c['rockHi']}, 104)
        x += r.uniform(160, 420)
    return t.uri()

# ---- Plants -------------------------------------------------------------------------------------
def leaf(cx, cy, ang, length, width, droop, fill):
    """A tapered leaf from (cx, cy) along `ang` degrees (0 = right, 90 = up), arching and drooping."""
    a = math.radians(ang)
    tx, ty = cx + length * math.cos(a), cy - length * math.sin(a) + droop * length
    mx, my = (cx + tx) / 2, (cy + ty) / 2 - length * .22
    top, bot = [], []
    for i in range(9):
        u = i / 8
        px = (1 - u) ** 2 * cx + 2 * (1 - u) * u * mx + u * u * tx
        py = (1 - u) ** 2 * cy + 2 * (1 - u) * u * my + u * u * ty
        dx = 2 * (1 - u) * (mx - cx) + 2 * u * (tx - mx)
        dy = 2 * (1 - u) * (my - cy) + 2 * u * (ty - my)
        n = math.hypot(dx, dy) or 1
        wv = width * math.sin(math.pi * min(u * 1.15, 1)) ** .8 / 2
        top.append((px - dy / n * wv, py + dx / n * wv)); bot.append((px + dy / n * wv, py - dx / n * wv))
    return poly(top + bot[::-1], fill)

def palm(t, x, base, h, c, lean=.22):
    """A palm tree: a curved, ringed trunk and a crown of drooping fronds."""
    tx, ty = x + lean * h, base - h
    cxm, cym = x + lean * h * .05, base - h * .6
    pt = lambda u: ((1 - u) ** 2 * x + 2 * (1 - u) * u * cxm + u * u * tx, (1 - u) ** 2 * base + 2 * (1 - u) * u * cym + u * u * ty)
    n, w0, w1 = 9, h * .08, h * .045
    L, R, M = [], [], []
    for i in range(n + 1):
        px, py = pt(i / n); wv = w0 + (w1 - w0) * i / n
        L.append((px - wv / 2, py)); R.append((px + wv / 2, py)); M.append((px - wv * .05, py))
    g = [poly(L + R[::-1], c['trunk']), poly(L + M[::-1], c['trunkShade'])]
    g += [f"<path d='M{num(L[i][0])} {num(L[i][1])}H{num(R[i][0])}' stroke='{c['ring']}' stroke-width='{num(max(1.6, h * .018))}'/>" for i in range(1, n)]
    fronds = [(150, .5, .55, 'shade'), (110, .42, .25, 'shade'), (70, .42, .25, 'lit'), (30, .5, .5, 'lit'),
              (190, .48, .75, 'shade'), (-10, .5, .75, 'lit'), (215, .4, .95, 'shade'), (-35, .4, .95, 'lit')]
    for ang, ln, dr, tone in fronds:
        g.append(leaf(tx, ty, ang, h * ln, h * .16, dr, c[tone]))
    g += [f"<circle cx='{num(tx + dx * h)}' cy='{num(ty + h * .05)}' r='{num(h * .035)}' fill='{c['nut']}'/>" for dx in (-.04, .03)]
    t.add(min(x, tx) - h * .55, max(x, tx) + h * .55, ''.join(g))

def puff_cluster(cx, cy, rad, c, rng, n=7):
    """A round, bushy crown: a ring of puffs, shaded like the clouds."""
    puffs = [(cx, cy, rad * .62)]
    for i in range(n):
        a = 2 * math.pi * i / n + rng.uniform(-.2, .2)
        puffs.append((cx + math.cos(a) * rad * .48, cy + math.sin(a) * rad * .42, rad * rng.uniform(.4, .52)))
    g = [f"<circle cx='{num(px)}' cy='{num(py)}' r='{num(pr)}' fill='{c[2]}'/>" for px, py, pr in puffs]
    g += [f"<circle cx='{num(px + pr * .1)}' cy='{num(py - pr * .14)}' r='{num(pr * .88)}' fill='{c[1]}'/>" for px, py, pr in puffs]
    g += [f"<circle cx='{num(px + pr * .22)}' cy='{num(py - pr * .3)}' r='{num(pr * .62)}' fill='{c[0]}'/>" for px, py, pr in puffs if py < cy + rad * .1]
    return ''.join(g)

def ajisa(t, x, base, h, c):
    """A Namekian Ajisa tree: a thin trunk under a round, puffy crown."""
    r = t.rng
    cr = h * .34
    cx, cy = x + r.uniform(-.08, .08) * h, base - h + cr
    trunk = [(x - h * .035, base), (cx - h * .018, cy), (cx + h * .018, cy), (x + h * .035, base)]
    t.add(x - cr * 1.2, x + cr * 1.2, poly(trunk, c['trunk']) + puff_cluster(cx, cy, cr, c['crown'], r))

# ---- Namek ---------------------------------------------------------------------------------------
def namek_rock(t, x, base, w, h, c, trees=()):
    """A Namekian rock column: a narrow waist under an overhanging top, a grassy cap and trees on it."""
    top = base - h
    L = [(x - w * .32, base), (x - w * .2, base - h * .35), (x - w * .26, base - h * .62), (x - w * .44, top + h * .26), (x - w * .55, top + h * .12), (x - w * .5, top + h * .02), (x - w * .2, top)]
    R = [(2 * x - px, py) for px, py in L]
    def curve(pts):
        out = f"M{num(pts[0][0])} {num(pts[0][1])}"
        for i in range(1, len(pts) - 1, 2):
            out += f"Q{num(pts[i][0])} {num(pts[i][1])} {num(pts[i + 1][0])} {num(pts[i + 1][1])}"
        return out
    body = curve(L) + 'L' + curve(R[::-1])[1:] + 'Z'
    k = t.clip(L + R[::-1])
    g = [f"<path d='{body}' fill='{c['lit']}'/>", f"<g {k}>"]
    for f in (.36, .58, .78):
        g.append(f"<rect x='{num(x - w)}' y='{num(base - h * f)}' width='{num(2 * w)}' height='{num(max(2.4, h * .035))}' fill='{c['strata']}'/>")
    g.append(poly([(x - w, base), (x - w, top - 5), (x - w * .12, top - 5), (x - w * .2, top + h * .3), (x - w * .04, base - h * .5), (x - w * .08, base)], c['shade']))
    g.append(poly([(x + w * .55, top), (x + w * .4, top + h * .3), (x + w * .2, base - h * .45), (x + w * .26, base), (x + w, base), (x + w, top)], c['rim']))
    g.append('</g>')
    n = 7
    drips = ''.join(f"Q{num(x + w * (.52 - (i + .5) / n * 1.04))} {num(top + h * (.17 if i % 2 else .11))} {num(x + w * (.52 - (i + 1) / n * 1.04))} {num(top + h * .07)}" for i in range(n))
    g.append(f"<path d='M{num(x - w * .52)} {num(top + h * .07)}C{num(x - w * .5)} {num(top - w * .14)} {num(x + w * .5)} {num(top - w * .14)} {num(x + w * .52)} {num(top + h * .07)}{drips}Z' fill='{c['grass']}'/>")
    g.append(f"<path d='M{num(x - w * .05)} {num(top - w * .08)}C{num(x + w * .25)} {num(top - w * .1)} {num(x + w * .46)} {num(top - w * .04)} {num(x + w * .5)} {num(top + h * .05)}C{num(x + w * .3)} {num(top)} {num(x + w * .1)} {num(top - w * .04)} {num(x - w * .05)} {num(top - w * .08)}Z' fill='{c['grassLit']}'/>")
    t.add(x - w * .6, x + w * .6, ''.join(g))
    for dx, th in trees:
        ajisa(t, x + dx * w, top - w * .04, th, c)

def namek_house(t, x, base, w, c):
    """A white Namekian dome house with round windows."""
    h = w * .78
    dome = f"M{num(x - w / 2)} {num(base)}C{num(x - w * .52)} {num(base - h * 1.3)} {num(x + w * .52)} {num(base - h * 1.3)} {num(x + w / 2)} {num(base)}Z"
    shade = f"M{num(x - w / 2)} {num(base)}C{num(x - w * .52)} {num(base - h * 1.3)} {num(x + w * .1)} {num(base - h * 1.3)} {num(x)} {num(base - h * .97)}C{num(x - w * .3)} {num(base - h * .8)} {num(x - w * .32)} {num(base - h * .3)} {num(x - w * .18)} {num(base)}Z"
    g = [f"<rect x='{num(x - w * .04)}' y='{num(base - h * 1.12)}' width='{num(w * .08)}' height='{num(h * .2)}' fill='{c['pipe']}'/>",
         f"<circle cx='{num(x)}' cy='{num(base - h * 1.13)}' r='{num(w * .06)}' fill='{c['pipe']}'/>",
         f"<path d='{dome}' fill='{c['wall']}'/>", f"<path d='{shade}' fill='{c['wallShade']}'/>",
         f"<rect x='{num(x - w / 2)}' y='{num(base - h * .08)}' width='{num(w)}' height='{num(h * .08)}' fill='{c['band']}'/>"]
    k = t.clip([(x - w, base - h * .5), (x + w, base - h * .5), (x + w, base - h * .42), (x - w, base - h * .42)])
    g.append(f"<path d='{dome}' fill='{c['band']}' {k}/>")
    for wx in (-.3, -.1, .1, .3):
        wr = w * .055 * (1 - abs(wx) * .6)
        g.append(f"<ellipse cx='{num(x + wx * w)}' cy='{num(base - h * .64)}' rx='{num(wr * (1 - abs(wx) * .5))}' ry='{num(wr)}' fill='{c['glass']}'/>")
    g.append(f"<path d='M{num(x + w * .14)} {num(base)}v{num(-h * .2)}a{num(w * .07)} {num(w * .07)} 0 0 1 {num(w * .14)} 0v{num(h * .2)}Z' fill='{c['door']}'/>")
    t.add(x - w / 2, x + w / 2, ''.join(g))

def grass(c, seed, w=1250, shore=None):
    """A lawn seen in depth, with darker patches and tufts that grow towards the front."""
    t = Tile(w, 100, seed)
    r = t.rng
    if shore:   # a wavy bank where the grass meets the water
        edge = [(x, 3 + 2.2 * math.sin(x / 37) + 1.4 * math.sin(x / 13)) for x in range(0, w + 1, 10)]
        t.add(0, w, poly(edge + [(w, 100), (0, 100)], c['base']) + f"<path d='{d(edge, False)}' fill='none' stroke='{shore}' stroke-width='3'/>")
    else:
        t.add(0, w, f"<rect width='{w}' height='100' fill='{c['base']}'/>")
    t.add(0, w, f"<rect y='6' width='{w}' height='5' fill='{c['haze']}' opacity='.5'/>")
    for _ in range(24):
        y = r.uniform(14, 96); s = .35 + .65 * y / 100; x = r.uniform(0, w)
        rx, ry = r.uniform(30, 90) * s, r.uniform(2.5, 5) * s
        t.add(x - rx, x + rx, f"<ellipse cx='{num(x)}' cy='{num(y)}' rx='{num(rx)}' ry='{num(ry)}' fill='{c['patch']}'/>")
    for _ in range(46):
        y = r.uniform(14, 98); s = .35 + .65 * y / 100; x = r.uniform(0, w)
        tuft(t, x, y, 12 * s, c['tuft'], c['tuftShade'])
    for _ in range(c.get('flowers', 0)):
        y = r.uniform(20, 96); s = .35 + .65 * y / 100; x = r.uniform(0, w)
        t.add(x - 3, x + 3, f"<circle cx='{num(x)}' cy='{num(y)}' r='{num(2.2 * s)}' fill='{c['flower']}'/>")
    return t.uri()

def tufts(c, seed, w=1300):
    """Tall grass along the front edge."""
    t = Tile(w, 100, seed)
    r, x = t.rng, t.rng.uniform(10, 60)
    while x < w:
        for k in range(r.randint(2, 4)):
            tuft(t, x + k * r.uniform(9, 16), 104, r.uniform(40, 70), c['tuft'], c['tuftShade'])
        x += r.uniform(140, 380)
    return t.uri()

def water(c, seed, w=900):
    """Glints on open water; they get longer and lower towards the front."""
    t = Tile(w, 100, seed)
    r = t.rng
    for _ in range(46):
        y = r.uniform(6, 96); s = .25 + .75 * y / 100; x = r.uniform(0, w)
        ln = r.uniform(14, 40) * s
        t.add(x, x + ln, f"<rect x='{num(x)}' y='{num(y)}' width='{num(ln)}' height='{num(max(1.6, 3.2 * s))}' rx='1' fill='{c}'/>")
    return t.uri()

def waves(c, seed, w=600):
    """Wave crests and glints, bigger towards the front."""
    t = Tile(w, 100, seed)
    r = t.rng
    for _ in range(11):
        y = r.uniform(14, 90); s = .3 + .7 * y / 100; x = r.uniform(0, w); ln = r.uniform(26, 50) * s
        t.add(x, x + ln, f"<path d='M{num(x)} {num(y)}q{num(ln / 2)} {num(-4 * s)} {num(ln)} 0' fill='none' stroke='{c}' stroke-width='{num(2.4 * s + 1)}' stroke-linecap='round' opacity='.8'/>")
    for _ in range(16):
        y = r.uniform(6, 96); s = .3 + .7 * y / 100; x = r.uniform(0, w); ln = r.uniform(6, 14) * s
        t.add(x, x + ln, f"<rect x='{num(x)}' y='{num(y)}' width='{num(ln)}' height='{num(1.2 + 1.6 * s)}' rx='1' fill='{c}' opacity='.55'/>")
    return t.uri()

# ---- Kame House ----------------------------------------------------------------------------------
def kame_house(c):
    """Master Roshi's house on the beach, between two palm trees."""
    t = Tile(280, 160, 11)
    t.add(0, 0, f"<ellipse cx='118' cy='154' rx='104' ry='6' fill='{c['sandShade']}'/>")
    palm(t, 44, 156, 112, c['palm'], lean=-.2)
    g = [poly([(62, 146), (62, 84), (84, 90), (84, 154)], c['wallShade']),
         f"<rect x='84' y='88' width='106' height='66' fill='{c['wall']}'/>",
         f"<rect x='84' y='146' width='106' height='8' fill='{c['wallBase']}'/>",
         poly([(76, 94), (198, 94), (166, 52), (100, 52)], c['roof']),
         poly([(54, 86), (76, 94), (100, 52)], c['roofShade']),
         ''.join(f"<path d='M{num(76 + i * 12.2)} 93L{num(100 + i * 6.6)} 53' stroke='{c['roofLine']}' stroke-width='2'/>" for i in range(1, 10)),
         f"<path d='M54 86L76 94H198' fill='none' stroke='{c['eave']}' stroke-width='5' stroke-linejoin='round'/>",
         f"<path d='M98 52H168' stroke='{c['eave']}' stroke-width='6' stroke-linecap='round'/>",
         f"<text x='137' y='106' font-family='Arial,Helvetica,sans-serif' font-weight='900' font-size='12' fill='{c['text']}' text-anchor='middle'>KAME HOUSE</text>",
         f"<rect x='126' y='116' width='22' height='38' fill='{c['frame']}'/><rect x='129' y='119' width='16' height='35' fill='{c['door']}'/>",
         f"<circle cx='141' cy='137' r='1.6' fill='{c['frame']}'/>"]
    for wx in (94, 160):
        g.append(f"<rect x='{wx}' y='116' width='22' height='20' fill='{c['frame']}'/><rect x='{wx + 3}' y='119' width='16' height='14' fill='{c['glass']}'/>"
                 f"<path d='M{wx + 11} 119v14M{wx + 3} 126h16' stroke='{c['frame']}' stroke-width='2'/>")
    g.append(f"<rect x='120' y='154' width='34' height='4' fill='{c['step']}'/>")
    t.add(0, 0, ''.join(g))
    palm(t, 222, 158, 140, c['palm'], lean=.16)
    return t.uri(wrap=False)

def sand(c, seed, w=1200):
    """A beach: wet sand and foam at the waterline, ripples, shells and pebbles."""
    t = Tile(w, 100, seed)
    r = t.rng
    edge = [(x, 2.5 + 1.5 * math.sin(x / 41) + math.sin(x / 17)) for x in range(0, w + 1, 10)]
    wet = [(x, y + 7 + 1.5 * math.sin(x / 29)) for x, y in edge]
    t.add(0, w, poly(edge + [(w, 100), (0, 100)], c['base']) + poly(edge + wet[::-1], c['wet'])
          + f"<path d='{d(edge, False)}' fill='none' stroke='{c['foam']}' stroke-width='3.4'/>")
    for _ in range(18):
        y = r.uniform(18, 96); s = .35 + .65 * y / 100; x = r.uniform(0, w); ln = r.uniform(30, 80) * s
        t.add(x, x + ln, f"<path d='M{num(x)} {num(y)}q{num(ln / 2)} {num(-3 * s)} {num(ln)} 0' fill='none' stroke='{c['ripple']}' stroke-width='{num(2.4 * s)}'/>")
    for _ in range(40):
        y = r.uniform(14, 98); s = .3 + .7 * y / 100; x = r.uniform(0, w); rx = r.uniform(2, 4) * s
        col = r.choice([c['pebble'], c['pebble'], c['shell']])
        t.add(x - rx, x + rx, f"<ellipse cx='{num(x)}' cy='{num(y)}' rx='{num(rx)}' ry='{num(rx * .6)}' fill='{col}'/>")
    return t.uri()

def islands(c, seed, w=16000):
    """Long, low islands far out on the horizon (a wide tile: the layer is only a few pixels high)."""
    t = Tile(w, 100, seed)
    for x, iw, ih in [(1800, 260, 34), (9200, 180, 24)]:
        t.add(x - iw, x + iw, f"<path d='M{num(x - iw / 2)} 100C{num(x - iw * .3)} {num(100 - ih)} {num(x + iw * .2)} {num(100 - ih * 1.1)} {num(x + iw / 2)} 100Z' fill='{c[0]}'/>"
              f"<path d='M{num(x - iw / 2)} 100C{num(x - iw * .35)} {num(100 - ih * .9)} {num(x - iw * .2)} {num(100 - ih * 1.02)} {num(x - iw * .08)} {num(100 - ih * 1.04)}C{num(x - iw * .2)} {num(100 - ih * .7)} {num(x - iw * .26)} {num(100 - ih * .3)} {num(x - iw * .2)} 100Z' fill='{c[1]}'/>")
        for px, ph in ((x + iw * .06, ih * 1.9), (x + iw * .14, ih * 1.5)):
            t.add(px - 20, px + 20, f"<path d='M{num(px)} {num(100 - ih * .9)}q{num(ph * .1)} {num(-ph * .5)} {num(ph * .18)} {num(-ph)}' fill='none' stroke='{c[1]}' stroke-width='5'/>"
                  + ''.join(leaf(px + ph * .18, 100 - ih * .9 - ph, a, ph * .45, ph * .14, .5, c[1]) for a in (160, 110, 60, 15)))
    return t.uri()

# ---- Tenkaichi Budokai ---------------------------------------------------------------------------
def hills(t, base, hmin, hmax, wmin, wmax, lit, shade, gap=(0, 40)):
    """Rounded mountains, shaded on the left."""
    r, x = t.rng, t.rng.uniform(-40, 0)
    while x < t.w:
        w, h = r.uniform(wmin, wmax), r.uniform(hmin, hmax)
        xp = x + w * r.uniform(.4, .6)
        body = (f"M{num(x)} {num(base)}C{num(x + w * .25)} {num(base - h * .55)} {num(xp - w * .14)} {num(base - h)} {num(xp)} {num(base - h)}"
                f"C{num(xp + w * .14)} {num(base - h)} {num(x + w * .75)} {num(base - h * .55)} {num(x + w)} {num(base)}Z")
        sh = (f"M{num(x)} {num(base)}C{num(x + w * .25)} {num(base - h * .55)} {num(xp - w * .14)} {num(base - h)} {num(xp)} {num(base - h)}"
              f"C{num(xp - w * .08)} {num(base - h * .6)} {num(xp + w * .04)} {num(base - h * .3)} {num(xp - w * .02)} {num(base)}Z")
        t.add(x, x + w, f"<path d='{body}' fill='{lit}'/><path d='{sh}' fill='{shade}'/>")
        x += w * r.uniform(.45, .75) + r.uniform(*gap)

def roof(xc, ye, w, h, c):
    """A tiled temple roof with upturned eaves."""
    tip = h * .4
    eave = (f"M{num(xc - w / 2 - tip)} {num(ye - tip)}Q{num(xc - w / 2)} {num(ye)} {num(xc - w / 2 + tip * 1.5)} {num(ye)}"
            f"H{num(xc + w / 2 - tip * 1.5)}Q{num(xc + w / 2)} {num(ye)} {num(xc + w / 2 + tip)} {num(ye - tip)}")
    g = [f"<path d='{eave}L{num(xc + w * .3)} {num(ye - h)}H{num(xc - w * .3)}Z' fill='{c['roof']}'/>",
         poly([(xc - w / 2 - tip, ye - tip), (xc - w * .3, ye - h), (xc - w * .2, ye - h), (xc - w * .3, ye)], c['roofShade'])]
    for i in range(1, 12):
        u = i / 12 - .5
        g.append(f"<path d='M{num(xc + u * w * .92)} {num(ye - 1)}L{num(xc + u * w * .6)} {num(ye - h)}' stroke='{c['roofLine']}' stroke-width='{num(max(1.4, h * .05))}'/>")
    g.append(f"<path d='{eave}' fill='none' stroke='{c['eave']}' stroke-width='{num(h * .18)}' stroke-linecap='round'/>")
    g.append(f"<rect x='{num(xc - w * .33)}' y='{num(ye - h - h * .14)}' width='{num(w * .66)}' height='{num(h * .18)}' fill='{c['ridge']}'/>")
    return ''.join(g)

def temple(c):
    """The Tenkaichi Budokai hall: white walls, red pillars and orange tiled roofs."""
    W, H = 330, 170
    g = [f"<rect x='34' y='150' width='262' height='20' fill='{c['plinth']}'/><rect x='34' y='150' width='262' height='4' fill='{c['plinthTop']}'/>"]
    for x0, x1, ye in [(44, 118, 112), (212, 286, 112)]:          # side wings
        g.append(f"<rect x='{x0}' y='{ye}' width='{x1 - x0}' height='{150 - ye}' fill='{c['wall']}'/>")
        g += [f"<rect x='{px}' y='{ye}' width='6' height='{150 - ye}' fill='{c['pillar']}'/>" for px in range(x0 + 4, x1 - 4, 22)]
        g.append(roof((x0 + x1) / 2, ye, x1 - x0 + 8, 18, c))
    g.append(f"<rect x='110' y='96' width='110' height='54' fill='{c['wall']}'/><rect x='110' y='96' width='18' height='54' fill='{c['wallShade']}'/>")
    g += [f"<rect x='{px}' y='96' width='7' height='54' fill='{c['pillar']}'/>" for px in (114, 136, 187, 209)]
    g.append(f"<rect x='148' y='114' width='34' height='36' fill='{c['door']}'/><rect x='146' y='104' width='38' height='8' fill='{c['sign']}'/>")
    g.append(roof(165, 96, 150, 26, c))
    g.append(f"<rect x='128' y='60' width='74' height='22' fill='{c['wall']}'/><rect x='128' y='60' width='12' height='22' fill='{c['wallShade']}'/>")
    g += [f"<rect x='{px}' y='60' width='5' height='22' fill='{c['pillar']}'/>" for px in (131, 151, 174, 194)]
    g.append(roof(165, 60, 108, 26, c))
    g.append(f"<path d='M165 18v-10' stroke='{c['eave']}' stroke-width='4'/><circle cx='165' cy='8' r='4' fill='{c['eave']}'/>")
    return svg(W, H, ''.join(g))

def crowd(c, seed, w=900):
    """Spectators behind a low wall, on a strip of grass."""
    t = Tile(w, 100, seed)
    r = t.rng
    for y0, rad, step in [(26, 8, 17), (40, 9.5, 20)]:
        x = r.uniform(0, step)
        while x < w:
            y = y0 + r.uniform(-2.5, 2.5)
            shirt, hair = r.choice(c['shirts']), r.choice(c['hair'])
            t.add(x - rad * 2, x + rad * 2,
                  f"<rect x='{num(x - rad * 1.35)}' y='{num(y + rad * .7)}' width='{num(rad * 2.7)}' height='{num(rad * 4)}' rx='{num(rad * .8)}' fill='{shirt}'/>"
                  f"<circle cx='{num(x)}' cy='{num(y)}' r='{num(rad)}' fill='{r.choice(c['skin'])}'/>"
                  f"<path d='M{num(x - rad)} {num(y + rad * .1)}a{num(rad)} {num(rad)} 0 0 1 {num(rad * 2)} 0Z' fill='{hair}'/>")
            x += step * r.uniform(.75, 1.2)
    for i, x in enumerate(range(110, w, 230)):
        col = c['banners'][i % len(c['banners'])]
        t.add(x - 4, x + 14, f"<rect x='{x}' y='0' width='2.6' height='58' fill='{c['pole']}'/><rect x='{x + 2.6}' y='4' width='11' height='34' fill='{col}'/>"
              f"<rect x='{x + 2.6}' y='4' width='11' height='4' fill='{c['pole']}'/>")
    t.add(0, w, f"<rect y='58' width='{w}' height='26' fill='{c['wall']}'/><rect y='56' width='{w}' height='6' fill='{c['coping']}'/>"
          + ''.join(f"<rect x='{x}' y='62' width='3' height='22' fill='{c['joint']}'/>" for x in range(30, w, 60))
          + f"<rect y='84' width='{w}' height='16' fill='{c['grass']}'/>")
    return t.uri()

def floor(c, cols, seed, edge=0, rows=6, grow=1.32, k=.55):
    """A tiled floor in perspective, stretched to the arena's width: joints converge towards the middle.
    `cols` slabs span the back edge; k is how much narrower the back edge is than the front."""
    r = random.Random(seed)
    B = 100 - edge
    hs = [grow ** i for i in range(rows)]
    ys = [0]
    for hh in hs:
        ys.append(ys[-1] + hh / sum(hs) * B)
    xt = [i * 100 / cols for i in range(-cols, 2 * cols + 1)]
    at = lambda x, y: 50 + (x - 50) * (1 + (1 / k - 1) * y / B)
    line = f"stroke='{c['grout']}' stroke-width='1' vector-effect='non-scaling-stroke'"
    g = [f"<rect width='100' height='100' fill='{c['slab']}'/>"]
    for i in range(rows):
        for j in range(len(xt) - 1):
            q = [(at(xt[j], ys[i]), ys[i]), (at(xt[j + 1], ys[i]), ys[i]), (at(xt[j + 1], ys[i + 1]), ys[i + 1]), (at(xt[j], ys[i + 1]), ys[i + 1])]
            if r.random() < .3 and max(p[0] for p in q) > 0 and min(p[0] for p in q) < 100:
                g.append(poly(q, c['slab2']))
    g += [f"<path d='M0 {num(y)}H100' {line}/>" for y in ys[1:-1]]
    g += [f"<path d='M{num(x)} 0L{num(at(x, B))} {num(B)}' {line}/>" for x in xt if -60 < at(x, B) < 160]
    if edge:
        g.append(f"<rect y='{num(B)}' width='100' height='{edge}' fill='{c['face']}'/>")
        g += [f"<path d='M{num(at(x, B))} {num(B)}V100' {line}/>" for x in xt if 0 < at(x, B) < 100]
        g.append(f"<path d='M0 {num(B)}H100' stroke='{c['lip']}' stroke-width='1.5' vector-effect='non-scaling-stroke'/>")
    return uri(f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>{''.join(g)}</svg>")

def floors(c, seed, **kw):
    """The same floor with more slabs for wider arenas (see the media queries)."""
    return [floor(c, n, seed, **kw) for n in (7, 12, 18)]

# ---- Kami's Lookout ------------------------------------------------------------------------------
def cloud_sea(c, seed, w=1800):
    """The top of a cloud layer seen from above, stretching to the horizon."""
    t = Tile(w, 100, seed)
    r = t.rng
    for base, wmin, wmax, cols in [(62, 180, 300, c['far']), (84, 240, 380, c['near'])]:
        t.add(0, w, f"<rect y='{base - 6}' width='{w}' height='{106 - base}' fill='{cols[1]}'/>")
        x = r.uniform(0, 60)
        while x < w:
            cw = r.uniform(wmin, wmax)
            cumulus(t, x, base, cw, cols)
            x += cw * r.uniform(.45, .65)
    return t.uri()

def palace(c):
    """Kami's palace: a white domed hall with two towers."""
    g = [f"<rect x='40' y='150' width='240' height='14' fill='{c['step']}'/><rect x='40' y='150' width='240' height='3' fill='{c['stepTop']}'/>"]
    for x0 in (62, 228):                                            # towers
        g += [f"<rect x='{x0}' y='92' width='30' height='58' fill='{c['wall']}'/><rect x='{x0}' y='92' width='10' height='58' fill='{c['wallShade']}'/>",
              f"<path d='M{x0 - 3} 92a18 20 0 0 1 36 0Z' fill='{c['dome']}'/><path d='M{x0 - 3} 92a18 20 0 0 1 14-19.4a22 20 0 0 0-4 19.4Z' fill='{c['domeShade']}'/>",
              f"<rect x='{x0 - 4}' y='90' width='38' height='5' fill='{c['band']}'/>",
              f"<path d='M{x0 + 10} 150v-16a5 5 0 0 1 10 0v16Z' fill='{c['arch']}'/><path d='M{x0 + 11} 116v-8a4 4 0 0 1 8 0v8Z' fill='{c['arch']}'/>"]
    g += [f"<rect x='92' y='118' width='136' height='32' fill='{c['wall']}'/>",
          ''.join(f"<path d='M{x} 150v-16a6 6 0 0 1 12 0v16Z' fill='{c['arch']}'/>" for x in (100, 120, 188, 208)),
          f"<rect x='116' y='70' width='88' height='80' fill='{c['wall']}'/><rect x='116' y='70' width='26' height='80' fill='{c['wallShade']}'/>",
          f"<path d='M146 150v-26a14 14 0 0 1 28 0v26Z' fill='{c['arch']}'/>",
          ''.join(f"<path d='M{x} 104v-12a5 5 0 0 1 10 0v12Z' fill='{c['arch']}'/>" for x in (126, 155, 184)),
          f"<rect x='110' y='66' width='100' height='7' fill='{c['band']}'/>",
          f"<path d='M112 66a48 44 0 0 1 96 0Z' fill='{c['dome']}'/><path d='M112 66a48 44 0 0 1 40-43.4a56 44 0 0 0-14 43.4Z' fill='{c['domeShade']}'/>",
          f"<path d='M150 24a10 10 0 0 1 20 0Z' fill='{c['dome']}'/><rect x='158' y='8' width='4' height='14' fill='{c['band']}'/><circle cx='160' cy='8' r='4' fill='{c['dome']}'/>"]
    return svg(320, 164, ''.join(g))

def planters(c, seed, w=1500):
    """Palm trees on patches of grass along the back of the Lookout."""
    t = Tile(w, 100, seed)
    for x, h, lean in [(90, 74, .2), (150, 58, -.18), (700, 80, -.16), (1180, 70, .22), (1230, 52, -.2)]:
        t.add(x - 30, x + 30, f"<ellipse cx='{num(x)}' cy='98' rx='34' ry='5' fill='{c['grass']}'/>")
        palm(t, x, 98, h, c['palm'], lean)
    return t.uri()

# ---- Hyperbolic Time Chamber ---------------------------------------------------------------------
CHAMBER_HOUSE = svg(200, 80,
    "<rect x='30' y='34' width='118' height='44' fill='#fdfcf9' stroke='#d8d1c2' stroke-width='1.2'/>"
    "<path d='M22 34h134l-8-10H30Z' fill='#f1ece1' stroke='#d8d1c2' stroke-width='1.2'/>"
    "<path d='M46 40v38M62 40v38M116 40v38M132 40v38' stroke='#e3ddd0' stroke-width='3'/>"
    "<rect x='78' y='46' width='22' height='32' fill='#8c8476'/><rect x='78' y='46' width='22' height='4' fill='#6f685c'/>")

def moon(c):
    return svg(100, 100, f"<circle cx='50' cy='50' r='50' fill='{c[0]}'/>"
               + ''.join(f"<circle cx='{x}' cy='{y}' r='{rr}' fill='{c[1]}'/>" for x, y, rr in [(34, 36, 11), (62, 30, 6), (58, 62, 14), (28, 66, 6), (76, 50, 5)]))

def stars(seed, n, w=500, h=150):
    t = Tile(w, h, seed)
    r = t.rng
    for _ in range(n):
        x, y, rr = r.uniform(0, w), r.uniform(0, h * .95), r.choice([.8, .8, 1, 1.2, 1.6])
        t.add(x - 2, x + 2, f"<circle cx='{num(x)}' cy='{num(y)}' r='{rr}' fill='#fff' opacity='{num(r.uniform(.5, 1))}'/>")
    for _ in range(3):
        x, y = r.uniform(0, w), r.uniform(0, h * .7)
        t.add(x - 6, x + 6, f"<path d='M{num(x)} {num(y - 5)}L{num(x + 1.2)} {num(y - 1.2)}L{num(x + 5)} {num(y)}L{num(x + 1.2)} {num(y + 1.2)}L{num(x)} {num(y + 5)}L{num(x - 1.2)} {num(y + 1.2)}L{num(x - 5)} {num(y)}L{num(x - 1.2)} {num(y - 1.2)}Z' fill='#fff'/>")
    return t.uri()

# ---- Scenes --------------------------------------------------------------------------------------
def wasteland(p, seed=3):
    far = Tile(2300, 160, seed)
    for x, base, w in [(160, 128, 240), (700, 132, 170), (1120, 126, 300), (1650, 130, 200), (2050, 128, 150)]:
        cumulus(far, x, base, w, p['bank'])
    mesa_range(far, 146, 26, 48, 120, 260, p['far2'], p['far2s'], gap=(30, 120))
    mesa_range(far, 150, 14, 30, 90, 200, p['far'], p['fars'], gap=(40, 140))
    far.add(0, far.w, f"<rect y='146' width='{far.w}' height='14' fill='{p['plain']}'/>")
    mid = Tile(1800, 100, seed + 1)
    butte(mid, 130, 210, 132, 58, p['mid'], strata=2)
    butte(mid, 340, 66, 30, 86, p['mid'], strata=3, talus=.22)
    butte(mid, 430, 120, 62, 38, p['mid'], strata=1)
    hoodoo(mid, 720, 22, 74, 30, p['mid'])
    butte(mid, 1010, 260, 170, 70, p['mid'], strata=3)
    butte(mid, 1180, 150, 90, 44, p['mid'], strata=2)
    butte(mid, 1460, 70, 34, 92, p['mid'], strata=3, talus=.2)
    butte(mid, 1525, 60, 26, 64, p['mid'], strata=2, talus=.25)
    near = Tile(1600, 100, seed + 2)
    hoodoo(near, 260, 34, 92, 50, p['near'])
    boulder(near, 70, 120, 34, p['near'])
    boulder(near, 150, 70, 22, p['near'])
    butte(near, 980, 240, 150, 64, p['near'], strata=3)
    boulder(near, 1130, 90, 26, p['near'])
    boulder(near, 1350, 60, 16, p['near'])
    return dict(far=far.uri(), mid=mid.uri(), near=near.uri(), ground=dirt(p['ground'], seed + 3),
                mark=pod(p['pod']), front=pebbles(p['ground'], seed + 5),
                clouds=clouds(p['cloud'], seed + 4, [(130, 50, 110), (440, 30, 64), (730, 70, 150), (1010, 40, 84), (1200, 74, 54)]))

def namek(p, seed=21):
    far = Tile(2200, 100, seed)
    for x, w, h in [(140, 44, 70), (205, 30, 46), (760, 50, 84), (1300, 36, 58), (1350, 26, 38), (1820, 46, 74)]:
        namek_rock(far, x, 100, w, h, p['farRock'])
    mid = Tile(1700, 100, seed + 1)
    for x, w, h, trees in [(150, 50, 80, [(-.18, 20), (.18, 15)]), (420, 34, 56, [(.05, 16)]), (980, 62, 90, [(-.22, 18), (.1, 24), (.34, 14)]),
                           (1085, 32, 48, []), (1440, 44, 68, [(0, 19)])]:
        namek_rock(mid, x, 96, w, h, p['rock'], trees)
        mid.add(x - w * .5, x + w * .5, f"<ellipse cx='{x}' cy='97' rx='{num(w * .42)}' ry='3' fill='{p['ripple']}'/>")
    near = Tile(1500, 100, seed + 2)
    for x, h in [(80, 86), (122, 64), (520, 92), (566, 70), (606, 52), (1090, 88), (1140, 62)]:
        ajisa(near, x, 100, h, p['tree'])
    marks = Tile(240, 100, seed + 3)
    marks.add(0, 0, f"<ellipse cx='120' cy='96' rx='112' ry='5' fill='{p['grass']['patch']}'/>")
    namek_house(marks, 80, 96, 92, p['house'])
    namek_house(marks, 170, 97, 64, p['house'])
    return dict(far=far.uri(), mid=mid.uri(), near=near.uri(), mark=marks.uri(wrap=False),
                ground=grass(p['grass'], seed + 4, shore=p['shore']), front=tufts(p['grass'], seed + 5),
                sea=water(p['glint'], seed + 6),
                clouds=clouds(p['cloud'], seed + 7, [(160, 54, 100), (560, 36, 60), (900, 70, 130), (1180, 44, 70)]))

def kamehouse(p, seed=31):
    near = Tile(2600, 100, seed + 4)
    for x, h, lean in [(160, 92, .2), (205, 70, -.16), (1350, 86, -.18)]:
        palm(near, x, 99, h, p['house']['palm'], lean)
    for x, w, h in [(250, 34, 12), (276, 18, 7), (1400, 26, 9), (2100, 40, 14), (2130, 20, 8)]:
        boulder(near, x, w, h, p['rock'], 100)
    return dict(far=islands(p['islands'], seed), sea=p['sea'], waves=waves(p['crest'], seed + 1), mark=kame_house(p['house']), near=near.uri(),
                ground=sand(p['sand'], seed + 2),
                clouds=clouds(p['cloud'], seed + 3, [(150, 50, 120), (470, 30, 70), (760, 72, 160), (1070, 40, 90)]))

def tournament(p, seed=41):
    far = Tile(2000, 100, seed)
    hills(far, 100, 40, 80, 260, 420, p['hill2'], p['hill2s'])
    hills(far, 100, 20, 46, 200, 340, p['hill'], p['hills'], gap=(40, 160))
    mid = Tile(1600, 100, seed + 1)
    for x, h, lean in [(60, 86, .18), (110, 66, -.15), (640, 92, -.14), (1010, 78, .2), (1300, 88, .16), (1350, 64, -.2)]:
        palm(mid, x, 100, h, p['palm'], lean)
    return dict(far=far.uri(), mid=mid.uri(), land=temple(p['temple']), near=crowd(p['crowd'], seed + 2),
                ground=floors(p['ring'], seed + 3, edge=9),
                clouds=clouds(p['cloud'], seed + 4, [(140, 52, 110), (480, 32, 64), (780, 70, 150), (1080, 42, 84)]))

def lookout(p, seed=51):
    return dict(far=cloud_sea(p['sea'], seed), land=palace(p['palace']), near=planters(p, seed + 1),
                ground=floors(p['floor'], seed + 2, rows=5, edge=7),
                clouds=clouds(p['cloud'], seed + 3, [(200, 46, 90), (620, 64, 130), (1000, 34, 60)]))

PALM = dict(trunk='#b98a5a', trunkShade='#8e6440', ring='#7d5636', lit='#4fae4f', shade='#2f7f3c', nut='#6b4a2a')
WASTE = dict(
    far2='#d2b8c6', far2s='#c2a5b8', far='#c4a1ae', fars='#b48ea0', plain='#e2c8b0',
    cloud=('#ffffff', '#e2eaf4', '#c4d3e7'), bank=('#f4f1f2', '#e3dde6', '#d3cbdb'),
    mid=dict(lit='#d9906a', shade='#a9654d', talus='#d49c78', strata='#bf7553', cap='#eaae88', capShade='#bd7c60', rim='#eeb08c'),
    near=dict(lit='#df8a53', shade='#9b5034', talus='#d9935f', strata='#c0683a', cap='#f2ad79', capShade='#b2633d', rim='#f5b37f'),
    ground=dict(base='#e0b47c', haze='#e6c193', patch='#d5a56f', crack='#b37c4e', pebble='#a9724a', pebbleHi='#f0c896',
                rock='#cd8b57', rockShade='#9e5f39', rockHi='#e8b07d', tuft='#b3a45c', tuftShade='#8f8144'),
    pod=dict(rim='#e9c290', pit='#b98352', lip='#c99360', shell='#f4f2ee', shellShade='#c9c4bd', seam='#b3ada6',
             frame='#a39c95', glass='#8c2c55', hole='#3b2d36', rock='#cd8b57', rockShade='#9e5f39', rockHi='#e8b07d'),
)
NIGHT = dict(
    far2='#3a3d70', far2s='#33356a', far='#30315f', fars='#2a2a58', plain='#3b3a69',
    cloud=('#59609a', '#474e87', '#3a4077'), bank=('#4a5088', '#3f457a', '#363b6d'),
    mid=dict(lit='#403c6c', shade='#2e2a56', talus='#3e3b69', strata='#37335f', cap='#5b5b93', capShade='#3a3666', rim='#6a69a8'),
    near=dict(lit='#3b3161', shade='#251f45', talus='#39305d', strata='#302853', cap='#57518b', capShade='#2f2852', rim='#6f69a7'),
    ground=dict(base='#4a4271', haze='#575181', patch='#433b69', crack='#352d58', pebble='#332b55', pebbleHi='#6b639a',
                rock='#41385f', rockShade='#2a2346', rockHi='#60588d', tuft='#525d7d', tuftShade='#3e4668'),
    pod=dict(rim='#57517f', pit='#3a3360', lip='#463f6c', shell='#c9cbe0', shellShade='#8f92b3', seam='#7d80a3',
             frame='#7c7f9e', glass='#6a2a52', hole='#221b30', rock='#41385f', rockShade='#2a2346', rockHi='#60588d'),
)
NAMEK = dict(
    cloud=('#fbfff6', '#e1f2dc', '#c6e3c4'),
    farRock=dict(lit='#a5d1c0', shade='#97c4b3', rim='#b2dbca', strata='#9dcab8', grass='#93cbb0', grassLit='#a3d5bc'),
    rock=dict(lit='#8fb2a5', shade='#6a8c84', rim='#a8c7ba', strata='#7fa196', grass='#4aa77c', grassLit='#6cc495', trunk='#5e8170',
              crown=('#86d6a6', '#58b886', '#3c9a70')),
    ripple='#a9e0d1',
    tree=dict(trunk='#55796a', crown=('#8fdbb0', '#5fbd8e', '#3f9c76')),
    house=dict(wall='#f4f6ee', wallShade='#ccd5ca', band='#b9c4b8', frame='#c0cbc0', glass='#4f7488', door='#5e7a82', pipe='#b0bcb0'),
    grass=dict(base='#5db497', haze='#7fc8ae', patch='#52a88b', tuft='#7fd2b0', tuftShade='#3f977b', flowers=26, flower='#f4f0b8'),
    shore='#9bd9c6', glint='#a6e2d3',
)
KAME = dict(
    cloud=('#ffffff', '#e4f0fa', '#c7dcef'),
    islands=('#8ec3c0', '#7cb3b2'), crest='#e8f7ff', sea='linear-gradient(#2b7fd0,#3d9ddf 55%,#55b8e6)',
    house=dict(wall='#f6b4b0', wallShade='#dc8f90', wallBase='#e09a98', roof='#e2473d', roofShade='#b3312e', roofLine='#cc3b34', eave='#9c2a28',
               text='#d1302c', frame='#fbf4ea', door='#4f8a62', glass='#a9dcf2', step='#d8d2c4', sandShade='#e2c07e',
               palm=PALM),
    sand=dict(base='#f3d9a0', wet='#e0be82', foam='#fbfaf2', ripple='#e6c588', pebble='#cfae78', shell='#fbefe4'),
    rock=dict(lit='#a39486', shade='#7a6c62', cap='#bfb1a2'),
)
TOURNAMENT = dict(
    cloud=('#ffffff', '#e2edf7', '#c5d8ec'),
    hill2='#a8c4d4', hill2s='#9ab7c9', hill='#8db3a6', hills='#7da596',
    trees=('#7cc06a', '#5aa253', '#3f8545'), palm=PALM,
    temple=dict(wall='#f4eee1', wallShade='#ddd3c0', pillar='#c8452f', door='#4a2f25', sign='#2f5d8c', roof='#e8792f', roofShade='#c65d24',
                roofLine='#cf6526', eave='#9e3f1c', ridge='#a8461f', plinth='#cfc6b4', plinthTop='#e2dacb'),
    crowd=dict(wall='#e8dfcd', coping='#d2c6ae', joint='#d5cab4', grass='#63ad5a', pole='#7a5a3a',
               banners=['#d8473a', '#f3efe4', '#2f6db0', '#e9b23c'],
               shirts=['#c9625b', '#5f84b8', '#d9b45f', '#6f9e72', '#ece8de', '#8a78ad', '#d98b4e', '#4d5868'],
               hair=['#2b2420', '#2b2420', '#5a3a24', '#e3c26a', '#9b9b9b', '#7a2f22'], skin=['#f5d0b0', '#e8b890', '#c99472']),
    ring=dict(slab='#e7e3d9', slab2='#dfdacf', grout='#b3ab9b', face='#c4bcaa', lip='#f4f1ea'),
)
LOOKOUT = dict(
    cloud=('#ffffff', '#e6eef8', '#ccdcef'),
    sea=dict(far=('#f7fafd', '#e4edf6', '#d3e1ef'), near=('#ffffff', '#e8f0f8', '#cfdeee')),
    palace=dict(wall='#f6f3ec', wallShade='#dcd6c8', dome='#fbfaf6', domeShade='#ded8cb', band='#e3dccd', arch='#6f7f93',
                step='#e6e0d3', stepTop='#f5f2ea'),
    palm=PALM, grass='#6bb35f',
    floor=dict(slab='#f2ede2', slab2='#ece6da', grout='#d4cab7', face='#d8cebb', lip='#fbf9f4'),
)

themes = {
    'wasteland': dict(sky='linear-gradient(#3e7ecf,#79ade2 45%,#d3e2e6 72%,#f0dcb6 88%)', sun='#fff4d4', **wasteland(WASTE)),
    'namek': dict(sky='linear-gradient(#58c08c,#93d9a8 45%,#d0efc4 72%,#eef8d2 88%)', sun='#fdfde6', **namek(NAMEK)),
    'kamehouse': dict(sky='linear-gradient(#3a96e0,#76bdee 45%,#bfe4f8 72%,#e9f7ff 86%)', sun='#fffbe6', **kamehouse(KAME)),
    'tournament': dict(sky='linear-gradient(#3f8fdc,#7bb9ea 45%,#c2e1f5 72%,#eaf6fc 88%)', sun='#fffbe6', **tournament(TOURNAMENT)),
    'lookout': dict(sky='linear-gradient(#2a6fcc,#5b9de4 40%,#a9d0f2 66%,#e2f0fb 84%)', sun='#fffdf0', **lookout(LOOKOUT)),
    'chamber': dict(sky='linear-gradient(#e6e2d9,#fbfaf6 60%)', land=CHAMBER_HOUSE,
                    ground=floors(dict(slab='#f4f1ea', slab2='#efebe2', grout='#ddd6c8'), 61)),
    'night': dict(sky='linear-gradient(#0b1233,#1d2757 45%,#363c75 75%,#544d84 92%)', sun=moon(('#f3efd6', '#dcd5b6')) + ' center/100%',
                  stars=stars(71, 60), **wasteland(NIGHT)),
}

out = ["/* Generated by tools/scenes.py: arena backgrounds. Most layers repeat sideways so wide panels work. */",
 ".scene{position:absolute;inset:0;z-index:-2;overflow:hidden}",
 ".scene i{position:absolute;left:0;right:0;display:block;background-repeat:repeat-x;background-size:auto 100%;background-position:0 100%}",
 ".scene .sky{inset:0}",
 ".scene .sun{left:auto;right:12%;bottom:44%;width:min(10%,36px);aspect-ratio:1;border-radius:50%}",
 ".scene .stars{top:0;height:70%}",
 ".scene .clouds{top:3%;right:auto;width:calc(100% + 1300px);height:70px;background-size:1300px 70px;animation:cloudDrift 360s linear infinite}",
 "@keyframes cloudDrift{to{transform:translateX(-1300px)}}",
 ".scene .far{bottom:19%;height:38%;max-height:112px}",
 ".scene .sea{bottom:19%;height:12%}",
 ".scene .mid{bottom:19%;height:31%;max-height:88px}",
 ".scene .land{bottom:20%;height:40%;max-height:110px;background-repeat:no-repeat}",
 ".scene .near{bottom:19%;height:34%;max-height:84px;background-position:-60px 100%}",
 ".scene .ground{bottom:0;height:21%}",
 ".scene .mark{bottom:11%;height:16%;max-height:44px;background-repeat:no-repeat;background-position:64% 100%}",
 ".scene .front{bottom:0;height:7%}",
]
LAYERS = ['sky', 'sun', 'stars', 'clouds', 'far', 'sea', 'mid', 'land', 'near', 'ground', 'mark', 'front']
for name, t in themes.items():
    sel = f"body[data-scene='{name}'] .scene" if name != 'wasteland' else ".scene"
    for layer in LAYERS:
        v = t.get(layer)
        if isinstance(v, list):     # a stretched floor: more slabs on wider arenas
            out.append(f"{sel} .{layer}{{background:{v[0]} 0 0/100% 100% no-repeat}}")
            out.append(f"@media(min-width:520px){{{sel} .{layer}{{background-image:{v[1]}}}}}")
            out.append(f"@media(min-width:1000px){{{sel} .{layer}{{background-image:{v[2]}}}}}")
            continue
        prop = 'background' if layer in ('sky', 'sun') else 'background-image'
        out.append(f"{sel} .{layer}{{{prop}:{v or 'none'}}}")
out += [
 # Night: stars twinkle, the moon sits higher.
 "body[data-scene='night'] .scene .stars::after{content:'';position:absolute;inset:0;background:inherit;background-position:180px 40px;animation:twinkle 5s ease-in-out infinite alternate}",
 "@keyframes twinkle{from{opacity:.15}to{opacity:1}}",
 "body[data-scene='night'] .scene .sun{bottom:52%;right:14%;width:min(11%,40px);border-radius:50%}",
 "body[data-scene='night'] .scene .clouds{opacity:.85}",
 # Namek: three suns over a green sea with rock columns.
 "body[data-scene='namek'] .scene .sun{bottom:58%;right:16%;width:min(8%,26px);box-shadow:-24px 9px 0 -7px #fdfde6,17px 17px 0 -10px #fdfde6}",
 "body[data-scene='namek'] .scene .sea{bottom:19%;height:12%;background-color:#4fa7a0;background-size:auto 100%}",
 "body[data-scene='namek'] .scene .far{bottom:30.5%;height:13%;max-height:40px}",
 "body[data-scene='namek'] .scene .mid{bottom:21.5%;height:30%;max-height:86px}",
 "body[data-scene='namek'] .scene .near{height:32%;max-height:84px;background-position:-40px 100%}",
 "body[data-scene='namek'] .scene .mark{bottom:12%;height:20%;max-height:56px;background-position:24% 100%}",
 "body[data-scene='namek'] .scene .front{height:9%;max-height:26px}",
 # Kame House: open sea, the house on the beach.
 "body[data-scene='kamehouse'] .scene .sea{bottom:19%;height:17%;overflow:hidden}",
 "body[data-scene='kamehouse'] .scene .sea::after{content:'';position:absolute;top:0;bottom:0;left:0;width:calc(100% + 600px);background:" + themes['kamehouse']['waves'] + " 0 0/600px 100% repeat-x;animation:waveDrift 14s linear infinite}",
 "@keyframes waveDrift{to{transform:translateX(-600px)}}",
 "body[data-scene='kamehouse'] .scene .far{bottom:35.6%;height:6%;max-height:16px}",
 "body[data-scene='kamehouse'] .scene .mark{bottom:13%;height:42%;max-height:118px;background-position:right 8% bottom}",
 "body[data-scene='kamehouse'] .scene .sun{bottom:58%}",
 # Tenkaichi Budokai: the hall behind the crowd, the ring in front.
 "body[data-scene='tournament'] .scene .far{height:26%;max-height:72px}",
 "body[data-scene='tournament'] .scene .mid{bottom:27%;height:26%;max-height:72px}",
 "body[data-scene='tournament'] .scene .land{bottom:27%;height:36%;max-height:100px;background-position:30% 100%}",
 "body[data-scene='tournament'] .scene .near{height:22%;max-height:60px;background-position:0 100%}",
 "body[data-scene='tournament'] .scene .sun{bottom:60%}",
 # Kami's Lookout: above the clouds.
 "body[data-scene='lookout'] .scene .far{height:16%;max-height:44px}",
 "body[data-scene='lookout'] .scene .land{bottom:20.5%;height:42%;max-height:118px;background-position:68% 100%}",
 "body[data-scene='lookout'] .scene .near{height:40%;max-height:104px}",
 "body[data-scene='lookout'] .scene .sun{bottom:62%}",
 # Hyperbolic Time Chamber: an endless white void.
 "body[data-scene='chamber'] .scene .land{bottom:20.5%;height:28%;max-height:80px;background-position:8% 100%}",
]
open(sys.argv[1], 'w').write("\n".join(out) + "\n")
