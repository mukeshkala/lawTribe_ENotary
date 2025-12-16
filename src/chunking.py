"""Chunk cleaned pages into larger text segments.

This module reads cleaned page text and a page mapping for a given run ID,
combines the text into chunks sized by word count, and writes the result to a
JSON Lines file. It also exposes a CLI entrypoint so it can be invoked via
``python -m src.chunking``.
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Sequence


DEFAULT_MIN_WORDS = 1500
DEFAULT_MAX_WORDS = 3000
DEFAULT_PAGE_OVERLAP = 1


class ChunkingError(Exception):
    """Custom exception used for chunking-related failures."""


def load_jsonl(path: Path) -> List[Mapping]:
    """Load a JSON Lines file into a list of dictionaries."""

    if not path.exists():
        raise ChunkingError(f"Missing input file: {path}")

    records: List[Mapping] = []
    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            records.append(json.loads(line))
    if not records:
        raise ChunkingError(f"Input file {path} contained no records")
    return records


def write_jsonl(path: Path, records: Iterable[Mapping]) -> None:
    """Write dictionaries to a JSON Lines file."""

    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for record in records:
            fh.write(json.dumps(record, ensure_ascii=False))
            fh.write("\n")


def load_page_mapping(path: Path) -> Dict[int, int]:
    """Load a page mapping file and normalize it to a dict of int -> int."""

    if not path.exists():
        raise ChunkingError(f"Missing page mapping file: {path}")

    with path.open("r", encoding="utf-8") as fh:
        raw = json.load(fh)

    mapping: Dict[int, int] = {}
    if isinstance(raw, dict):
        mapping = {int(k): int(v) for k, v in raw.items()}
    elif isinstance(raw, list):
        for entry in raw:
            if not isinstance(entry, Mapping):
                continue
            cleaned = (
                entry.get("cleaned_page")
                or entry.get("clean_page")
                or entry.get("cleaned")
                or entry.get("page")
            )
            original = entry.get("original_page") or entry.get("original")
            if cleaned is not None and original is not None:
                mapping[int(cleaned)] = int(original)
    else:
        raise ChunkingError(
            "Page mapping file must be a dictionary or list of mappings"
        )

    if not mapping:
        raise ChunkingError("Page mapping file did not yield any entries")

    return mapping


def normalize_page_number(
    page_record: Mapping, mapping: Mapping[int, int], fallback_index: int
) -> int:
    """Resolve the original page number for a cleaned page."""

    cleaned_page = (
        page_record.get("page_number")
        or page_record.get("page")
        or page_record.get("clean_page")
        or page_record.get("cleaned_page")
        or fallback_index
    )
    try:
        cleaned_page_int = int(cleaned_page)
    except (TypeError, ValueError):
        cleaned_page_int = fallback_index
    return mapping.get(cleaned_page_int, cleaned_page_int)


def count_words(text: str) -> int:
    """Count approximate words using a regex that matches word characters."""

    return len(re.findall(r"\w+", text or ""))


def chunk_pages(
    pages: Sequence[Mapping],
    mapping: Mapping[int, int],
    min_words: int = DEFAULT_MIN_WORDS,
    max_words: int = DEFAULT_MAX_WORDS,
    page_overlap: int = DEFAULT_PAGE_OVERLAP,
    run_id: str | None = None,
) -> List[Mapping]:
    """Group cleaned pages into larger text chunks.

    Args:
        pages: Sequence of page dictionaries containing a ``text`` key.
        mapping: Mapping of cleaned page numbers to original page numbers.
        min_words: Minimum number of words per chunk (best effort).
        max_words: Maximum number of words per chunk.
        page_overlap: Number of pages to overlap between consecutive chunks.
        run_id: Optional run identifier to embed in ``chunk_id``.

    Returns:
        A list of chunk dictionaries with ``chunk_id``, ``page_start``,
        ``page_end``, and ``text`` fields.
    """

    if min_words <= 0 or max_words <= 0:
        raise ChunkingError("Word limits must be positive integers")
    if min_words > max_words:
        raise ChunkingError("min_words cannot exceed max_words")
    if page_overlap < 0:
        raise ChunkingError("page_overlap cannot be negative")

    chunks: List[Mapping] = []
    index = 0
    chunk_counter = 1

    while index < len(pages):
        start_index = index
        word_total = 0
        end_index = start_index

        while end_index < len(pages):
            page_text = pages[end_index].get("text", "")
            page_word_count = count_words(page_text)
            word_total += page_word_count

            next_index = end_index + 1
            next_word_count = (
                count_words(pages[next_index].get("text", ""))
                if next_index < len(pages)
                else 0
            )

            if word_total >= max_words:
                break
            if word_total >= min_words and (word_total + next_word_count) > max_words:
                break

            end_index += 1
            if end_index >= len(pages):
                break

        chunk_pages_seq = pages[start_index : end_index + 1]
        chunk_text = "\n\n".join(str(page.get("text", "")) for page in chunk_pages_seq)

        page_numbers = [
            normalize_page_number(page, mapping, fallback_index=i + 1)
            for i, page in enumerate(chunk_pages_seq, start=start_index)
        ]

        chunk_id = (
            f"{run_id}-chunk-{chunk_counter:04d}" if run_id else f"chunk-{chunk_counter:04d}"
        )

        chunks.append(
            {
                "chunk_id": chunk_id,
                "page_start": min(page_numbers),
                "page_end": max(page_numbers),
                "text": chunk_text.strip(),
            }
        )

        chunk_counter += 1
        next_start = end_index + 1 - page_overlap
        if next_start <= start_index:
            next_start = end_index + 1
        index = max(next_start, end_index + 1 if page_overlap == 0 else next_start)

    return chunks


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Chunk cleaned pages into JSONL output.")
    parser.add_argument("--run-id", required=True, help="Run identifier used to locate inputs and outputs.")
    parser.add_argument(
        "--pages-path",
        type=Path,
        help="Optional override for the cleaned pages JSONL path.",
    )
    parser.add_argument(
        "--page-mapping",
        dest="page_mapping_path",
        type=Path,
        help="Optional override for the page mapping JSON path.",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Override for the chunks output directory (defaults to runs/<run_id>/chunks).",
    )
    parser.add_argument(
        "--min-words",
        type=int,
        default=DEFAULT_MIN_WORDS,
        help=f"Minimum number of words per chunk (default: {DEFAULT_MIN_WORDS}).",
    )
    parser.add_argument(
        "--max-words",
        type=int,
        default=DEFAULT_MAX_WORDS,
        help=f"Maximum number of words per chunk (default: {DEFAULT_MAX_WORDS}).",
    )
    parser.add_argument(
        "--page-overlap",
        type=int,
        default=DEFAULT_PAGE_OVERLAP,
        help=f"Number of pages to overlap between chunks (default: {DEFAULT_PAGE_OVERLAP}).",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> None:
    parser = build_argument_parser()
    args = parser.parse_args(argv)

    base = Path("runs") / args.run_id
    pages_path = args.pages_path or base / "cleaned" / "pages.jsonl"
    mapping_path = args.page_mapping_path or base / "cleaned" / "page_mapping.json"
    output_dir = args.output_dir or base / "chunks"
    output_path = output_dir / "chunks.jsonl"

    pages = load_jsonl(pages_path)
    page_mapping = load_page_mapping(mapping_path)

    chunks = chunk_pages(
        pages,
        page_mapping,
        min_words=args.min_words,
        max_words=args.max_words,
        page_overlap=args.page_overlap,
        run_id=args.run_id,
    )

    write_jsonl(output_path, chunks)

    print(f"Wrote {len(chunks)} chunks to {output_path}")
    if chunks:
        sample = chunks[0]
        print("Sample chunk:")
        print(json.dumps(sample, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
