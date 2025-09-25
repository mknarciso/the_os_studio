# Interface API - Sistema AI

## Visão Geral

Interface REST para comunicação entre o frontend e o sistema AI, com suporte a Threads para manter históricos de conversas separados e contexto de documentação.

## Endpoints

### 1. Gerenciamento de Threads

#### `POST /ai/threads`
Criar uma nova thread de conversa.

**Request:**
```json
{
  "title": "Discussão sobre Flow de Pagamentos",
  "context": {
    "type": "documentation",
    "projectPath": "/apps/quero/flow",
    "currentFile": "documentation.json"
  }
}
```

**Response:**
```json
{
  "threadId": "thread_abc123",
  "title": "Discussão sobre Flow de Pagamentos",
  "createdAt": "2024-01-15T10:30:00Z",
  "context": {
    "type": "documentation",
    "projectPath": "/apps/quero/flow",
    "currentFile": "documentation.json"
  }
}
```

#### `GET /ai/threads`
Listar todas as threads do usuário.

**Response:**
```json
{
  "threads": [
    {
      "threadId": "thread_abc123",
      "title": "Discussão sobre Flow de Pagamentos",
      "lastMessage": "Como posso melhorar a documentação?",
      "lastActivity": "2024-01-15T10:35:00Z",
      "messageCount": 5
    }
  ]
}
```

#### `GET /ai/threads/:threadId`
Obter detalhes de uma thread específica.

**Response:**
```json
{
  "threadId": "thread_abc123",
  "title": "Discussão sobre Flow de Pagamentos",
  "createdAt": "2024-01-15T10:30:00Z",
  "context": {
    "type": "documentation",
    "projectPath": "/apps/quero/flow",
    "currentFile": "documentation.json"
  },
  "messages": [
    {
      "messageId": "msg_001",
      "role": "user",
      "content": "Como posso melhorar a documentação do flow?",
      "timestamp": "2024-01-15T10:31:00Z"
    },
    {
      "messageId": "msg_002",
      "role": "assistant",
      "content": "Posso ajudar você a melhorar a documentação...",
      "timestamp": "2024-01-15T10:31:15Z",
      "metadata": {
        "executionTime": 1500,
        "tokensUsed": 150
      }
    }
  ]
}
```

#### `DELETE /ai/threads/:threadId`
Deletar uma thread e todo seu histórico.

**Response:**
```json
{
  "success": true,
  "message": "Thread deletada com sucesso"
}
```

### 2. Mensagens

#### `POST /ai/threads/:threadId/messages`
Enviar uma nova mensagem na thread.

**Request:**
```json
{
  "message": "Como posso melhorar a documentação do flow de pagamentos?",
  "context": {
    "type": "documentation",
    "projectPath": "/apps/quero/flow",
    "currentFile": "documentation.json",
    "selectedText": "flow de pagamentos...",
    "cursorPosition": {
      "line": 45,
      "column": 12
    }
  }
}
```

**Response:**
```json
{
  "messageId": "msg_003",
  "threadId": "thread_abc123",
  "response": {
    "type": "text",
    "content": "Para melhorar a documentação do flow de pagamentos, sugiro...",
    "metadata": {
      "executionTime": 2300,
      "tokensUsed": 280,
      "taskType": "conversation"
    }
  },
  "timestamp": "2024-01-15T10:32:00Z"
}
```

#### `POST /ai/threads/:threadId/messages` (Streaming)
Para respostas longas, suporte a streaming.

**Headers:**
```
Accept: text/event-stream
```

**Response (Server-Sent Events):**
```
data: {"type": "start", "messageId": "msg_003"}

data: {"type": "content", "delta": "Para melhorar"}

data: {"type": "content", "delta": " a documentação"}

data: {"type": "end", "metadata": {"executionTime": 2300, "tokensUsed": 280}}
```

### 3. Contexto e Ferramentas

#### `POST /ai/threads/:threadId/tools/documentation`
Executar ferramenta específica de documentação.

**Request:**
```json
{
  "action": "update_documentation",
  "target": "/apps/quero/flow/documentation.json",
  "instructions": "Adicionar seção sobre validações de pagamento",
  "context": {
    "type": "documentation",
    "projectPath": "/apps/quero/flow"
  }
}
```

**Response:**
```json
{
  "taskId": "task_xyz789",
  "status": "processing",
  "message": "Atualizando documentação..."
}
```

#### `GET /ai/tasks/:taskId`
Verificar status de uma tarefa assíncrona.

**Response:**
```json
{
  "taskId": "task_xyz789",
  "status": "completed",
  "result": {
    "type": "file_update",
    "updatedFiles": ["/apps/quero/flow/documentation.json"],
    "changes": "Adicionada seção sobre validações de pagamento",
    "backup": "/backups/documentation_20240115_103200.json"
  }
}
```

## Estrutura de Dados

### Thread
```typescript
interface Thread {
  threadId: string;
  title: string;
  createdAt: string;
  lastActivity: string;
  context: ThreadContext;
  messageCount: number;
}

interface ThreadContext {
  type: 'documentation' | 'general';
  projectPath?: string;
  currentFile?: string;
  metadata?: Record<string, any>;
}
```

### Message
```typescript
interface Message {
  messageId: string;
  threadId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  context?: MessageContext;
  metadata?: MessageMetadata;
}

interface MessageContext {
  type: 'documentation';
  projectPath: string;
  currentFile?: string;
  selectedText?: string;
  cursorPosition?: {
    line: number;
    column: number;
  };
}

interface MessageMetadata {
  executionTime?: number;
  tokensUsed?: number;
  taskType?: 'conversation' | 'documentation' | 'analysis';
  updatedFiles?: string[];
}
```

## Fluxo de Uso

### 1. Iniciar Nova Conversa
```
Frontend → POST /ai/threads
Frontend ← threadId + context
```

### 2. Enviar Mensagem
```
Frontend → POST /ai/threads/:id/messages + context
Backend  → Análise de intenção
Backend  → Processamento (generateText/generateObject)
Frontend ← Resposta + metadata
```

### 3. Continuar Conversa
```
Frontend → POST /ai/threads/:id/messages
Backend  → Carrega histórico da thread
Backend  → Processa com contexto completo
Frontend ← Resposta contextualizada
```

## Considerações de Implementação

### Persistência
- Threads armazenadas em banco de dados local (SQLite/lowdb)
- Mensagens com TTL configurável (ex: 30 dias)
- Backup automático de conversas importantes

### Performance
- Cache de contexto por thread
- Paginação de mensagens antigas
- Compressão de histórico longo

### Segurança
- Validação de ownership das threads
- Sanitização de contexto enviado
- Rate limiting por thread/usuário

