import { useState } from 'react';
import type { ShopItem } from '../../hooks/useShop';
import { formatChips } from '../../utils/card-utils';
import './ShopPanel.css';

interface ShopPanelProps {
  catalog: ShopItem[];
  isOwned: (itemId: string) => boolean;
  chipBalance: number;
  onPurchase: (itemId: string) => Promise<unknown>;
  onClose: () => void;
}

export function ShopPanel({ catalog, isOwned, chipBalance, onPurchase, onClose }: ShopPanelProps) {
  const [tab, setTab] = useState<'emote' | 'badge'>('emote');
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const items = catalog.filter(i => i.type === tab);

  const handleBuy = async (item: ShopItem) => {
    if (isOwned(item.id)) return;
    setPurchasing(item.id);
    setMessage('');
    try {
      await onPurchase(item.id);
      setMessage(`Purchased ${item.name}!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Purchase failed';
      setMessage(msg);
    }
    setPurchasing(null);
  };

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel-content shop-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h2>Shop</h2>
          <button className="panel-close" onClick={onClose}>&times;</button>
        </div>

        <div className="shop-panel-balance">
          Balance: <strong>{formatChips(chipBalance)}</strong> chips
        </div>

        {/* Tabs */}
        <div className="shop-tabs">
          <button
            className={`shop-tab ${tab === 'emote' ? 'shop-tab--active' : ''}`}
            onClick={() => setTab('emote')}
          >
            Emotes
          </button>
          <button
            className={`shop-tab ${tab === 'badge' ? 'shop-tab--active' : ''}`}
            onClick={() => setTab('badge')}
          >
            Badges
          </button>
        </div>

        {message && <p className="shop-message">{message}</p>}

        {/* Item Grid */}
        <div className="shop-grid">
          {items.map(item => {
            const owned = isOwned(item.id);
            const canAfford = chipBalance >= item.price;

            return (
              <div key={item.id} className={`shop-item rarity-${item.rarity} ${owned ? 'shop-item--owned' : ''}`}>
                <span className="shop-item-emoji">{item.emoji}</span>
                <span className="shop-item-name">{item.name}</span>
                <span className="shop-item-desc">{item.description}</span>
                <span className={`shop-item-rarity rarity-label-${item.rarity}`}>
                  {item.rarity}
                </span>
                <div className="shop-item-footer">
                  {owned ? (
                    <span className="shop-item-owned-badge">Owned</span>
                  ) : (
                    <>
                      <span className="shop-item-price">{formatChips(item.price)}</span>
                      <button
                        className="btn-buy"
                        disabled={!canAfford || purchasing === item.id}
                        onClick={() => handleBuy(item)}
                      >
                        {purchasing === item.id ? '...' : 'Buy'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
