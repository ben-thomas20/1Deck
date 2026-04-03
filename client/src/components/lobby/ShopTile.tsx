import type { ShopItem } from '../../hooks/useShop';
import { formatChips } from '../../utils/card-utils';
import './ShopTile.css';

interface ShopTileProps {
  catalog: ShopItem[];
  chipBalance: number;
  onOpenShop: () => void;
}

export function ShopTile({ catalog, chipBalance, onOpenShop }: ShopTileProps) {
  // Show up to 3 featured items (one from each rarity if possible)
  const featured = [
    catalog.find(i => i.rarity === 'legendary'),
    catalog.find(i => i.rarity === 'rare'),
    catalog.find(i => i.rarity === 'common'),
  ].filter(Boolean) as ShopItem[];

  return (
    <div className="dashboard-tile shop-tile" onClick={onOpenShop}>
      <div className="tile-header">
        <h2 className="tile-title">Shop</h2>
        <span className="shop-balance">{formatChips(chipBalance)} chips</span>
      </div>

      <div className="shop-featured">
        {featured.map(item => (
          <div key={item.id} className={`shop-featured-item rarity-${item.rarity}`}>
            <span className="shop-featured-emoji">{item.emoji}</span>
            <span className="shop-featured-name">{item.name}</span>
            <span className="shop-featured-price">{formatChips(item.price)}</span>
          </div>
        ))}
      </div>

      <button className="btn-browse-shop">Browse Shop</button>
    </div>
  );
}
