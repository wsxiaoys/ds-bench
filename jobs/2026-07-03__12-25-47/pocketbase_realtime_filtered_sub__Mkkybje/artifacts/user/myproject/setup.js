const PocketBase = require('pocketbase').default || require('pocketbase');
const pb = new PocketBase('http://127.0.0.1:8090');

(async () => {
  try {
    await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
    console.log('Authenticated');
    
    // Check if collection exists
    try {
      await pb.collections.getOne('messages');
      console.log('messages collection already exists');
    } catch (e) {
      // Create the messages collection
      const collection = await pb.collections.create({
        name: 'messages',
        type: 'base',
        schema: [
          { name: 'chat', type: 'text', required: false, options: { min: null, max: null, pattern: '' } },
          { name: 'body', type: 'text', required: false, options: { min: null, max: null, pattern: '' } }
        ],
        listRule: '',
        viewRule: '',
        createRule: '',
        updateRule: '',
        deleteRule: '',
      });
      console.log('Created messages collection:', collection.id);
    }
  } catch (e) {
    console.error('Error:', e.message || e);
    process.exit(1);
  }
})();
