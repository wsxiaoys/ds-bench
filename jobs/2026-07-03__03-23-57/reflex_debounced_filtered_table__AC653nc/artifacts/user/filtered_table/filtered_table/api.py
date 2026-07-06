from fastapi import FastAPI
from .queries import get_filtered_products_query
from .models import Product
import reflex as rx

fastapi_app = FastAPI()

@fastapi_app.get("/api/filter")
def api_filter(
    search: str = "",
    category: str = "All",
    min_price: float = None,
    max_price: float = None,
    in_stock_only: str = None,
    sort_by: str = "id",
    sort_dir: str = "asc",
):
    # Ensure seeding is done if empty
    from .seed import seed_db
    seed_db()
    
    # Parse in_stock_only case-insensitively
    is_in_stock_only = False
    if in_stock_only is not None:
        is_in_stock_only = in_stock_only.lower() == "true"
        
    with rx.session() as session:
        query = get_filtered_products_query(
            search=search,
            category=category,
            min_price=min_price,
            max_price=max_price,
            in_stock_only=is_in_stock_only,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
        products = session.exec(query).all()
        
        # Format the response exactly as required
        filtered_list = []
        for p in products:
            filtered_list.append({
                "id": p.id,
                "name": p.name,
                "category": p.category,
                "sku": p.sku,
                "price": float(p.price),
                "in_stock": bool(p.in_stock),
            })
            
        return {
            "result_count": len(filtered_list),
            "filtered": filtered_list,
        }
