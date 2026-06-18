import "./Header.css";

interface HeaderProps {
  cartItemCount: number;
}

export function Header({ cartItemCount }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-content">
        <h1 className="header-title">🛍️ E-Commerce Store</h1>
        <div className="header-cart-info">
          <span className="header-cart-label">Cart:</span>
          <span className="header-cart-count">
            {cartItemCount} {cartItemCount === 1 ? "item" : "items"}
          </span>
        </div>
      </div>
    </header>
  );
}