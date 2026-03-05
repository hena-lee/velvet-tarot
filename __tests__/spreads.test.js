const { spreads } = require('../lib/spreads');

describe('spreads', () => {
  test('all spreads have required fields', () => {
    Object.entries(spreads).forEach(([key, spread]) => {
      expect(spread).toHaveProperty('name');
      expect(spread).toHaveProperty('cardCount');
      expect(spread).toHaveProperty('positions');
      expect(typeof spread.name).toBe('string');
      expect(typeof spread.cardCount).toBe('number');
      expect(Array.isArray(spread.positions)).toBe(true);
    });
  });

  test('cardCount matches the number of positions', () => {
    Object.entries(spreads).forEach(([key, spread]) => {
      expect(spread.positions).toHaveLength(spread.cardCount);
    });
  });

  test('every position has a label and description', () => {
    Object.values(spreads).forEach(spread => {
      spread.positions.forEach(pos => {
        expect(pos).toHaveProperty('label');
        expect(pos).toHaveProperty('description');
        expect(typeof pos.label).toBe('string');
        expect(typeof pos.description).toBe('string');
        expect(pos.label.length).toBeGreaterThan(0);
        expect(pos.description.length).toBeGreaterThan(0);
      });
    });
  });

  test('single spread has 1 card', () => {
    expect(spreads.single.cardCount).toBe(1);
  });

  test('threeCard spread has 3 cards', () => {
    expect(spreads.threeCard.cardCount).toBe(3);
  });

  test('celticCross spread has 10 cards', () => {
    expect(spreads.celticCross.cardCount).toBe(10);
  });
});
