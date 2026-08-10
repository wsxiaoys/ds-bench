import time
from prefect.events import emit_event

def test_trigger():
    print("Emitting first event: zealt.export.staged.zrwr4k6h6l")
    emit_event(
        event="zealt.export.staged.zrwr4k6h6l",
        resource={"prefect.resource.id": "zealt.export.zrwr4k6h6l"}
    )
    
    print("Sleeping for 2 seconds...")
    time.sleep(2)
    
    print("Emitting second event: zealt.export.approved.zrwr4k6h6l")
    emit_event(
        event="zealt.export.approved.zrwr4k6h6l",
        resource={"prefect.resource.id": "zealt.export.zrwr4k6h6l"}
    )
    print("Events emitted!")

if __name__ == "__main__":
    test_trigger()
