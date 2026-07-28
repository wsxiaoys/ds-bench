from docling.document_converter import PdfFormatOption
import inspect

print("PdfFormatOption fields/init:")
print(inspect.signature(PdfFormatOption.__init__))
print("PdfFormatOption model_fields:")
for name, field in PdfFormatOption.model_fields.items():
    print(f"  {name}: {field.annotation}")
