import { RecomendadorBase } from '../../recomendacao/RecomendadorBase';
import { EstrategiaFiltragemColaborativa } from '../../strategies/EstrategiaFiltragemColaborativa';

/**
 * Recomendador da família "documentário": prioriza reputação e histórico de
 * projetos anteriores sobre competências puramente técnicas, já que
 * documentários dependem fortemente de credibilidade e de uma relação de
 * confiança do profissional com o tema abordado.
 */
export class RecomendadorDocumentario extends RecomendadorBase {
  constructor() {
    super(new EstrategiaFiltragemColaborativa());
  }
}
