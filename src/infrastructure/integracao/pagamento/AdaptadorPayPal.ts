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
import { ErroGateway, GatewayPagamento, StatusGateway } from './GatewayPagamento';

const STATUS: Record<StatusGateway, StatusPagamento> = {
  APROVADA: 'CONFIRMADO',
  ESTORNADA: 'CANCELADO',
  RECUSADA: 'FALHOU'
};

/**
 * Adapter: traduz o contrato padronizado de pagamentos para o PayPal,
 * acessado por um gateway genérico de API síncrona (`processarPagamento`,
 * `estornarPagamento`, `consultarStatus`).
 */
export class AdaptadorPayPal implements AdaptadorPagamento {
  readonly provedor = 'paypal';

  constructor(private readonly gateway: GatewayPagamento) {}

  async efetuarPagamento(valor: number, origem: string, destino: string): Promise<string> {
    exigirDadosDePagamento(valor, origem, destino);
    const transacao = this.gateway.processarPagamento(valor, { origem, destino });
    if (transacao.status !== 'APROVADA') {
      throw new PagamentoRecusadoError(`Pagamento recusado pelo ${this.provedor}.`);
    }
    return transacao.id;
  }

  async cancelarPagamento(id: string): Promise<boolean> {
    return this.executar(() => this.gateway.estornarPagamento(id), id);
  }

  async verificarPagamento(id: string): Promise<StatusPagamento> {
    return this.executar(() => STATUS[this.gateway.consultarStatus(id)], id);
  }

  private executar<T>(acao: () => T, id: string): T {
    try {
      return acao();
    } catch (erro) {
      if (erro instanceof ErroGateway && erro.codigo === 'TRANSACAO_INEXISTENTE') {
        throw new PagamentoNaoEncontradoError(`Pagamento não encontrado: ${id}`);
      }
      throw new ErroDeIntegracao(this.provedor, 'Falha na comunicação com o gateway.', erro);
    }
  }
}
