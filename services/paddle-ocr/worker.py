"""Private CPU OCR worker; expose only through an authenticated HTTPS proxy.

No PDF/text logging, persistent files, database access or arbitrary URL fetching.
Single request at a time bounds model memory and protects PDFium thread safety.
"""
import hashlib
import hmac
import json
import math
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

MAX_BYTES = 20 * 1024 * 1024
MAX_PIXELS = 20_000_000


def validated_pages(raw):
    pages = [int(p) for p in raw.split(",")]
    if not 1 <= len(pages) <= 5 or len(set(pages)) != len(pages):
        raise ValueError("invalid pages")
    if any(p < 1 or p > 50 for p in pages):
        raise ValueError("invalid pages")
    return pages


def recognized_text(result):
    texts = result["rec_texts"]
    scores = result["rec_scores"]
    if len(texts) != len(scores):
        raise ValueError("incomplete recognition")
    # Conservative initial policy: reject questionable lines rather than silently omit.
    if any(not math.isfinite(float(score)) or not 0.85 <= float(score) <= 1 for text, score in zip(texts, scores) if text.strip()):
        raise ValueError("review required")
    return "\n".join(texts)


def recognize_pdf(data, pages, engine):
    import pypdfium2 as pdfium
    document = pdfium.PdfDocument(data)
    try:
        total = len(document)
        if not 1 <= total <= 50 or max(pages) > total:
            raise ValueError("invalid document pages")
        output = []
        for number in pages:
            page = document[number - 1]
            bitmap = None
            try:
                width, height = page.get_size()
                scale = 300 / 72
                if width * height * scale * scale > MAX_PIXELS:
                    raise ValueError("render limit")
                bitmap = page.render(scale=scale)
                results = list(engine.predict(bitmap.to_numpy()))
                if len(results) != 1:
                    raise ValueError("incomplete recognition")
                output.append({"page": number, "text": recognized_text(results[0])})
            finally:
                if bitmap is not None:
                    bitmap.close()
                page.close()
        return {"engine": "paddleocr", "sha256": hashlib.sha256(data).hexdigest(),
                "totalPages": total, "pages": output}
    finally:
        document.close()


class Handler(BaseHTTPRequestHandler):
    engine = None
    token = ""

    def log_message(self, *_):
        pass

    def reply(self, status, body):
        encoded = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "private, no-store")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_POST(self):
        self.connection.settimeout(10)
        if self.path != "/ocr/pdf":
            return self.reply(404, {"error": "not_found"})
        if not hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + self.token):
            return self.reply(401, {"error": "unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if self.headers.get("Transfer-Encoding") or not 0 < length <= MAX_BYTES:
                return self.reply(413, {"error": "file_limit"})
            if self.headers.get("Content-Type") != "application/pdf":
                return self.reply(415, {"error": "pdf_required"})
            pages = validated_pages(self.headers.get("X-Ocr-Pages", ""))
            data = self.rfile.read(length)
            if len(data) != length or not data.startswith(b"%PDF-"):
                return self.reply(400, {"error": "invalid_pdf"})
            digest = hashlib.sha256(data).hexdigest()
            if not hmac.compare_digest(digest, self.headers.get("X-Document-Sha256", "")):
                return self.reply(400, {"error": "digest_mismatch"})
            self.reply(200, recognize_pdf(data, pages, self.engine))
        except ValueError:
            self.reply(422, {"error": "ocr_review_required"})
        except Exception:
            self.reply(503, {"error": "ocr_unavailable"})


if __name__ == "__main__":
    from paddleocr import PaddleOCR
    token = os.environ.get("PADDLE_OCR_TOKEN", "")
    if len(token) < 32:
        raise RuntimeError("PADDLE_OCR_TOKEN must contain at least 32 characters")
    Handler.token = token
    Handler.engine = PaddleOCR(lang="en", use_doc_orientation_classify=True,
                               use_doc_unwarping=False, use_textline_orientation=True)
    HTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8080"))), Handler).serve_forever()
