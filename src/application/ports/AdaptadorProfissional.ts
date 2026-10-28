import { Profissional } from '../../domain/entities/Profissional';
import { PapelTecnico } from '../../domain/entities/types';
import { AvaliacaoInvalidaError } from './ErrosDeIntegracao';

export interface CriteriosProfissional {
  papel?: PapelTecnico;
  cidade?: string;
  /** Preço mínimo cobrado pelo profissional não pode passar deste valor. */
  precoMaximo?: number;
}

export interface AvaliacaoDeProfissional {
  /** De 0 a 5. */
  nota: number;
  projetoId: string;
  comentario?: string;
}

/**
 * Adapter (alvo): contrato padronizado de acesso a cadastros de
 * profissionais — a base interna, redes sociais profissionais, portais de
 * emprego. Todos devolvem entidades `Profissional` do próprio domínio, com os
 * dados já traduzidos do formato de cada origem.
 */
export interface AdaptadorProfissional {
  /** Nome do provedor em uso (para diagnóstico). */
  readonly provedor: string;
  listarProfissionais(criterios: CriteriosProfissional): Promise<Profissional[]>;
  /** Lança `ProfissionalNaoEncontradoError` se o id não existir neste provedor. */
  detalharProfissional(id: string): Promise<Profissional>;
  registrarAvaliacao(id: string, avaliacao: AvaliacaoDeProfissional): Promise<void>;
}

export function exigirAvaliacaoValida(avaliacao: AvaliacaoDeProfissional): void {
  if (!Number.isFinite(avaliacao.nota) || avaliacao.nota < 0 || avaliacao.nota > 5) {
    throw new AvaliacaoInvalidaError('A nota da avaliação deve estar entre 0 e 5.');
  }
}

/** Aplica os critérios que a origem externa não sabe filtrar sozinha. */
export function filtrarPorCriterios(profissionais: Profissional[], criterios: CriteriosProfissional): Profissional[] {
  return profissionais.filter((p) => {
    if (criterios.papel && p.especialidadePrincipal !== criterios.papel) return false;
    if (criterios.cidade && p.localizacao.cidade.toLowerCase() !== criterios.cidade.toLowerCase()) return false;
    if (criterios.precoMaximo !== undefined && p.faixaDePreco.minimo > criterios.precoMaximo) return false;
    return true;
  });
}
