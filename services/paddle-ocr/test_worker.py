import unittest
import hashlib
import http.client
import threading
from unittest.mock import patch
from http.server import HTTPServer
from worker import Handler
from worker import validated_pages, recognized_text


class WorkerContract(unittest.TestCase):
    def test_http_boundary(self):
        Handler.token = "synthetic-test-token-32-characters-only"
        server = HTTPServer(("127.0.0.1", 0), Handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        data = b"%PDF-synthetic-contract"
        headers = {"Authorization": "Bearer " + Handler.token,
                   "Content-Type": "application/pdf", "X-Ocr-Pages": "1",
                   "X-Document-Sha256": hashlib.sha256(data).hexdigest()}
        def send(changes):
            connection = http.client.HTTPConnection(*server.server_address)
            connection.request("POST", "/ocr/pdf", data, headers | changes)
            response = connection.getresponse()
            result = (response.status, response.getheader("Cache-Control"))
            response.read()
            connection.close()
            return result
        try:
            with patch("worker.recognize_pdf", return_value={"engine": "paddleocr"}) as recognize:
                self.assertEqual(send({"Authorization": "Bearer wrong"}), (401, "private, no-store"))
                self.assertEqual(send({"X-Document-Sha256": "wrong"})[0], 400)
                self.assertEqual(send({"X-Ocr-Pages": "1,1"})[0], 422)
                recognize.assert_not_called()
                self.assertEqual(send({}), (200, "private, no-store"))
                self.assertEqual(recognize.call_args.args[:2], (data, [1]))
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_pages(self):
        self.assertEqual(validated_pages("1,2,3"), [1, 2, 3])
        for raw in ["", "0", "51", "1,1", "1,2,3,4,5,6", "x"]:
            with self.assertRaises(ValueError):
                validated_pages(raw)

    def test_quality(self):
        self.assertEqual(recognized_text({"rec_texts": ["SAP", "Consultant"],
                                         "rec_scores": [.99, .98]}), "SAP\nConsultant")
        for result in [{"rec_texts": ["SAP"], "rec_scores": [.2]},
                       {"rec_texts": ["SAP"], "rec_scores": []},
                       {"rec_texts": ["SAP"], "rec_scores": [float("nan")]},
                       {"rec_texts": ["SAP"], "rec_scores": [1.1]}]:
            with self.assertRaises(ValueError):
                recognized_text(result)


if __name__ == "__main__":
    unittest.main()
