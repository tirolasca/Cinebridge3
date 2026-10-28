export class ErroPagSeguro extends Error {
  constructor(readonly codigoErro: number, message: string) {
    super(message);
  }
}

export type SituacaoPagSeguro = 'PAGO' | 'CANCELADO' | 'RECUSADO' | 'AGUARDANDO';

interface Cobranca {
  codigo: string;
  valor: string;
  moeda: string;
  pagador: string;
  recebedor: string;
  situacao: SituacaoPagSeguro;
}

/**
 * Sistema externo simulado: imita o PagSeguro (cobranças com `codigo`;
 * valor como texto decimal; situações em português). `limite` permite
 * simular recusas por valor.
 */
export class PagSeguroSimulado {
  private readonly cobrancas = new Map<string, Cobranca>();
  private contador = 0;

  constructor(private readonly limite = Number.POSITIVE_INFINITY) {}

  async criarCobranca(dados: { valor: string; moeda: string; pagador: string; recebedor: string }): Promise<{
    codigo: string;
    situacao: SituacaoPagSeguro;
  }> {
    this.contador += 1;
    const cobranca: Cobranca = {
      codigo: `PS-${String(this.contador).padStart(8, '0')}`,
      ...dados,
      situacao: Number(dados.valor) > this.limite ? 'RECUSADO' : 'PAGO'
    };
    this.cobrancas.set(cobranca.codigo, cobranca);
    return { codigo: cobranca.codigo, situacao: cobranca.situacao };
  }

  async consultarCobranca(codigo: string): Promise<{ codigo: string; situacao: SituacaoPagSeguro }> {
    const cobranca = this.cobrancas.get(codigo);
    if (!cobranca) throw new ErroPagSeguro(404, `Cobrança não encontrada: ${codigo}`);
    return { codigo, situacao: cobranca.situacao };
  }

  async cancelarCobranca(codigo: string): Promise<{ sucesso: boolean }> {
    const cobranca = this.cobrancas.get(codigo);
    if (!cobranca) throw new ErroPagSeguro(404, `Cobrança não encontrada: ${codigo}`);
    if (cobranca.situacao !== 'PAGO') return { sucesso: false };
    cobranca.situacao = 'CANCELADO';
    return { sucesso: true };
  }
}
