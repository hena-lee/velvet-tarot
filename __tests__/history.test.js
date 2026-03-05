const fs = require('fs');
const path = require('path');
const { loadHistory, saveReading } = require('../lib/history');

const HISTORY_PATH = path.join(__dirname, '..', 'data', 'history.json');

let originalContent;

beforeAll(() => {
  originalContent = fs.readFileSync(HISTORY_PATH, 'utf8');
});

afterAll(() => {
  fs.writeFileSync(HISTORY_PATH, originalContent);
});

beforeEach(() => {
  fs.writeFileSync(HISTORY_PATH, '[]\n');
});

const mockEntry = {
  spreadType: 'threeCard',
  question: 'Will this work?',
  cards: [{ name: 'The Fool', isReversed: false }],
  spread: 'Past, Present, Future',
  reading: 'Test reading text.'
};

describe('loadHistory', () => {
  test('returns empty array when no readings exist', () => {
    expect(loadHistory()).toEqual([]);
  });

  test('returns saved readings', () => {
    saveReading(mockEntry);
    const history = loadHistory();
    expect(history).toHaveLength(1);
    expect(history[0].question).toBe('Will this work?');
  });
});

describe('saveReading', () => {
  test('adds id and timestamp to the entry', () => {
    const saved = saveReading(mockEntry);
    expect(saved).toHaveProperty('id');
    expect(saved).toHaveProperty('timestamp');
    expect(typeof saved.id).toBe('number');
    expect(new Date(saved.timestamp).toISOString()).toBe(saved.timestamp);
  });

  test('preserves all entry fields', () => {
    const saved = saveReading(mockEntry);
    expect(saved.spreadType).toBe('threeCard');
    expect(saved.question).toBe('Will this work?');
    expect(saved.spread).toBe('Past, Present, Future');
    expect(saved.reading).toBe('Test reading text.');
    expect(saved.cards).toHaveLength(1);
  });

  test('newest reading appears first', () => {
    saveReading({ ...mockEntry, question: 'First' });
    saveReading({ ...mockEntry, question: 'Second' });
    const history = loadHistory();
    expect(history[0].question).toBe('Second');
    expect(history[1].question).toBe('First');
  });

  test('persists to disk', () => {
    saveReading(mockEntry);
    const raw = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    expect(raw).toHaveLength(1);
  });
});
