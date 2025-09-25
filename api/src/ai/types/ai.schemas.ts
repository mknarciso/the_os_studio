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
    area: z.string().optional(),
    namespace: z.string().optional(),
    app: z.string().optional()
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

// Input Schemas para validação
export const CreateThreadInputSchema = z.object({
  title: z.string().min(1).max(200)
});

export const SendMessageInputSchema = z.object({
  message: z.string().min(1),
  type: z.enum(['documentation', 'general']),
  context: z.object({
    projectPath: z.string().optional(),
    currentFile: z.string().optional(),
    area: z.string().optional(),
    namespace: z.string().optional(),
    app: z.string().optional()
  }).optional()
});

// Types automáticos
export type Thread = z.infer<typeof ThreadSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type ChatDb = z.infer<typeof ChatDbSchema>;
export type CreateThreadInput = z.infer<typeof CreateThreadInputSchema>;
export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;
