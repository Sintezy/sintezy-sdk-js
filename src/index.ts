/**
 * Sintezy SDK - Integração para sistemas de terceiros
 *
 * Esta SDK permite integrar o sistema Sintezy em aplicações de terceiros,
 * oferecendo funcionalidades de transcrição médica e geração de documentos.
 *
 * @example
 * ```typescript
 * import { SintezySDK } from '@sintezy-corp/sdk';
 *
 * const sdk = new SintezySDK({
 *   clientId: 'seu-client-id',
 *   clientSecret: 'seu-client-secret',
 *   environment: 'production', // ou 'sandbox'
 * });
 *
 * // Autenticar
 * await sdk.authenticate();
 *
 * // Criar consulta
 * const appointment = await sdk.createAppointment({ userEmail: 'medico@clinica.com' });
 *
 * // Gerar documento
 * const document = await sdk.generateDocument(appointment.id, 'MEDICAL_RECORD');
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

export interface CreateAppointmentParams {
  /** Email do usuário (médico/profissional). Se não existir, será criado automaticamente */
  userEmail: string;
  /** Nome do usuário (opcional, usado na criação) */
  userName?: string;
  /** Telefone do usuário (opcional) */
  userPhone?: string;
  /** Profissão/especialidade (opcional) */
  userOccupation?: string;
  /** Documento profissional - CRM, CRO, etc (opcional) */
  userOccupationDoc?: string;
  /** Metadados extras (opcional) */
  metadata?: Record<string, unknown>;
}

export interface Appointment {
  id: string;
  secureId: string;
  userId: string;
  status: string;
  createdAt: string;
}

export interface GenerateDocumentParams {
  consultationId: string;
  documentType: DocumentType;
}

export type DocumentType = 'MEDICAL_RECORD' | 'PRESCRIPTION' | 'CERTIFICATE' | 'REFERRAL' | 'EXAM_REQUEST';

export interface Document {
  // Document structure
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

  /**
   * Autentica a aplicação usando OAuth 2.0 Client Credentials
   *
   * @returns Token de acesso
   */
  async authenticate(): Promise<AuthToken> {
    const response = await fetch(`${this.getBaseUrl()}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new SintezySDKError(
        error.message || 'Authentication failed',
        response.status,
        'AUTH_FAILED'
      );
    }

    const data = await response.json();
    this.token = {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    };

    return this.token;
  }

  /**
   * Verifica se está autenticado e se o token ainda é válido
   */
  isAuthenticated(): boolean {
    if (!this.token) return false;
    // Considera expirado se faltar menos de 1 minuto
    return this.token.expiresAt.getTime() > Date.now() + 60000;
  }

  /**
   * Retorna o token atual (ou null se não autenticado)
   */
  getToken(): AuthToken | null {
    return this.token;
  }

  /**
   * Garante que há um token válido, re-autenticando se necessário
   */
  async ensureAuthenticated(): Promise<AuthToken> {
    if (!this.isAuthenticated()) {
      return this.authenticate();
    }
    return this.token!;
  }

  // ============================================================
  // APPOINTMENTS (CONSULTAS)
  // ============================================================

  /**
   * Cria uma nova consulta (appointment)
   *
   * @param params Parâmetros para criação da consulta
   * @returns Dados da consulta criada
   */
  async createAppointment(params: CreateAppointmentParams): Promise<Appointment> {
    return this.request('POST', '/sdk/appointments', params);
  }

  /**
   * Busca uma consulta pelo ID
   *
   * @param appointmentId ID da consulta
   * @returns Dados da consulta
   */
  async getAppointment(appointmentId: string): Promise<Appointment> {
    return this.request('GET', `/sdk/appointments/${appointmentId}`);
  }

  /**
   * Busca o status de uma consulta
   *
   * @param appointmentId ID da consulta
   * @returns Status da consulta
   */
  async getAppointmentStatus(appointmentId: string): Promise<{
    status: string;
    updatedAt: string;
    hasMainDocument: boolean;
  }> {
    return this.request('GET', `/sdk/appointments/${appointmentId}/status`);
  }

  /**
   * Lista todos os documentos de uma consulta
   *
   * @param appointmentId ID da consulta
   * @returns Mapa de documentos por tipo
   */
  async getAppointmentDocuments(appointmentId: string): Promise<Record<string, { exists: boolean }>> {
    return this.request('GET', `/sdk/appointments/${appointmentId}/documents`);
  }

  /**
   * Busca um documento específico de uma consulta
   *
   * @param appointmentId ID da consulta
   * @param documentType Tipo do documento
   * @returns Documento
   */
  async getAppointmentDocument(appointmentId: string, documentType: string): Promise<Document> {
    return this.request('GET', `/sdk/appointments/${appointmentId}/document/${documentType}`);
  }

  // ============================================================
  // DOCUMENTOS
  // ============================================================

  /**
   * Gera um documento a partir de uma consulta
   *
   * @param appointmentId ID da consulta
   * @param documentType Tipo do documento a ser gerado
   * @returns Documento gerado
   */
  async generateDocument(appointmentId: string, documentType: DocumentType): Promise<Document> {
    return this.request('POST', `/sdk/appointments/${appointmentId}/documents`, {
      documentType,
    });
  }

  /**
   * Busca um documento gerado
   *
   * @param documentId ID do documento
   * @returns Dados do documento
   */
  async getDocument(documentId: string): Promise<Document> {
    return this.request('GET', `/sdk/documents/${documentId}`);
  }

  // ============================================================
  // HELPERS INTERNOS
  // ============================================================

  /**
   * Retorna a URL base da API
   */
  private getBaseUrl(): string {
    if (this.config.baseUrl) {
      return this.config.baseUrl;
    }
    return this.config.environment === 'production'
      ? 'https://api.sintezy.com'
      : 'https://sandbox-api.sintezy.com';
  }

  /**
   * Faz uma requisição autenticada para a API
   * Re-autentica automaticamente se o token expirou
   */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    await this.ensureAuthenticated();

    const response = await fetch(`${this.getBaseUrl()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token!.accessToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new SintezySDKError(
        error.message || `Request failed: ${method} ${path}`,
        response.status,
        error.code
      );
    }

    return response.json();
  }
}

export default SintezySDK;
