import { useState, useEffect, useRef } from 'react';
import { Bot, Send, Sparkles, List, MessageSquarePlus, Trash2, Maximize2, Minimize2, Terminal, ArrowUp, ChevronsUpDown, Loader2, AlertTriangle, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ApiService } from '../services/api';

export function ChatPanel({ isVisible, currentContext = {}, width }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [currentThread, setCurrentThread] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [threads, setThreads] = useState([]);
  const [showThreadList, setShowThreadList] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const [expandedTools, setExpandedTools] = useState({});
  const toggleToolExpanded = (id) => {
    setExpandedTools(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Carregar threads quando o componente for visível
  useEffect(() => {
    if (isVisible) {
      loadThreads();
    }
  }, [isVisible]);

  // Auto-scroll para a última mensagem apenas quando há novas mensagens
  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ 
            behavior: 'smooth',
            block: 'end',
            inline: 'nearest'
          });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  // Fechar tela cheia com ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    if (isFullscreen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isFullscreen]);

  // Auto-resize inicial do textarea
  useEffect(() => {
    if (textareaRef.current) {
      autoResize(textareaRef.current);
    }
  }, [inputValue]);

  const loadThreads = async () => {
    try {
      const threadsData = await ApiService.getThreads();
      setThreads(threadsData);
    } catch (error) {
      console.error('Error loading threads:', error);
    }
  };

  const initializeThread = async () => {
    try {
      setLoading(true);
      const thread = await ApiService.createThread('E-Zaz Documentation Chat');
      setCurrentThread(thread);
      setThreads(prev => [thread, ...prev]);
    } catch (error) {
      console.error('Error creating thread:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNewThread = () => {
    // Apenas limpar o chat - nova thread será criada automaticamente no primeiro envio
    setCurrentThread(null);
    setMessages([]);
    setShowThreadList(false);
  };

  const selectThread = async (threadId) => {
    try {
      setLoading(true);
      const threadData = await ApiService.getThread(threadId);
      setCurrentThread(threadData.thread);
      
      // Converter mensagens do backend para formato do ChatPanel
      const formattedMessages = (threadData.messages || []).map(msg => ({
        id: msg.messageId,
        type: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      }));
      
      setMessages(formattedMessages);
      setShowThreadList(false);
    } catch (error) {
      console.error('Error loading thread:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteCurrentThread = async () => {
    if (!currentThread) return;
    
    const confirmed = window.confirm('Tem certeza que deseja deletar esta conversa? Esta ação não pode ser desfeita.');
    if (!confirmed) return;

    try {
      await ApiService.deleteThread(currentThread.threadId);
      setThreads(prev => prev.filter(t => t.threadId !== currentThread.threadId));
      
      // Selecionar outra thread ou criar nova
      const remainingThreads = threads.filter(t => t.threadId !== currentThread.threadId);
      if (remainingThreads.length > 0) {
        await selectThread(remainingThreads[0].threadId);
      } else {
        setCurrentThread(null);
        setMessages([]);
        await initializeThread();
      }
    } catch (error) {
      console.error('Error deleting thread:', error);
    }
  };

  // Auto-resize textarea
  const autoResize = (textarea) => {
    if (textarea) {
      textarea.style.height = 'auto';
      const lineHeight = 20; // altura de uma linha em pixels
      const minLines = 1;
      const maxLines = 6.5;
      const minHeight = lineHeight * minLines;
      const maxHeight = lineHeight * maxLines;
      
      const scrollHeight = Math.max(textarea.scrollHeight, minHeight);
      textarea.style.height = Math.min(scrollHeight, maxHeight) + 'px';
    }
  };

  // Handle input change with auto-resize
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
    autoResize(e.target);
  };

  const formatToolName = (name) => {
    if (!name) return 'Tool';
    const base = String(name)
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return base.replace(/\bTool\b$/i, '').trim();
  };

  const extractDetail = (obj) => {
    const pickFrom = (o) => {
      if (!o || typeof o !== 'object') return null;
      // Prefer osPath, then common path-like fields
      const keys = ['osPath', 'path', 'file', 'relativePath', 'target', 'detail', 'info'];
      for (const k of keys) {
        if (o[k]) return o[k];
      }
      return null;
    };
    const maybe = pickFrom(obj) || (obj && typeof obj === 'object' && pickFrom(obj.args)) || (obj && typeof obj === 'object' && pickFrom(obj.result));
    if (!maybe) return null;
    const str = String(maybe);
    if (str.includes('/') || str.includes('\\')) {
      const parts = str.split(/\\\\|\//);
      return parts[parts.length - 1] || str;
    }
    return str;
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || sending) return;

    // Se não há thread atual, criar uma nova
    let threadToUse = currentThread;
    if (!threadToUse) {
      try {
        const thread = await ApiService.createThread('E-Zaz Documentation Chat');
        setCurrentThread(thread);
        setThreads(prev => [thread, ...prev]);
        threadToUse = thread;
      } catch (error) {
        console.error('Error creating thread:', error);
        return;
      }
    }

    const messageText = inputValue.trim();
    setInputValue('');
    setSending(true);

    // Mostrar mensagem do usuário imediatamente (otimista)
    const optimisticUserMessage = {
      id: `temp-${Date.now()}`,
      type: 'user',
      content: messageText
    };
    setMessages(prev => [...prev, optimisticUserMessage]);

    // Mostrar indicador de digitação
    const typingIndicator = {
      id: 'typing-indicator',
      type: 'assistant',
      content: '...',
      isTyping: true
    };
    setMessages(prev => [...prev, typingIndicator]);

    try {
      // Construir contexto para documentação
      const context = {
        // Use incoming context from MainContent; fall back only if not provided
        projectPath: currentContext.projectPath || '/apps/quero/flow',
        currentFile: currentContext.currentFile || 'documentation.json',
        area: currentContext.area || 'documentação',
        namespace: currentContext.namespace,
        app: currentContext.app,
      };

      // Prepare assistant placeholder for streaming
      const assistantId = `assistant-${Date.now()}`;
      setMessages(prev => prev.map(m => m.id === 'typing-indicator' ? { ...m, id: assistantId, content: '' , isTyping: false } : m));

      let accumulated = '';
      await ApiService.sendMessageStream(
        threadToUse.threadId,
        messageText,
        'documentation',
        context,
        (evt) => {
          if (evt.ack?.userMessageId) {
            // Replace optimistic user message id with persisted one
            setMessages(prev => prev.map(m => m.id === optimisticUserMessage.id ? { ...m, id: evt.ack.userMessageId } : m));
          }

          // Mastra vNext chunk handling
          if (evt.type === 'text-delta' && evt.payload?.text !== undefined) {
            accumulated += String(evt.payload.text);
            setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m));
          }
          if (evt.type === 'tool-call' && evt.payload) {
            const name = formatToolName(evt.payload.toolName || 'Tool');
            const detail = extractDetail(evt.payload.args || {});
            const msgId = `tool-${evt.payload.toolCallId || Date.now()}`;
            const toolMessage = {
              id: msgId,
              type: 'tool',
              tool: name,
              detail,
              args: evt.payload.args,
              status: 'running',
            };
            setMessages(prev => {
              const idx = prev.findIndex(m => m.id === msgId);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...toolMessage };
                return copy;
              }
              return [...prev, toolMessage];
            });
          }
          if (evt.type === 'tool-result' && evt.payload) {
            const name = formatToolName(evt.payload.toolName || 'Tool');
            const r = evt.payload.result;
            const looksSuccess = r && (r.osPath !== undefined || r.content !== undefined || r.created !== undefined || r.changed !== undefined);
            const looksError = (evt.payload.isError === true) 
              || (evt.payload.error !== undefined)
              || (evt.payload.status === 'error')
              || (r && (r.code === 'TOOL_EXECUTION_FAILED' || r.error !== undefined || (r.details && (r.details.message || r.details.domain || r.details.category))));
            const isError = looksError && !looksSuccess;
            const msgId = `tool-${evt.payload.toolCallId || Date.now()}`;
            const detail = extractDetail((!isError ? (evt.payload.result || evt.payload.args) : (evt.payload.args || {})) || {});
            const errorVal = isError
              ? (evt.payload.error !== undefined ? evt.payload.error
                : (r && (r.message || r.error)) || r || 'Tool error')
              : undefined;

            setMessages(prev => {
              const idx = prev.findIndex(m => m.id === msgId);
              const baseUpdate = {
                id: msgId,
                tool: name,
                detail,
                args: evt.payload.args,
              };
              if (idx >= 0) {
                const copy = [...prev];
                const current = copy[idx];
                copy[idx] = isError
                  ? { ...current, ...baseUpdate, type: 'tool-error', status: 'error', error: errorVal }
                  : { ...current, ...baseUpdate, type: 'tool', status: 'success' };
                return copy;
              }
              // No prior tool-call seen: create one now
              const newMsg = isError
                ? { ...baseUpdate, type: 'tool-error', status: 'error', error: errorVal }
                : { ...baseUpdate, type: 'tool', status: 'success' };
              return [...prev, newMsg];
            });
          }
          if (evt.type === 'tool-error' && evt.payload) {
            const name = formatToolName(evt.payload.toolName || 'Tool');
            const detail = extractDetail(evt.payload.args || {});
            const toolErrMessage = {
              id: `tool-${evt.payload.toolCallId || Date.now()}`,
              type: 'tool-error',
              tool: name,
              detail,
              args: evt.payload.args,
              error: evt.payload.error || evt.payload.result || evt.payload.message,
              status: 'error',
            };
            setMessages(prev => {
              const idx = prev.findIndex(m => m.id === toolErrMessage.id);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = { ...copy[idx], ...toolErrMessage };
                return copy;
              }
              return [...prev, toolErrMessage];
            });
          }

          // Legacy token-based text streaming (backward compatibility)
          if (evt.token) {
            accumulated += evt.token;
            setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: accumulated } : m));
          }
          if ((evt.done && evt.assistantMessageId) || evt.type === 'finish') {
            // If we have assistantMessageId, persist it; otherwise leave as is
            if (evt.assistantMessageId) {
              setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, id: evt.assistantMessageId } : m));
            }
            // If there were tool calls, notify potential changes
            try { window.dispatchEvent(new CustomEvent('studio:ai-tools-finished')); } catch {}
          }
        }
      );

      // Keep optimistic user message (persisted version will match after refresh)
      // Update thread counters locally for better UX
      setThreads(prev => prev.map(t => t.threadId === threadToUse.threadId 
        ? { ...t, messageCount: (t.messageCount || 0) + 2, lastActivity: new Date().toISOString() }
        : t
      ));
      setCurrentThread(prev => prev 
        ? { ...prev, messageCount: (prev.messageCount || 0) + 2, lastActivity: new Date().toISOString() }
        : prev
      );

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remover indicador de digitação
      setMessages(prev => prev.filter(msg => msg.id !== 'typing-indicator'));
      
      // Fallback para resposta de erro
      const errorMessage = {
        id: Date.now(),
        type: 'assistant',
        content: '❌ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !sending) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setInputValue(suggestion);
  };

  const suggestions = [
    'Como melhorar a documentação do projeto?',
    'Ajude-me a criar um novo fluxo de processo',
    'Ajude-me com testes de validação'
  ];

  if (!isVisible) return null;

  return (
    <>
      {/* Menu flutuante de threads */}
      {showThreadList && (
        <div className="thread-menu-overlay" onClick={() => setShowThreadList(false)}>
          <div className="thread-menu" onClick={(e) => e.stopPropagation()}>
            <div className="thread-menu-header">
              <span>Conversas Recentes</span>
              <button 
                className="close-button"
                onClick={() => setShowThreadList(false)}
              >
                ×
              </button>
            </div>
            <div className="thread-menu-content">
              {threads.length === 0 ? (
                <div className="no-threads">Nenhuma conversa ainda</div>
              ) : (
                threads.map(thread => (
                  <div
                    key={thread.threadId}
                    className={`thread-item ${currentThread?.threadId === thread.threadId ? 'active' : ''}`}
                    onClick={() => selectThread(thread.threadId)}
                  >
                    <div className="thread-item-title">{thread.title}</div>
                    <div className="thread-item-info">
                      {thread.messageCount} mensagens • {new Date(thread.lastActivity).toLocaleString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      
      <div className={`chat-panel ${isFullscreen ? 'fullscreen' : ''}`} style={!isFullscreen && width ? { width: 'calc(100% - 16px)', marginRight: 16 } : undefined}>
        <div className="chat-header">
        <div className="chat-header-left" />
        <div className="chat-header-actions">
          <button
            className="chat-header-button"
            onClick={() => setShowThreadList(!showThreadList)}
            title={currentThread?.title || 'Conversas'}
            style={{ display: 'inline-flex', gap: 6, padding: '0 8px', width: 'auto' }}
          >
            <List size={16} />
            <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentThread?.title || 'Conversas'}
            </span>
          </button>
          <button
            className="chat-header-button"
            onClick={createNewThread}
            title="Nova conversa"
          >
            <MessageSquarePlus size={16} />
          </button>
          {currentThread && (
            <button
              className="chat-header-button"
              onClick={deleteCurrentThread}
              title="Deletar conversa atual"
            >
              <Trash2 size={16} />
            </button>
          )}
          
          <button 
            className="chat-header-button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>
      

      
      {messages.length === 0 ? (
        <div className="chat-blank-state">
          <img 
            src="/e-zaz.png" 
            alt="E-Zaz AI Assistant" 
            className="mascot-image"
          />
          <div className="title">E... zaz!</div>
          <div className="subtitle">
            Your magical internal products wizard is here to help you.
          </div>
          <div className="suggestions">
            {suggestions.map(suggestion => (
              <button
                key={suggestion}
                className="suggestion-chip"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="chat-messages">
          {messages.map(message => (
            <div key={message.id} className={`chat-message ${message.type}`}>
              {message.type === 'assistant' ? (
                <div className={`assistant-message ${message.isTyping ? 'typing' : ''}`}>
                  {message.isTyping ? (
                    <div className="typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  ) : (
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  )}
                </div>
              ) : message.type === 'tool' ? (
                <div className="tool-message">
                  <div className="tool-message-header" onClick={() => toggleToolExpanded(message.id)}>
                    <span className="tool-message-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {message.status === 'running' ? <Loader2 size={14} className="spin" /> : (message.status === 'success' ? <Check size={14} /> : <Check size={14} />)}
                      <strong>{message.tool}</strong>{message.detail ? `: ${message.detail}`: ''}
                    </span>
                    <ChevronsUpDown size={14} />
                  </div>
                  {expandedTools[message.id] && (
                    <div className="tool-message-details">
                      {message.args && (
                        <>
                          <div className="tool-section-title">args</div>
                          <pre>{JSON.stringify(message.args, null, 2)}</pre>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : message.type === 'tool-error' ? (
                <div className="tool-message error">
                  <div className="tool-message-header" onClick={() => toggleToolExpanded(message.id)}>
                    <span className="tool-message-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <AlertTriangle size={14} />
                      <strong>{message.tool}</strong>{message.detail ? `: ${message.detail}`: ''}
                    </span>
                    <ChevronsUpDown size={14} />
                  </div>
                  {expandedTools[message.id] && (
                    <div className="tool-message-details">
                      {message.args && (
                        <>
                          <div className="tool-section-title">args</div>
                          <pre>{JSON.stringify(message.args, null, 2)}</pre>
                        </>
                      )}
                      {message.error !== undefined && (
                        <>
                          <pre className="tool-error-pre">{typeof message.error === 'string' ? message.error : JSON.stringify(message.error, null, 2)}</pre>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className={`message-bubble ${message.type}`}>
                  {message.content}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}
      
      <div className="chat-input">
        <textarea
          ref={textareaRef}
          className="chat-input-field"
          placeholder={sending ? "E-Zaz está pensando..." : "Digite aqui..."}
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          disabled={false}
          rows={1}
          style={{ paddingRight: 44 }}
        />
        <button
          type="button"
          title="Enviar"
          aria-label="Enviar"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleSendMessage}
          disabled={sending || !inputValue.trim()}
          style={{
            position: 'absolute',
            right: 16,
            bottom: 16,
            width: 28,
            height: 28,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.8)',
            cursor: sending || !inputValue.trim() ? 'not-allowed' : 'pointer',
            opacity: sending || !inputValue.trim() ? 0.5 : 0.8,
          }}
        >
          <ArrowUp size={14} />
        </button>
      </div>
      </div>
    </>
  );
}
