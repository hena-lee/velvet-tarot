const { drawCards, shuffleDeck } = require('../lib/deck');

describe('drawCards', () => {
  test('returns the correct number of cards', () => {
    expect(drawCards(1)).toHaveLength(1);
    expect(drawCards(3)).toHaveLength(3);
    expect(drawCards(10)).toHaveLength(10);
  });

  test('returns no duplicate cards in a single draw', () => {
    const drawn = drawCards(10);
    const ids = drawn.map(card => card.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  test('each card has all original fields plus isReversed', () => {
    const drawn = drawCards(3);
    drawn.forEach(card => {
      expect(card).toHaveProperty('id');
      expect(card).toHaveProperty('name');
      expect(card).toHaveProperty('arcana');
      expect(card).toHaveProperty('keywords');
      expect(card).toHaveProperty('meaning');
      expect(card).toHaveProperty('isReversed');
    });
  });

  test('isReversed is always a boolean', () => {
    const drawn = drawCards(10);
    drawn.forEach(card => {
      expect(typeof card.isReversed).toBe('boolean');
    });
  });

  test('successive draws are independent (original deck not mutated)', () => {
    const draw1 = drawCards(22);
    const draw2 = drawCards(22);
    const ids1 = draw1.map(c => c.id).join(',');
    const ids2 = draw2.map(c => c.id).join(',');
    // Two full-deck shuffles producing the exact same order is astronomically unlikely
    // (1 in 22! ≈ 1 in 10^21). If this fails, the shuffle is broken.
    expect(ids1).not.toBe(ids2);
  });

  test('produces both upright and reversed cards over many draws', () => {
    let hasUpright = false;
    let hasReversed = false;
    // 50 single-card draws — probability of all same orientation: 2^-50
    for (let i = 0; i < 50; i++) {
      const [card] = drawCards(1);
      if (card.isReversed) hasReversed = true;
      else hasUpright = true;
      if (hasUpright && hasReversed) break;
    }
    expect(hasUpright).toBe(true);
    expect(hasReversed).toBe(true);
  });
});

describe('shuffleDeck', () => {
  test('returns all 78 cards', () => {
    expect(shuffleDeck()).toHaveLength(78);
  });

  test('every card has isReversed', () => {
    shuffleDeck().forEach(card => {
      expect(typeof card.isReversed).toBe('boolean');
    });
  });

  test('no duplicate cards', () => {
    const deck = shuffleDeck();
    const ids = new Set(deck.map(c => c.id));
    expect(ids.size).toBe(78);
  });

  test('order differs between shuffles', () => {
    const deck1 = shuffleDeck().map(c => c.id).join(',');
    const deck2 = shuffleDeck().map(c => c.id).join(',');
    expect(deck1).not.toBe(deck2);
  });
});
