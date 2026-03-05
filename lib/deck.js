// load deck once at import time — Node caches this automatically
const cards = require('../data/cards.json');

// Fisher-Yates shuffle: O(n), unbiased, operates on a copy
function shuffle(deck) {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

// draw count cards from a freshly shuffled deck, each with a random orientation
function drawCards(count) {
  const shuffled = shuffle(cards);

  return shuffled.slice(0, count).map(card => ({
    ...card,
    isReversed: Math.random() < 0.5
  }));
}

// shuffle entire deck with orientation — for interactive picking
function shuffleDeck() {
  return shuffle(cards).map(card => ({
    ...card,
    isReversed: Math.random() < 0.5
  }));
}

module.exports = { drawCards, shuffleDeck };