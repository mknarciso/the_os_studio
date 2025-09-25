# Sistema de Contexto de Documentação Automático

## 🎯 **Funcionalidade Implementada**

Quando o contexto da mensagem for `"documentation"`, o sistema agora **carrega automaticamente** o JSON de documentação atual do app e o inclui no prompt do AI.

## 🔄 **Fluxo Completo**

### 1. **Detecção de Contexto**
```javascript
if (input.type === 'documentation') {
  // Carregar documentação atual automaticamente
  currentDocContext = await documentationLoader.loadCurrentDocumentation(input.context);
}
```

### 2. **Resolução de Caminhos**
O `DocumentationLoaderService` tenta encontrar o arquivo `documentation.json` em:

```
📁 Padrões de busca (em ordem de prioridade):
├── {projectPath}/documentation.json
├── {projectPath}/docs/documentation.json  
├── {projectPath}/data/documentation.json
├── dist_customers/{projectPath}/documentation.json
└── preview_customers/{projectPath}/documentation.json
```

### 3. **Carregamento e Validação**
- ✅ **Validação com Zod** do schema de documentação
- ✅ **Tratamento de erros** gracioso (arquivo não encontrado, JSON inválido)
- ✅ **Logs informativos** sobre sucesso/falha do carregamento

### 4. **Integração no Prompt**

#### **Para Conversação Simples:**
```
<CURRENT_DOCUMENTATION>
Documentação atual do projeto:

📋 App: Sistema de Pagamentos (sistema_pagamentos)
🔄 3 Flows definidos
👥 5 Roles definidos
⚡ 12 Activities definidas
📖 8 Stories definidas
🧪 15 Test Cases definidos

JSON completo:
```json
{
  "app": { ... },
  "flows": { ... },
  "roles": { ... }
}
```
</CURRENT_DOCUMENTATION>

Use esta documentação atual como base para suas respostas.
```

#### **Para Documentação Estruturada:**
O JSON atual é passado diretamente para o `DocumentationToolService` como base para atualizações.

## 🎨 **Exemplos de Uso**

### **Conversação com Contexto**
**Input**: "Quais são os roles definidos no sistema?"
**Contexto**: `{ type: 'documentation', projectPath: '/apps/quero/flow' }`
**Resultado**: AI responde baseado nos roles reais do `documentation.json` atual

### **Atualização Inteligente**
**Input**: "Adicione um novo role de Auditor ao sistema"
**Contexto**: `{ type: 'documentation', projectPath: '/apps/quero/flow' }`
**Resultado**: AI usa `generateObject` para atualizar a estrutura existente, mantendo todos os dados atuais e adicionando o novo role

## 🛠️ **Componentes Criados**

### **DocumentationLoaderService**
```typescript
class DocumentationLoaderService {
  // Carrega documentação baseada no contexto
  loadCurrentDocumentation(context): Promise<DocumentationContext>
  
  // Resolve caminhos possíveis para o arquivo
  resolveDocumentationPath(context): string | null
  
  // Carrega e valida arquivo JSON
  loadDocumentationFile(filePath): Promise<DocumentationDb>
  
  // Gera resumo da documentação
  generateDocumentationSummary(doc): string
  
  // Salva documentação atualizada
  saveDocumentation(filePath, doc): Promise<void>
}
```

### **Integração no AiService**
- ✅ Carregamento automático quando `type === 'documentation'`
- ✅ Logs detalhados do processo
- ✅ Contexto passado para ambos os fluxos (conversação e estruturado)

### **Atualização do ConversationService**
- ✅ Novo parâmetro `currentDocumentation` no contexto
- ✅ Inclusão automática do JSON no system prompt
- ✅ Instruções claras para usar documentação atual como base

## 📊 **Benefícios**

### 🎯 **Contexto Rico**
- AI sempre tem acesso ao estado atual da documentação
- Respostas baseadas em dados reais, não genéricos

### 🔄 **Atualizações Inteligentes**
- Modificações preservam estrutura existente
- Relacionamentos entre entidades mantidos

### 📈 **Evolução Incremental**
- Documentação cresce organicamente
- Histórico preservado via sistema de backup

### 🛡️ **Robustez**
- Funciona mesmo se arquivo não existir
- Fallback gracioso para conversação normal
- Validação rigorosa de dados

## 🚀 **Exemplo Prático**

```bash
# Usuário envia mensagem
POST /ai/threads/123/messages
{
  "message": "Explique o fluxo de aprovação de pagamentos",
  "type": "documentation",
  "context": {
    "projectPath": "/apps/quero/flow",
    "currentFile": "documentation.json",
    "area": "documentação"
  }
}

# Sistema automaticamente:
# 1. Carrega /apps/quero/flow/documentation.json
# 2. Inclui JSON completo no prompt
# 3. AI responde com base nos flows reais definidos
# 4. Resultado: Explicação precisa do fluxo atual
```

**O AI agora tem memória completa da documentação atual! 🧠✨**
