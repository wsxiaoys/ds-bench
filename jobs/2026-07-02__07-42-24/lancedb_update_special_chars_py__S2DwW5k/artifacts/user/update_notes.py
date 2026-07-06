import os
import json
import pyarrow as pa
import lancedb

def main():
    # Connect to LanceDB at /home/user/db
    db_path = "/home/user/db"
    db = lancedb.connect(db_path)
    
    # Define schema
    schema = pa.schema([
        pa.field("id", pa.int64()),
        pa.field("author", pa.string()),
        pa.field("body", pa.string()),
        pa.field("vector", pa.list_(pa.float32(), 4))
    ])
    
    # Seed data
    data = [
        {"id": 1, "author": "Alice", "body": "Original body 1", "vector": [0.1, 0.2, 0.3, 0.4]},
        {"id": 2, "author": "Bob", "body": "Original body 2", "vector": [0.5, 0.6, 0.7, 0.8]},
        {"id": 3, "author": "Charlie", "body": "Original body 3", "vector": [0.9, 1.0, 1.1, 1.2]},
        {"id": 4, "author": "David", "body": "Original body 4", "vector": [1.3, 1.4, 1.5, 1.6]},
        {"id": 5, "author": "Eve", "body": "Original body 5", "vector": [1.7, 1.8, 1.9, 2.0]},
        {"id": 6, "author": "Frank", "body": "Original body 6", "vector": [2.1, 2.2, 2.3, 2.4]},
        {"id": 7, "author": "Grace", "body": "Original body 7", "vector": [2.5, 2.6, 2.7, 2.8]},
        {"id": 8, "author": "Heidi", "body": "Original body 8", "vector": [2.9, 3.0, 3.1, 3.2]}
    ]
    
    # Create notes table (overwrite if already exists)
    table = db.create_table("notes", data=data, schema=schema, mode="overwrite")
    print("Table 'notes' created and seeded successfully.")
    
    # Perform updates in order
    # 1. Set the body of the row where id = 2 to the string "I'm good".
    table.update(where="id = 2", values={"body": "I'm good"})
    print("Update 1 completed: id=2 body -> I'm good")
    
    # 2. Set the body of the row where id = 4 to the string "It's a test".
    table.update(where="id = 4", values={"body": "It's a test"})
    print("Update 2 completed: id=4 body -> It's a test")
    
    # 3. Set the author of the row where id = 6 to the string "O'Brien".
    table.update(where="id = 6", values={"author": "O'Brien"})
    print("Update 3 completed: id=6 author -> O'Brien")
    
    # Read the rows with id in 1..8
    arrow_tbl = table.to_arrow()
    # Select columns id, author, body
    arrow_tbl = arrow_tbl.select(["id", "author", "body"])
    
    # Convert to Python list of dicts
    records = arrow_tbl.to_pylist()
    
    # Sort them by id ascending
    records.sort(key=lambda x: x["id"])
    
    # Make sure output directory exists
    output_dir = "/home/user/output"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "notes_after.json")
    
    # Write to /home/user/output/notes_after.json as a JSON array of objects
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)
        
    print(f"Successfully wrote post-update state to {output_path}")

if __name__ == "__main__":
    main()
