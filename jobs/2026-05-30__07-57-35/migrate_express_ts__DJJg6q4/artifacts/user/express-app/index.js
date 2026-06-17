const express = require('express');
const app = express();
const port = 3000;

app.get('/greet/:name', (req, res) => {
  res.json({ message: `Hello, ${req.params.name}!` });
});

app.listen(port, () => {
  console.log(`Express app listening on port ${port}`);
});
