var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  SintezySDK: () => SintezySDK,
  SintezySDKError: () => SintezySDKError,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var SintezySDKError = class extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "SintezySDKError";
  }
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
  /**
   * Autentica a aplicação usando OAuth 2.0 Client Credentials
   *
   * @returns Token de acesso
   */
  async authenticate() {
    const response = await fetch(`${this.getBaseUrl()}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      })
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new SintezySDKError(
        error.message || "Authentication failed",
        response.status,
        "AUTH_FAILED"
      );
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
  /**
   * Verifica se está autenticado e se o token ainda é válido
   */
  isAuthenticated() {
    if (!this.token) return false;
    return this.token.expiresAt.getTime() > Date.now() + 6e4;
  }
  /**
   * Retorna o token atual (ou null se não autenticado)
   */
  getToken() {
    return this.token;
  }
  /**
   * Garante que há um token válido, re-autenticando se necessário
   */
  async ensureAuthenticated() {
    if (!this.isAuthenticated()) {
      return this.authenticate();
    }
    return this.token;
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
  async createAppointment(params) {
    return this.request("POST", "/sdk/appointments", params);
  }
  /**
   * Busca uma consulta pelo ID
   *
   * @param appointmentId ID da consulta
   * @returns Dados da consulta
   */
  async getAppointment(appointmentId) {
    return this.request("GET", `/sdk/appointments/${appointmentId}`);
  }
  /**
   * Busca o status de uma consulta
   *
   * @param appointmentId ID da consulta
   * @returns Status da consulta
   */
  async getAppointmentStatus(appointmentId) {
    return this.request("GET", `/sdk/appointments/${appointmentId}/status`);
  }
  /**
   * Lista todos os documentos de uma consulta
   *
   * @param appointmentId ID da consulta
   * @returns Mapa de documentos por tipo
   */
  async getAppointmentDocuments(appointmentId) {
    return this.request("GET", `/sdk/appointments/${appointmentId}/documents`);
  }
  /**
   * Busca um documento específico de uma consulta
   *
   * @param appointmentId ID da consulta
   * @param documentType Tipo do documento
   * @returns Documento
   */
  async getAppointmentDocument(appointmentId, documentType) {
    return this.request("GET", `/sdk/appointments/${appointmentId}/document/${documentType}`);
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
  async generateDocument(appointmentId, documentType) {
    return this.request("POST", `/sdk/appointments/${appointmentId}/documents`, {
      documentType
    });
  }
  /**
   * Busca um documento gerado
   *
   * @param documentId ID do documento
   * @returns Dados do documento
   */
  async getDocument(documentId) {
    return this.request("GET", `/sdk/documents/${documentId}`);
  }
  // ============================================================
  // HELPERS INTERNOS
  // ============================================================
  /**
   * Retorna a URL base da API
   */
  getBaseUrl() {
    if (this.config.baseUrl) {
      return this.config.baseUrl;
    }
    return this.config.environment === "production" ? "https://api.sintezy.com" : "https://sandbox-api.sintezy.com";
  }
  /**
   * Faz uma requisição autenticada para a API
   * Re-autentica automaticamente se o token expirou
   */
  async request(method, path, body) {
    await this.ensureAuthenticated();
    const response = await fetch(`${this.getBaseUrl()}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.token.accessToken}`
      },
      body: body ? JSON.stringify(body) : void 0
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
};
var index_default = SintezySDK;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SintezySDK,
  SintezySDKError
});
