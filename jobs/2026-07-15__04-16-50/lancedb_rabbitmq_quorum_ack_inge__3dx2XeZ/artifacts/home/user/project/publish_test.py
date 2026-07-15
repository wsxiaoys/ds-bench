import pika
import json

def main():
    credentials = pika.PlainCredentials("guest", "guest")
    parameters = pika.ConnectionParameters(
        host="localhost",
        port=5672,
        virtual_host="/",
        credentials=credentials
    )
    connection = pika.BlockingConnection(parameters)
    channel = connection.channel()
    
    # Let's declare the topology first to make sure the queue exists
    channel.exchange_declare(
        exchange="documents.dlx",
        exchange_type="fanout",
        durable=True
    )
    
    channel.queue_declare(
        queue="documents",
        durable=True,
        arguments={
            "x-queue-type": "quorum",
            "x-dead-letter-exchange": "documents.dlx"
        }
    )
    
    # Clear the queue first in case there are old messages
    channel.queue_purge(queue="documents")
    
    # 1. Valid messages
    valid_docs = [
        {"id": "doc1", "text": "The quick brown fox jumps over the lazy dog."},
        {"id": "doc2", "text": "Artificial Intelligence is transforming industries."},
        {"id": "doc3", "text": "Vector databases are essential for semantic search."},
        {"id": "doc4", "text": "RabbitMQ is a reliable message broker."},
        {"id": "doc5", "text": "LanceDB is a serverless vector database."}
    ]
    
    for doc in valid_docs:
        channel.basic_publish(
            exchange="",
            routing_key="documents",
            body=json.dumps(doc).encode("utf-8")
        )
        print(f"Published valid: {doc['id']}")
        
    # 2. Duplicate messages
    duplicates = [
        {"id": "doc2", "text": "Duplicate of doc2 text"},
        {"id": "doc3", "text": "Another text for doc3"},
        {"id": "doc1", "text": "Original doc1 again"}
    ]
    for doc in duplicates:
        channel.basic_publish(
            exchange="",
            routing_key="documents",
            body=json.dumps(doc).encode("utf-8")
        )
        print(f"Published duplicate: {doc['id']}")
        
    # 3. Poison messages
    # Non-UTF8/non-JSON
    channel.basic_publish(
        exchange="",
        routing_key="documents",
        body=b"\x80\x81\x82 invalid non-utf8"
    )
    print("Published poison: non-utf8")
    
    # Non-JSON
    channel.basic_publish(
        exchange="",
        routing_key="documents",
        body=b"plain text not json"
    )
    print("Published poison: plain text")
    
    # JSON array
    channel.basic_publish(
        exchange="",
        routing_key="documents",
        body=json.dumps([1, 2, 3]).encode("utf-8")
    )
    print("Published poison: json array")
    
    # Missing text
    channel.basic_publish(
        exchange="",
        routing_key="documents",
        body=json.dumps({"id": "doc6"}).encode("utf-8")
    )
    print("Published poison: missing text")
    
    # Empty id
    channel.basic_publish(
        exchange="",
        routing_key="documents",
        body=json.dumps({"id": "", "text": "hello"}).encode("utf-8")
    )
    print("Published poison: empty id")
    
    # Missing id
    channel.basic_publish(
        exchange="",
        routing_key="documents",
        body=json.dumps({"text": "hello"}).encode("utf-8")
    )
    print("Published poison: missing id")
    
    connection.close()
    print("All test messages published!")

if __name__ == "__main__":
    main()
