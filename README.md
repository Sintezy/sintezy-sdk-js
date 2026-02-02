# Sintezy SDK

SDK oficial para integração com a plataforma Sintezy.

## Instalação

```bash
npm install @sintezy-corp/sdk
# ou
yarn add @sintezy-corp/sdk
# ou
pnpm add @sintezy-corp/sdk
```

## Uso Rápido

```typescript
import { SintezySDK } from '@sintezy-corp/sdk';

// 1. Inicializar a SDK
const sdk = new SintezySDK({
  clientId: 'seu-client-id',
  clientSecret: 'seu-client-secret',
});

// 2. Criar uma consulta (autenticação é automática)
const appointment = await sdk.createAppointment({
  userEmail: 'medico@clinica.com',
  userName: 'Dr. João Silva',
  layout: {
    fields: [
      { name: 'Queixa Principal', content: 'inserir aqui a queixa principal', position: 0 },
      { name: 'História da Doença Atual', content: 'inserir aqui a história', position: 1 },
      { name: 'Exame Físico', content: 'inserir aqui os exames', position: 2 },
      { name: 'Diagnóstico', content: 'inserir aqui o diagnóstico', position: 3 },
      { name: 'Conduta', content: 'inserir aqui a conduta', position: 4 },
    ]
  }
});

// 3. Abrir portal para gravação em popup
window.open(appointment.portalUrl, 'sintezy-portal', 'width=900,height=700');

// 4. Após finalizar a consulta, buscar o documento principal
const documento = await sdk.getDocument(appointment.secureId, 'document');

// 5. Gerar outros documentos
const receita = await sdk.generateDocument(appointment.secureId, 'prescription');
const atestado = await sdk.generateDocument(appointment.secureId, 'certificate');
```

## Métodos Disponíveis

### Autenticação

| Método | Descrição |
|--------|-----------|
| `authenticate()` | Autentica usando Client Credentials (OAuth 2.0). Chamado automaticamente. |
| `isAuthenticated()` | Verifica se há um token válido |
| `ensureAuthenticated()` | Garante autenticação, re-autenticando se necessário |

### Consultas (Appointments)

| Método | Descrição |
|--------|-----------|
| `createAppointment(params)` | Cria uma nova consulta e retorna a URL do portal |
| `getAppointment(secureId)` | Busca uma consulta pelo ID |
| `deleteAppointment(secureId)` | Exclui uma consulta (soft delete) |

### Documentos

| Método | Descrição |
|--------|-----------|
| `generateDocument(secureId, type)` | Gera um documento a partir de uma consulta finalizada |
| `getDocument(secureId, type)` | Busca um documento específico |
| `listDocuments(secureId)` | Lista todos os documentos disponíveis |

## Tipos de Documento

| Tipo | Descrição |
|------|-----------|
| `document` | Prontuário/Documento principal (gerado automaticamente ao finalizar) |
| `anamnese_summary` | Resumo de anamnese |
| `clinic_summary` | Resumo clínico |
| `referral` | Encaminhamento |
| `exames_call` | Solicitação de exames |
| `prescription` | Receita médica |
| `certificate` | Atestado médico |
| `inss_report` | Laudo INSS |

## API

| URL Base |
|----------|
| `https://api.sintezy.com` |

## Fluxo de Integração

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Seu Sistema   │     │   Sintezy SDK   │     │   Sintezy API   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │  1. createAppointment()                       │
         │──────────────────────>│                       │
         │                       │  POST /oauth/token    │
         │                       │──────────────────────>│
         │                       │   access_token        │
         │                       │<──────────────────────│
         │                       │                       │
         │                       │  POST /sdk/appointments
         │                       │──────────────────────>│
         │                       │   appointment         │
         │                       │<──────────────────────│
         │   appointment         │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │  2. Abrir portalUrl em popup                  │
         │  3. Médico grava a consulta                   │
         │  4. Médico finaliza (documento principal gerado)
         │                       │                       │
         │  5. getDocument()     │                       │
         │──────────────────────>│                       │
         │                       │  GET /sdk/.../documents/document
         │                       │──────────────────────>│
         │                       │   document            │
         │                       │<──────────────────────│
         │   document            │                       │
         │<──────────────────────│                       │
         │                       │                       │
         │  6. generateDocument('prescription')          │
         │──────────────────────>│                       │
         │                       │  POST /sdk/.../documents
         │                       │──────────────────────>│
         │                       │   prescription        │
         │                       │<──────────────────────│
         │   prescription        │                       │
         │<──────────────────────│                       │
```

## Licença

MIT

## Licença

MIT
