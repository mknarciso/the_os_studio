# Studio Web

Frontend para edição de arquivos com Monaco Editor, integrado com o Studio API.

## Funcionalidades

- **Explorador de arquivos**: Visualização em árvore dos arquivos do projeto
- **Editor Monaco**: Editor de código com syntax highlighting
- **Salvamento automático**: Integração com API para salvar arquivos
- **Store do editor**: Gerenciamento de estado dos arquivos editados
- **Atalhos de teclado**: Cmd+S / Ctrl+S para salvar

## Instalação

```bash
cd studio-web
npm install
```

## Execução

### Desenvolvimento
```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:5173`

### Build para produção
```bash
npm run build
```

## Estrutura

```
src/
├── components/
│   ├── FileTree.jsx      # Árvore de arquivos
│   └── MonacoEditor.jsx  # Editor de código
├── services/
│   └── api.js           # Serviços de API
├── stores/
│   └── EditorStore.js   # Store para gerenciar arquivos
├── App.jsx              # Componente principal
├── main.jsx            # Entry point
└── index.css           # Estilos globais
```

## Uso

1. **Seleção de contexto**: O app atualmente usa valores hardcoded:
   - Customer: `quero`
   - Namespace: `quero`
   - App: `flow`

2. **Navegação**: Clique nos arquivos na árvore à esquerda para abrir no editor

3. **Edição**: Use o Monaco Editor para editar arquivos com syntax highlighting

4. **Salvamento**: 
   - Clique no botão "Save" 
   - Use Cmd+S (Mac) ou Ctrl+S (Windows/Linux)
   - Arquivos modificados mostram um ponto (•) no título

## Integração com API

O frontend se comunica com o Studio API através dos endpoints:

- `POST /files/save` - Salvar arquivo
- `GET /files/tree/:customer/:namespace/:app` - Carregar árvore
- `GET /files/content/:customer/:namespace/:app` - Carregar conteúdo

## Store do Editor

O `EditorStore` mantém o estado dos arquivos editados:

```javascript
// Atualizar arquivo no store após salvar
editorStore.updateFile(fullPath, content);

// Escutar mudanças no store
const unsubscribe = editorStore.subscribe(() => {
  // Handle store changes
});
```

## Personalização

Para usar com diferentes contextos, modifique as variáveis em `App.jsx`:

```javascript
const [customer] = useState('seu-customer');
const [namespace] = useState('seu-namespace');
const [app] = useState('sua-app');
```
