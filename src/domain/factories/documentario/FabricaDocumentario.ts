import { FabricaProjeto } from '../FabricaProjeto';
import { VisitanteProjeto, RecomendacaoStrategy, Observador } from '../TiposDeFabrica';
import { Projeto } from '../../entities/Projeto';
import { DadosCriacaoProjeto, extrairDadosBase } from '../DadosCriacaoProjeto';
import { ProjetoDocumentario } from '../../entities/ProjetoDocumentario';
import { ValidadorDocumentario } from './ValidadorDocumentario';
import { RecomendadorDocumentario } from './RecomendadorDocumentario';
import { NotificadorDocumentario } from './NotificadorDocumentario';

/**
 * Fábrica concreta (Abstract Factory) para a família de objetos do tipo
 * documentário: garante que o projeto, o validador, o recomendador e o
 * notificador criados sejam sempre coerentes entre si para este gênero.
 */
export class FabricaDocumentario implements FabricaProjeto {
  criarProjeto(dados: DadosCriacaoProjeto): Projeto {
    return new ProjetoDocumentario({
      ...extrairDadosBase(dados),
      tema: dados.tema,
      entrevistados: dados.entrevistados
    });
  }

  criarValidador(): VisitanteProjeto {
    return new ValidadorDocumentario();
  }

  criarRecomendador(): RecomendacaoStrategy {
    return new RecomendadorDocumentario();
  }

  criarNotificador(): Observador {
    return new NotificadorDocumentario();
  }
}
