// src/stock-mapper.ts

export interface AdminVariantResponse {
  variant: {
    inventory_quantity: number;
  };
}

export interface StockEntry {
  qty: number;
  low: boolean;
}

const LOW_STOCK_THRESHOLD = 5;

export function mapVariantToStock(data: { inventory_quantity: number }): StockEntry {
  const qty = data.inventory_quantity;
  return {
    qty,
    low: qty <= LOW_STOCK_THRESHOLD,
  };
}
