import docling.datamodel.pipeline_options as po
import inspect

for name, obj in inspect.getmembers(po):
    if inspect.isclass(obj):
        print(name, obj)
