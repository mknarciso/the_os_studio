# Plano de Implementação - Sistema AI

## Fases de Desenvolvimento

### Fase 1: Setup e Estrutura Base
- [ ] Instalar AI SDK da Vercel (`npm install ai`)
- [ ] Criar estrutura de módulos NestJS
- [ ] Configurar DTOs e tipos básicos para threads e mensagens
- [ ] Implementar endpoints REST conforme API_INTERFACE.md:
  - [ ] `POST /ai/threads` - Criar thread
  - [ ] `GET /ai/threads` - Listar threads  
  - [ ] `GET /ai/threads/:id` - Obter thread
  - [ ] `POST /ai/threads/:id/messages` - Enviar mensagem
  - [ ] `DELETE /ai/threads/:id` - Deletar thread
- [ ] Sistema de persistência para threads (lowdb em /studio/api/data)
- [ ] Validação de contexto "documentation"

### Fase 2: Análise de Intenção
- [ ] Implementar `IntentionAnalyzerService`
- [ ] Criar classificador de tarefas (simples/complexa)
- [ ] Definir prompts para análise de intenção
- [ ] Testes de classificação

### Fase 3: Conversação Simples
- [ ] Implementar `ConversationService`
- [ ] Integrar `generateText` do AI SDK
- [-] Construir contexto do projeto - Depois, por enquanto AI bruta
- [-] Cache de contexto - Depois, por enquanto AI bruta

### Fase 4: Tool de Documentação
- [ ] Implementar `DocumentationToolService`
- [ ] Integrar `generateObject` com `DocumentationDbSchema`
- [ ] Sistema de backup automático
- [ ] Validação rigorosa de saída

### Fase 5: Integração e Testes
- [ ] Controller e rotas da API
- [ ] Testes de integração
- [ ] Tratamento de erros
- [ ] Performance e rate limiting

## Dependências Críticas

### Instalação Obrigatória
```bash
npm install ai
```

### Padronização de Validação
- **Usar Zod para TODAS as tipagens** (migrar de class-validator)
- **Type Safety**: Schemas reutilizáveis para generateObject do AI SDK

### Configuração de Ambiente
```env
# .env
ANTHROPIC_API_KEY=sk-...
AI_MODEL=claude-3-5-sonnet-20241022
AI_TIMEOUT=30000
AI_MAX_TOKENS=4096
```

## Estrutura de Dados (Zod Schemas)

### Schemas
```typescript
import { z } from 'zod';

// Thread - guarda referências das mensagens, não as mensagens completas
export const ThreadSchema = z.object({
  threadId: z.string().uuid(),
  title: z.string().min(1).max(200),
  createdAt: z.string().datetime(),
  lastActivity: z.string().datetime(),
  messageCount: z.number().int().min(0).default(0),
  messageIds: z.array(z.string().uuid()).default([]) // referências às mensagens
});

// Message - type enviado pela aba ativa no frontend
export const MessageSchema = z.object({
  messageId: z.string().uuid(),
  threadId: z.string().uuid(),
  role: z.enum(['user', 'assistant']),
  type: z.enum(['documentation', 'general']), // tipo da aba/contexto
  content: z.string(),
  timestamp: z.string().datetime(),
  context: z.object({
    projectPath: z.string().optional(),
    currentFile: z.string().optional(),
    area: z.string().optional()
  }).optional()
});

// Database (lowdb) - mensagens separadas para performance
export const ChatDbSchema = z.object({
  threads: z.record(z.string(), ThreadSchema).default({}),
  messages: z.record(z.string(), MessageSchema).default({}), // messageId -> message
  metadata: z.object({
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    version: z.string().default("1.0.0")
  })
});

// Types automáticos
export type Thread = z.infer<typeof ThreadSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type ChatDb = z.infer<typeof ChatDbSchema>;
```

### Controller Validation (direto com Zod)
```typescript
// Validação inline nos controllers
@Post('threads')
async createThread(@Body() body: unknown) {
  const data = z.object({
    title: z.string().min(1).max(200)
  }).parse(body);
  
  return this.aiService.createThread(data);
}

@Post('threads/:threadId/messages')
async sendMessage(
  @Param('threadId') threadId: string,
  @Body() body: unknown
) {
  const data = z.object({
    message: z.string().min(1).max(10000),
    type: z.enum(['documentation', 'general']),
    context: z.object({
      projectPath: z.string().optional(),
      currentFile: z.string().optional(),
      area: z.string().optional()
    }).optional()
  }).parse(body);
  
  return this.aiService.sendMessage(threadId, data);
}
```

## Pontos de Atenção

### Qualidade
- **Type safety end-to-end**: Zod schemas → TypeScript types → Runtime validation
- **Backup automático**: Antes de modificações de arquivos
- **Rollback automático**: Em caso de falhas
- **Logs estruturados**: Para debugging e monitoramento