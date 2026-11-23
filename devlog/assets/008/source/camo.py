# The "20-line artist" from Devlog #008: paints camo onto the baked base color
# map, but only where the ID map says Body (red) or Magazine (magenta).
#   python3 camo.py basecolor.png id.png camo_tex.png
import random, sys
from PIL import Image, ImageFilter

base = Image.open(sys.argv[1]).convert('RGB')
idm = Image.open(sys.argv[2]).convert('RGB')
W = base.width
random.seed(7)

def noise(scale):
    n = Image.new('L', (W // scale, W // scale))
    n.putdata([random.randint(0, 255) for _ in range((W // scale) ** 2)])
    return n.resize((W, W), Image.BICUBIC).filter(ImageFilter.GaussianBlur(scale / 3))

n1, n2 = noise(24), noise(16)
camo = [(70, 84, 48), (128, 112, 72), (40, 40, 30), (168, 152, 104)]
px, ip, a, b = base.load(), idm.load(), n1.load(), n2.load()
for y in range(W):
    for x in range(W):
        if ip[x, y] in {(255, 0, 0), (255, 0, 255)}:
            v, u = a[x, y], b[x, y]
            c = camo[0] if v < 115 else camo[1] if v < 145 else camo[3]
            px[x, y] = camo[2] if u > 160 else c
base.save(sys.argv[3])
