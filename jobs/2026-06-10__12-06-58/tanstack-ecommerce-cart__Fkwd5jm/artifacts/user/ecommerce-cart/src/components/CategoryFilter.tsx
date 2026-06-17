import { useNavigate, useSearch } from '@tanstack/react-router'
import { shopRoute } from '../router'
import type { Product } from '../data/products'

interface CategoryFilterProps {
  products: Product[]
}

export function CategoryFilter({ products }: CategoryFilterProps) {
  const { category } = useSearch({ from: shopRoute.id })
  const navigate = useNavigate({ from: shopRoute.id })

  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category))).sort()]

  function setCategory(cat: string) {
    navigate({
      search: (prev) => ({ ...prev, category: cat }),
      replace: true,
    })
  }

  return (
    <div className="category-filter">
      {categories.map((cat) => (
        <button
          key={cat}
          className={`category-btn ${category === cat ? 'active' : ''}`}
          onClick={() => setCategory(cat)}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}
