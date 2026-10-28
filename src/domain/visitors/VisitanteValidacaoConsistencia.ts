import { VisitanteDeComposicao, ArvoreDeComposicao } from './ArvoreDeComposicao';

export interface ResultadoValidacao {
  readonly valido: boolean;
  readonly erros: string[];
}

/**
 * Visitor concreto: verifica se todos os papéis obrigatórios do projeto
 * estão preenchidos na equipe e se o custo total da equipe montada respeita
 * o orçamento do projeto.
 */
export class VisitanteValidacaoConsistencia implements VisitanteDeComposicao<ResultadoValidacao> {
  visitar(arvore: ArvoreDeComposicao): ResultadoValidacao {
    const erros: string[] = [];

    for (const papelRequerido of arvore.projeto.papeisRequeridos) {
      if (!arvore.equipe.has(papelRequerido.papel)) {
        erros.push(`Papel obrigatório não preenchido: ${papelRequerido.papel}`);
      }
    }

    const custoTotal = Array.from(arvore.equipe.values()).reduce(
      (soma, profissional) => soma + profissional.faixaDePreco.minimo,
      0
    );

    if (custoTotal > arvore.projeto.orcamentoTotal) {
      erros.push(
        `Custo total da equipe (R$ ${custoTotal.toFixed(2)}) excede o orçamento do projeto (R$ ${arvore.projeto.orcamentoTotal.toFixed(2)})`
      );
    }

    return { valido: erros.length === 0, erros };
  }
}
