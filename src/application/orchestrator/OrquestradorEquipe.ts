import { Projeto } from '../../domain/entities/Projeto';
import { Profissional } from '../../domain/entities/Profissional';
import { FabricaProjeto } from '../../domain/factories/FabricaProjeto';

/** Equipe final orquestrada: mapa de papel -> profissional escolhido. */
export type Equipe = Map<string, Profissional>;

/**
 * Template Method que depende exclusivamente da abstração FabricaProjeto
 * (Abstract Factory) — nunca de uma fábrica concreta ou de condicionais
 * baseados em tipo de projeto — para obter o validador e o recomendador
 * corretos durante a orquestração. É esta dependência que permite trocar a
 * família de objetos inteira (documentário, animação, publicitário, ou um
 * novo tipo futuro) sem alterar uma linha sequer desta classe.
 *
 * Mantém o mesmo espírito de Template Method do OrquestradorComposicaoEquipe
 * já existente (que opera papel a papel com EstrategiaRecomendacao), mas
 * atuando um nível acima: orquestra a família completa de objetos de uma
 * fábrica concreta para produzir a equipe final de uma só vez.
 */
export abstract class OrquestradorEquipe {
  constructor(protected readonly fabrica: FabricaProjeto) {}

  /**
   * Método template: define a sequência fixa de etapas da orquestração —
   * validar o projeto, normalizar os profissionais candidatos, obter a
   * equipe recomendada pela fábrica e pós-processar o resultado. As
   * subclasses não podem alterar esta sequência, apenas os hooks abaixo.
   */
  orquestrar(projeto: Projeto, profissionaisCandidatos: Profissional[]): Equipe {
    if (!this.validarRestricoes(projeto)) {
      throw new Error(
        `Projeto "${projeto.titulo}" não atende às restrições de validação da família "${projeto.tipoProjeto}".`
      );
    }

    const profissionaisNormalizados = this.normalizarDados(projeto, profissionaisCandidatos);

    const recomendador = this.fabrica.criarRecomendador();
    const equipeRecomendada = recomendador.recomendar(projeto, profissionaisNormalizados);

    return this.posProcessar(equipeRecomendada, projeto);
  }

  /**
   * Hook: valida o projeto e seus profissionais candidatos usando o
   * validador obtido da fábrica (Abstract Factory). Implementação padrão
   * disponível em OrquestradorPadraoDeFabrica; subclasses podem especializar.
   */
  protected abstract validarRestricoes(projeto: Projeto): boolean;

  /**
   * Hook: filtra/normaliza os profissionais candidatos antes de delegá-los
   * ao recomendador da fábrica, tipicamente usando o validador para
   * descartar candidatos inadequados à família de objetos em uso.
   */
  protected abstract normalizarDados(projeto: Projeto, profissionais: Profissional[]): Profissional[];

  /** Hook: aplica transformações finais sobre a equipe recomendada. */
  protected abstract posProcessar(equipe: Equipe, projeto: Projeto): Equipe;
}
