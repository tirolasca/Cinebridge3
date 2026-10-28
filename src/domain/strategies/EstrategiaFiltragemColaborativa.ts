import { EstrategiaRecomendacao, CandidatoPontuado } from './EstrategiaRecomendacao';
import { Profissional } from '../entities/Profissional';
import { Projeto } from '../entities/Projeto';
import { PapelTecnico } from '../entities/types';

/**
 * Estratégia concreta (Strategy): ranqueia profissionais com base no histórico
 * de avaliações recebidas em projetos anteriores (filtragem colaborativa
 * simplificada por nota média + volume de experiência no papel).
 *
 * Adequada quando o histórico de avaliações é o sinal mais confiável disponível,
 * por exemplo em papéis onde a qualidade é difícil de medir por competências
 * declaradas (ex: liderança de equipe, trato com elenco).
 */
export class EstrategiaFiltragemColaborativa implements EstrategiaRecomendacao {
  readonly nome = 'filtragem_colaborativa';

  private readonly pesoNotaMedia = 0.7;
  private readonly pesoVolumeExperiencia = 0.3;
  private readonly experienciaMaximaConsiderada = 10; // projetos

  ranquear(_projeto: Projeto, papel: PapelTecnico, candidatos: Profissional[]): CandidatoPontuado[] {
    const relevantes = candidatos.filter(
      (c) => c.especialidadePrincipal === papel || c.avaliacoesSeguras.length > 0
    );

    const pontuados = relevantes.map((profissional) => {
      const notaNormalizada = profissional.notaMedia() / 5; // nota é 0..5
      const volumeNormalizado = Math.min(
        profissional.historicoProjetosSeguro.length / this.experienciaMaximaConsiderada,
        1
      );

      const pontuacao = notaNormalizada * this.pesoNotaMedia + volumeNormalizado * this.pesoVolumeExperiencia;

      return {
        profissional,
        pontuacao,
        justificativa: `Nota média ${profissional.notaMedia().toFixed(1)}/5 em ${profissional.historicoProjetosSeguro.length} projeto(s) anterior(es)`
      };
    });

    return pontuados.sort((a, b) => b.pontuacao - a.pontuacao);
  }
}
