/**
 * Sintezy SDK - Integração para sistemas de terceiros
 *
 * Transcrição médica e geração de documentos a partir da consulta.
 *
 * @example
 * ```typescript
 * import { SintezySDK } from '@sintezy-corp/sdk';
 *
 * const sdk = new SintezySDK({
 *   clientId: 'seu-client-id',
 *   clientSecret: 'seu-client-secret',
 * });
 *
 * // 1. Criar a consulta e abrir o portal para o médico gravar
 * const appointment = await sdk.createAppointment({
 *   userEmail: 'medico@clinica.com',
 *   userName: 'Dr. João Silva',
 *   layout: {
 *     fields: [
 *       { name: 'Queixa Principal', content: 'inserir aqui...', position: 0 },
 *       { name: 'Conduta', content: 'inserir aqui...', position: 1 },
 *     ],
 *   },
 * });
 * window.open(appointment.portalUrl);
 *
 * // 2. Depois de finalizada, ler a anamnese e gerar outros documentos
 * const anamnese = await sdk.getDocument(appointment.secureId, 'document');
 * const receita = await sdk.generateDocument(appointment.secureId, 'prescription');
 * ```
 */

// ============================================================
// TYPES
// ============================================================

export interface SintezySDKConfig {
  clientId: string;
  clientSecret: string;
  environment?: 'production' | 'sandbox';
  baseUrl?: string;
}

export interface AuthToken {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
  /** Timestamp de quando o token expira */
  expiresAt: Date;
}

/** Campo do layout da anamnese: o `content` é a instrução para a IA. */
export interface LayoutField {
  name: string;
  content?: string;
  position?: number;
}

export interface Layout {
  fields: LayoutField[];
}

export interface CreateAppointmentParams {
  /** Email do médico. Se não existir, o usuário é criado automaticamente. */
  userEmail: string;
  /** Nome do médico. */
  userName: string;
  /** Estrutura da anamnese: um campo por seção do seu prontuário. */
  layout: Layout;
  userPhone?: string;
  userOccupation?: string;
  userOccupationDoc?: string;
  title?: string;
  type?: 'NORMAL' | 'RETORNO';
  modality?: 'PRESENCIAL' | 'ONLINE';
  /** Observações pré-consulta. */
  notes?: string;
  /** Histórico do paciente — a IA usa na geração dos documentos. */
  context?: string;
  metadata?: Record<string, unknown>;
  /**
   * URL de redirecionamento após a geração do documento. Se fornecida, o
   * portal redireciona para ela em vez de fechar a janela.
   */
  redirectUrl?: string;
}

export interface Appointment {
  secureId: string;
  status: string;
  createdAt: string;
  title?: string;
  /** URL do portal de gravação, para abrir em popup ou iframe. */
  portalUrl: string;
}

/** Tipos servidos pelos modelos padrão da Sintezy. */
export type CatalogDocumentType =
  | 'document'
  | 'anamnese_summary'
  | 'clinic_summary'
  | 'referral'
  | 'exames_call'
  | 'prescription'
  | 'certificate'
  | 'inss_report';

export const CATALOG_DOCUMENT_TYPES: CatalogDocumentType[] = [
  'document',
  'anamnese_summary',
  'clinic_summary',
  'referral',
  'exames_call',
  'prescription',
  'certificate',
  'inss_report',
];

/**
 * Um tipo do catálogo, ou o nome que você dá ao seu próprio documento.
 * O `(string & {})` preserva o autocomplete dos tipos do catálogo sem
 * impedir um nome livre.
 */
export type DocumentType = CatalogDocumentType | (string & {});

/** Prompt do documento: os dois campos andam sempre juntos. */
export interface DocumentPrompt {
  /** Objetivo, tom, regras e informações obrigatórias. */
  contextualization: string;
  /** Como o texto deve aparecer: seções, quebras de linha, assinatura. */
  format: string;
}

/**
 * Corpo aceito por `generateDocument`:
 *  - `{ documentType }` — tipo do catálogo com o prompt padrão da Sintezy;
 *  - `{ documentType, ...prompt }` — mesmo tipo, com o SEU prompt;
 *  - `{ documentType: 'meu_nome', ...prompt }` — documento com nome próprio;
 *  - `{ ...prompt }` — idem, gravado com o nome `custom`.
 */
export interface GenerateDocumentInput extends Partial<DocumentPrompt> {
  documentType?: DocumentType;
}

export interface Document {
  secureId: string;
  /** O tipo com que o documento ficou gravado — use-o no `getDocument`. */
  type: string;
  content: unknown;
  createdAt: string;
  updatedAt?: string;
}

export interface DocumentListItem {
  type: string;
  exists: boolean;
  createdAt?: string;
}

export interface Transcription {
  secureId: string;
  transcription: string | null;
  recordedTimeSeconds?: number;
  status: string;
}

export interface SubscriptionStatus {
  email: string;
  hasSubscription: boolean;
  status?: string;
  planType?: string;
  endDate?: string;
  checkoutUrl?: string;
}

export interface DeleteResult {
  message: string;
  deleted: boolean;
}

// ============================================================
// ERROR CLASS
// ============================================================

export class SintezySDKError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'SintezySDKError';
  }
}

// ============================================================
// MAIN SDK CLASS
// ============================================================

export class SintezySDK {
  private config: SintezySDKConfig;
  private token: AuthToken | null = null;

  constructor(config: SintezySDKConfig) {
    if (!config.clientId || !config.clientSecret) {
      throw new SintezySDKError('clientId and clientSecret are required');
    }
    this.config = {
      environment: 'production',
      ...config,
    };
  }

  // ============================================================
  // AUTENTICAÇÃO
  // ============================================================

  /** Autentica via OAuth 2.0 Client Credentials. */
  async authenticate(): Promise<AuthToken> {
    const response = await fetch(`${this.getBaseUrl()}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      throw await this.toError(response, 'Authentication failed', 'AUTH_FAILED');
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      token_type: string;
    };
    this.token = {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };

    return this.token;
  }

  /** True se há token e ele ainda vale por mais de um minuto. */
  isAuthenticated(): boolean {
    if (!this.token) return false;
    return this.token.expiresAt.getTime() > Date.now() + 60_000;
  }

  getToken(): AuthToken | null {
    return this.token;
  }

  /** Autentica se necessário. Chamado por todos os métodos. */
  async ensureAuthenticated(): Promise<AuthToken> {
    if (!this.isAuthenticated()) {
      return this.authenticate();
    }
    return this.token!;
  }

  // ============================================================
  // CONSULTAS
  // ============================================================

  /** Cria a consulta e devolve a URL do portal de gravação. */
  async createAppointment(
    params: CreateAppointmentParams
  ): Promise<Appointment> {
    if (!params.layout?.fields?.length) {
      throw new SintezySDKError(
        'layout.fields é obrigatório: informe ao menos um campo da anamnese'
      );
    }
    return this.request('POST', '/sdk/appointments', params);
  }

  async getAppointment(appointmentSecureId: string): Promise<Appointment> {
    return this.request(
      'GET',
      `/sdk/appointments/${encodeURIComponent(appointmentSecureId)}`
    );
  }

  /** Exclui a consulta (soft delete). */
  async deleteAppointment(appointmentSecureId: string): Promise<DeleteResult> {
    return this.request(
      'DELETE',
      `/sdk/appointments/${encodeURIComponent(appointmentSecureId)}`
    );
  }

  /** Transcrição da consulta, quando a gravação já terminou. */
  async getTranscription(appointmentSecureId: string): Promise<Transcription> {
    return this.request(
      'GET',
      `/sdk/appointments/${encodeURIComponent(appointmentSecureId)}/transcription`
    );
  }

  /** Status da assinatura de um médico (API keys do tipo reseller). */
  async getSubscriptionStatus(email: string): Promise<SubscriptionStatus> {
    return this.request(
      'GET',
      `/sdk/subscription-status?email=${encodeURIComponent(email)}`
    );
  }

  // ============================================================
  // DOCUMENTOS
  // ============================================================

  /**
   * Gera um documento da consulta, que precisa estar finalizada.
   *
   * @example
   * ```typescript
   * // Tipo do catálogo, prompt padrão da Sintezy
   * await sdk.generateDocument(id, 'prescription');
   *
   * // Mesmo tipo, com o seu prompt (continua sendo `clinic_summary`)
   * await sdk.generateDocument(id, {
   *   documentType: 'clinic_summary',
   *   contextualization: '...',
   *   format: '...',
   * });
   *
   * // Documento com nome próprio, buscado depois por esse nome
   * await sdk.generateDocument(id, {
   *   documentType: 'carta_alta',
   *   contextualization: '...',
   *   format: '...',
   * });
   * ```
   */
  async generateDocument(
    appointmentSecureId: string,
    input: DocumentType | GenerateDocumentInput
  ): Promise<Document> {
    const body: GenerateDocumentInput =
      typeof input === 'string' ? { documentType: input } : { ...input };

    const hasPrompt =
      body.contextualization !== undefined || body.format !== undefined;
    if (hasPrompt && (!body.contextualization || !body.format)) {
      throw new SintezySDKError(
        'contextualization e format são obrigatórios juntos'
      );
    }
    if (!body.documentType && !hasPrompt) {
      throw new SintezySDKError(
        'informe um documentType ou o par contextualization + format'
      );
    }
    if (
      body.documentType &&
      !CATALOG_DOCUMENT_TYPES.includes(body.documentType as CatalogDocumentType) &&
      !hasPrompt
    ) {
      throw new SintezySDKError(
        `"${body.documentType}" não é um tipo do catálogo (${CATALOG_DOCUMENT_TYPES.join(', ')}), ` +
          'então é o nome do seu documento e exige contextualization + format'
      );
    }

    return this.request(
      'POST',
      `/sdk/appointments/${encodeURIComponent(appointmentSecureId)}/documents`,
      body
    );
  }

  /**
   * Busca um documento já gerado.
   *
   * @param documentType Tipo do catálogo, ou o nome que você usou ao gerar
   *                     (`custom` quando você não informou nenhum).
   */
  async getDocument(
    appointmentSecureId: string,
    documentType: DocumentType
  ): Promise<Document> {
    return this.request(
      'GET',
      `/sdk/appointments/${encodeURIComponent(appointmentSecureId)}/documents/${encodeURIComponent(documentType)}`
    );
  }

  /** Lista os documentos da consulta e quais já foram gerados. */
  async listDocuments(
    appointmentSecureId: string
  ): Promise<DocumentListItem[]> {
    return this.request(
      'GET',
      `/sdk/appointments/${encodeURIComponent(appointmentSecureId)}/documents`
    );
  }

  // ============================================================
  // HELPERS INTERNOS
  // ============================================================

  private getBaseUrl(): string {
    if (this.config.baseUrl) {
      return this.config.baseUrl;
    }
    return this.config.environment === 'production'
      ? 'https://api.sintezy.com'
      : 'https://sandbox-api.sintezy.com';
  }

  /**
   * Erro da API já traduzido; `message` pode vir string ou array (erros de
   * validação). Tipado estruturalmente para não exigir a lib DOM no build.
   */
  private async toError(
    response: { status: number; json(): Promise<unknown> },
    fallback: string,
    code?: string
  ): Promise<SintezySDKError> {
    const body = (await response.json().catch(() => ({}))) as {
      message?: string | string[];
      error?: string | string[];
      code?: string;
    };
    const raw = body.message ?? body.error;
    const message = Array.isArray(raw) ? raw.join('; ') : raw;
    return new SintezySDKError(
      message || fallback,
      response.status,
      body.code ?? code
    );
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    await this.ensureAuthenticated();

    const response = await fetch(`${this.getBaseUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token!.accessToken}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      throw await this.toError(response, `Request failed: ${method} ${path}`);
    }

    return response.json() as Promise<T>;
  }
}

export default SintezySDK;
