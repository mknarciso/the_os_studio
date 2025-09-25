class EditorStore {
  constructor() {
    this.files = new Map();
    this.listeners = new Set();
  }

  // Subscribe to store changes
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Notify all listeners of changes
  notify() {
    this.listeners.forEach(listener => listener());
  }

  // Update file content in the store
  updateFile(fullPath, content) {
    this.files.set(fullPath, {
      content,
      lastModified: new Date(),
    });
    this.notify();
    console.log(`File updated in store: ${fullPath}`);
  }

  // Get file from store
  getFile(fullPath) {
    return this.files.get(fullPath);
  }

  // Check if file exists in store
  hasFile(fullPath) {
    return this.files.has(fullPath);
  }

  // Get all files
  getAllFiles() {
    return Array.from(this.files.entries()).map(([path, data]) => ({
      path,
      ...data,
    }));
  }

  // Clear store
  clear() {
    this.files.clear();
    this.notify();
  }
}

// Create singleton instance
export const editorStore = new EditorStore();
