import lancedb
from neo4j import GraphDatabase

def main():
    print("Connecting to LanceDB...")
    db = lancedb.connect("/app/lancedb")
    print("Tables:", db.table_names())
    table = db.open_table("nodes")
    print("Table schema:", table.schema)
    print("Number of rows:", len(table))
    
    # Print first few rows
    df = table.to_pandas()
    print("First 5 rows of table:")
    print(df.head())
    
    print("\nConnecting to Neo4j...")
    # Neo4j authentication is disabled, connect with auth=None
    driver = GraphDatabase.driver("bolt://localhost:7687", auth=None)
    with driver.session() as session:
        # Check node count
        result = session.run("MATCH (n:Entity) RETURN count(n) as count")
        print("Neo4j Entity node count:", result.single()["count"])
        
        # Check relationship count
        result = session.run("MATCH ()-[r:RELATED_TO]->() RETURN count(r) as count")
        print("Neo4j RELATED_TO relationship count:", result.single()["count"])
        
        # Sample some nodes and relationships
        result = session.run("MATCH (n:Entity)-[r:RELATED_TO]->(m:Entity) RETURN n.id, n.name, m.id, m.name LIMIT 5")
        print("Sample relationships:")
        for record in result:
            print(f"({record['n.id']}: {record['n.name']}) -RELATED_TO-> ({record['m.id']}: {record['m.name']})")

    driver.close()

if __name__ == "__main__":
    main()
