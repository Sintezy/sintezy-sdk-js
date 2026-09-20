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
/** Campo do layout da anamnese: o `content` é a instrução para a IA. */
interface LayoutField {
    name: string;
    content?: string;
    position?: number;
}
interface Layout {
    fields: LayoutField[];
}
interface CreateAppointmentParams {
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
interface Appointment {
    secureId: string;
    status: string;
    createdAt: string;
    title?: string;
    /** URL do portal de gravação, para abrir em popup ou iframe. */
    portalUrl: string;
}
/** Tipos servidos pelos modelos padrão da Sintezy. */
type CatalogDocumentType = 'document' | 'anamnese_summary' | 'clinic_summary' | 'referral' | 'exames_call' | 'prescription' | 'certificate' | 'inss_report';
declare const CATALOG_DOCUMENT_TYPES: CatalogDocumentType[];
/**
 * Um tipo do catálogo, ou o nome que você dá ao seu próprio documento.
 * O `(string & {})` preserva o autocomplete dos tipos do catálogo sem
 * impedir um nome livre.
 */
type DocumentType = CatalogDocumentType | (string & {});
/** Prompt do documento: os dois campos andam sempre juntos. */
interface DocumentPrompt {
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
interface GenerateDocumentInput extends Partial<DocumentPrompt> {
    documentType?: DocumentType;
}
interface Document {
    secureId: string;
    /** O tipo com que o documento ficou gravado — use-o no `getDocument`. */
    type: string;
    content: unknown;
    createdAt: string;
    updatedAt?: string;
}
interface DocumentListItem {
    type: string;
    exists: boolean;
    createdAt?: string;
}
interface Transcription {
    secureId: string;
    transcription: string | null;
    recordedTimeSeconds?: number;
    status: string;
}
interface SubscriptionStatus {
    email: string;
    hasSubscription: boolean;
    status?: string;
    planType?: string;
    endDate?: string;
    checkoutUrl?: string;
}
interface DeleteResult {
    message: string;
    deleted: boolean;
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
    /** Autentica via OAuth 2.0 Client Credentials. */
    authenticate(): Promise<AuthToken>;
    /** True se há token e ele ainda vale por mais de um minuto. */
    isAuthenticated(): boolean;
    getToken(): AuthToken | null;
    /** Autentica se necessário. Chamado por todos os métodos. */
    ensureAuthenticated(): Promise<AuthToken>;
    /** Cria a consulta e devolve a URL do portal de gravação. */
    createAppointment(params: CreateAppointmentParams): Promise<Appointment>;
    getAppointment(appointmentSecureId: string): Promise<Appointment>;
    /** Exclui a consulta (soft delete). */
    deleteAppointment(appointmentSecureId: string): Promise<DeleteResult>;
    /** Transcrição da consulta, quando a gravação já terminou. */
    getTranscription(appointmentSecureId: string): Promise<Transcription>;
    /** Status da assinatura de um médico (API keys do tipo reseller). */
    getSubscriptionStatus(email: string): Promise<SubscriptionStatus>;
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
    generateDocument(appointmentSecureId: string, input: DocumentType | GenerateDocumentInput): Promise<Document>;
    /**
     * Busca um documento já gerado.
     *
     * @param documentType Tipo do catálogo, ou o nome que você usou ao gerar
     *                     (`custom` quando você não informou nenhum).
     */
    getDocument(appointmentSecureId: string, documentType: DocumentType): Promise<Document>;
    /** Lista os documentos da consulta e quais já foram gerados. */
    listDocuments(appointmentSecureId: string): Promise<DocumentListItem[]>;
    private getBaseUrl;
    /**
     * Erro da API já traduzido; `message` pode vir string ou array (erros de
     * validação). Tipado estruturalmente para não exigir a lib DOM no build.
     */
    private toError;
    private request;
}

export { type Appointment, type AuthToken, CATALOG_DOCUMENT_TYPES, type CatalogDocumentType, type CreateAppointmentParams, type DeleteResult, type Document, type DocumentListItem, type DocumentPrompt, type DocumentType, type GenerateDocumentInput, type Layout, type LayoutField, SintezySDK, type SintezySDKConfig, SintezySDKError, type SubscriptionStatus, type Transcription, SintezySDK as default };
