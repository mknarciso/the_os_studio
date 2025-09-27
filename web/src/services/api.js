const API_BASE_URL = 'http://localhost:3001';

export class ApiService {
  static async saveFile(namespace, app, relativePath, content) {
    const response = await fetch(`${API_BASE_URL}/files/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        namespace,
        app,
        relativePath,
        content,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to save file' }));
      throw new Error(error.message || 'Failed to save file');
    }

    return response.json();
  }

  static async getUnsavedDiffs(namespace, app, verbose = false) {
    const url = new URL(`${API_BASE_URL}/git/unsaved-diffs`);
    url.searchParams.set('namespace', namespace);
    url.searchParams.set('app', app);
    if (verbose) url.searchParams.set('verbose', 'true');
    const response = await fetch(url.toString());
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to get unsaved diffs' }));
      throw new Error(error.message || 'Failed to get unsaved diffs');
    }
    return response.json();
  }

  static async applyDiffs(namespace, app, files) {
    const response = await fetch(`${API_BASE_URL}/git/apply-diffs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ namespace, app, files }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to apply diffs' }));
      throw new Error(error.message || 'Failed to apply diffs');
    }
    return response.json();
  }

  static async getFileContentByOsPath(osPath) {
    const url = new URL(`${API_BASE_URL}/files/content-by-os`);
    url.searchParams.set('path', osPath);
    const response = await fetch(url.toString());
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to load file content' }));
      throw new Error(error.message || 'Failed to load file content');
    }
    return response.json();
  }

  static async getFileContentByAppPath(appPath) {
    const url = new URL(`${API_BASE_URL}/files/content-by-app`);
    url.searchParams.set('path', appPath);
    const response = await fetch(url.toString());
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to load file content' }));
      throw new Error(error.message || 'Failed to load file content');
    }
    return response.json();
  }

  static async getFileTree(namespace, app, subPath = '') {
    const url = new URL(`${API_BASE_URL}/files/tree/${namespace}/${app}`);
    if (subPath) {
      url.searchParams.set('subPath', subPath);
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to load file tree' }));
      throw new Error(error.message || 'Failed to load file tree');
    }

    return response.json();
  }

  static async getFileContent(namespace, app, relativePath) {
    const encodedPath = encodeURIComponent(relativePath);
    const response = await fetch(`${API_BASE_URL}/files/content/${namespace}/${app}?path=${encodedPath}`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to load file content' }));
      throw new Error(error.message || 'Failed to load file content');
    }

    return response.json();
  }

  static async getUiJson(namespace, app) {
    // IMPORTANT: server already resolves base path using namespace/app params
    // so the query 'path' must be RELATIVE to the app root
    const encodedPath = encodeURIComponent('docs/ui.json');
    const response = await fetch(`${API_BASE_URL}/files/content/${namespace}/${app}?path=${encodedPath}`);
    if (!response.ok) {
      return null;
    }
    try {
      const data = await response.json();
      const parsed = JSON.parse(data.content || '{}');
      return parsed;
    } catch {
      return null;
    }
  }

  static async pathExists(namespace, app, relativePath) {
    try {
      const encodedPath = encodeURIComponent(relativePath);
      const response = await fetch(`${API_BASE_URL}/files/exists/${namespace}/${app}?path=${encodedPath}`);
      if (!response.ok) return false;
      const data = await response.json();
      return Boolean(data?.exists);
    } catch {
      return false;
    }
  }

  // Branding API
  static async getBrandingFile(relativePath) {
    const encoded = encodeURIComponent(relativePath);
    const response = await fetch(`${API_BASE_URL}/branding/content?path=${encoded}`);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to load branding file' }));
      throw new Error(error.message || 'Failed to load branding file');
    }
    return response.json();
  }

  static async runBranding(domain) {
    const response = await fetch(`${API_BASE_URL}/branding/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to run branding workflow' }));
      throw new Error(error.message || 'Failed to run branding workflow');
    }
    return response.json();
  }

  static async testHello(name = 'world') {
    const response = await fetch(`${API_BASE_URL}/branding/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to run hello test' }));
      throw new Error(error.message || 'Failed to run hello test');
    }
    return response.json();
  }

  // Documentation API methods
  static async getDocumentation(namespace, app) {
    const url = new URL(`${API_BASE_URL}/documentation`);
    url.searchParams.set('namespace', namespace);
    url.searchParams.set('app', app);
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to load documentation' }));
      throw new Error(error.message || 'Failed to load documentation');
    }

    return response.json();
  }

  static async updateApp(namespace, app, data) {
    const url = new URL(`${API_BASE_URL}/documentation/app`);
    url.searchParams.set('namespace', namespace);
    url.searchParams.set('app', app);
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to update app' }));
      throw new Error(error.message || 'Failed to update app');
    }

    return response.json();
  }

  // Generic entity methods - works with any entity type
  static async getEntities(namespace, app, entityType) {
    const url = new URL(`${API_BASE_URL}/documentation/${entityType}`);
    url.searchParams.set('namespace', namespace);
    url.searchParams.set('app', app);
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: `Failed to load ${entityType}` }));
      throw new Error(error.message || `Failed to load ${entityType}`);
    }

    return response.json();
  }

  static async createEntity(namespace, app, entityType, data) {
    const url = new URL(`${API_BASE_URL}/documentation/${entityType}`);
    url.searchParams.set('namespace', namespace);
    url.searchParams.set('app', app);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: `Failed to create ${entityType}` }));
      throw new Error(error.message || `Failed to create ${entityType}`);
    }

    return response.json();
  }

  static async updateEntity(namespace, app, entityType, slug, data) {
    const url = new URL(`${API_BASE_URL}/documentation/${entityType}/${slug}`);
    url.searchParams.set('namespace', namespace);
    url.searchParams.set('app', app);
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: `Failed to update ${entityType}` }));
      throw new Error(error.message || `Failed to update ${entityType}`);
    }

    return response.json();
  }

  static async deleteEntity(namespace, app, entityType, slug) {
    const url = new URL(`${API_BASE_URL}/documentation/${entityType}/${slug}`);
    url.searchParams.set('namespace', namespace);
    url.searchParams.set('app', app);
    const response = await fetch(url, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: `Failed to delete ${entityType}` }));
      throw new Error(error.message || `Failed to delete ${entityType}`);
    }

    return response.json();
  }

  // AI Chat Methods
  static async createThread(title) {
    const response = await fetch(`${API_BASE_URL}/ai/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to create thread' }));
      throw new Error(error.message || 'Failed to create thread');
    }

    return response.json();
  }

  static async getThreads() {
    const response = await fetch(`${API_BASE_URL}/ai/threads`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to get threads' }));
      throw new Error(error.message || 'Failed to get threads');
    }

    return response.json();
  }

  static async getThread(threadId) {
    const response = await fetch(`${API_BASE_URL}/ai/threads/${threadId}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to get thread' }));
      throw new Error(error.message || 'Failed to get thread');
    }

    return response.json();
  }

  static async sendMessage(threadId, message, type = 'documentation', context = {}) {
    const payload = {
      message,
      type,
      context,
    };
    
    console.log('📤 [ApiService] Sending message:', {
      threadId,
      payload: JSON.stringify(payload, null, 2)
    });
    
    const response = await fetch(`${API_BASE_URL}/ai/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to send message' }));
      console.error('❌ [ApiService] Send message failed:', {
        status: response.status,
        statusText: response.statusText,
        error
      });
      throw new Error(error.message || 'Validation failed');
    }

    const result = await response.json();
    console.log('✅ [ApiService] Message sent successfully:', result);
    return result;
  }

  static async deleteThread(threadId) {
    const response = await fetch(`${API_BASE_URL}/ai/threads/${threadId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to delete thread' }));
      throw new Error(error.message || 'Failed to delete thread');
    }

    return response.json();
  }

  static async sendMessageStream(threadId, message, type = 'documentation', context = {}, onEvent) {
    const payload = { message, type, context };
    const response = await fetch(`${API_BASE_URL}/ai/threads/${threadId}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok || !response.body) {
      const error = await response.text().catch(() => 'Failed to start stream');
      throw new Error(error || 'Failed to start stream');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let firstToken = true;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sepIndex;
      // SSE events are separated by double newlines
      while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sepIndex).trim();
        buffer = buffer.slice(sepIndex + 2);
        if (!rawEvent) continue;

        // Lines may include: "data: {json}"
        const dataLine = rawEvent.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        const jsonStr = dataLine.replace(/^data:\s*/, '');
        try {
          const evt = JSON.parse(jsonStr);
          if (onEvent) onEvent(evt, { firstToken });
          firstToken = false;
          if (evt.done) return;
        } catch (e) {
          // ignore JSON parse errors of stray lines
        }
      }
    }
  }

  // UI Graph
  static async runUiGraph({ action, namespace, app, filePath }) {
    const response = await fetch(`${API_BASE_URL}/ai/ui/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, namespace, app, filePath }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to run UI graph' }));
      throw new Error(error.message || 'Failed to run UI graph');
    }
    return response.json();
  }
}
