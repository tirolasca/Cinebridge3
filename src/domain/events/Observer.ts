import { EventoDominio } from './EventosDominio';

/**
 * Observer: contrato que todo observador de eventos de domínio deve implementar.
 * Cada observador reage de forma independente ao mesmo evento, sem que o
 * sujeito precise conhecer os detalhes de cada reação.
 */
export interface Observer {
  /** Nome descritivo do observador, útil para logs e testes. */
  readonly nome: string;

  notificar(evento: EventoDominio): Promise<void> | void;
}

/**
 * Subject (sujeito observável): mantém a lista de observadores e os notifica
 * sempre que um evento de domínio ocorre. Implementado sobre EventEmitter do
 * Node.js internamente seria uma alternativa; aqui optamos por uma
 * implementação explícita para deixar o contrato do padrão Observer visível
 * e facilmente testável, mantendo a possibilidade de futura substituição por
 * uma fila de mensagens (ex.: RabbitMQ) sem alterar a interface pública.
 */
export class SujeitoDeEventos {
  private readonly observadores: Observer[] = [];

  inscrever(observador: Observer): void {
    this.observadores.push(observador);
  }

  desinscrever(observador: Observer): void {
    const indice = this.observadores.indexOf(observador);
    if (indice >= 0) this.observadores.splice(indice, 1);
  }

  /**
   * Notifica todos os observadores inscritos. Cada observador é notificado
   * de forma isolada: uma falha em um observador não impede os demais de
   * serem notificados (requisito de tolerância a falhas em componentes
   * dependentes, como o serviço de e-mail).
   */
  async publicar(evento: EventoDominio): Promise<void> {
    const resultados = await Promise.allSettled(
      this.observadores.map((observador) => {
        // Envolve a chamada em uma função para capturar também exceções
        // lançadas de forma síncrona por notificar(), e não apenas rejeições
        // de Promises retornadas — garantindo que uma falha em um observador
        // nunca interrompa a notificação dos demais.
        try {
          return Promise.resolve(observador.notificar(evento));
        } catch (erroSincrono) {
          return Promise.reject(erroSincrono);
        }
      })
    );

    resultados.forEach((resultado, indice) => {
      if (resultado.status === 'rejected') {
        // eslint-disable-next-line no-console
        console.error(
          `[SujeitoDeEventos] Observador "${this.observadores[indice].nome}" falhou ao processar evento "${evento.tipo}":`,
          resultado.reason
        );
      }
    });
  }

  quantidadeDeObservadores(): number {
    return this.observadores.length;
  }
}
