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
import { ErroLinkedIn, LinkedInSimulado, PerfilLinkedIn } from './LinkedInSimulado';
import { HABILIDADE_LINKEDIN, HEADLINE_PARA_PAPEL, PALAVRA_CHAVE_POR_PAPEL, normalizarHabilidade } from './mapeamentos';

const PREFIXO = 'linkedin:';
const ENDOSSOS_PARA_NIVEL_MAXIMO = 20;

/**
 * Adapter: traduz o contrato padronizado de cadastro de profissionais para
 * uma rede social profissional. Converte perfis (`headline`, `skills` com
 * endossos, `rateCardBRL`, recomendações em estrelas) em entidades
 * `Profissional` do domínio.
 */
export class AdaptadorLinkedIn implements AdaptadorProfissional {
  readonly provedor = 'linkedin';

  constructor(private readonly cliente: LinkedInSimulado) {}

  async listarProfissionais(criterios: CriteriosProfissional): Promise<Profissional[]> {
    try {
      const { elements } = await this.cliente.searchPeople({
        keywords: criterios.papel ? PALAVRA_CHAVE_POR_PAPEL[criterios.papel] : undefined,
        location: criterios.cidade
      });
      const profissionais = elements.filter((perfil) => perfil.headline in HEADLINE_PARA_PAPEL).map((perfil) => this.traduzir(perfil));
      return filtrarPorCriterios(profissionais, criterios);
    } catch (erro) {
      throw new ErroDeIntegracao(this.provedor, 'Falha ao buscar profissionais.', erro);
    }
  }

  async detalharProfissional(id: string): Promise<Profissional> {
    const urn = this.urnDe(id);
    try {
      const perfil = await this.cliente.getProfile(urn);
      if (!(perfil.headline in HEADLINE_PARA_PAPEL)) {
        throw new ErroDeIntegracao(this.provedor, `Cargo sem correspondência na plataforma: "${perfil.headline}".`);
      }
      return this.traduzir(perfil);
    } catch (erro) {
      if (erro instanceof ErroLinkedIn && erro.status === 404) throw new ProfissionalNaoEncontradoError(`Profissional não encontrado: ${id}`);
      if (erro instanceof ErroDeIntegracao) throw erro;
      throw new ErroDeIntegracao(this.provedor, 'Falha ao detalhar o profissional.', erro);
    }
  }

  async registrarAvaliacao(id: string, avaliacao: AvaliacaoDeProfissional): Promise<void> {
    exigirAvaliacaoValida(avaliacao);
    const urn = this.urnDe(id);
    try {
      // O LinkedIn recomenda de 1 a 5 estrelas, em números inteiros.
      const rating = Math.min(5, Math.max(1, Math.round(avaliacao.nota)));
      await this.cliente.createRecommendation(urn, { rating, projectId: avaliacao.projetoId, text: avaliacao.comentario ?? '' });
    } catch (erro) {
      if (erro instanceof ErroLinkedIn && erro.status === 404) throw new ProfissionalNaoEncontradoError(`Profissional não encontrado: ${id}`);
      throw new ErroDeIntegracao(this.provedor, 'Falha ao registrar a avaliação.', erro);
    }
  }

  private urnDe(id: string): string {
    if (!id.startsWith(PREFIXO)) throw new ProfissionalNaoEncontradoError(`Profissional não encontrado: ${id}`);
    return id.slice(PREFIXO.length);
  }

  private traduzir(perfil: PerfilLinkedIn): Profissional {
    return new Profissional({
      id: `${PREFIXO}${perfil.urn}`,
      nome: `${perfil.firstName} ${perfil.lastName}`,
      especialidadePrincipal: HEADLINE_PARA_PAPEL[perfil.headline],
      faixaDePreco: { minimo: perfil.rateCardBRL.min, maximo: perfil.rateCardBRL.max },
      disponibilidade: perfil.availability.map((janela) => ({ inicio: new Date(janela.from), fim: new Date(janela.to) })),
      localizacao: { latitude: perfil.location.lat, longitude: perfil.location.lng, cidade: perfil.location.city },
      historicoProjetos: [...perfil.pastProjects],
      competencias: perfil.skills.map(
        (skill) =>
          new Competencia(
            HABILIDADE_LINKEDIN[skill.name] ?? normalizarHabilidade(skill.name),
            Math.min(1, skill.endorsementCount / ENDOSSOS_PARA_NIVEL_MAXIMO)
          )
      ),
      avaliacoes: perfil.recommendations.map((r) => new Avaliacao(r.stars, r.projectId, r.text))
    });
  }
}
