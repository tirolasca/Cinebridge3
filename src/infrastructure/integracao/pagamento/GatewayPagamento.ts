export class ErroGateway extends Error {
  constructor(readonly codigo: 'TRANSACAO_INEXISTENTE', message: string) {
    super(message);
  }
}

export type StatusGateway = 'APROVADA' | 'ESTORNADA' | 'RECUSADA';

export interface Transacao {
  id: string;
  valor: number;
  status: StatusGateway;
  dados: { origem: string; destino: string };
}

/**
 * Sistema externo simulado: um gateway de pagamento genérico (usado aqui para
 * o PayPal), com API própria síncrona — `processarPagamento`,
 * `estornarPagamento`, `consultarStatus` — e valores em reais. `limite`
 * permite simular recusas por valor.
 */
export class GatewayPagamento {
  private readonly transacoes = new Map<string, Transacao>();
  private contador = 0;

  constructor(private readonly limite = Number.POSITIVE_INFINITY) {}

  processarPagamento(valor: number, dados: { origem: string; destino: string }): Transacao {
    this.contador += 1;
    const transacao: Transacao = {
      id: `PAYID-${String(this.contador).padStart(6, '0')}`,
      valor,
      status: valor > this.limite ? 'RECUSADA' : 'APROVADA',
      dados: { ...dados }
    };
    this.transacoes.set(transacao.id, transacao);
    return { ...transacao };
  }

  /** `true` se estornou agora; `false` se a transação não estava aprovada. */
  estornarPagamento(id: string): boolean {
    const transacao = this.exigir(id);
    if (transacao.status !== 'APROVADA') return false;
    transacao.status = 'ESTORNADA';
    return true;
  }

  consultarStatus(id: string): StatusGateway {
    return this.exigir(id).status;
  }

  private exigir(id: string): Transacao {
    const transacao = this.transacoes.get(id);
    if (!transacao) throw new ErroGateway('TRANSACAO_INEXISTENTE', `Transação inexistente: ${id}`);
    return transacao;
  }
}
