from flask import Flask, request, jsonify, render_template
import typesense
import json
import os

app = Flask(__name__, template_folder='templates')

# Initialize Typesense client
# Typesense is running locally on port 8108.
# Authenticate using the key from /etc/typesense-api-key.
try:
    with open('/etc/typesense-api-key', 'r') as f:
        typesense_api_key = f.read().strip()
except Exception as e:
    # Fallback key from prompt
    typesense_api_key = 'w3E7XhJMftaUNPbVwOkBp0PaKCgfHWxt'

client = typesense.Client({
    'nodes': [{
        'host': '127.0.0.1',
        'port': '8108',
        'protocol': 'http'
    }],
    'api_key': typesense_api_key,
    'connection_timeout_seconds': 5
})

# Load pre-computed query vectors lookup table
query_vectors_path = '/home/user/kbsearch/data/query_vectors.json'
try:
    with open(query_vectors_path, 'r') as f:
        query_vectors = json.load(f)
except Exception as e:
    print(f"Error loading query vectors from {query_vectors_path}: {e}")
    query_vectors = {}

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/search')
def search():
    query_text = request.args.get('q', '').strip()
    mode = request.args.get('mode', 'keyword').strip().lower()
    alpha_str = request.args.get('alpha', '0.5').strip()
    
    try:
        alpha = float(alpha_str)
    except ValueError:
        alpha = 0.5

    print(f"API request: q='{query_text}', mode='{mode}', alpha={alpha}")

    if not query_text:
        return jsonify({
            "mode": mode,
            "results": []
        })

    results = []

    try:
        if mode == 'keyword':
            # Keyword mode: rank documents by textual relevance of the query against the document title and body.
            search_res = client.collections['knowledge_base'].documents.search({
                'q': query_text,
                'query_by': 'title,body'
            })
            for hit in search_res.get('hits', []):
                results.append({
                    "id": hit['document']['id'],
                    "title": hit['document']['title'],
                    "score": hit.get('text_match', 0)
                })

        elif mode == 'semantic':
            # Semantic mode: rank documents by nearest-neighbor similarity between the query's pre-computed vector and each document's embedding.
            # Look up vector in query_vectors.json
            vector = query_vectors.get(query_text) or query_vectors.get(query_text.lower())
            if not vector:
                return jsonify({
                    "error": f"Query vector not found for evaluation query: '{query_text}'"
                }), 400

            search_res = client.collections['knowledge_base'].documents.search({
                'q': '*',
                'vector_query': f"embedding:({vector}, k:10)"
            })
            for hit in search_res.get('hits', []):
                # Cosine similarity = 1.0 - vector_distance
                score = 1.0 - hit.get('vector_distance', 0.0)
                results.append({
                    "id": hit['document']['id'],
                    "title": hit['document']['title'],
                    "score": score
                })

        elif mode == 'hybrid':
            # Hybrid mode: rank documents by a fused score that blends keyword and semantic signals, controlled by alpha.
            vector = query_vectors.get(query_text) or query_vectors.get(query_text.lower())
            if not vector:
                return jsonify({
                    "error": f"Query vector not found for evaluation query: '{query_text}'"
                }), 400

            search_res = client.collections['knowledge_base'].documents.search({
                'q': query_text,
                'query_by': 'title,body',
                'vector_query': f"embedding:({vector}, alpha: {alpha})"
            })
            for hit in search_res.get('hits', []):
                score = hit.get('hybrid_search_info', {}).get('rank_fusion_score', 0.0)
                results.append({
                    "id": hit['document']['id'],
                    "title": hit['document']['title'],
                    "score": score
                })
        else:
            return jsonify({"error": "Invalid search mode"}), 400

        # Return results sorted best-match first.
        # Since Typesense already returns hits ordered best-match first, we just preserve the order.
        return jsonify({
            "mode": mode,
            "results": results
        })

    except Exception as e:
        print(f"Error during search: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Bind to 127.0.0.1 and port 8080 as required
    app.run(host='127.0.0.1', port=8080, debug=False)
