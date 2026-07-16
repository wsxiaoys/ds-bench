import express from 'express';

const app = express();
app.use(express.json());

const products = [
  { id: 1, name: "Notebook", price: 5 },
  { id: 2, name: "Pen", price: 2 },
  { id: 3, name: "Backpack", price: 40 }
];

// GET /api/products
app.get('/api/products', (req, res) => {
  res.json(products);
});

// GET /api/products/:id
app.get('/api/products/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const product = products.find(p => p.id === id);
  if (!product) {
    return res.status(404).json({ error: `Product with id ${id} not found` });
  }
  res.json(product);
});

// POST /api/orders
app.post('/api/orders', (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== 'local-dev-key-123') {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing X-Api-Key' });
  }

  const { productId, quantity } = req.body;

  if (productId === undefined || quantity === undefined) {
    return res.status(400).json({ error: 'productId and quantity are required' });
  }

  const product = products.find(p => p.id === productId);
  if (!product) {
    return res.status(404).json({ error: `Product with id ${productId} not found` });
  }

  if (typeof quantity !== 'number' || quantity < 1) {
    return res.status(400).json({ error: 'quantity must be a number greater than or equal to 1' });
  }

  const orderId = `ord_${Math.random().toString(36).substring(2, 11)}`;
  const total = product.price * quantity;

  res.status(201).json({
    orderId,
    productId,
    quantity,
    total
  });
});

const PORT = 8787;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock API server running at http://localhost:${PORT}`);
});
