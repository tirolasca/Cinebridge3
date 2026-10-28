import { RecomendacaoStrategy } from '../factories/TiposDeFabrica';
import { Projeto } from '../entities/Projeto';
import { Profissional } from '../entities/Profissional';
import { EstrategiaRecomendacao } from '../strategies/EstrategiaRecomendacao';

/**
 * Recomendador base: contém a lógica principal de recomendação — para cada
 * papel exigido pelo projeto, ranqueia os candidatos daquela especialidade
 * com a estratégia de ranqueamento recebida e escolhe o melhor.
 *
 * É o objeto "central" que os decoradores (cache, auditoria, compressão)
 * envolvem. Nenhuma preocupação transversal vive aqui: quem quiser somar
 * comportamento ao redor da recomendação o faz com um decorador, sem
 * alterar esta classe.
 */
export class RecomendadorBase implements RecomendacaoStrategy {
  constructor(protected readonly estrategia: EstrategiaRecomendacao) {}

  recomendar(projeto: Projeto, profissionais: Profissional[]): Map<string, Profissional> {
    const equipe = new Map<string, Profissional>();

    for (const papelRequerido of projeto.papeisRequeridos) {
      const candidatos = profissionais.filter((p) => p.especialidadePrincipal === papelRequerido.papel);
      const ranqueados = this.estrategia.ranquear(projeto, papelRequerido.papel, candidatos);
      if (ranqueados.length > 0) {
        equipe.set(papelRequerido.papel, ranqueados[0].profissional);
      }
    }

    return equipe;
  }
}
