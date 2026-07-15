"""
Test publisher: pushes a controlled set of messages onto the `documents` queue
to exercise every code path in ingest.py.

Message set:
  doc-1  .. doc-5   valid unique documents
  doc-2             duplicate of doc-2 (same id sent again)
  doc-3             duplicate of doc-3
  <poison-1>        not valid UTF-8 bytes
  <poison-2>        valid UTF-8 but not JSON
  <poison-3>        JSON array (not an object)
  <poison-4>        object missing 'id'
  <poison-5>        object with empty 'id'
  <poison-6>        object missing 'text'
  <poison-7>        object with empty 'text'
  doc-6  .. doc-20  more valid unique docs (exercises batch flush mid-stream)
"""

import json
import pika

RABBITMQ_HOST = "localhost"
MAIN_QUEUE = "documents"
DLX_EXCHANGE = "documents.dlx"
DLQ_QUEUE = "documents.dlq"


def publish(channel, body: bytes):
    channel.basic_publish(exchange="", routing_key=MAIN_QUEUE, body=body)


def main():
    creds = pika.PlainCredentials("guest", "guest")
    params = pika.ConnectionParameters(host=RABBITMQ_HOST, credentials=creds)
    conn = pika.BlockingConnection(params)
    ch = conn.channel()

    # --- Idempotent topology (mirrors ingest.py) -----------------------
    ch.exchange_declare(exchange=DLX_EXCHANGE, exchange_type="fanout", durable=True)
    ch.queue_declare(
        queue=MAIN_QUEUE, durable=True,
        arguments={"x-queue-type": "quorum", "x-dead-letter-exchange": DLX_EXCHANGE},
    )
    ch.queue_declare(
        queue=DLQ_QUEUE, durable=True,
        arguments={"x-queue-type": "quorum"},
    )
    ch.queue_bind(queue=DLQ_QUEUE, exchange=DLX_EXCHANGE)

    count = 0

    # Valid docs 1-5
    for i in range(1, 6):
        publish(ch, json.dumps({"id": f"doc-{i}", "text": f"Hello world document number {i}"}).encode())
        count += 1

    # Duplicates
    publish(ch, json.dumps({"id": "doc-2", "text": "Hello world document number 2"}).encode())
    count += 1
    publish(ch, json.dumps({"id": "doc-3", "text": "Hello world document number 3"}).encode())
    count += 1

    # Poison messages
    publish(ch, b"\xff\xfe invalid utf-8 \x80\x81")          # not UTF-8
    count += 1
    publish(ch, b"this is not json at all!!!")                # not JSON
    count += 1
    publish(ch, json.dumps([1, 2, 3]).encode())               # JSON array
    count += 1
    publish(ch, json.dumps({"text": "no id here"}).encode())  # missing id
    count += 1
    publish(ch, json.dumps({"id": "", "text": "empty id"}).encode())   # empty id
    count += 1
    publish(ch, json.dumps({"id": "x", "text": ""}).encode())          # empty text
    count += 1
    publish(ch, json.dumps({"id": "y"}).encode())                       # missing text
    count += 1

    # Valid docs 6-20 (15 more, total unique = 20)
    for i in range(6, 21):
        publish(ch, json.dumps({"id": f"doc-{i}", "text": f"Extended document number {i} with more tokens"}).encode())
        count += 1

    conn.close()
    print(f"Published {count} messages total.")
    print("Expected: 20 unique valid docs, 2 duplicates, 7 poison messages.")


if __name__ == "__main__":
    main()
