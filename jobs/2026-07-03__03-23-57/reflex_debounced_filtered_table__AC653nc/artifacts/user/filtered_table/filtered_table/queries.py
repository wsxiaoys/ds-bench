from sqlmodel import select
from .models import Product

def get_filtered_products_query(
    search: str = "",
    category: str = "All",
    min_price: float = None,
    max_price: float = None,
    in_stock_only: bool = False,
    sort_by: str = "id",
    sort_dir: str = "asc"
):
    query = select(Product)
    
    # Search (case-insensitive substring match against Product.name)
    if search:
        query = query.where(Product.name.ilike(f"%{search}%"))
        
    # Category (All or empty means no constraint)
    if category and category != "All":
        query = query.where(Product.category == category)
        
    # Price range
    if min_price is not None:
        try:
            query = query.where(Product.price >= float(min_price))
        except (ValueError, TypeError):
            pass
            
    if max_price is not None:
        try:
            query = query.where(Product.price <= float(max_price))
        except (ValueError, TypeError):
            pass
            
    # In stock only
    if in_stock_only:
        query = query.where(Product.in_stock == True)
        
    # Sorting
    sort_col = Product.id
    if sort_by == "name":
        sort_col = Product.name
    elif sort_by == "price":
        sort_col = Product.price
    elif sort_by == "category":
        sort_col = Product.category
        
    if sort_dir == "desc":
        query = query.order_by(sort_col.desc())
    else:
        query = query.order_by(sort_col.asc())
        
    return query
