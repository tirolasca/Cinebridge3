import { VisitanteDeComposicao, ArvoreDeComposicao } from './ArvoreDeComposicao';

export interface MetricaCompatibilidade {
  readonly pontuacaoGeral: number; // 0..1
  readonly pontuacaoPorPapel: Record<string, number>;
}

/**
 * Visitor concreto: calcula uma métrica agregada de compatibilidade da
 * equipe montada, combinando a nota média histórica de cada profissional
 * escolhido. Útil para o produtor comparar diferentes composições de equipe.
 */
export class VisitanteMetricaCompatibilidade implements VisitanteDeComposicao<MetricaCompatibilidade> {
  visitar(arvore: ArvoreDeComposicao): MetricaCompatibilidade {
    const pontuacaoPorPapel: Record<string, number> = {};
    let somaPonderada = 0;
    let somaPesos = 0;

    for (const papelRequerido of arvore.projeto.papeisRequeridos) {
      const profissional = arvore.equipe.get(papelRequerido.papel);
      const notaNormalizada = profissional ? profissional.notaMedia() / 5 : 0;

      pontuacaoPorPapel[papelRequerido.papel] = notaNormalizada;
      somaPonderada += notaNormalizada * papelRequerido.pesoImportancia;
      somaPesos += papelRequerido.pesoImportancia;
    }

    const pontuacaoGeral = somaPesos > 0 ? somaPonderada / somaPesos : 0;

    return { pontuacaoGeral, pontuacaoPorPapel };
  }
}
