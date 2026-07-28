import docling.document_converter as dc
import inspect

for name, obj in inspect.getmembers(dc):
    if inspect.isclass(obj) or name.endswith("Option") or name.endswith("Options"):
        print(name, obj)
