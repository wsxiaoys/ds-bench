import reflex as rx
from sqlmodel import select
from .models import Product

CATEGORIES = ["Electronics", "Books", "Clothing", "Home", "Toys", "Sports"]

def seed_db():
    with rx.session() as session:
        try:
            # Check if any products exist
            existing = session.exec(select(Product)).first()
            if existing is not None:
                print("Database already seeded. Skipping.")
                return
            
            # Seed exactly 240 rows
            products = []
            for c in range(len(CATEGORIES)):
                category = CATEGORIES[c]
                for i in range(40):
                    name = f"{category} #{i+1:02d}"
                    sku = f"{category[:3].upper()}-{i+1:03d}"
                    price = round(5.0 + (c * 5) + (i * 1.0), 2)
                    in_stock = (i % 4) != 3
                    
                    product = Product(
                        name=name,
                        category=category,
                        sku=sku,
                        price=price,
                        in_stock=in_stock
                    )
                    products.append(product)
            
            session.add_all(products)
            session.commit()
            print(f"Successfully seeded {len(products)} products.")
        except Exception as e:
            print(f"Error during seeding: {e}")
