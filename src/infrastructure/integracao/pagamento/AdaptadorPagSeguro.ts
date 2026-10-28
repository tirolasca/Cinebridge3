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
import { ErroPagSeguro, PagSeguroSimulado, SituacaoPagSeguro } from './PagSeguroSimulado';

const STATUS: Record<SituacaoPagSeguro, StatusPagamento> = {
  PAGO: 'CONFIRMADO',
  CANCELADO: 'CANCELADO',
  RECUSADO: 'FALHOU',
  AGUARDANDO: 'PENDENTE'
};

/** Adapter: traduz o contrato padronizado de pagamentos para o PagSeguro (valor em texto, `codigo`, situações em português). */
export class AdaptadorPagSeguro implements AdaptadorPagamento {
  readonly provedor = 'pagseguro';

  constructor(private readonly cliente: PagSeguroSimulado) {}

  async efetuarPagamento(valor: number, origem: string, destino: string): Promise<string> {
    exigirDadosDePagamento(valor, origem, destino);
    try {
      const cobranca = await this.cliente.criarCobranca({
        valor: valor.toFixed(2),
        moeda: 'BRL',
        pagador: origem,
        recebedor: destino
      });
      if (cobranca.situacao !== 'PAGO') {
        throw new PagamentoRecusadoError(`Pagamento recusado pelo ${this.provedor}.`);
      }
      return cobranca.codigo;
    } catch (erro) {
      if (erro instanceof PagamentoRecusadoError) throw erro;
      throw new ErroDeIntegracao(this.provedor, 'Falha ao efetuar o pagamento.', erro);
    }
  }

  async cancelarPagamento(id: string): Promise<boolean> {
    try {
      return (await this.cliente.cancelarCobranca(id)).sucesso;
    } catch (erro) {
      if (erro instanceof ErroPagSeguro && erro.codigoErro === 404) {
        throw new PagamentoNaoEncontradoError(`Pagamento não encontrado: ${id}`);
      }
      throw new ErroDeIntegracao(this.provedor, 'Falha ao cancelar o pagamento.', erro);
    }
  }

  async verificarPagamento(id: string): Promise<StatusPagamento> {
    try {
      return STATUS[(await this.cliente.consultarCobranca(id)).situacao];
    } catch (erro) {
      if (erro instanceof ErroPagSeguro && erro.codigoErro === 404) {
        throw new PagamentoNaoEncontradoError(`Pagamento não encontrado: ${id}`);
      }
      throw new ErroDeIntegracao(this.provedor, 'Falha ao consultar o pagamento.', erro);
    }
  }
}
