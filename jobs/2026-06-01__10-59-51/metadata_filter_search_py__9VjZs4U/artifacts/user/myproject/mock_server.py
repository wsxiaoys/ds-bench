from http.server import BaseHTTPRequestHandler, HTTPServer
import json

class RequestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        print("POST", self.path)
        print("Headers:", self.headers)
        print("Body:", json.loads(post_data.decode('utf-8')))
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(b'{"contexts": [{"metadata": {"file_name": "test.txt", "group_name": ["support"]}}]}')

if __name__ == '__main__':
    server = HTTPServer(('localhost', 8080), RequestHandler)
    print("Starting server...")
    server.serve_forever()
