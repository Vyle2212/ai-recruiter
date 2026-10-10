# Private PaddleOCR integration — staging required

The app uses direct extraction for readable PDFs/DOCX. PDF fallback can now use
this private worker instead of Google. No provider fallback is automatic.

Acceptance-only configuration after deploying and testing the worker:

* `CV_OCR_PROVIDER=paddle` (Config)
* `PADDLE_OCR_URL=https://<owned-worker-host>/ocr/pdf` (Config)
* `PADDLE_OCR_TOKEN=<random secret of at least 32 characters>` (Secret), same on worker

Never prefix these variables with NEXT_PUBLIC. Do not commit credentials.
Build from this directory with Docker. The first worker start downloads models;
warm the models before routing requests. Place behind an HTTPS proxy with body
limit 20 MiB, connection/concurrency limits, and no body/header access logging.
Use an isolated container with memory/CPU limits and no database credentials.
Do not put the raw HTTP listener on the public internet.

Protocol: POST raw PDF bytes, Bearer token, X-Document-Sha256 and X-Ocr-Pages
(one-based comma-separated pages, at most five). JSON response identifies the
engine, digest, total page count and each page's text. App validates identity,
complete coverage, duplicate/out-of-range pages and required-page text length.
PDF bytes are processed in memory; originals remain in existing private storage.

Current worker is English-first, single-request CPU processing, not a durable
queue. Recognition scores below 0.85 reject the batch for review. This heuristic
does not prove correctness. Multi-column reading order, language coverage, model
startup, CPU timing and resource isolation need live acceptance benchmarks.
The existing app has a 45-second whole-PDF OCR budget: longer documents may time
out. Do not extend this or claim production readiness without measured capacity.
Deploying a durable job queue and status UI remains separate work for scale.

No deployment/config change is made by adding these files. Google remains the
compatibility default until acceptance is explicitly configured for Paddle.
Release requires synthetic scan end-to-end tests (parser/confirmation/search,
original-byte preservation and zero residue) plus consent/authorization checks.
