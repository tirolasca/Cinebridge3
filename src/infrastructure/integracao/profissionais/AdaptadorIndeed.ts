import {
  AdaptadorProfissional,
  AvaliacaoDeProfissional,
  CriteriosProfissional,
  exigirAvaliacaoValida,
  filtrarPorCriterios
} from '../../../application/ports/AdaptadorProfissional';
import { ErroDeIntegracao, ProfissionalNaoEncontradoError } from '../../../application/ports/ErrosDeIntegracao';
import { Avaliacao } from '../../../domain/entities/Avaliacao';
import { Competencia } from '../../../domain/entities/Competencia';
import { Profissional } from '../../../domain/entities/Profissional';
import { ApiProfissionalExterna, ErroApiProfissional, PerfilPortal } from './ApiProfissionalExterna';
import { CARGO_PARA_PAPEL, CATEGORIA_POR_PAPEL, HABILIDADE_PORTAL, normalizarHabilidade } from './mapeamentos';

const PREFIXO = 'indeed:';
const NIVEL_PADRAO_DA_HABILIDADE = 0.7; // o portal lista habilidades sem indicar o nível

/**
 * Adapter: traduz o contrato padronizado de cadastro de profissionais para um
 * portal de empregos, cuja API é síncrona e cujos perfis trazem cargo por
 * código, habilidades em texto livre e notas soltas.
 */
export class AdaptadorIndeed implements AdaptadorProfissional {
  readonly provedor = 'indeed';

  constructor(private readonly api: ApiProfissionalExterna) {}

  async listarProfissionais(criterios: CriteriosProfissional): Promise<Profissional[]> {
    try {
      const perfis = this.api.buscarProfissionais({
        categoria: criterios.papel ? CATEGORIA_POR_PAPEL[criterios.papel] : undefined,
        cidade: criterios.cidade
      });
      const profissionais = perfis.filter((perfil) => perfil.cargo in CARGO_PARA_PAPEL).map((perfil) => this.traduzir(perfil));
      return filtrarPorCriterios(profissionais, criterios);
    } catch (erro) {
      throw new ErroDeIntegracao(this.provedor, 'Falha ao buscar profissionais.', erro);
    }
  }

  async detalharProfissional(id: string): Promise<Profissional> {
    const perfil = this.executar(() => this.api.obterPerfil(this.idDoPortal(id)), id, 'detalhar o profissional');
    if (!(perfil.cargo in CARGO_PARA_PAPEL)) {
      throw new ErroDeIntegracao(this.provedor, `Cargo sem correspondência na plataforma: "${perfil.cargo}".`);
    }
    return this.traduzir(perfil);
  }

  async registrarAvaliacao(id: string, avaliacao: AvaliacaoDeProfissional): Promise<void> {
    exigirAvaliacaoValida(avaliacao);
    this.executar(() => this.api.avaliarProfissional(this.idDoPortal(id), avaliacao.nota), id, 'registrar a avaliação');
  }

  private idDoPortal(id: string): string {
    if (!id.startsWith(PREFIXO)) throw new ProfissionalNaoEncontradoError(`Profissional não encontrado: ${id}`);
    return id.slice(PREFIXO.length);
  }

  private executar<T>(acao: () => T, id: string, descricao: string): T {
    try {
      return acao();
    } catch (erro) {
      if (erro instanceof ProfissionalNaoEncontradoError) throw erro;
      if (erro instanceof ErroApiProfissional && erro.codigo === 'PERFIL_INEXISTENTE') {
        throw new ProfissionalNaoEncontradoError(`Profissional não encontrado: ${id}`);
      }
      throw new ErroDeIntegracao(this.provedor, `Falha ao ${descricao}.`, erro);
    }
  }

  private traduzir(perfil: PerfilPortal): Profissional {
    return new Profissional({
      id: `${PREFIXO}${perfil.id}`,
      nome: perfil.nomeCompleto,
      especialidadePrincipal: CARGO_PARA_PAPEL[perfil.cargo],
      faixaDePreco: { minimo: perfil.pretensaoSalarial.de, maximo: perfil.pretensaoSalarial.ate },
      disponibilidade: [{ inicio: new Date(perfil.disponivelDe), fim: new Date(perfil.disponivelAte) }],
      localizacao: { latitude: perfil.coordenadas.lat, longitude: perfil.coordenadas.lon, cidade: perfil.cidade },
      historicoProjetos: [...perfil.projetosAnteriores],
      competencias: perfil.habilidades.map(
        (habilidade) => new Competencia(HABILIDADE_PORTAL[habilidade] ?? normalizarHabilidade(habilidade), NIVEL_PADRAO_DA_HABILIDADE)
      ),
      avaliacoes: perfil.notas.map((nota, indice) => new Avaliacao(nota, perfil.projetosAnteriores[indice] ?? 'portal-sem-projeto'))
    });
  }
}
