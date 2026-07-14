INSERT INTO orders (id, customer_name, status) VALUES
  (1, 'Alice Anderson', 'pending'),
  (2, 'Bob Brown', 'shipped'),
  (3, 'Carol Clark', 'cancelled');

INSERT INTO order_items (id, order_id, product_name, quantity, unit_price) VALUES
  (1, 1, 'Widget', 2, 1500),
  (2, 1, 'Gadget', 1, 2500),
  (3, 2, 'Sprocket', 5, 800),
  (4, 3, 'Doohickey', 3, 1200);