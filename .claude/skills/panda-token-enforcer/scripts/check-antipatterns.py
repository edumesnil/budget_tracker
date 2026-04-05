#!/usr/bin/env python3
"""
Panda CSS / Park UI Anti-Pattern Scanner

Scans .tsx/.ts files for common violations of Park UI and Panda CSS conventions.
Outputs violations with file, line number, category, severity, and suggested fix.

Usage:
    python3 check-antipatterns.py <file_or_directory> [--json] [--severity=high]
"""

import re
import sys
import os
import json
from dataclasses import dataclass, field, asdict
from pathlib import Path
from typing import Optional


@dataclass
class Violation:
    file: str
    line: int
    category: str
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW
    code: str
    message: str
    suggestion: str


def scan_file(filepath: str) -> list[Violation]:
    """Scan a single file for anti-patterns."""
    violations = []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            lines = f.readlines()
    except (UnicodeDecodeError, FileNotFoundError):
        return violations

    content = "".join(lines)
    is_theme_file = any(
        p in filepath
        for p in ["/theme/", "panda.config", "global-css", "/recipes/"]
    )

    for i, line in enumerate(lines, 1):
        stripped = line.strip()

        # Skip comments and imports
        if stripped.startswith("//") or stripped.startswith("*") or stripped.startswith("import "):
            continue

        # === Category 1: Hardcoded values inside css() ===
        # Look for hex colors
        hex_match = re.search(r"""css\(\s*\{[^}]*['"]#[0-9a-fA-F]{3,8}['"]""", line)
        if not hex_match:
            # Also check if we're inside a css() block (multi-line)
            if re.search(r"""['"]#[0-9a-fA-F]{3,8}['"]""", line) and _in_css_block(lines, i):
                violations.append(Violation(
                    file=filepath, line=i, category="hardcoded-color",
                    severity="HIGH", code=stripped,
                    message="Hardcoded hex color found. Use a Panda CSS token instead.",
                    suggestion="Replace with semantic token: 'fg.default', 'fg.muted', 'bg.subtle', 'border.default', 'accent.default', etc."
                ))
        else:
            violations.append(Violation(
                file=filepath, line=i, category="hardcoded-color",
                severity="HIGH", code=stripped,
                message="Hardcoded hex color in css() call.",
                suggestion="Replace with semantic token: 'fg.default', 'fg.muted', 'bg.subtle', 'border.default', 'accent.default', etc."
            ))

        # RGB/RGBA values
        if re.search(r"""rgba?\(\s*\d""", line) and (_in_css_block(lines, i) or "css(" in line):
            violations.append(Violation(
                file=filepath, line=i, category="hardcoded-color",
                severity="HIGH", code=stripped,
                message="Hardcoded rgb/rgba color. Use a Panda CSS token.",
                suggestion="Replace with a semantic color token from your theme."
            ))

        # Pixel values in css() (but not in theme/config files)
        if not is_theme_file and re.search(r"""['"][\d.]+px['"]""", line) and (_in_css_block(lines, i) or "css(" in line):
            violations.append(Violation(
                file=filepath, line=i, category="hardcoded-size",
                severity="MEDIUM", code=stripped,
                message="Hardcoded pixel value. Use a Panda CSS spacing/size token.",
                suggestion="Replace with token: '1' (4px), '2' (8px), '3' (12px), '4' (16px), '6' (24px), '8' (32px), etc."
            ))

        # === Category 2: Manual borders ===
        border_props = re.search(
            r"""(?:borderWidth|borderBottom|borderTop|borderLeft|borderRight|borderColor)\s*[:=]""",
            line,
        )
        if border_props and (_in_css_block(lines, i) or "css(" in line) and not is_theme_file:
            violations.append(Violation(
                file=filepath, line=i, category="manual-border",
                severity="HIGH", code=stripped,
                message="Manual border property. Park UI recipes (Table, Card) handle borders.",
                suggestion="Use Card.Root for containers. Table recipe handles cell borders via box-shadow. Remove manual border props."
            ))

        # border: '1px solid' pattern (but allow border: 'none')
        if re.search(r"""border\s*:\s*['"][^'"]*solid""", line) and (_in_css_block(lines, i) or "css(" in line):
            violations.append(Violation(
                file=filepath, line=i, category="manual-border",
                severity="HIGH", code=stripped,
                message="Manual 'border: solid' in css(). Recipes handle component borders.",
                suggestion="Use Card.Root for bordered containers. If you need a divider, use a recipe or semantic token."
            ))

        # === Category 3: Duplicated recipe styles ===
        # Table.Header/Table.Cell with recipe-handled props
        if re.search(r"""Table\.(Header|Cell).*className.*css\(""", line) or \
           (re.search(r"""Table\.(Header|Cell)""", content) and "css({" in line):
            recipe_props = re.findall(
                r"""\b(fontSize|fontWeight|px|py|color|letterSpacing)\s*:""", line
            )
            if recipe_props:
                violations.append(Violation(
                    file=filepath, line=i, category="duplicated-recipe",
                    severity="MEDIUM", code=stripped,
                    message=f"Table recipe already sets {', '.join(recipe_props)} on this slot.",
                    suggestion="Remove these props. Only add textAlign or width — the recipe handles the rest."
                ))

        # Table.Row with manual hover
        if re.search(r"""Table\.Row.*_hover""", line) or \
           (re.search(r"""_hover\s*:\s*\{.*bg""", line) and "Table" in content):
            violations.append(Violation(
                file=filepath, line=i, category="duplicated-recipe",
                severity="MEDIUM", code=stripped,
                message="Manual hover on Table.Row. Use the 'interactive' prop on Table.Root instead.",
                suggestion="<Table.Root interactive> — this enables hover styling via the recipe."
            ))

        # Field.Label with styling
        if re.search(r"""Field\.Label.*className.*css\(""", line):
            violations.append(Violation(
                file=filepath, line=i, category="duplicated-recipe",
                severity="MEDIUM", code=stripped,
                message="Field.Label recipe handles fontSize, fontWeight, color.",
                suggestion="Remove className from Field.Label. The recipe styles it correctly."
            ))

        # Select.ItemGroupLabel with styling
        if re.search(r"""Select\.ItemGroupLabel.*className""", line):
            violations.append(Violation(
                file=filepath, line=i, category="duplicated-recipe",
                severity="MEDIUM", code=stripped,
                message="Select.ItemGroupLabel recipe handles all styling.",
                suggestion="Remove className entirely. The recipe provides px, py, fontSize, fontWeight, color."
            ))

        # === Category 4: Raw HTML elements ===
        # Raw <label> with css()
        if re.search(r"""<label\s[^>]*className.*css\(""", line) and "Field" not in line:
            violations.append(Violation(
                file=filepath, line=i, category="raw-html",
                severity="CRITICAL", code=stripped,
                message="Raw <label> with custom CSS. Use Field.Label inside Field.Root.",
                suggestion="<Field.Root><Field.Label>...</Field.Label></Field.Root>"
            ))

        # Raw <input> with css() (check it's not an import or Park UI ref)
        if re.search(r"""<input\s[^>]*className.*css\(""", line, re.IGNORECASE):
            violations.append(Violation(
                file=filepath, line=i, category="raw-html",
                severity="CRITICAL", code=stripped,
                message="Raw <input> with custom CSS. Use Park UI Input component.",
                suggestion="import { Input } from '@/components/ui/input' — wrap in Field.Root for labels/errors."
            ))

        # Raw <select> (not Select.*)
        if re.search(r"""<select[\s>]""", line) and "Select." not in line:
            violations.append(Violation(
                file=filepath, line=i, category="raw-html",
                severity="CRITICAL", code=stripped,
                message="Raw <select> element. Use Park UI Select component.",
                suggestion="import * as Select from '@/components/ui/select'"
            ))

        # Raw <table> (not Table.*)
        if re.search(r"""<table[\s>]""", line) and "Table." not in line:
            violations.append(Violation(
                file=filepath, line=i, category="raw-html",
                severity="CRITICAL", code=stripped,
                message="Raw <table> element. Use Park UI Table component.",
                suggestion="import * as Table from '@/components/ui/table'"
            ))

        # === Category 5: Manual behavior reimplementation ===
        # useState + onMouseEnter/onMouseLeave (hover tracking)
        if re.search(r"""onMouse(Enter|Leave)\s*=.*set""", line):
            violations.append(Violation(
                file=filepath, line=i, category="manual-behavior",
                severity="HIGH", code=stripped,
                message="Manual mouse enter/leave handler. Check if the zag-js machine handles this.",
                suggestion="Toast: use pauseOnInteraction. Tooltip: built-in. Carousel: built-in pause on hover."
            ))

        # addEventListener for outside click
        if re.search(r"""addEventListener\s*\(\s*['"](?:mousedown|click|pointerdown)['"]""", line):
            violations.append(Violation(
                file=filepath, line=i, category="manual-behavior",
                severity="HIGH", code=stripped,
                message="Manual outside-click listener. Zag machines handle this via closeOnInteractOutside.",
                suggestion="Dialog, Popover, Menu, Select all have closeOnInteractOutside (default: true)."
            ))

        # addEventListener for Escape key
        if re.search(r"""addEventListener\s*\(\s*['"]keydown['"]""", line) and "Escape" in content:
            violations.append(Violation(
                file=filepath, line=i, category="manual-behavior",
                severity="HIGH", code=stripped,
                message="Manual Escape key handler. Zag machines handle this via closeOnEscape.",
                suggestion="Dialog, Popover, Menu, Select, Tooltip all handle Escape built-in."
            ))

        # document.body.style.overflow (scroll lock)
        if re.search(r"""document\.body\.style\.overflow""", line):
            violations.append(Violation(
                file=filepath, line=i, category="manual-behavior",
                severity="HIGH", code=stripped,
                message="Manual scroll lock. Dialog/Drawer machine handles this via preventScroll.",
                suggestion="Dialog.Root with modal={true} (default) prevents body scroll automatically."
            ))

        # Manual focus() calls near dialog patterns
        if re.search(r"""\.focus\(\)""", line) and any(
            kw in content for kw in ["Dialog", "Popover", "Menu", "Drawer"]
        ):
            violations.append(Violation(
                file=filepath, line=i, category="manual-behavior",
                severity="MEDIUM", code=stripped,
                message="Manual .focus() call near a dialog/overlay component. Zag manages focus.",
                suggestion="Dialog: trapFocus (default true). Popover: autoFocus. Let the machine handle it."
            ))

        # getBoundingClientRect for positioning
        if re.search(r"""getBoundingClientRect""", line) and any(
            kw in content
            for kw in ["Tooltip", "Popover", "Select", "Menu", "Combobox", "DatePicker"]
        ):
            violations.append(Violation(
                file=filepath, line=i, category="manual-behavior",
                severity="HIGH", code=stripped,
                message="Manual positioning via getBoundingClientRect. Zag uses floating-ui.",
                suggestion="Use the 'positioning' prop: positioning={{ placement: 'bottom-start', flip: true }}"
            ))

        # === Category 6: Inline styles ===
        if re.search(r"""\bstyle\s*=\s*\{\{""", line):
            # Allow dynamic width/height/transform which sometimes need runtime values
            if not re.search(r"""(?:width|height|transform|top|left|right|bottom)\s*:.*[`$]""", line):
                violations.append(Violation(
                    file=filepath, line=i, category="inline-style",
                    severity="HIGH", code=stripped,
                    message="Inline style={{}} attribute. Use css() from Panda CSS.",
                    suggestion="Replace style={{...}} with className={css({...})} using Panda tokens."
                ))

        # === Category 7: Token syntax in config ===
        if is_theme_file:
            # Look for unbraced token references
            token_ref = re.search(
                r"""['"](?:colors|spacing|fontSizes|fonts|radii|shadows|sizes)\.[a-zA-Z][\w.]*['"]""",
                line,
            )
            if token_ref and "{" not in token_ref.group():
                violations.append(Violation(
                    file=filepath, line=i, category="token-syntax",
                    severity="MEDIUM", code=stripped,
                    message="Token reference missing curly braces. Will output literal string.",
                    suggestion="Wrap in braces: '{colors.border.subtle}' not 'colors.border.subtle'"
                ))

        # === Extra: fontFamily: 'mono' ===
        if re.search(r"""fontFamily\s*:\s*['"]mono['"]""", line):
            violations.append(Violation(
                file=filepath, line=i, category="invalid-token",
                severity="MEDIUM", code=stripped,
                message="fontFamily: 'mono' is not a Park UI default token.",
                suggestion="Remove it, or define a 'mono' font token in panda.config.ts if needed."
            ))

    return violations


def _in_css_block(lines: list[str], current_line: int, lookback: int = 10) -> bool:
    """Heuristic: check if current line is inside a css() or css({}) block."""
    start = max(0, current_line - lookback - 1)
    block = "".join(lines[start : current_line])
    # Count unmatched css( opens
    css_opens = len(re.findall(r"css\(\s*\{", block))
    closes = len(re.findall(r"\}\s*\)", block))
    return css_opens > closes


def scan_path(path: str) -> list[Violation]:
    """Scan a file or directory recursively."""
    violations = []
    p = Path(path)

    if p.is_file():
        if p.suffix in (".tsx", ".ts", ".jsx", ".js"):
            violations.extend(scan_file(str(p)))
    elif p.is_dir():
        for ext in ("**/*.tsx", "**/*.ts", "**/*.jsx"):
            for f in p.glob(ext):
                # Skip node_modules and generated files
                fstr = str(f)
                if "node_modules" in fstr or "styled-system" in fstr or ".next" in fstr:
                    continue
                violations.extend(scan_file(fstr))
    else:
        print(f"Error: {path} is not a file or directory", file=sys.stderr)
        sys.exit(1)

    return violations


def format_violations(violations: list[Violation], as_json: bool = False) -> str:
    """Format violations for output."""
    if as_json:
        return json.dumps([asdict(v) for v in violations], indent=2)

    if not violations:
        return "No violations found."

    # Group by severity
    by_severity = {"CRITICAL": [], "HIGH": [], "MEDIUM": [], "LOW": []}
    for v in violations:
        by_severity.get(v.severity, by_severity["LOW"]).append(v)

    output = []
    total = len(violations)
    output.append(f"\n{'='*60}")
    output.append(f"  SCAN RESULTS: {total} violation{'s' if total != 1 else ''} found")
    output.append(f"{'='*60}\n")

    for severity in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
        items = by_severity[severity]
        if not items:
            continue

        icon = {"CRITICAL": "🔴", "HIGH": "🟠", "MEDIUM": "🟡", "LOW": "🔵"}[severity]
        output.append(f"{icon} {severity} ({len(items)})")
        output.append("-" * 40)

        for v in items:
            rel_path = v.file
            # Try to make path relative
            for prefix in ("src/", "components/", "routes/"):
                idx = rel_path.find(prefix)
                if idx != -1:
                    rel_path = rel_path[idx:]
                    break

            output.append(f"  {rel_path}:{v.line}")
            output.append(f"  [{v.category}] {v.message}")
            output.append(f"  Code: {v.code[:100]}")
            output.append(f"  Fix:  {v.suggestion}")
            output.append("")

    # Summary
    output.append(f"{'='*60}")
    output.append("  SUMMARY")
    output.append(f"  CRITICAL: {len(by_severity['CRITICAL'])}  |  HIGH: {len(by_severity['HIGH'])}  |  MEDIUM: {len(by_severity['MEDIUM'])}  |  LOW: {len(by_severity['LOW'])}")
    if by_severity["CRITICAL"]:
        output.append("  ⚠️  CRITICAL violations must be fixed before committing.")
    output.append(f"{'='*60}\n")

    return "\n".join(output)


def main():
    if len(sys.argv) < 2:
        print("Usage: check-antipatterns.py <file_or_directory> [--json] [--severity=high]")
        sys.exit(1)

    path = sys.argv[1]
    as_json = "--json" in sys.argv

    min_severity = "LOW"
    for arg in sys.argv:
        if arg.startswith("--severity="):
            min_severity = arg.split("=")[1].upper()

    violations = scan_path(path)

    # Filter by minimum severity
    severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    min_level = severity_order.get(min_severity, 3)
    violations = [v for v in violations if severity_order.get(v.severity, 3) <= min_level]

    print(format_violations(violations, as_json))

    # Exit with error code if critical violations found
    if any(v.severity == "CRITICAL" for v in violations):
        sys.exit(2)
    elif violations:
        sys.exit(1)
    else:
        sys.exit(0)


if __name__ == "__main__":
    main()
