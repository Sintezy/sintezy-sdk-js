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
interface SintezySDKConfig {
    clientId: string;
    clientSecret: string;
    environment?: 'production' | 'sandbox';
    baseUrl?: string;
}
interface AuthToken {
    accessToken: string;
    expiresIn: number;
    tokenType: string;
    /** Timestamp de quando o token expira */
    expiresAt: Date;
}
interface CreateAppointmentParams {
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
interface Appointment {
    id: string;
    secureId: string;
    userId: string;
    status: string;
    createdAt: string;
}
interface GenerateDocumentParams {
    consultationId: string;
    documentType: DocumentType;
}
type DocumentType = 'MEDICAL_RECORD' | 'PRESCRIPTION' | 'CERTIFICATE' | 'REFERRAL' | 'EXAM_REQUEST';
interface Document {
}
declare class SintezySDKError extends Error {
    statusCode?: number;
    code?: string;
    constructor(message: string, statusCode?: number, code?: string);
}
declare class SintezySDK {
    private config;
    private token;
    constructor(config: SintezySDKConfig);
    /**
     * Autentica a aplicação usando OAuth 2.0 Client Credentials
     *
     * @returns Token de acesso
     */
    authenticate(): Promise<AuthToken>;
    /**
     * Verifica se está autenticado e se o token ainda é válido
     */
    isAuthenticated(): boolean;
    /**
     * Retorna o token atual (ou null se não autenticado)
     */
    getToken(): AuthToken | null;
    /**
     * Garante que há um token válido, re-autenticando se necessário
     */
    ensureAuthenticated(): Promise<AuthToken>;
    /**
     * Cria uma nova consulta (appointment)
     *
     * @param params Parâmetros para criação da consulta
     * @returns Dados da consulta criada
     */
    createAppointment(params: CreateAppointmentParams): Promise<Appointment>;
    /**
     * Busca uma consulta pelo ID
     *
     * @param appointmentId ID da consulta
     * @returns Dados da consulta
     */
    getAppointment(appointmentId: string): Promise<Appointment>;
    /**
     * Busca o status de uma consulta
     *
     * @param appointmentId ID da consulta
     * @returns Status da consulta
     */
    getAppointmentStatus(appointmentId: string): Promise<{
        status: string;
        updatedAt: string;
        hasMainDocument: boolean;
    }>;
    /**
     * Lista todos os documentos de uma consulta
     *
     * @param appointmentId ID da consulta
     * @returns Mapa de documentos por tipo
     */
    getAppointmentDocuments(appointmentId: string): Promise<Record<string, {
        exists: boolean;
    }>>;
    /**
     * Busca um documento específico de uma consulta
     *
     * @param appointmentId ID da consulta
     * @param documentType Tipo do documento
     * @returns Documento
     */
    getAppointmentDocument(appointmentId: string, documentType: string): Promise<Document>;
    /**
     * Gera um documento a partir de uma consulta
     *
     * @param appointmentId ID da consulta
     * @param documentType Tipo do documento a ser gerado
     * @returns Documento gerado
     */
    generateDocument(appointmentId: string, documentType: DocumentType): Promise<Document>;
    /**
     * Busca um documento gerado
     *
     * @param documentId ID do documento
     * @returns Dados do documento
     */
    getDocument(documentId: string): Promise<Document>;
    /**
     * Retorna a URL base da API
     */
    private getBaseUrl;
    /**
     * Faz uma requisição autenticada para a API
     * Re-autentica automaticamente se o token expirou
     */
    private request;
}

export { type Appointment, type AuthToken, type CreateAppointmentParams, type Document, type DocumentType, type GenerateDocumentParams, SintezySDK, type SintezySDKConfig, SintezySDKError, SintezySDK as default };
