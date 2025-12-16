import argparse
import json
import random
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional


CHUNK_SUMMARY_PROMPT = """You are a legal research assistant. Read the provided book chunk and return structured JSON with:
- page_range: citation string like "pp. X–Y"
- key_topics: bullet points of the main ideas
- definitions: key definitions explained plainly
- legal_rules_tests: distilled legal rules or tests
- exceptions: important exceptions or caveats
- cheat_sheet: exactly 10 crisp bullet points for quick recall
Stay factual. Do not invent page numbers.
"""

ROLLUP_PROMPT = """You are writing a rollup summary for a chapter or section composed of several chunk summaries.
Return JSON with: section_label, page_range, key_topics, notable_definitions, pivotal_rules_or_tests,
notable_exceptions, cheat_sheet_10 (exactly 10 bullets), and overall_summary.
"""

BOOK_SUMMARY_PROMPT = """You are summarizing an entire book based on section rollups.
Return JSON with: overview, key_themes, recurring_rules_or_tests, noteworthy_exceptions,
practice_cheat_sheet (10 bullets), and navigation_hints that cite page spans where possible.
"""


@dataclass
class Chunk:
    id: str
    text: str
    page_start: Optional[int]
    page_end: Optional[int]
    raw: Dict[str, Any]


class RetryHelper:
    def __init__(self, retries: int = 5, base_delay: float = 1.5, max_delay: float = 30.0) -> None:
        self.retries = retries
        self.base_delay = base_delay
        self.max_delay = max_delay

    def __call__(self, func: Callable[[], Any]) -> Any:
        last_error: Optional[Exception] = None
        for attempt in range(self.retries):
            try:
                return func()
            except Exception as exc:  # pylint: disable=broad-except
                last_error = exc
                if attempt == self.retries - 1:
                    break
                sleep_for = min(self.base_delay * (2 ** attempt), self.max_delay)
                sleep_for += random.uniform(0, 0.75)
                time.sleep(sleep_for)
        if last_error:
            raise last_error
        raise RuntimeError("Retry helper exhausted without executing function")


class VertexSummarizer:
    def __init__(self, project: str, location: str, model: str, temperature: float = 0.2) -> None:
        from google import genai  # imported lazily to allow no-network mode without dependency errors
        from google.genai import types

        self.types = types
        self.client = genai.Client(vertexai=True, project=project, location=location)
        self.model = model
        self.temperature = temperature
        self.retry = RetryHelper()

    def _generate_json(self, prompt: str) -> Dict[str, Any]:
        def request() -> str:
            response = self.client.models.generate_content(
                model=self.model,
                contents=[prompt],
                config=self.types.GenerateContentConfig(
                    temperature=self.temperature,
                    response_mime_type="application/json",
                ),
            )
            return response.text

        raw = self.retry(request)
        return json.loads(raw)

    def summarize_chunk(self, chunk: Chunk) -> Dict[str, Any]:
        page_range = format_page_range(chunk.page_start, chunk.page_end)
        prompt = (
            f"{CHUNK_SUMMARY_PROMPT}\n"
            f"Chunk ID: {chunk.id}\n"
            f"Page range: {page_range}\n"
            f"Text:\n{chunk.text}\n"
        )
        summary = self._generate_json(prompt)
        summary.setdefault("page_range", page_range)
        summary["chunk_id"] = chunk.id
        return summary

    def summarize_rollup(self, label: str, page_range: str, chunk_summaries: List[Dict[str, Any]]) -> Dict[str, Any]:
        prompt = (
            f"{ROLLUP_PROMPT}\n"
            f"Section: {label}\n"
            f"Page range: {page_range}\n"
            "Chunk summaries:\n"
            f"{json.dumps(chunk_summaries, indent=2)}\n"
        )
        rollup = self._generate_json(prompt)
        rollup.setdefault("section_label", label)
        rollup.setdefault("page_range", page_range)
        return rollup

    def summarize_book(self, rollups: List[Dict[str, Any]]) -> Dict[str, Any]:
        prompt = (
            f"{BOOK_SUMMARY_PROMPT}\n"
            "Section rollups:\n"
            f"{json.dumps(rollups, indent=2)}\n"
        )
        return self._generate_json(prompt)


class FakeSummarizer:
    def __init__(self) -> None:
        self.retry = RetryHelper(retries=1)

    def _cheat_sheet(self, text: str) -> List[str]:
        words = text.split()
        bullets = []
        for idx in range(10):
            start = idx * 5
            snippet = " ".join(words[start : start + 5]).strip()
            if not snippet:
                snippet = f"Key insight {idx + 1} from local stub"
            bullets.append(snippet)
        return bullets

    def summarize_chunk(self, chunk: Chunk) -> Dict[str, Any]:
        page_range = format_page_range(chunk.page_start, chunk.page_end)
        cheat_sheet = self._cheat_sheet(chunk.text)
        return {
            "chunk_id": chunk.id,
            "page_range": page_range,
            "key_topics": [f"Topic from chunk {chunk.id}"],
            "definitions": [f"Definition sample for {chunk.id}"],
            "legal_rules_tests": ["Stubbed rule summary"],
            "exceptions": ["Stubbed exception"],
            "cheat_sheet": cheat_sheet,
        }

    def summarize_rollup(self, label: str, page_range: str, chunk_summaries: List[Dict[str, Any]]) -> Dict[str, Any]:
        combined_text = " ".join(
            " ".join(summary.get("cheat_sheet", [])) for summary in chunk_summaries
        )
        cheat_sheet = self._cheat_sheet(combined_text or label)
        return {
            "section_label": label,
            "page_range": page_range,
            "key_topics": [f"Rollup topics for {label}"],
            "notable_definitions": [f"Key definitions for {label}"],
            "pivotal_rules_or_tests": ["Stubbed rollup rule"],
            "notable_exceptions": ["Stubbed rollup exception"],
            "cheat_sheet_10": cheat_sheet,
            "overall_summary": f"Stubbed summary for {label}",
        }

    def summarize_book(self, rollups: List[Dict[str, Any]]) -> Dict[str, Any]:
        combined = " ".join(rollup.get("overall_summary", "") for rollup in rollups)
        return {
            "overview": combined or "Stubbed book overview",
            "key_themes": ["Stubbed theme"],
            "recurring_rules_or_tests": ["Stubbed recurring rule"],
            "noteworthy_exceptions": ["Stubbed recurring exception"],
            "practice_cheat_sheet": self._cheat_sheet(combined or "book"),
            "navigation_hints": ["Pages are grouped by rollups"],
        }


def format_page_range(page_start: Optional[int], page_end: Optional[int]) -> str:
    if page_start is None and page_end is None:
        return "pp. (unknown)"
    if page_start is not None and page_end is not None:
        if page_start == page_end:
            return f"pp. {page_start}"
        return f"pp. {page_start}\u2013{page_end}"
    if page_start is not None:
        return f"pp. {page_start}"
    return f"pp. {page_end}"


def load_chunks(path: Path, max_chunks: Optional[int]) -> List[Chunk]:
    chunks: List[Chunk] = []
    with path.open("r", encoding="utf-8") as handle:
        for idx, line in enumerate(handle):
            if max_chunks is not None and idx >= max_chunks:
                break
            data = json.loads(line)
            chunk_id = str(data.get("id", idx))
            text = data.get("text") or data.get("content") or ""
            page_start = _as_int(
                data.get("page_start") or data.get("pageStart") or data.get("pageStartIndex")
            )
            page_end = _as_int(
                data.get("page_end") or data.get("pageEnd") or data.get("pageEndIndex")
            )
            chunks.append(
                Chunk(
                    id=chunk_id,
                    text=text,
                    page_start=page_start,
                    page_end=page_end,
                    raw=data,
                )
            )
    return chunks


def _as_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def create_rollups(chunks: List[Chunk], chunk_summaries: List[Dict[str, Any]], rollup_size: int, summarizer: Any) -> List[Dict[str, Any]]:
    rollups: List[Dict[str, Any]] = []
    for start in range(0, len(chunks), rollup_size):
        end = min(start + rollup_size, len(chunks))
        label = f"Rollup {len(rollups) + 1}"
        page_range = format_page_range(chunks[start].page_start, chunks[end - 1].page_end)
        slice_summaries = chunk_summaries[start:end]
        rollups.append(summarizer.summarize_rollup(label, page_range, slice_summaries))
    return rollups


def main() -> None:
    parser = argparse.ArgumentParser(description="Summarize chunks with Vertex AI.")
    parser.add_argument("run_id", help="Run identifier for output folder creation")
    parser.add_argument("chunks_path", type=Path, help="Path to chunks.jsonl")
    parser.add_argument("--project", help="Google Cloud project ID")
    parser.add_argument("--location", default="us-central1", help="Vertex AI region")
    parser.add_argument("--model", default="gemini-1.5-pro-002", help="Model name")
    parser.add_argument("--rollup-size", type=int, default=5, help="Number of chunks per rollup")
    parser.add_argument("--max-chunks", type=int, default=None, help="Limit number of chunks processed")
    parser.add_argument("--no-network", action="store_true", help="Use local fake summarizer instead of Vertex AI")

    args = parser.parse_args()

    if not args.chunks_path.exists():
        raise FileNotFoundError(f"Chunks file not found: {args.chunks_path}")

    if args.rollup_size <= 0:
        raise ValueError("--rollup-size must be positive")

    if args.max_chunks is not None and args.max_chunks <= 0:
        raise ValueError("--max-chunks must be positive when set")

    chunks = load_chunks(args.chunks_path, args.max_chunks)
    if not chunks:
        raise ValueError("No chunks found to summarize")

    output_dir = Path("runs") / args.run_id / "summaries"
    output_dir.mkdir(parents=True, exist_ok=True)

    summarizer: Any
    if args.no_network:
        summarizer = FakeSummarizer()
    else:
        if not args.project:
            raise ValueError("--project is required when not using --no-network")
        summarizer = VertexSummarizer(args.project, args.location, args.model)

    chunk_summaries: List[Dict[str, Any]] = []
    for chunk in chunks:
        chunk_summaries.append(summarizer.summarize_chunk(chunk))

    rollups = create_rollups(chunks, chunk_summaries, args.rollup_size, summarizer)
    book_summary = summarizer.summarize_book(rollups)

    chunks_output = output_dir / "chunk_summaries.jsonl"
    with chunks_output.open("w", encoding="utf-8") as handle:
        for summary in chunk_summaries:
            handle.write(json.dumps(summary, ensure_ascii=False) + "\n")

    rollups_output = output_dir / "rollup_summaries.jsonl"
    with rollups_output.open("w", encoding="utf-8") as handle:
        for rollup in rollups:
            handle.write(json.dumps(rollup, ensure_ascii=False) + "\n")

    book_output = output_dir / "book_summary.json"
    with book_output.open("w", encoding="utf-8") as handle:
        json.dump(book_summary, handle, ensure_ascii=False, indent=2)

    print(f"Wrote {len(chunk_summaries)} chunk summaries to {chunks_output}")
    print(f"Wrote {len(rollups)} rollup summaries to {rollups_output}")
    print(f"Wrote book summary to {book_output}")


if __name__ == "__main__":
    main()
