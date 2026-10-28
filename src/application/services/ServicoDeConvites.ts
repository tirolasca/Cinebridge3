import { Convite } from '../../domain/entities/Convite';
import { Projeto } from '../../domain/entities/Projeto';
import { Profissional } from '../../domain/entities/Profissional';
import { PapelTecnico, StatusConvite } from '../../domain/entities/types';
import { SujeitoDeEventos } from '../../domain/events/Observer';
import { NomeEvento } from '../../domain/events/EventosDominio';
import { ArvoreDeComposicao, VisitanteDeComposicao } from '../../domain/visitors/ArvoreDeComposicao';
import { VisitanteValidacaoConsistencia, ResultadoValidacao } from '../../domain/visitors/VisitanteValidacaoConsistencia';
import { VisitanteMetricaCompatibilidade, MetricaCompatibilidade } from '../../domain/visitors/VisitanteMetricaCompatibilidade';
import { VisitanteRelatorioEquipe, RelatorioEquipe } from '../../domain/visitors/VisitanteRelatorioEquipe';

/**
 * Serviço de aplicação responsável pelo ciclo de vida dos convites: envio,
 * aceite, recusa e disparo de nova rodada de recomendação quando necessário.
 * Também consolida a composição final da equipe e aplica os Visitors sobre
 * a ArvoreDeComposicao resultante.
 */
export class ServicoDeConvites {
  constructor(private readonly sujeitoDeEventos: SujeitoDeEventos) {}

  async aceitarConvite(convite: Convite): Promise<void> {
    convite.aceitar();
    await this.sujeitoDeEventos.publicar({
      tipo: NomeEvento.CONVITE_ACEITO,
      convite
    });
  }

  /**
   * Registra a recusa do convite e sinaliza qual papel precisa de uma nova
   * rodada de recomendação, mantendo as demais escolhas da equipe fixas —
   * conforme o requisito de que cada substituição afeta apenas o papel
   * correspondente.
   */
  async recusarConvite(convite: Convite): Promise<PapelTecnico> {
    convite.recusar();
    await this.sujeitoDeEventos.publicar({
      tipo: NomeEvento.CONVITE_RECUSADO,
      convite,
      papelParaNovaRecomendacao: convite.papel
    });
    return convite.papel;
  }

  /** Verifica se todos os convites necessários para o projeto foram aceitos. */
  equipeEstaCompleta(convites: Convite[], papeisRequeridos: PapelTecnico[]): boolean {
    return papeisRequeridos.every((papel) =>
      convites.some((c) => c.papel === papel && c.status === StatusConvite.ACEITO)
    );
  }

  /**
   * Finaliza a composição da equipe: monta a ArvoreDeComposicao, aplica os
   * três Visitors (validação, compatibilidade e relatório) e, se válida,
   * publica o evento EQUIPE_FORMADA para os demais microsserviços.
   */
  async finalizarComposicao(
    projeto: Projeto,
    equipe: ReadonlyMap<PapelTecnico, Profissional>
  ): Promise<{
    validacao: ResultadoValidacao;
    compatibilidade: MetricaCompatibilidade;
    relatorio: RelatorioEquipe;
  }> {
    const arvore = new ArvoreDeComposicao(projeto, equipe);

    const validacao = this.visitar(arvore, new VisitanteValidacaoConsistencia());
    const compatibilidade = this.visitar(arvore, new VisitanteMetricaCompatibilidade());
    const relatorio = this.visitar(arvore, new VisitanteRelatorioEquipe());

    if (validacao.valido) {
      await this.sujeitoDeEventos.publicar({
        tipo: NomeEvento.EQUIPE_FORMADA,
        projetoId: projeto.id,
        composicaoFinal: Array.from(equipe.entries()).map(([papel, profissional]) => ({
          papel,
          profissionalId: profissional.id
        }))
      });
    }

    return { validacao, compatibilidade, relatorio };
  }

  private visitar<T>(arvore: ArvoreDeComposicao, visitante: VisitanteDeComposicao<T>): T {
    return arvore.aceitar(visitante);
  }
}
