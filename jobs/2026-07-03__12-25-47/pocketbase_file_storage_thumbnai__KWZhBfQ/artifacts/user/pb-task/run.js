const PocketBase = require('pocketbase').default;
const fs = require('fs');
const path = require('path');

(async () => {
  const pb = new PocketBase('http://127.0.0.1:8090');

  try {
    // 1. Authenticate as the admin
    await pb.admins.authWithPassword('admin@example.com', 'adminpassword');
    console.log('Admin authenticated');

    // 2. Upload input.jpg to create a new record in the gallery collection
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(path.join(__dirname, 'input.jpg'));
    const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
    formData.append('image', blob, 'input.jpg');

    const record = await pb.collection('gallery').create(formData);
    console.log('Created record:', record.id);

    // 3. Get the URL for the 100x100 thumbnail
    const thumbUrl = pb.files.getURL(record, record.image, { 'thumb': '100x100' });
    console.log('Thumbnail URL:', thumbUrl);

    // 4. Download the thumbnail and save it as thumbnail.jpg
    const response = await fetch(thumbUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(path.join(__dirname, 'thumbnail.jpg'), buffer);
    console.log('Thumbnail saved');

    // 5. Write the record ID to output.log
    fs.writeFileSync(path.join(__dirname, 'output.log'), `Record ID: ${record.id}\n`);
    console.log('Record ID written to output.log');
  } catch (err) {
    console.error('Error:', err);
    if (err.response) {
      const errBody = await err.response.text();
      console.error('Response:', errBody);
    }
    process.exit(1);
  }
})();
