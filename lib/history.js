const fs = require('fs');
const path = require('path');

const HISTORY_PATH = path.join(__dirname, '..', 'data', 'history.json');

function loadHistory() {
  const data = fs.readFileSync(HISTORY_PATH, 'utf8');
  return JSON.parse(data);
}

function saveReading(entry) {
  const history = loadHistory();

  history.unshift({
    id: Date.now(),
    timestamp: new Date().toISOString(),
    ...entry
  });

  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n');
  return history[0];
}

function toggleFavorite(id) {
  const history = loadHistory();
  const entry = history.find(e => e.id === id);
  if (!entry) return null;
  entry.favorite = !entry.favorite;
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n');
  return entry;
}

function deleteReadings(ids) {
  const history = loadHistory();
  const idSet = new Set(ids);
  const filtered = history.filter(entry => !idSet.has(entry.id));
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(filtered, null, 2) + '\n');
  return filtered;
}

module.exports = { loadHistory, saveReading, deleteReadings, toggleFavorite };
