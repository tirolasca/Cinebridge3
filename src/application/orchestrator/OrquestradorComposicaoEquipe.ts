import { Projeto } from '../../domain/entities/Projeto';
import { Profissional } from '../../domain/entities/Profissional';
import { Recomendacao, ItemRecomendacao } from '../../domain/entities/Recomendacao';
import { PapelTecnico } from '../../domain/entities/types';
import { EstrategiaRecomendacao } from '../../domain/strategies/EstrategiaRecomendacao';

/**
 * Template Method: define o esqueleto imutável do processo de composição de
 * equipe — validar restrições, normalizar dados de entrada, ranquear
 * candidatos por papel (delegado à estratégia) e pós-processar o resultado.
 *
 * As subclasses concretas implementam os "hooks" (etapas variáveis) sem
 * poder alterar a ordem ou a presença das etapas do fluxo principal, o que
 * garante que o processo seja sempre auditável e testável de forma
 * consistente, independentemente da variação de negócio implementada.
 */
export abstract class OrquestradorComposicaoEquipe {
  /**
   * Método template: NÃO deve ser sobrescrito pelas subclasses. Define a
   * sequência fixa de etapas do processo de composição de equipe.
   */
  async compor(
    projeto: Projeto,
    estrategia: EstrategiaRecomendacao,
    profissionaisPorPapel: Map<PapelTecnico, Profissional[]>
  ): Promise<Recomendacao> {
    this.validarRestricoesOrcamentarias(projeto);

    const profissionaisNormalizados = this.normalizarDadosDeEntrada(profissionaisPorPapel);

    const itens: ItemRecomendacao[] = [];

    for (const papelRequerido of projeto.papeisRequeridos) {
      const candidatos = profissionaisNormalizados.get(papelRequerido.papel) ?? [];
      const ranqueados = estrategia.ranquear(projeto, papelRequerido.papel, candidatos);

      if (ranqueados.length > 0) {
        const melhor = ranqueados[0];
        itens.push({
          papel: papelRequerido.papel,
          profissionalId: melhor.profissional.id,
          pontuacao: melhor.pontuacao,
          justificativa: melhor.justificativa
        });
      }
    }

    const itensProcessados = this.posProcessarRecomendacoes(itens, projeto);

    return new Recomendacao({
      projetoId: projeto.id,
      estrategiaUtilizada: estrategia.nome,
      itens: itensProcessados,
      parcial: itensProcessados.length < projeto.papeisRequeridos.length
    });
  }

  /**
   * Hook abstrato: valida se as restrições orçamentárias e de prazo do
   * projeto são consistentes antes de iniciar o processo de recomendação.
   * Deve lançar erro quando o projeto for inválido para composição.
   */
  protected abstract validarRestricoesOrcamentarias(projeto: Projeto): void;

  /**
   * Hook abstrato: normaliza os dados de entrada (ex.: filtra profissionais
   * indisponíveis, aplica regras de elegibilidade específicas) antes do
   * ranqueamento pela estratégia.
   */
  protected abstract normalizarDadosDeEntrada(
    profissionaisPorPapel: Map<PapelTecnico, Profissional[]>
  ): Map<PapelTecnico, Profissional[]>;

  /**
   * Hook abstrato: aplica transformações finais sobre a lista de itens de
   * recomendação antes de retornar o resultado (ex.: arredondamento de
   * pontuações, aplicação de regras de exibição).
   */
  protected abstract posProcessarRecomendacoes(
    itens: ItemRecomendacao[],
    projeto: Projeto
  ): ItemRecomendacao[];
}
