import { VisitanteProjeto } from '../TiposDeFabrica';
import { Projeto } from '../../entities/Projeto';
import { Profissional } from '../../entities/Profissional';
import { ProjetoPublicitario } from '../../entities/ProjetoPublicitario';

/**
 * Validador concreto da família "publicitário": exige marca anunciante e
 * data de veiculação definidas, com a data de veiculação sempre posterior
 * à data de entrega do projeto — regra própria deste gênero, onde o prazo
 * de veiculação é contratualmente crítico.
 */
export class ValidadorPublicitario implements VisitanteProjeto {
  visitarProjeto(projeto: Projeto): boolean {
    if (!(projeto instanceof ProjetoPublicitario)) return false;
    const temMarca = Boolean(projeto.marcaAnunciante && projeto.marcaAnunciante.trim().length > 0);
    const temVeiculacaoValida =
      Boolean(projeto.dataVeiculacao) && projeto.dataVeiculacao.getTime() >= projeto.dataEntrega.getTime();
    return temMarca && temVeiculacaoValida;
  }

  visitarProfissional(profissional: Profissional): boolean {
    // Produções publicitárias dependem de agilidade; qualquer profissional
    // com disponibilidade cadastrada é aceito.
    return profissional.disponibilidade !== undefined;
  }
}
