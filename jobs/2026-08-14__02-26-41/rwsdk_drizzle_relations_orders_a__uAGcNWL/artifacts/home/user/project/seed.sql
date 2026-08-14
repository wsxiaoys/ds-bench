INSERT INTO orders (id, customer_name, status) VALUES (1, 'Alice Smith', 'completed');
INSERT INTO orders (id, customer_name, status) VALUES (2, 'Bob Jones', 'pending');

INSERT INTO order_items (id, order_id, product_name, quantity, unit_price) VALUES (1, 1, 'Laptop', 1, 1200);
INSERT INTO order_items (id, order_id, product_name, quantity, unit_price) VALUES (2, 1, 'Mouse', 2, 25);
INSERT INTO order_items (id, order_id, product_name, quantity, unit_price) VALUES (3, 2, 'Keyboard', 1, 75);
