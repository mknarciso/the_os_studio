const sessionState = {
  data: null,
  scopes: null,
  pages: null,
  automations: null,
};

// Basic listener pattern to notify components of changes
const listeners = new Set();

const notify = () => {
  for (const listener of listeners) {
    listener();
  }
};

export const EditorSessionStore = {
  setSelectedFileForArea(area, filePath) {
    if (sessionState.hasOwnProperty(area)) {
      sessionState[area] = filePath;
      notify();
    }
  },

  getSelectedFileForArea(area) {
    return sessionState[area] || null;
  },

  subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
};
