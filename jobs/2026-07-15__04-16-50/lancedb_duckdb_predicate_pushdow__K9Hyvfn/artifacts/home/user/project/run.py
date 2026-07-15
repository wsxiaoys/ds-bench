import os
import json
import argparse
import pyarrow as pa
import lancedb
import duckdb

def get_or_create_table():
    db_path = "/home/user/project/lancedb"
    db = lancedb.connect(db_path)
    table_name = "documents"
    
    # Robust check for table existence across different LanceDB versions
    try:
        res = db.list_tables()
        if hasattr(res, "tables"):
            tables = res.tables
        else:
            tables = list(res)
    except Exception:
        tables = db.table_names()
        
    if table_name in tables:
        return db.open_table(table_name)
        
    # Read the JSONL file
    data = []
    jsonl_path = "/home/user/project/data/documents.jsonl"
    with open(jsonl_path, "r") as f:
        for line in f:
            if line.strip():
                data.append(json.loads(line))
                
    # Prepare pyarrow arrays
    ids = pa.array([d["id"] for d in data], type=pa.int32())
    titles = pa.array([d["title"] for d in data], type=pa.string())
    categories = pa.array([d["category"] for d in data], type=pa.string())
    prices = pa.array([d["price"] for d in data], type=pa.float32())
    in_stocks = pa.array([d["in_stock"] for d in data], type=pa.bool_())
    vectors = pa.array([d["vector"] for d in data], type=pa.list_(pa.float32(), 8))
    
    batch = pa.RecordBatch.from_arrays(
        [ids, titles, categories, prices, in_stocks, vectors],
        names=["id", "title", "category", "price", "in_stock", "vector"]
    )
    tbl = pa.Table.from_batches([batch])
    
    table = db.create_table(table_name, data=tbl)
    table.optimize()
    return table

def main():
    parser = argparse.ArgumentParser(description="Hybrid LanceDB + DuckDB Analytics Bridge")
    parser.add_argument("--query-vector", required=True, type=str, help="Comma-separated query vector of 8 floats")
    parser.add_argument("--top-k", required=True, type=int, help="Number of candidates to retrieve from LanceDB")
    parser.add_argument("--max-price", required=True, type=float, help="Maximum price limit for candidates")
    parser.add_argument("--category", required=False, type=str, default=None, help="Optional exact category filter")
    
    args = parser.parse_args()
    
    # Parse query vector
    try:
        vector_parts = args.query_vector.split(",")
        if len(vector_parts) != 8:
            raise ValueError("Query vector must have exactly 8 elements.")
        query_vector = [float(x) for x in vector_parts]
    except Exception as e:
        raise ValueError(f"Invalid query-vector: {e}")
        
    # Open or create LanceDB table
    table = get_or_create_table()
    
    # Perform L2 vector search in LanceDB
    candidates_arrow = table.search(query_vector).metric("l2").limit(args.top_k).to_arrow()
    
    # Connect to DuckDB
    con = duckdb.connect()
    
    # Register candidates table from Arrow
    con.register("candidates", candidates_arrow)
    
    # Load categories from CSV
    con.execute("CREATE OR REPLACE TABLE categories AS SELECT * FROM read_csv_auto('/home/user/project/data/categories.csv')")
    
    # Create temp table of surviving candidates applying predicate filters
    query = """
    CREATE OR REPLACE TEMP TABLE surviving_candidates AS
    SELECT 
        c.id,
        c.title,
        c.category,
        cat.department,
        CAST(c.price AS DOUBLE) as price,
        CAST(c._distance AS DOUBLE) AS distance
    FROM candidates c
    JOIN categories cat ON c.category = cat.category
    WHERE c.in_stock = true
      AND c.price <= ?
    """
    params = [args.max_price]
    if args.category is not None:
        query += " AND c.category = ?"
        params.append(args.category)
        
    con.execute(query, params)
    
    # Fetch hits
    hits_res = con.execute("""
        SELECT 
            id,
            title,
            category,
            department,
            price,
            distance,
            CAST(ROW_NUMBER() OVER (PARTITION BY department ORDER BY distance ASC, id ASC) AS INTEGER) AS dept_rank
        FROM surviving_candidates
        ORDER BY distance ASC, id ASC
    """).fetchall()
    
    hits = []
    for row in hits_res:
        hits.append({
            "id": int(row[0]),
            "title": str(row[1]),
            "category": str(row[2]),
            "department": str(row[3]),
            "price": float(row[4]),
            "distance": float(row[5]),
            "dept_rank": int(row[6])
        })
        
    # Fetch departments
    dept_res = con.execute("""
        SELECT 
            department,
            CAST(COUNT(*) AS INTEGER) AS num_docs,
            CAST(ROUND(AVG(price), 4) AS DOUBLE) AS avg_price,
            CAST(MIN(distance) AS DOUBLE) AS min_distance
        FROM surviving_candidates
        GROUP BY department
        ORDER BY department ASC
    """).fetchall()
    
    departments = []
    for row in dept_res:
        departments.append({
            "department": str(row[0]),
            "num_docs": int(row[1]),
            "avg_price": float(row[2]),
            "min_distance": float(row[3])
        })
        
    # Output JSON object
    output = {
        "hits": hits,
        "departments": departments
    }
    
    print(json.dumps(output))

if __name__ == "__main__":
    main()
