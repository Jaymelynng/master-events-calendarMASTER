#!/usr/bin/env python3
"""Print check_* keys from validation_engine.CHECK_REGISTRY for doc / DB alignment."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from validation_engine import CHECK_REGISTRY  # noqa: E402


def main() -> None:
    keys = sorted(CHECK_REGISTRY.keys())
    print("CHECK_REGISTRY (%d functions):" % len(keys))
    for k in keys:
        print(f"  {k}")


if __name__ == "__main__":
    main()
