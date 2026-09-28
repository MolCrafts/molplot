"""``python -m molplot.host script.py`` is an alias for ``molplot serve``."""

from __future__ import annotations

import sys

from molplot.cli import main

main(["serve", *sys.argv[1:]])
