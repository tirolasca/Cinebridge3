import { RecomendadorBase } from '../../recomendacao/RecomendadorBase';
import { EstrategiaOrcamentoReduzido } from '../../strategies/EstrategiaOrcamentoReduzido';

/**
 * Recomendador da família "publicitário": prioriza custo-benefício e
 * velocidade, já que produções publicitárias operam sob prazos e orçamentos
 * mais apertados que os demais gêneros.
 */
export class RecomendadorPublicitario extends RecomendadorBase {
  constructor() {
    super(new EstrategiaOrcamentoReduzido());
  }
}
