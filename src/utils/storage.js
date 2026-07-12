const STORAGE_PREFIX = 'pfmea_';

export function loadData(key) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Load failed:', key, e);
    return null;
  }
}

export function saveData(key, data) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
    return true;
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded');
      return false;
    }
    console.warn('Save failed:', key, e);
    return false;
  }
}

export function removeData(key) {
  localStorage.removeItem(STORAGE_PREFIX + key);
}

export function loadConfig() {
  return loadData('config');
}

export function saveConfig(config) {
  return saveData('config', config);
}

export function loadSopData() {
  return loadData('sopData');
}

export function saveSopData(data) {
  return saveData('sopData', data);
}

export function loadPfmeaData() {
  return loadData('pfmeaData');
}

export function savePfmeaData(data) {
  return saveData('pfmeaData', data);
}
