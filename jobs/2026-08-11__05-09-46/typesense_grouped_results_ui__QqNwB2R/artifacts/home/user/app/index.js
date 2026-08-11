const express = require('express');
const { initialize, client } = require('./init-typesense');

const app = express();
app.set('view engine', 'ejs');
app.set('views', '/home/user/app/views');

app.get('/', async (req, res) => {
  const q = req.query.q || '';
  const page = parseInt(req.query.page) || 1;
  const perPage = 3;

  try {
    const searchParams = {
      q: q.trim() || '*',
      query_by: 'name',
      group_by: 'brand',
      group_limit: 99,
      per_page: perPage,
      page: page,
      sort_by: 'popularity:desc'
    };

    const searchResult = await client.collections('products').documents().search(searchParams);

    const totalGroups = searchResult.found || 0;
    const totalPages = Math.max(1, Math.ceil(totalGroups / perPage));
    const groupedHits = searchResult.grouped_hits || [];

    res.render('index', {
      q: q,
      currentPage: page,
      totalPages: totalPages,
      groupedHits: groupedHits
    });
  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Start initialization and then server
initialize()
  .then(() => {
    app.listen(3000, '0.0.0.0', () => {
      console.log('Server is running on http://0.0.0.0:3000');
    });
  })
  .catch(err => {
    console.error('Failed to initialize Typesense or start server:', err);
    process.exit(1);
  });
