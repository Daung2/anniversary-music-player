from pathlib import Path
from math import sin, cos, pi
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"


def mix(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size=1024):
    start = (255, 226, 236)
    end = (199, 183, 231)
    image = Image.new("RGB", (size, size))
    pixels = image.load()
    for y in range(size):
        for x in range(size):
            t = (x / size * 0.45) + (y / size * 0.55)
            pixels[x, y] = mix(start, end, t)
    return image


def heart_points(cx, cy, scale, count=360):
    points = []
    for index in range(count):
        t = 2 * pi * index / count
        x = 16 * sin(t) ** 3
        y = 13 * cos(t) - 5 * cos(2 * t) - 2 * cos(3 * t) - cos(4 * t)
        points.append((cx + x * scale, cy - y * scale))
    return points


def make_icon(size=1024, maskable=False):
    image = gradient(size)
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)

    cx, cy = size / 2, size / 2 + size * 0.035
    scale = size * (0.022 if maskable else 0.026)
    points = heart_points(cx, cy, scale)

    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(glow).polygon(points, fill=(255, 255, 255, 150))
    glow = glow.filter(ImageFilter.GaussianBlur(size * 0.035))
    image = Image.alpha_composite(image.convert("RGBA"), glow)

    draw.polygon(points, fill=(255, 255, 255, 245))
    draw.ellipse(
        (size * 0.71, size * 0.18, size * 0.75, size * 0.22),
        fill=(255, 255, 255, 220),
    )
    draw.ellipse(
        (size * 0.24, size * 0.27, size * 0.27, size * 0.30),
        fill=(255, 255, 255, 190),
    )
    draw.ellipse(
        (size * 0.79, size * 0.65, size * 0.815, size * 0.675),
        fill=(255, 255, 255, 170),
    )
    image = Image.alpha_composite(image, layer)
    return image.convert("RGB")


def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)
    icon = make_icon()
    maskable = make_icon(maskable=True)
    icon.resize((512, 512), Image.Resampling.LANCZOS).save(PUBLIC / "icon-512.png", quality=95)
    icon.resize((192, 192), Image.Resampling.LANCZOS).save(PUBLIC / "icon-192.png", quality=95)
    maskable.resize((512, 512), Image.Resampling.LANCZOS).save(PUBLIC / "icon-maskable-512.png", quality=95)
    icon.resize((180, 180), Image.Resampling.LANCZOS).save(PUBLIC / "apple-touch-icon.png", quality=95)
    print("Generated PWA icons in public/")


if __name__ == "__main__":
    main()
