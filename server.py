"""
TeamPulse Web Portal - Local HTTP Server
Serves the web application at http://localhost:5000
"""

import http.server
import socketserver
import os
import sys

PORT = 5000

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()
        
    def log_message(self, format, *args):
        # Concise logging
        sys.stdout.write(f"[TeamPulse Web] {self.address_string()} - {format % args}\n")
        sys.stdout.flush()

def main():
    directory = os.path.dirname(os.path.abspath(__file__))
    os.chdir(directory)
    
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), QuietHandler) as httpd:
        print(f"[ONLINE] TeamPulse Web Application is running at http://localhost:{PORT}")
        sys.stdout.flush()
        httpd.serve_forever()

if __name__ == "__main__":
    main()
