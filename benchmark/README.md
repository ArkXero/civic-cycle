# BoardDocs attachment benchmark

Production attachment ingestion stays disabled until this benchmark and a taxonomy sample are reviewed.

1. `pnpm benchmark:manifest` freezes at least 80 public attachments from at least 20 meetings across all four districts.
2. Human reviewers add `traits`, `visibleFacts`, and fidelity scores to the frozen manifest. Raw PDFs remain temporary.
3. `pnpm benchmark:parsers` compares `pdf-parse` and LiteParse on identical bytes and writes an ignored JSON report.
4. `pnpm benchmark:llamaindex -- --input benchmark/runtime-input.jsonl` runs normalized Markdown through the isolated Python/LlamaIndex worker. Raw PDFs are not accepted.

Selection gates live in `selection-rules.json`. Reports never select or deploy a runtime automatically.

Before running Python worker, use Python 3.12 environment and install pinned packages:

```sh
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r workers/llamaindex/requirements.txt
```

Runtime input must use identical normalized Markdown, taxonomy, model, and gold topic labels for Node and Python runs. `lib/benchmark-selection.ts` computes macro/micro F1, per-topic precision/recall, auto-publish precision, suggestion precision, and evidence traceability before applying selection gates.
