import os

# Create a small valid PNG
png_bytes = b'\x89PNG\r\n\x1a\n\x00\x01\x02\x03'
with open('test.png', 'wb') as f:
    f.write(png_bytes)

# Create a small valid PDF
pdf_bytes = b'%PDF-1.4\n\x00\x01\x02\x03'
with open('test.pdf', 'wb') as f:
    f.write(pdf_bytes)

# Create an invalid file (txt)
with open('test.txt', 'wb') as f:
    f.write(b'Hello World! This is a plain text file.')

# Create a file that is too large (> 1MB)
# 1048576 is 1MB. Let's make it 1048577 bytes.
large_png_bytes = b'\x89PNG\r\n\x1a\n' + b'\x00' * (1048576 - 8 + 1)
with open('large.png', 'wb') as f:
    f.write(large_png_bytes)

print("Test files created successfully!")
