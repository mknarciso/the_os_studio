# Sugestões de Ajuste - Schemas

## Estrutura Proposta (Corrigida)

```typescript
import { z } from 'zod';

// Context para Documentation
export const DocumentationContextSchema = z.object({
  type: z.literal('documentation'),
  projectPath: z.string().min(1),
  currentFile: z.string().optional(),
  area: z.string().optional() // sua adição
});

// DTOs de Input (necessários para validação)
export const CreateThreadSchema = z.object({
  title: z.string().min(1).max(200),
  context: DocumentationContextSchema
});

export const SendMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  context: DocumentationContextSchema.optional()
});

// Entidades de Database
export const ThreadSchema = z.object({
  threadId: z.string().uuid(),
  title: z.string().min(1).max(200),
  createdAt: z.string().datetime(),
  lastActivity: z.string().datetime(),
  messageCount: z.number().int().min(0).default(0),
  context: DocumentationContextSchema
  // NÃO incluir messages aqui (performance)
});

export const MessageSchema = z.object({
  messageId: z.string().uuid(),
  threadId: z.string().uuid(),
  role: z.enum(['user', 'assistant']),
  type: z.enum(['text', 'file_update', 'error']),
  content: z.string(),
  timestamp: z.string().datetime(),
  context: DocumentationContextSchema.optional()
});

// Database (lowdb)
export const ChatDbSchema = z.object({
  threads: z.record(z.string(), ThreadSchema).default({}),
  messages: z.record(z.string(), z.array(MessageSchema)).default({}), // threadId -> messages[]
  metadata: z.object({
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    version: z.string().default("1.0.0")
  })
});

// Types
export type DocumentationContext = z.infer<typeof DocumentationContextSchema>;
export type CreateThreadDto = z.infer<typeof CreateThreadSchema>;
export type SendMessageDto = z.infer<typeof SendMessageSchema>;
export type Thread = z.infer<typeof ThreadSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type ChatDb = z.infer<typeof ChatDbSchema>;
```

## Questões para Decidir

1. **AI Provider**: Anthropic direto ou via Vercel AI SDK?
2. **Context**: Manter contexto rico de documentation ou simplificar?
3. **Estrutura**: Messages dentro de threads ou separadas?
4. **DTOs**: Precisamos dos schemas de input para validação?

