#!/usr/bin/env python3
"""Publish test messages to RabbitMQ for testing the ingestion worker."""

import json
import pika

QUEUE_NAME = "documents"

def publish(messages):
    credentials = pika.PlainCredentials("guest", "guest")
    connection = pika.BlockingConnection(
        pika.ConnectionParameters(host="localhost", port=5672, virtual_host="/", credentials=credentials)
    )
    channel = connection.channel()
    # Declare the queue idempotently so the publisher works standalone
    channel.exchange_declare(exchange="documents.dlx", exchange_type="fanout", durable=True)
    channel.queue_declare(queue="documents.dlq", durable=True, arguments={"x-queue-type": "quorum"})
    channel.queue_bind(exchange="documents.dlx", queue="documents.dlq")
    channel.queue_declare(
        queue=QUEUE_NAME, durable=True,
        arguments={"x-queue-type": "quorum", "x-dead-letter-exchange": "documents.dlx"},
    )

    for body in messages:
        if isinstance(body, (dict, list)):
            body = json.dumps(body)
        if isinstance(body, str):
            body = body.encode("utf-8")
        channel.basic_publish(
            exchange="",
            routing_key=QUEUE_NAME,
            body=body,
            properties=pika.BasicProperties(delivery_mode=2),  # persistent
        )
    connection.close()
    print(f"Published {len(messages)} messages")

if __name__ == "__main__":
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else "mixed"

    if mode == "mixed":
        msgs = [
            json.dumps({"id": "doc1", "text": "Hello world from RabbitMQ"}),      # valid
            json.dumps({"id": "doc2", "text": "Another document here"}),          # valid
            json.dumps({"id": "doc3", "text": "Third document text"}),            # valid
            json.dumps({"id": "doc1", "text": "Duplicate of doc1"}),              # duplicate (same run)
            b'\xff\xfe not valid utf-8',                                          # poison: bad encoding
            json.dumps({"id": "", "text": "empty id"}),                           # poison: empty id
            json.dumps({"text": "missing id"}),                                  # poison: no id
            json.dumps({"id": "doc4", "text": ""}),                              # poison: empty text
            json.dumps([1, 2, 3]),                                                # poison: not object
            "not json at all",                                                    # poison: invalid json
            json.dumps({"id": "doc5", "text": "Fifth document"}),                # valid
            json.dumps({"id": "doc6", "text": "Sixth document content"}),        # valid
        ]
    elif mode == "duplicates":
        msgs = [
            json.dumps({"id": "doc1", "text": "Hello world from RabbitMQ"}),
            json.dumps({"id": "doc2", "text": "Another document here"}),
            json.dumps({"id": "doc3", "text": "Third document text"}),
        ]
    elif mode == "poison":
        msgs = [
            b'\xff\xfe bad bytes',
            json.dumps({"nope": "wrong"}),
            "plain text not json",
        ]
    elif mode == "empty":
        msgs = []
    elif mode == "batch":
        # 40 valid docs to test batching
        msgs = [json.dumps({"id": f"b{i}", "text": f"batch document number {i}"}) for i in range(40)]
    else:
        msgs = []

    publish(msgs)