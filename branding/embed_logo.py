"""Embed the Infobhan PNG into logo.svg for AuthLayout (assets/logo.svg)."""

from pathlib import Path
import base64

root = Path(__file__).resolve().parent
png = root / "infobhan-logo.png"
if not png.is_file():
    raise SystemExit(f"missing {png}")

b64 = base64.b64encode(png.read_bytes()).decode("ascii")
svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
     width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="Infobhan AI">
  <image width="512" height="512" preserveAspectRatio="xMidYMid meet"
         xlink:href="data:image/png;base64,{b64}"/>
</svg>
"""

targets = [
    root / "logo.svg",
    root.parent / "client" / "public" / "assets" / "logo.svg",
]
for target in targets:
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(svg, encoding="utf-8")
    print(f"wrote {target} ({target.stat().st_size} bytes)")
