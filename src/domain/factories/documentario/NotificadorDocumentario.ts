import { Observador } from '../TiposDeFabrica';

/**
 * Notificador concreto da família "documentário": formata mensagens de
 * evento incluindo contexto específico do gênero (ex.: tema do projeto),
 * quando disponível no payload do evento.
 */
export class NotificadorDocumentario implements Observador {
  private readonly notificacoes: unknown[] = [];

  atualizar(evento: unknown): void {
    this.notificacoes.push(evento);
    // eslint-disable-next-line no-console
    console.log('[NotificadorDocumentario] Evento recebido para projeto documentário:', evento);
  }

  /** Exposto para fins de teste e inspeção. */
  obterNotificacoes(): ReadonlyArray<unknown> {
    return this.notificacoes;
  }
}
