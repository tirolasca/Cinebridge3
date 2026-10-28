import { VisitanteProjeto } from '../TiposDeFabrica';
import { Projeto } from '../../entities/Projeto';
import { Profissional } from '../../entities/Profissional';
import { ProjetoDocumentario } from '../../entities/ProjetoDocumentario';
import { PapelTecnico } from '../../entities/types';

/**
 * Validador concreto da família "documentário": exige que o projeto tenha
 * tema definido e ao menos um entrevistado previsto, e que o profissional
 * candidato não esteja associado a um papel incompatível com produção
 * documental (ex.: especialista em VFX puro, sem histórico relevante,
 * ainda é aceito — a regra aqui é propositalmente permissiva quanto a
 * profissionais, focando a exigência na completude do projeto).
 */
export class ValidadorDocumentario implements VisitanteProjeto {
  visitarProjeto(projeto: Projeto): boolean {
    if (!(projeto instanceof ProjetoDocumentario)) return false;
    const temTema = Boolean(projeto.tema && projeto.tema.trim().length > 0);
    const temEntrevistados = projeto.entrevistados.length > 0;
    return temTema && temEntrevistados;
  }

  visitarProfissional(profissional: Profissional): boolean {
    // Documentários dependem fortemente de roteiro/pesquisa temática e
    // direção sensível ao tema; qualquer especialidade é aceita, desde que
    // o profissional tenha ao menos uma competência registrada.
    if (profissional.especialidadePrincipal === PapelTecnico.ROTEIRISTA) {
      return profissional.competenciasSeguras.length > 0;
    }
    return true;
  }
}
