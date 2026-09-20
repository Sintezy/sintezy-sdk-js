// src/index.ts
var CATALOG_DOCUMENT_TYPES = [
  "document",
  "anamnese_summary",
  "clinic_summary",
  "referral",
  "exames_call",
  "prescription",
  "certificate",
  "inss_report"
];
var SintezySDKError = class extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "SintezySDKError";
  }
  statusCode;
  code;
};
var SintezySDK = class {
  config;
  token = null;
  constructor(config) {
    if (!config.clientId || !config.clientSecret) {
      throw new SintezySDKError("clientId and clientSecret are required");
    }
    this.config = {
      environment: "production",
      ...config
    };
  }
  // ============================================================
  // AUTENTICAÇÃO
  // ============================================================
  /** Autentica via OAuth 2.0 Client Credentials. */
  async authenticate() {
    const response = await fetch(`${this.getBaseUrl()}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      })
    });
    if (!response.ok) {
      throw await this.toError(response, "Authentication failed", "AUTH_FAILED");
    }
    const data = await response.json();
    this.token = {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
      expiresAt: new Date(Date.now() + data.expires_in * 1e3)
    };
    return this.token;
  }
  /** True se há token e ele ainda vale por mais de um minuto. */
  isAuthenticated() {
    if (!this.token) return false;
    return this.token.expiresAt.getTime() > Date.now() + 6e4;
  }
  getToken() {
    return this.token;
  }
  /** Autentica se necessário. Chamado por todos os métodos. */
  async ensureAuthenticated() {
    if (!this.isAuthenticated()) {
      return this.authenticate();
    }
    return this.token;
  }
  // ============================================================
  // CONSULTAS
  // ============================================================
  /** Cria a consulta e devolve a URL do portal de gravação. */
  async createAppointment(params) {
    var _a, _b;
    if (!((_b = (_a = params.layout) == null ? void 0 : _a.fields) == null ? void 0 : _b.length)) {
      throw new SintezySDKError(
        "layout.fields \xE9 obrigat\xF3rio: informe ao menos um campo da anamnese"
      );
    }
    return this.request("POST", "/sdk/appointments", params);
  }
  async getAppointment(appointmentSecureId) {
    return this.request(
      "GET",
      `/sdk/appointments/${encodeURIComponent(appointmentSecureId)}`
    );
  }
  /** Exclui a consulta (soft delete). */
  async deleteAppointment(appointmentSecureId) {
    return this.request(
      "DELETE",
      `/sdk/appointments/${encodeURIComponent(appointmentSecureId)}`
    );
  }
  /** Transcrição da consulta, quando a gravação já terminou. */
  async getTranscription(appointmentSecureId) {
    return this.request(
      "GET",
      `/sdk/appointments/${encodeURIComponent(appointmentSecureId)}/transcription`
    );
  }
  /** Status da assinatura de um médico (API keys do tipo reseller). */
  async getSubscriptionStatus(email) {
    return this.request(
      "GET",
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
  async generateDocument(appointmentSecureId, input) {
    const body = typeof input === "string" ? { documentType: input } : { ...input };
    const hasPrompt = body.contextualization !== void 0 || body.format !== void 0;
    if (hasPrompt && (!body.contextualization || !body.format)) {
      throw new SintezySDKError(
        "contextualization e format s\xE3o obrigat\xF3rios juntos"
      );
    }
    if (!body.documentType && !hasPrompt) {
      throw new SintezySDKError(
        "informe um documentType ou o par contextualization + format"
      );
    }
    if (body.documentType && !CATALOG_DOCUMENT_TYPES.includes(body.documentType) && !hasPrompt) {
      throw new SintezySDKError(
        `"${body.documentType}" n\xE3o \xE9 um tipo do cat\xE1logo (${CATALOG_DOCUMENT_TYPES.join(", ")}), ent\xE3o \xE9 o nome do seu documento e exige contextualization + format`
      );
    }
    return this.request(
      "POST",
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
  async getDocument(appointmentSecureId, documentType) {
    return this.request(
      "GET",
      `/sdk/appointments/${encodeURIComponent(appointmentSecureId)}/documents/${encodeURIComponent(documentType)}`
    );
  }
  /** Lista os documentos da consulta e quais já foram gerados. */
  async listDocuments(appointmentSecureId) {
    return this.request(
      "GET",
      `/sdk/appointments/${encodeURIComponent(appointmentSecureId)}/documents`
    );
  }
  // ============================================================
  // HELPERS INTERNOS
  // ============================================================
  getBaseUrl() {
    if (this.config.baseUrl) {
      return this.config.baseUrl;
    }
    return this.config.environment === "production" ? "https://api.sintezy.com" : "https://sandbox-api.sintezy.com";
  }
  /**
   * Erro da API já traduzido; `message` pode vir string ou array (erros de
   * validação). Tipado estruturalmente para não exigir a lib DOM no build.
   */
  async toError(response, fallback, code) {
    const body = await response.json().catch(() => ({}));
    const raw = body.message ?? body.error;
    const message = Array.isArray(raw) ? raw.join("; ") : raw;
    return new SintezySDKError(
      message || fallback,
      response.status,
      body.code ?? code
    );
  }
  async request(method, path, body) {
    await this.ensureAuthenticated();
    const response = await fetch(`${this.getBaseUrl()}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.token.accessToken}`
      },
      body: body === void 0 ? void 0 : JSON.stringify(body)
    });
    if (!response.ok) {
      throw await this.toError(response, `Request failed: ${method} ${path}`);
    }
    return response.json();
  }
};
var index_default = SintezySDK;
export {
  CATALOG_DOCUMENT_TYPES,
  SintezySDK,
  SintezySDKError,
  index_default as default
};
