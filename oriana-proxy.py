#!/usr/bin/env python3
"""
Proxy local para la demo de ORIANA + ElevenLabs.

Evita el error "Failed to fetch" (CORS) cuando abrís la demo
directamente en el navegador. El proxy recibe la llamada del navegador,
le agrega tu API key y la reenvia a ElevenLabs, devolviendo el audio.

USO:
    python3 oriana-proxy.py
    (dejalo corriendo en esta terminal)

Luego, en la demo, tocá el engranaje ⚙️ y en "Proxy local" dejá:
    http://localhost:8787

No necesita instalar nada: usa solo la libreria estandar de Python 3.
Para detenerlo: Ctrl + C
"""
import http.server
import urllib.request
import urllib.error
import os
import mimetypes

TARGET = "https://api.elevenlabs.io"
PORT = 8787
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        # Sirve los archivos de la demo desde este mismo servidor, así se abre
        # como http://localhost:8787/oriana-mobile.html (origen seguro:
        # el permiso del micrófono queda persistente y no hay bloqueo CORS).
        path = self.path.split("?", 1)[0]
        if path in ("/", ""):
            path = "/oriana-mobile.html"
        fname = os.path.normpath(os.path.join(ROOT, path.lstrip("/")))
        if not fname.startswith(ROOT) or not os.path.isfile(fname):
            self.send_response(404)
            self._cors()
            self.end_headers()
            self.wfile.write(b"Not found")
            return
        ctype = mimetypes.guess_type(fname)[0] or "application/octet-stream"
        with open(fname, "rb") as f:
            data = f.read()
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", ctype)
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length)
        url = TARGET + self.path
        req = urllib.request.Request(url, data=body, method="POST")
        req.add_header("xi-api-key", self.headers.get("xi-api-key", ""))
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "audio/mpeg")
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type", r.headers.get("Content-Type", "audio/mpeg"))
                self.end_headers()
                self.wfile.write(data)
                print("OK  ->", self.path, "(%d bytes)" % len(data))
        except urllib.error.HTTPError as e:
            data = e.read()
            self.send_response(e.code)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(data)
            print("ERR ->", e.code, self.path, data[:200])
        except Exception as e:
            self.send_response(502)
            self._cors()
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(('{"error":"%s"}' % str(e)).encode())
            print("FAIL ->", str(e))

    def log_message(self, *args):
        pass  # silenciar el log por defecto


if __name__ == "__main__":
    print("=" * 56)
    print("  Servidor ORIANA + proxy ElevenLabs corriendo")
    print("  Abrí la demo en:   http://localhost:%d/oriana-mobile.html" % PORT)
    print("  (así el micrófono queda persistente y no hay CORS)")
    print("  Detener:           Ctrl + C")
    print("=" * 56)
    http.server.HTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
