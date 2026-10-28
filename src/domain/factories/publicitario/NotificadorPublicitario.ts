import { Observador } from '../TiposDeFabrica';

/**
 * Notificador concreto da família "publicitário".
 */
export class NotificadorPublicitario implements Observador {
  private readonly notificacoes: unknown[] = [];

  atualizar(evento: unknown): void {
    this.notificacoes.push(evento);
    // eslint-disable-next-line no-console
    console.log('[NotificadorPublicitario] Evento recebido para projeto publicitário:', evento);
  }

  /** Exposto para fins de teste e inspeção. */
  obterNotificacoes(): ReadonlyArray<unknown> {
    return this.notificacoes;
  }
}
