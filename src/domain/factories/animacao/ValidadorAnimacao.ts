import { VisitanteProjeto } from '../TiposDeFabrica';
import { Projeto } from '../../entities/Projeto';
import { Profissional } from '../../entities/Profissional';
import { ProjetoAnimacao } from '../../entities/ProjetoAnimacao';
import { PapelTecnico } from '../../entities/types';

/**
 * Validador concreto da família "animação": exige técnica de animação e
 * software principal definidos, e, para o papel de especialista em VFX,
 * exige competência registrada em modelagem 3D ou motion graphics — regra
 * própria deste gênero, onde a renderização é um gargalo técnico crítico.
 */
export class ValidadorAnimacao implements VisitanteProjeto {
  visitarProjeto(projeto: Projeto): boolean {
    if (!(projeto instanceof ProjetoAnimacao)) return false;
    const temTecnica = Boolean(projeto.tecnicaAnimacao && projeto.tecnicaAnimacao.trim().length > 0);
    const temSoftware = Boolean(projeto.softwarePrincipal && projeto.softwarePrincipal.trim().length > 0);
    return temTecnica && temSoftware;
  }

  visitarProfissional(profissional: Profissional): boolean {
    if (profissional.especialidadePrincipal === PapelTecnico.ESPECIALISTA_VFX) {
      return profissional.competenciasSeguras.some(
        (c) => c.nome === 'modelagem_3d' || c.nome === 'motion_graphics'
      );
    }
    return true;
  }
}
