import { EstrategiaRecomendacao, CandidatoPontuado } from './EstrategiaRecomendacao';
import { Profissional } from '../entities/Profissional';
import { Projeto } from '../entities/Projeto';
import { PapelTecnico } from '../entities/types';

/**
 * Estratégia concreta (Strategy): aplica regras de negócio voltadas a projetos
 * com orçamento reduzido, priorizando o menor custo entre os profissionais
 * que atendem a um piso mínimo de qualidade (nota média), em vez de otimizar
 * puramente por competência ou reputação.
 *
 * Reflete uma decisão de negócio explícita: em produções de baixo orçamento,
 * o custo é o fator decisório dominante, respeitada uma barreira de qualidade.
 */
export class EstrategiaOrcamentoReduzido implements EstrategiaRecomendacao {
  readonly nome = 'orcamento_reduzido';

  private readonly notaMinimaAceitavel = 2.5; // em 5

  ranquear(projeto: Projeto, papel: PapelTecnico, candidatos: Profissional[]): CandidatoPontuado[] {
    const orcamentoMaximoPapel = projeto.orcamentoMaximoParaPapel(papel);

    const elegiveis = candidatos.filter((profissional) => {
      const semHistoricoOuNotaAceitavel =
        profissional.avaliacoesSeguras.length === 0 || profissional.notaMedia() >= this.notaMinimaAceitavel;
      return profissional.cabeNoOrcamento(orcamentoMaximoPapel) && semHistoricoOuNotaAceitavel;
    });

    const pontuados = elegiveis.map((profissional) => {
      // Pontuação inversamente proporcional ao preço mínimo: quanto mais barato, maior a pontuação
      const custoNormalizado =
        orcamentoMaximoPapel > 0 ? profissional.faixaDePreco.minimo / orcamentoMaximoPapel : 1;
      const pontuacao = Math.max(0, 1 - custoNormalizado);

      return {
        profissional,
        pontuacao,
        justificativa: `Custo de R$ ${profissional.faixaDePreco.minimo.toFixed(2)} dentro do teto de R$ ${orcamentoMaximoPapel.toFixed(2)} para o papel`
      };
    });

    return pontuados.sort((a, b) => b.pontuacao - a.pontuacao);
  }
}
