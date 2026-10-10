#!/usr/bin/env python3
"""Refresh the client demo from the HMI repository; keep client changes here."""
import argparse
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="HMI docs/images/theme/hmi-web-demo.html")
    args = parser.parse_args()
    document = args.source.read_text(encoding="utf-8")
    # The HMI page keeps its engineering-document links between these markers;
    # the client page drops them and keeps the simulated-data note.
    document, count = re.subn(
        r'\s*<!-- engineering-links:begin.*?<!-- engineering-links:end -->',
        '', document, count=1, flags=re.DOTALL,
    )
    if count != 1 or '.md"' in document:
        raise ValueError("Demo wrapper changed; review client adaptation before syncing")
    document = document.replace('<meta charset="utf-8">',
        '<meta charset="utf-8">\n<meta name="robots" content="noindex, nofollow">', 1)
    document = document.replace('<title>Furnace HMI Web Demo</title>',
        '<title>Telamorph | HMI Web Demo</title>', 1)
    (ROOT / "hmi-web-demo.html").write_text(document, encoding="utf-8", newline="\n")
    print("Updated hmi-web-demo.html; run python scripts/build_site.py next")

if __name__ == "__main__":
    main()
