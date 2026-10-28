import { RecomendadorBase } from '../../recomendacao/RecomendadorBase';
import { EstrategiaSimilaridadeCosseno } from '../../strategies/EstrategiaSimilaridadeCosseno';

/**
 * Recomendador da família "animação": prioriza a similaridade técnica
 * (competências declaradas), já que a qualidade de uma animação depende
 * diretamente de habilidades específicas de software e de técnica.
 */
export class RecomendadorAnimacao extends RecomendadorBase {
  constructor() {
    super(new EstrategiaSimilaridadeCosseno());
  }
}
