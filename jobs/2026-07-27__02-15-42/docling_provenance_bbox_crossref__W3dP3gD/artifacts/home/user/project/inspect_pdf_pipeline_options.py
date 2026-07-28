from docling.datamodel.pipeline_options import PdfPipelineOptions

print("PdfPipelineOptions fields:")
for name, field in PdfPipelineOptions.model_fields.items():
    print(f"  {name}: {field.annotation}")
