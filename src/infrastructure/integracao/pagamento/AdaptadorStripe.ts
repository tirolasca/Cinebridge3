import {
  AdaptadorPagamento,
  StatusPagamento,
  exigirDadosDePagamento
} from '../../../application/ports/AdaptadorPagamento';
import {
  ErroDeIntegracao,
  PagamentoNaoEncontradoError,
  PagamentoRecusadoError
} from '../../../application/ports/ErrosDeIntegracao';
import { ErroStripe, StripeSimulado } from './StripeSimulado';

const STATUS: Record<string, StatusPagamento> = {
  succeeded: 'CONFIRMADO',
  refunded: 'CANCELADO',
  requires_payment_method: 'FALHOU',
  processing: 'PENDENTE'
};

/** Adapter: traduz o contrato padronizado de pagamentos para o Stripe (centavos, `pi_...`, status em inglês). */
export class AdaptadorStripe implements AdaptadorPagamento {
  readonly provedor = 'stripe';

  constructor(private readonly cliente: StripeSimulado) {}

  async efetuarPagamento(valor: number, origem: string, destino: string): Promise<string> {
    exigirDadosDePagamento(valor, origem, destino);
    try {
      const intent = await this.cliente.paymentIntents.create({
        amount: Math.round(valor * 100),
        currency: 'brl',
        metadata: { origem, destino }
      });
      if (intent.status !== 'succeeded') {
        throw new PagamentoRecusadoError(`Pagamento recusado pelo ${this.provedor}.`);
      }
      return intent.id;
    } catch (erro) {
      if (erro instanceof PagamentoRecusadoError) throw erro;
      throw new ErroDeIntegracao(this.provedor, 'Falha ao efetuar o pagamento.', erro);
    }
  }

  async cancelarPagamento(id: string): Promise<boolean> {
    try {
      await this.cliente.refunds.create({ payment_intent: id });
      return true;
    } catch (erro) {
      if (erro instanceof ErroStripe) {
        if (erro.code === 'resource_missing') throw new PagamentoNaoEncontradoError(`Pagamento não encontrado: ${id}`);
        if (erro.code === 'charge_already_refunded' || erro.code === 'charge_not_refundable') return false;
      }
      throw new ErroDeIntegracao(this.provedor, 'Falha ao cancelar o pagamento.', erro);
    }
  }

  async verificarPagamento(id: string): Promise<StatusPagamento> {
    try {
      const intent = await this.cliente.paymentIntents.retrieve(id);
      return STATUS[intent.status] ?? 'PENDENTE';
    } catch (erro) {
      if (erro instanceof ErroStripe && erro.code === 'resource_missing') {
        throw new PagamentoNaoEncontradoError(`Pagamento não encontrado: ${id}`);
      }
      throw new ErroDeIntegracao(this.provedor, 'Falha ao consultar o pagamento.', erro);
    }
  }
}
