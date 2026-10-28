import { Observer } from '../Observer';
import { EventoDominio, NomeEvento } from '../EventosDominio';

/**
 * Observer concreto: publica mensagens internas na plataforma (ex.: sino de
 * notificações no painel do usuário). Independente do ObservadorEmail —
 * reage ao mesmo evento sem qualquer acoplamento entre os dois observadores.
 */
export class ObservadorMensagemInterna implements Observer {
  readonly nome = 'ObservadorMensagemInterna';

  private readonly mensagens: Array<{ destinatarioId: string; texto: string }> = [];

  constructor(
    private readonly publicador?: (destinatarioId: string, texto: string) => Promise<void> | void
  ) {}

  async notificar(evento: EventoDominio): Promise<void> {
    let destinatarioId: string;
    let texto: string;

    switch (evento.tipo) {
      case NomeEvento.RECOMENDACAO_GERADA:
        destinatarioId = evento.recomendacao.projetoId;
        texto = `Nova recomendação gerada com a estratégia "${evento.recomendacao.estrategiaUtilizada}".`;
        break;
      case NomeEvento.CONVITE_ACEITO:
        destinatarioId = evento.convite.projetoId;
        texto = `Profissional ${evento.convite.profissionalId} aceitou o convite para ${evento.convite.papel}.`;
        break;
      case NomeEvento.CONVITE_RECUSADO:
        destinatarioId = evento.convite.projetoId;
        texto = `Profissional ${evento.convite.profissionalId} recusou o convite para ${evento.convite.papel}.`;
        break;
      case NomeEvento.EQUIPE_FORMADA:
        destinatarioId = evento.projetoId;
        texto = `Equipe finalizada com ${evento.composicaoFinal.length} membro(s).`;
        break;
    }

    this.mensagens.push({ destinatarioId, texto });
    if (this.publicador) {
      await this.publicador(destinatarioId, texto);
    }
  }

  /** Exposto para fins de teste e inspeção — não faz parte do contrato Observer. */
  mensagensPublicadas(): ReadonlyArray<{ destinatarioId: string; texto: string }> {
    return this.mensagens;
  }
}
