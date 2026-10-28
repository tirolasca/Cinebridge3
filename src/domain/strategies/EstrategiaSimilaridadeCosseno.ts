import { EstrategiaRecomendacao, CandidatoPontuado } from './EstrategiaRecomendacao';
import { Profissional } from '../entities/Profissional';
import { Projeto } from '../entities/Projeto';
import { PapelTecnico } from '../entities/types';

/**
 * Estratégia concreta (Strategy): ranqueia profissionais pela similaridade
 * de cosseno entre o vetor de competências do profissional e um vetor de
 * competências "ideal" inferido a partir do gênero/tipo de captação do projeto.
 *
 * Esta é a estratégia padrão para projetos com requisitos técnicos bem definidos.
 */
export class EstrategiaSimilaridadeCosseno implements EstrategiaRecomendacao {
  readonly nome = 'similaridade_cosseno';

  /**
   * Mapa de competências esperadas por papel, usado para construir o vetor
   * ideal contra o qual cada profissional é comparado. Em produção, isso
   * poderia vir de um serviço de configuração; aqui é fixo para viabilizar
   * testes determinísticos.
   */
  private readonly competenciasEsperadasPorPapel: Record<string, string[]> = {
    [PapelTecnico.DIRETOR]: ['direcao_atores', 'visao_narrativa', 'lideranca_equipe'],
    [PapelTecnico.DIRETOR_FOTOGRAFIA]: ['iluminacao_natural', 'composicao_imagem', 'operacao_camera'],
    [PapelTecnico.SONOPLASTA]: ['captacao_som_direto', 'mixagem_audio', 'design_sonoro'],
    [PapelTecnico.EDITOR]: ['edicao_avancada', 'ritmo_narrativo', 'color_grading'],
    [PapelTecnico.ROTEIRISTA]: ['estrutura_narrativa', 'dialogo', 'pesquisa_tematica'],
    [PapelTecnico.ESPECIALISTA_VFX]: ['composicao_digital', 'modelagem_3d', 'motion_graphics']
  };

  ranquear(_projeto: Projeto, papel: PapelTecnico, candidatos: Profissional[]): CandidatoPontuado[] {
    const competenciasIdeais = this.competenciasEsperadasPorPapel[papel] ?? [];

    const pontuados = candidatos.map((profissional) => {
      const similaridade = this.calcularSimilaridadeCosseno(profissional, competenciasIdeais);
      return {
        profissional,
        pontuacao: similaridade,
        justificativa: `Similaridade de ${(similaridade * 100).toFixed(1)}% com o vetor de competências esperado para ${papel}`
      };
    });

    return pontuados.sort((a, b) => b.pontuacao - a.pontuacao);
  }

  private calcularSimilaridadeCosseno(profissional: Profissional, competenciasIdeais: string[]): number {
    if (competenciasIdeais.length === 0 || profissional.competenciasSeguras.length === 0) {
      return 0;
    }

    // Vetor ideal: 1.0 para cada competência esperada
    const vetorIdeal = competenciasIdeais.map(() => 1);

    // Vetor do profissional: nível da competência se ele a possui, 0 caso contrário
    const vetorProfissional = competenciasIdeais.map((nomeCompetencia) => {
      const competencia = profissional.competenciasSeguras.find((c) => c.nome === nomeCompetencia);
      return competencia ? competencia.nivel : 0;
    });

    const produtoEscalar = vetorIdeal.reduce((acc, val, i) => acc + val * vetorProfissional[i], 0);
    const normaIdeal = Math.sqrt(vetorIdeal.reduce((acc, val) => acc + val * val, 0));
    const normaProfissional = Math.sqrt(vetorProfissional.reduce((acc, val) => acc + val * val, 0));

    if (normaIdeal === 0 || normaProfissional === 0) return 0;

    return produtoEscalar / (normaIdeal * normaProfissional);
  }
}
