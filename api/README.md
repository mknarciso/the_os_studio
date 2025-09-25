# Studio API

Backend simples para gerenciamento de arquivos do Studio Web.

## Funcionalidades

- **Salvar arquivos**: Endpoint para salvar conteúdo de arquivos
- **Árvore de arquivos**: Listar estrutura de diretórios e arquivos
- **Conteúdo de arquivos**: Ler conteúdo de arquivos específicos

## Instalação

```bash
cd studio-api
npm install
```

## Execução

### Desenvolvimento
```bash
npm run start:dev
```

### Produção
```bash
npm run build
npm run start:prod
```

A API estará disponível em `http://localhost:3001`

## Endpoints

### POST /files/save
Salva o conteúdo de um arquivo.

**Body:**
```json
{
  "customer": "quero",
  "namespace": "quero", 
  "app": "flow",
  "relativePath": "components/MyComponent.jsx",
  "content": "// conteúdo do arquivo"
}
```

**Response:**
```json
{
  "success": true,
  "message": "File saved successfully",
  "action": {
    "content": "// conteúdo do arquivo"
  },
  "fullPath": "/path/to/file"
}
```

### GET /files/tree/:customer/:namespace/:app
Retorna a árvore de arquivos para o contexto especificado.

**Response:**
```json
{
  "tree": {
    "name": "flow",
    "type": "directory",
    "path": ".",
    "children": [...]
  }
}
```

### GET /files/content/:customer/:namespace/:app?path=relativePath
Retorna o conteúdo de um arquivo específico.

**Response:**
```json
{
  "content": "// conteúdo do arquivo",
  "relativePath": "components/MyComponent.jsx"
}
```

## Estrutura de Diretórios

O sistema trabalha com arquivos em:
```
/preview_customers/{customer}/apps/{namespace}/{app}/
```

Por exemplo:
```
/preview_customers/quero/apps/quero/flow/
```
