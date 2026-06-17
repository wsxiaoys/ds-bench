import json
from dataclasses import dataclass, asdict
from typing import Any
from pathlib import Path
from prefect import flow, task
from prefect.serializers import Serializer

@dataclass
class SensitiveData:
    id: int
    secret: str

class ObfuscatedSerializer(Serializer):
    type: str = "obfuscated"

    def dumps(self, obj: Any) -> bytes:
        """
        Serializes the SensitiveData object into a JSON-encoded byte string,
        reversing the secret value before serialization.
        """
        if isinstance(obj, SensitiveData):
            payload = {"id": obj.id, "secret": obj.secret[::-1]}
            return json.dumps(payload).encode()
        return json.dumps(obj).encode()

    def loads(self, blob: bytes) -> Any:
        """
        Deserializes the byte string, reverses the secret value back,
        and returns a SensitiveData instance.
        """
        data = json.loads(blob.decode())
        # Reversing the secret back
        original_secret = data["secret"][::-1]
        return SensitiveData(id=data["id"], secret=original_secret)

@task(
    persist_result=True,
    result_serializer=ObfuscatedSerializer(),
    result_storage=Path("/home/user/myproject/results")
)
def generate_data():
    return SensitiveData(id=42, secret="my_super_secret_token")

@flow(name="process_sensitive_data")
def process_sensitive_data():
    return generate_data()

if __name__ == "__main__":
    result = process_sensitive_data()
    print(f"Flow result: {result}")
