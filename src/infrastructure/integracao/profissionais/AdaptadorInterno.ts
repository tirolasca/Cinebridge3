import {
  AdaptadorProfissional,
  AvaliacaoDeProfissional,
  CriteriosProfissional,
  exigirAvaliacaoValida,
  filtrarPorCriterios
} from '../../../application/ports/AdaptadorProfissional';
import { ProfissionalNaoEncontradoError } from '../../../application/ports/ErrosDeIntegracao';
import { RepositorioProfissionaisCompleto } from '../../../application/services/RepositorioProfissionais';
import { Profissional } from '../../../domain/entities/Profissional';
import { PapelTecnico } from '../../../domain/entities/types';

/**
 * Adapter: expõe o cadastro interno de profissionais (o repositório) pelo
 * mesmo contrato dos cadastros externos — assim o sistema de recomendação
 * não distingue entre a base própria e uma rede profissional.
 */
export class AdaptadorInterno implements AdaptadorProfissional {
  readonly provedor = 'interno';

  constructor(private readonly repositorio: RepositorioProfissionaisCompleto) {}

  async listarProfissionais(criterios: CriteriosProfissional): Promise<Profissional[]> {
    const papeis = criterios.papel ? [criterios.papel] : Object.values(PapelTecnico);
    const porPapel = await Promise.all(papeis.map((papel) => this.repositorio.buscarPorPapel(papel)));
    return filtrarPorCriterios(porPapel.flat(), criterios);
  }

  async detalharProfissional(id: string): Promise<Profissional> {
    const profissional = await this.repositorio.buscarPorId(id);
    if (!profissional) throw new ProfissionalNaoEncontradoError(`Profissional não encontrado: ${id}`);
    return profissional;
  }

  async registrarAvaliacao(id: string, avaliacao: AvaliacaoDeProfissional): Promise<void> {
    exigirAvaliacaoValida(avaliacao);
    const registrada = await this.repositorio.registrarAvaliacao(id, avaliacao);
    if (!registrada) throw new ProfissionalNaoEncontradoError(`Profissional não encontrado: ${id}`);
  }
}
