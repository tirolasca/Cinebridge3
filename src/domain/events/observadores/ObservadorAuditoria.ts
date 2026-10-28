import { Observer } from '../Observer';
import { EventoDominio } from '../EventosDominio';

export interface RegistroDeAuditoria {
  readonly timestamp: Date;
  readonly tipoEvento: string;
  readonly detalhes: Record<string, unknown>;
}

/**
 * Observer concreto: grava um log estruturado de auditoria para cada evento
 * de domínio, atendendo ao requisito não funcional de registrar todas as
 * ações de produtores e profissionais para fins de auditoria e melhoria
 * contínua.
 */
export class ObservadorAuditoria implements Observer {
  readonly nome = 'ObservadorAuditoria';

  private readonly registros: RegistroDeAuditoria[] = [];

  constructor(private readonly persistirLog?: (registro: RegistroDeAuditoria) => Promise<void> | void) {}

  async notificar(evento: EventoDominio): Promise<void> {
    const registro: RegistroDeAuditoria = {
      timestamp: new Date(),
      tipoEvento: evento.tipo,
      detalhes: this.extrairDetalhes(evento)
    };

    this.registros.push(registro);
    if (this.persistirLog) {
      await this.persistirLog(registro);
    }
  }

  private extrairDetalhes(evento: EventoDominio): Record<string, unknown> {
    // Serialização estrutural genérica do evento, preservando apenas dados
    // relevantes para auditoria (evita vazar objetos de domínio completos).
    return JSON.parse(JSON.stringify(evento)) as Record<string, unknown>;
  }

  /** Exposto para fins de teste e inspeção — não faz parte do contrato Observer. */
  obterRegistros(): ReadonlyArray<RegistroDeAuditoria> {
    return this.registros;
  }
}
