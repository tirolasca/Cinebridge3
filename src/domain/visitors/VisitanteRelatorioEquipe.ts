import { VisitanteDeComposicao, ArvoreDeComposicao } from './ArvoreDeComposicao';

export interface RelatorioEquipe {
  readonly tituloProjeto: string;
  readonly totalMembros: number;
  readonly custoTotalEstimado: number;
  readonly membros: Array<{ papel: string; nome: string; preco: number }>;
}

/**
 * Visitor concreto: gera um relatório completo e legível da equipe formada,
 * destinado ao produtor. Terceira operação transversal sobre a mesma
 * ArvoreDeComposicao, independente dos demais visitantes.
 */
export class VisitanteRelatorioEquipe implements VisitanteDeComposicao<RelatorioEquipe> {
  visitar(arvore: ArvoreDeComposicao): RelatorioEquipe {
    const membros = Array.from(arvore.equipe.entries()).map(([papel, profissional]) => ({
      papel,
      nome: profissional.nome,
      preco: profissional.faixaDePreco.minimo
    }));

    const custoTotalEstimado = membros.reduce((soma, membro) => soma + membro.preco, 0);

    return {
      tituloProjeto: arvore.projeto.titulo,
      totalMembros: membros.length,
      custoTotalEstimado,
      membros
    };
  }
}
