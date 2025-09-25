# Migração para Zod - Studio API

## Situação Atual

### ✅ Já usando Zod:
- **Documentation Service**: Todos os schemas (`DocumentationDbSchema`, `FlowSchema`, etc.)
- **Validação robusta**: Parse + validação automática
- **Type inference**: Tipos TypeScript gerados automaticamente

### ❌ Ainda usando class-validator:
- **Files DTO**: `SaveFileDto` com decorators `@IsString()`, `@IsNotEmpty()`
- **Inconsistência**: Duas bibliotecas para validação

## Vantagens do Zod

### 1. **Consistência Total**
```typescript
// ❌ class-validator (atual)
export class SaveFileDto {
  @IsString()
  @IsNotEmpty()
  customer: string;
}

// ✅ Zod (recomendado)
export const SaveFileSchema = z.object({
  customer: z.string().min(1),
  namespace: z.string().min(1),
  app: z.string().min(1),
  relativePath: z.string().min(1),
  content: z.string()
});

export type SaveFileDto = z.infer<typeof SaveFileSchema>;
```

### 2. **Melhor Integração NestJS**
```typescript
// Pipe customizado para Zod
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: any, metadata: ArgumentMetadata) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      throw new BadRequestException('Validation failed');
    }
  }
}

// Uso nos controllers
@Post()
async saveFile(
  @Body(new ZodValidationPipe(SaveFileSchema)) dto: SaveFileDto
) {
  return this.filesService.save(dto);
}
```

### 3. **Type Safety Completa**
```typescript
// Schemas para AI System
export const ThreadContextSchema = z.object({
  type: z.literal('documentation'),
  projectPath: z.string().min(1),
  currentFile: z.string().optional(),
  selectedText: z.string().optional(),
  cursorPosition: z.object({
    line: z.number().int().min(1),
    column: z.number().int().min(0)
  }).optional()
});

export const CreateThreadSchema = z.object({
  title: z.string().min(1).max(200),
  context: ThreadContextSchema
});

export const SendMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  context: ThreadContextSchema
});

// Types automáticos
export type ThreadContext = z.infer<typeof ThreadContextSchema>;
export type CreateThreadDto = z.infer<typeof CreateThreadSchema>;
export type SendMessageDto = z.infer<typeof SendMessageSchema>;
```

## Plano de Migração

### Fase 1: Criar Schemas Zod para AI
- [ ] `ThreadSchema`, `MessageSchema`, `TaskSchema`
- [ ] DTOs de request/response
- [ ] Validação de contexto "documentation"

### Fase 2: Migrar Files DTO
- [ ] Converter `SaveFileDto` para Zod
- [ ] Criar `ZodValidationPipe` reutilizável
- [ ] Atualizar controllers

### Fase 3: Padronização
- [ ] Remover `class-validator` das dependências
- [ ] Documentar padrões Zod
- [ ] Testes de validação

## Estrutura Proposta

```typescript
// /studio/api/src/common/validation/zod.pipe.ts
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}
  
  transform(value: any, metadata: ArgumentMetadata) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: error.errors
      });
    }
  }
}

// /studio/api/src/ai/schemas/thread.schemas.ts
export const ThreadSchemas = {
  create: CreateThreadSchema,
  update: UpdateThreadSchema,
  message: SendMessageSchema,
  context: ThreadContextSchema
};

// /studio/api/src/files/schemas/file.schemas.ts  
export const FileSchemas = {
  save: SaveFileSchema,
  read: ReadFileSchema
};
```

## Benefícios Esperados

### 1. **Consistência**
- Uma única biblioteca para validação
- Padrões uniformes em todo o projeto
- Manutenção simplificada

### 2. **Performance**
- Zod é mais rápido que class-validator
- Menos overhead de decorators
- Validação mais eficiente

### 3. **Developer Experience**
- Type inference automática
- Melhor autocomplete
- Erros mais claros

### 4. **Integração com AI SDK**
- Schemas reutilizáveis para `generateObject`
- Validação consistente de entrada/saída
- Type safety end-to-end

## Conclusão

**SIM, devemos usar Zod em todas as tipagens** do projeto `/studio`. A migração será simples e trará benefícios significativos de consistência, performance e type safety.
