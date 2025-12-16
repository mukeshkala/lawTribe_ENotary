"""Utilities for cleaning OCR'd book text while preserving page boundaries."""
from __future__ import annotations

import argparse
import re
from collections import Counter
from pathlib import Path
from typing import Iterable, List

PAGE_DELIMITER = "\f"


def _normalize_line(line: str) -> str:
    """Normalize a line for comparison across pages."""
    return line.strip()


def _find_repeating_lines(pages: Iterable[str], threshold_ratio: float = 0.6) -> set[str]:
    """Identify lines that appear on many pages (likely headers/footers)."""
    page_count = 0
    line_counts: Counter[str] = Counter()

    for page in pages:
        page_count += 1
        unique_lines = set()
        for raw_line in page.splitlines():
            normalized = _normalize_line(raw_line)
            if not normalized:
                continue
            unique_lines.add(normalized)
        line_counts.update(unique_lines)

    if page_count == 0:
        return set()

    threshold = max(2, int(page_count * threshold_ratio))
    return {line for line, count in line_counts.items() if count >= threshold}


def remove_repeating_headers_footers(pages: List[str]) -> List[str]:
    """Remove lines that are repeated across many pages.

    The heuristic treats lines that occur on at least 60% of pages (and at least
    twice overall) as headers or footers.
    """

    repeating_lines = _find_repeating_lines(pages)
    cleaned_pages: List[str] = []

    for page in pages:
        lines = page.splitlines()
        kept_lines = [line for line in lines if _normalize_line(line) not in repeating_lines]
        cleaned_pages.append("\n".join(kept_lines))

    return cleaned_pages


def fix_hyphenation(text: str) -> str:
    """Merge words that were split across lines with a trailing hyphen."""

    # Remove hyphenation where a word breaks across a newline. Allow for spaces
    # at the start of the following line to accommodate indentation.
    pattern = re.compile(r"(\w)-\s*\n\s*(\w)")
    return re.sub(pattern, r"\1\2", text)


def normalize_whitespace(text: str) -> str:
    """Standardise whitespace for consistent downstream processing."""

    # Normalise newlines first
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    lines = [line.rstrip() for line in text.split("\n")]

    collapsed_lines = []
    previous_blank = False
    for line in lines:
        if not line.strip():
            if not previous_blank:
                collapsed_lines.append("")
            previous_blank = True
            continue

        previous_blank = False
        # Collapse runs of internal whitespace to a single space
        collapsed_lines.append(re.sub(r"[ \t]+", " ", line))

    # Remove leading/trailing blank lines and rejoin
    while collapsed_lines and collapsed_lines[0] == "":
        collapsed_lines.pop(0)
    while collapsed_lines and collapsed_lines[-1] == "":
        collapsed_lines.pop()

    return "\n".join(collapsed_lines)


def _read_pages(input_path: Path, delimiter: str = PAGE_DELIMITER) -> List[str]:
    raw_text = input_path.read_text(encoding="utf-8")

    if delimiter in raw_text:
        pages = raw_text.split(delimiter)
    else:
        pages = [raw_text]

    # Trim stray whitespace around page boundaries
    return [page.strip("\n") for page in pages]


def _write_outputs(cleaned_pages: List[str], output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    pages_path = output_dir / "pages_clean.txt"
    book_path = output_dir / "book_clean.txt"

    pages_path.write_text(f"{PAGE_DELIMITER}\n".join(cleaned_pages), encoding="utf-8")
    book_path.write_text("\n\n".join(cleaned_pages), encoding="utf-8")


def _format_stats(before_lines: int, after_lines: int, removed_header_lines: int, page_count: int) -> str:
    return (
        "Cleaning summary:\n"
        f"  Pages: {page_count}\n"
        f"  Lines before: {before_lines}\n"
        f"  Lines after:  {after_lines}\n"
        f"  Removed repeating header/footer lines: {removed_header_lines}\n"
    )


def _clean_pages_with_stats(pages: List[str]) -> tuple[List[str], int, int]:
    repeating = _find_repeating_lines(pages)
    removed_repeating = 0
    cleaned_pages: List[str] = []

    for page in pages:
        lines = page.splitlines()
        kept_lines = [line for line in lines if _normalize_line(line) not in repeating]
        removed_repeating += len(lines) - len(kept_lines)
        text = "\n".join(kept_lines)
        text = fix_hyphenation(text)
        text = normalize_whitespace(text)
        cleaned_pages.append(text)

    return cleaned_pages, removed_repeating, len(repeating)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Clean OCR'd text while keeping page boundaries.")
    parser.add_argument("--input", required=True, help="Path to the raw book text or page-delimited text file.")
    parser.add_argument("--run-id", required=True, help="Name for the output run (written under runs/<run_id>/cleaned/).")
    parser.add_argument(
        "--page-delimiter",
        default=PAGE_DELIMITER,
        help="Delimiter used between pages in the input file. Defaults to form-feed (\\f).",
    )

    args = parser.parse_args(argv)
    input_path = Path(args.input)
    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    pages = _read_pages(input_path, delimiter=args.page_delimiter)

    before_line_count = sum(len(page.splitlines()) for page in pages)
    cleaned_pages, removed_repeating, repeating_line_count = _clean_pages_with_stats(pages)
    after_line_count = sum(len(page.splitlines()) for page in cleaned_pages)

    output_dir = Path("runs") / args.run_id / "cleaned"
    _write_outputs(cleaned_pages, output_dir)

    stats_message = _format_stats(before_line_count, after_line_count, removed_repeating, len(pages))
    print(stats_message)
    if repeating_line_count:
        print(f"Detected {repeating_line_count} candidate repeating lines.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
