# Sistema de Contexto Automático

## Visão Geral

O sistema de contexto automático carrega conteúdo de arquivos markdown específicos e os inclui no system prompt do AI, proporcionando contexto rico e específico para cada tipo de conversa.

## Como Funciona

### 1. Estrutura de Arquivos
```
src/ai/context/
├── documentation.md  # Contexto para conversas sobre documentação
├── general.md        # Contexto para conversas gerais
└── [tipo].md         # Outros tipos de contexto conforme necessário
```

### 2. Carregamento Automático
Quando uma mensagem é enviada para o AI:

1. **Identificação do Tipo**: O sistema identifica o tipo da conversa (`documentation`, `general`, etc.)
2. **Busca do Arquivo**: Procura por `/ai/context/{tipo}.md`
3. **Carregamento**: Se o arquivo existir, seu conteúdo é carregado
4. **Inclusão no Prompt**: O conteúdo é adicionado ao system prompt dentro de tags `<CONTEXT>`

### 3. Exemplo de System Prompt Gerado

```
Você é um assistente especializado em documentação de projetos...

<CONTEXT>
[Conteúdo do arquivo documentation.md]
</CONTEXT>

Contexto do projeto: /path/to/project
Arquivo atual: documentation.json
```

## Arquivos de Contexto Disponíveis

### `documentation.md`
- **Uso**: Conversas sobre documentação de processos
- **Conteúdo**: 
  - Role do eZaz como especialista em produtos
  - Fluxo estruturado de documentação (PRD, User Story Mapping, etc.)
  - Schemas Zod para estruturas de dados
  - FAQ sobre conceitos

### `general.md`
- **Uso**: Conversas gerais sobre desenvolvimento
- **Conteúdo**:
  - Visão geral do projeto Zazos Maestro
  - Arquitetura do sistema
  - Tecnologias utilizadas
  - Padrões de desenvolvimento

## Adicionando Novos Contextos

### 1. Criar Arquivo de Contexto
```bash
# Criar novo arquivo de contexto
touch src/ai/context/[novo-tipo].md
```

### 2. Definir Conteúdo
```markdown
# Contexto para [Novo Tipo]

## Instruções Específicas
[Instruções específicas para este tipo de conversa]

## Conhecimento de Domínio
[Informações relevantes para o contexto]

## Exemplos
[Exemplos práticos se necessário]
```

### 3. Usar no Frontend
```javascript
// No frontend, especificar o tipo correto
const response = await ApiService.sendMessage(
  threadId,
  message,
  'novo-tipo', // ← Deve corresponder ao nome do arquivo
  context
);
```

## Benefícios

### ✅ **Contexto Rico**
- AI tem acesso a informações específicas do projeto
- Respostas mais precisas e relevantes

### ✅ **Flexibilidade**
- Fácil adição de novos tipos de contexto
- Contexto específico por domínio

### ✅ **Manutenibilidade**
- Contexto centralizado em arquivos markdown
- Fácil edição e versionamento

### ✅ **Performance**
- Carregamento assíncrono
- Cache automático pelo sistema de arquivos

## Exemplo de Uso

```typescript
// O ConversationService automaticamente:
// 1. Identifica type = 'documentation'
// 2. Carrega /ai/context/documentation.md
// 3. Inclui no system prompt
// 4. Gera resposta contextualizada

const response = await conversationService.generateResponse(
  "Como estruturar um PRD?",
  "documentation", // ← Carrega documentation.md
  {
    projectPath: "/projeto/atual",
    currentFile: "documentacao.json"
  }
);
```

## Logs e Debug

O sistema registra quando arquivos de contexto não são encontrados:
```
Context file not found: novo-tipo.md
```

Isso não é um erro crítico - o AI funcionará normalmente sem o contexto adicional.
