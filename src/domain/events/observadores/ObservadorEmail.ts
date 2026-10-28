import { Observer } from '../Observer';
import { EventoDominio, NomeEvento } from '../EventosDominio';

/**
 * Observer concreto: envia notificações por e-mail aos profissionais e
 * produtores envolvidos. A implementação de envio real (SMTP, provedor
 * transacional etc.) é abstraída por `remetente`, permitindo testes com
 * um dublê (spy/mock) sem I/O real.
 */
export class ObservadorEmail implements Observer {
  readonly nome = 'ObservadorEmail';

  constructor(
    private readonly remetente: (destinatario: string, assunto: string, corpo: string) => Promise<void> | void
  ) {}

  async notificar(evento: EventoDominio): Promise<void> {
    switch (evento.tipo) {
      case NomeEvento.RECOMENDACAO_GERADA:
        await this.remetente(
          evento.recomendacao.projetoId,
          'Nova recomendação de equipe disponível',
          `Uma nova recomendação (${evento.recomendacao.estrategiaUtilizada}) foi gerada para o seu projeto.`
        );
        break;
      case NomeEvento.CONVITE_ACEITO:
        await this.remetente(
          evento.convite.profissionalId,
          'Convite aceito',
          `O convite para o papel ${evento.convite.papel} foi aceito.`
        );
        break;
      case NomeEvento.CONVITE_RECUSADO:
        await this.remetente(
          evento.convite.profissionalId,
          'Convite recusado',
          `O convite para o papel ${evento.convite.papel} foi recusado. Uma nova recomendação será gerada.`
        );
        break;
      case NomeEvento.EQUIPE_FORMADA:
        await this.remetente(
          evento.projetoId,
          'Equipe formada com sucesso',
          `A equipe do projeto ${evento.projetoId} foi finalizada com ${evento.composicaoFinal.length} membro(s).`
        );
        break;
    }
  }
}
