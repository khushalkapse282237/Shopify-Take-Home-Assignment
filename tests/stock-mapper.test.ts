// tests/stock-mapper.test.ts

import { describe, it, expect } from 'vitest';
import { mapVariantToStock } from '../src/stock-mapper';

describe('mapVariantToStock', () => {
  describe('qty field', () => {
    it('returns the exact inventory_quantity as qty', () => {
      expect(mapVariantToStock({ inventory_quantity: 42 }).qty).toBe(42);
    });

    it('returns 0 as qty when inventory_quantity is 0', () => {
      expect(mapVariantToStock({ inventory_quantity: 0 }).qty).toBe(0);
    });

    it('returns 1 as qty when inventory_quantity is 1', () => {
      expect(mapVariantToStock({ inventory_quantity: 1 }).qty).toBe(1);
    });

    it('returns 100 as qty when inventory_quantity is 100', () => {
      expect(mapVariantToStock({ inventory_quantity: 100 }).qty).toBe(100);
    });
  });

  describe('low field — threshold is 5', () => {
    it('marks low: true when qty is 0', () => {
      expect(mapVariantToStock({ inventory_quantity: 0 }).low).toBe(true);
    });

    it('marks low: true when qty is 1', () => {
      expect(mapVariantToStock({ inventory_quantity: 1 }).low).toBe(true);
    });

    it('marks low: true when qty is exactly 5 (boundary)', () => {
      expect(mapVariantToStock({ inventory_quantity: 5 }).low).toBe(true);
    });

    it('marks low: false when qty is 6 (just above threshold)', () => {
      expect(mapVariantToStock({ inventory_quantity: 6 }).low).toBe(false);
    });

    it('marks low: false when qty is 42', () => {
      expect(mapVariantToStock({ inventory_quantity: 42 }).low).toBe(false);
    });

    it('marks low: false when qty is 1000', () => {
      expect(mapVariantToStock({ inventory_quantity: 1000 }).low).toBe(false);
    });
  });

  describe('return shape', () => {
    it('returns an object with exactly qty and low fields', () => {
      const result = mapVariantToStock({ inventory_quantity: 10 });
      expect(result).toEqual({ qty: 10, low: false });
      expect(Object.keys(result)).toHaveLength(2);
    });

    it('does not mutate the input object', () => {
      const input = { inventory_quantity: 3 };
      mapVariantToStock(input);
      expect(input).toEqual({ inventory_quantity: 3 });
    });
  });
});
