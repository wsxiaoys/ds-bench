import lancedb
import pyarrow as pa
import numpy as np
import json
import os
import shutil

def run():
    db_path = "/home/user/db"
    if os.path.exists(db_path):
        shutil.rmtree(db_path)
    
    db = lancedb.connect(db_path)
    
    # Define schema
    schema = pa.schema([
        pa.field("id", pa.int64()),
        pa.field("title", pa.string()),
        pa.field("body", pa.string()),
        pa.field("vector", pa.list_(pa.float32(), 4))
    ])
    
    # Generate 20 random vectors using numpy.random.default_rng(1)
    rng = np.random.default_rng(1)
    vectors = rng.random((20, 4), dtype=np.float32).tolist()
    
    # Define 20 rows of data
    data = [
        {
            "id": 1,
            "title": "Introduction to Vector Databases",
            "body": "A vector database is a specialized database designed to store and query high-dimensional vector embeddings efficiently. Unlike traditional relational databases, a vector database index allows fast similarity search across millions of vectors.",
            "vector": vectors[0]
        },
        {
            "id": 2,
            "title": "The Lance Columnar Format",
            "body": "The lance format is a modern, high-performance columnar data format optimized for machine learning and vector search. Built as an alternative to Parquet, the lance format provides fast random access and native support for vector indices.",
            "vector": vectors[1]
        },
        {
            "id": 3,
            "title": "Understanding Columnar Storage",
            "body": "Columnar storage layouts organize data by column rather than by row. This is highly efficient for analytical queries that only access a subset of columns, reducing disk I/O significantly.",
            "vector": vectors[2]
        },
        {
            "id": 4,
            "title": "An Overview of Information Retrieval",
            "body": "Information retrieval is the science of searching for documents, information within documents, and metadata. Traditional systems rely on inverted indices and BM25 scoring to rank document relevance.",
            "vector": vectors[3]
        },
        {
            "id": 5,
            "title": "What is BM25 Scoring?",
            "body": "BM25 is a family of ranking functions used by search engines to estimate the relevance of documents to a given search query. It is based on the probabilistic retrieval framework.",
            "vector": vectors[4]
        },
        {
            "id": 6,
            "title": "High-Dimensional Vector Spaces",
            "body": "In machine learning, data is often represented as points in high-dimensional vector spaces. Similarity between these points can be calculated using cosine distance or Euclidean distance.",
            "vector": vectors[5]
        },
        {
            "id": 7,
            "title": "Approximate Nearest Neighbor Search",
            "body": "Approximate Nearest Neighbor algorithms trade a small amount of accuracy for massive speedups in search time. Popular techniques include HNSW graphs and inverted file index structures.",
            "vector": vectors[6]
        },
        {
            "id": 8,
            "title": "The Evolution of Data Formats",
            "body": "From CSV to Parquet and Arrow, data formats have evolved to meet the demands of modern analytics. Columnar formats are now the standard for big data processing pipelines.",
            "vector": vectors[7]
        },
        {
            "id": 9,
            "title": "Deep Learning and Embeddings",
            "body": "Deep learning models convert unstructured data like text and images into dense vector representations called embeddings. These embeddings capture semantic meaning.",
            "vector": vectors[8]
        },
        {
            "id": 10,
            "title": "Hybrid Search Techniques",
            "body": "Hybrid search combines keyword-based BM25 retrieval with dense vector similarity search. This approach leverages both lexical matching and semantic understanding for better results.",
            "vector": vectors[9]
        },
        {
            "id": 11,
            "title": "The Role of Metadata Filtering",
            "body": "Metadata filtering allows search queries to restrict results based on structured attributes. Combining vector search with metadata filters requires specialized indexing strategies.",
            "vector": vectors[10]
        },
        {
            "id": 12,
            "title": "Understanding Precision and Recall",
            "body": "Precision and recall are key metrics used to evaluate the performance of information retrieval systems. Precision measures accuracy, while recall measures completeness.",
            "vector": vectors[11]
        },
        {
            "id": 13,
            "title": "HNSW Graph Indexes",
            "body": "Hierarchical Navigable Small World graphs are state-of-the-art structures for approximate nearest neighbor search. They build a multi-layer graph to guide the search process.",
            "vector": vectors[12]
        },
        {
            "id": 14,
            "title": "Inverted Index Explained",
            "body": "An inverted index is an index data structure storing a mapping from content, such as words or numbers, to its locations in a document or a set of documents.",
            "vector": vectors[13]
        },
        {
            "id": 15,
            "title": "The Power of Arrow in Memory",
            "body": "Apache Arrow defines a standardized columnar memory format for flat and hierarchical data. It enables zero-copy data sharing across different systems and languages.",
            "vector": vectors[14]
        },
        {
            "id": 16,
            "title": "Tokenization in Text Search",
            "body": "Tokenization is the process of breaking text down into individual words or tokens. It is a crucial preprocessing step for both traditional and neural search pipelines.",
            "vector": vectors[15]
        },
        {
            "id": 17,
            "title": "Stemming and Lemmatization",
            "body": "Stemming and lemmatization reduce words to their base or dictionary form. This helps match different grammatical forms of a word during search query execution.",
            "vector": vectors[16]
        },
        {
            "id": 18,
            "title": "Term Frequency and Inverse Document Frequency",
            "body": "TF-IDF is a numerical statistic intended to reflect how important a word is to a document in a collection or corpus. It is a foundational concept in text mining.",
            "vector": vectors[17]
        },
        {
            "id": 19,
            "title": "Scaling Search Infrastructure",
            "body": "Scaling a search engine requires distributed indexing and querying capabilities. Sharding and replication ensure high availability and low latency under heavy load.",
            "vector": vectors[18]
        },
        {
            "id": 20,
            "title": "The Future of Vector Search",
            "body": "As unstructured data grows, the need for efficient similarity search becomes paramount. Hardware acceleration and novel algorithms will continue to drive vector search forward.",
            "vector": vectors[19]
        }
    ]
    
    # Create table
    table = db.create_table("articles", data=data, schema=schema, mode="overwrite")
    
    # Create native FTS index
    table.create_fts_index("body", use_tantivy=False, replace=True)
    
    # Query 1
    res1 = table.search("vector database", query_type="fts").limit(3).to_list()
    query_1_results = []
    for r in res1:
        query_1_results.append({
            "id": int(r["id"]),
            "title": str(r["title"]),
            "_score": float(r["_score"])
        })
        
    # Query 2
    res2 = table.search("lance format", query_type="fts").limit(3).to_list()
    query_2_results = []
    for r in res2:
        query_2_results.append({
            "id": int(r["id"]),
            "title": str(r["title"]),
            "_score": float(r["_score"])
        })
        
    output_dir = "/home/user/output"
    os.makedirs(output_dir, exist_ok=True)
    
    output_data = {
        "query_1": query_1_results,
        "query_2": query_2_results
    }
    
    output_path = os.path.join(output_dir, "fts_results.json")
    with open(output_path, "w") as f:
        json.dump(output_data, f, indent=2)
    print(f"Successfully wrote results to {output_path}")

if __name__ == "__main__":
    run()
