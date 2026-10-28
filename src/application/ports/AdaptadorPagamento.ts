import { PagamentoInvalidoError } from './ErrosDeIntegracao';

/** Situação de um pagamento, no vocabulário do próprio sistema (independente do provedor). */
export type StatusPagamento = 'PENDENTE' | 'CONFIRMADO' | 'CANCELADO' | 'FALHOU';

/**
 * Adapter (alvo): contrato padronizado de pagamentos entre produtores e
 * profissionais. Cada gateway (Stripe, PagSeguro, PayPal...) tem seu próprio
 * formato de valor, de identificador e de status; o adaptador converte tudo
 * para isto.
 */
export interface AdaptadorPagamento {
  /** Nome do provedor em uso (para diagnóstico). */
  readonly provedor: string;
  /** Efetua o pagamento (valor em reais) e devolve o id da transação. Lança `PagamentoRecusadoError` se recusado. */
  efetuarPagamento(valor: number, origem: string, destino: string): Promise<string>;
  /** `true` se este pedido cancelou o pagamento; `false` se ele já estava cancelado. Lança `PagamentoNaoEncontradoError` se o id não existir. */
  cancelarPagamento(id: string): Promise<boolean>;
  /** Lança `PagamentoNaoEncontradoError` se o id não existir. */
  verificarPagamento(id: string): Promise<StatusPagamento>;
}

/** Validação comum a todos os provedores, feita antes de qualquer chamada externa. */
export function exigirDadosDePagamento(valor: number, origem: string, destino: string): void {
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new PagamentoInvalidoError('O valor do pagamento deve ser maior que zero.');
  }
  if (!origem?.trim() || !destino?.trim()) {
    throw new PagamentoInvalidoError('Origem e destino do pagamento são obrigatórios.');
  }
}
