"""Check the real PDFs produced by report-pdf.mjs (requires pypdf).

Poppler rendering and visual inspection remain necessary for typography and colours.
"""
import json
from pathlib import Path
from pypdf import PdfReader

directory = Path("outputs/pdf/report-fixtures")
contracts = json.loads((directory / "pdf-contract.json").read_text(encoding="utf-8"))
assert len(contracts) == 24, "Run the complete PDF integration matrix first"
results = []
for case in contracts:
    name = "-".join((case["fixture"], case["lang"], case["format"])) + ".pdf"
    reader = PdfReader(directory / name)
    pages = [page.extract_text() or "" for page in reader.pages]
    for index, text in enumerate(pages):
        assert len(text.strip()) > 20, f"{name}: blank page {index + 1}"
        assert f"{index + 1} / {len(pages)}" in text, f"{name}: page counter"
        assert "/report/fixture-" not in text and "s" * 43 not in text, f"{name}: private token"
    families = ("Chargement", "Ressources", "Erreurs") if case["lang"] == "fr" else ("Loading", "Resources", "Errors")
    assert any(all(label in text for label in families) for text in pages), f"{name}: fragmented measurement families"
    heading, priority = ("Plan d’action", "Priorité 1") if case["lang"] == "fr" else ("Action plan", "Priority 1")
    priority_pages = [index for index, text in enumerate(pages) if priority in text]
    if priority_pages:
        assert heading in pages[priority_pages[0]], f"{name}: action heading detached from first priority"
    results.append({"file": name, "pages": len(pages), "numbering": True, "measurementFamiliesTogether": True})
(directory / "pagination.json").write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
print(f"{len(results)} PDFs, {sum(row['pages'] for row in results)} pages: pagination contracts passed")
