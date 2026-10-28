/** Falha ao falar com um sistema externo (qualquer provedor). */
export class ErroDeIntegracao extends Error {
  constructor(
    readonly provedor: string,
    mensagem: string,
    readonly causa?: unknown
  ) {
    super(`[${provedor}] ${mensagem}`);
  }
}

export class ArquivoNaoEncontradoError extends Error {}
export class PagamentoNaoEncontradoError extends Error {}
export class PagamentoRecusadoError extends Error {}
export class PagamentoInvalidoError extends Error {}
export class ProfissionalNaoEncontradoError extends Error {}
export class AvaliacaoInvalidaError extends Error {}

/** Argumento inválido numa operação (nome de arquivo, identificador de projeto...). */
export class ArgumentoInvalidoError extends Error {}
