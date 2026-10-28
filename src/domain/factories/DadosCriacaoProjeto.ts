import { Projeto, DadosProjeto } from '../entities/Projeto';

/**
 * Campos específicos de cada tipo de projeto. Todos opcionais: cada fábrica
 * concreta lê apenas os campos que pertencem ao seu tipo e ignora os demais,
 * de modo que quem solicita a criação (ex.: a camada HTTP) não precisa
 * conhecer a quais tipos cada campo se aplica.
 */
export interface DadosEspecificosProjeto {
  // Documentário
  tema?: string;
  entrevistados?: string[];
  // Animação
  tecnicaAnimacao?: string;
  softwarePrincipal?: string;
  // Publicitário
  marcaAnunciante?: string;
  dataVeiculacao?: Date;
}

/** Dados aceitos por `FabricaProjeto.criarProjeto`: campos comuns + campos específicos. */
export type DadosCriacaoProjeto = DadosProjeto<Projeto> & DadosEspecificosProjeto;

const CAMPOS_ESPECIFICOS: ReadonlyArray<keyof DadosEspecificosProjeto> = [
  'tema',
  'entrevistados',
  'tecnicaAnimacao',
  'softwarePrincipal',
  'marcaAnunciante',
  'dataVeiculacao'
];

/**
 * Remove os campos específicos de tipo, devolvendo apenas os campos comuns a
 * todos os projetos. Usado pelas fábricas para que um projeto nunca receba
 * atributos de outro tipo.
 */
export function extrairDadosBase(dados: DadosCriacaoProjeto): DadosProjeto<Projeto> {
  const base: Record<string, unknown> = { ...dados };
  for (const campo of CAMPOS_ESPECIFICOS) {
    delete base[campo];
  }
  return base as DadosProjeto<Projeto>;
}
