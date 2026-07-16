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
    
    # Send messages:
    # 1. doc1 (exists)
    channel.basic_publish(
        exchange="",
        routing_key="documents",
        body=json.dumps({"id": "doc1", "text": "Original doc1 again"}).encode("utf-8")
    )
    # 2. doc6 (new)
    channel.basic_publish(
        exchange="",
        routing_key="documents",
        body=json.dumps({"id": "doc6", "text": "This is doc6, a completely new document."}).encode("utf-8")
    )
    # 3. doc2 (exists)
    channel.basic_publish(
        exchange="",
        routing_key="documents",
        body=json.dumps({"id": "doc2", "text": "Duplicate of doc2 text"}).encode("utf-8")
    )
    # 4. doc7 (new)
    channel.basic_publish(
        exchange="",
        routing_key="documents",
        body=json.dumps({"id": "doc7", "text": "This is doc7, another new document."}).encode("utf-8")
    )
    # 5. doc6 (duplicate of new in this batch)
    channel.basic_publish(
        exchange="",
        routing_key="documents",
        body=json.dumps({"id": "doc6", "text": "Duplicate of doc6"}).encode("utf-8")
    )
    # 6. poison message
    channel.basic_publish(
        exchange="",
        routing_key="documents",
        body=json.dumps({"id": "doc8"}).encode("utf-8") # missing text
    )
    
    connection.close()
    print("Second batch of test messages published!")

if __name__ == "__main__":
    main()
