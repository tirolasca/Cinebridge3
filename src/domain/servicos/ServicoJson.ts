import { PapelRequerido, PapelTecnico } from '../entities/types';
import { PacoteServico } from './PacoteServico';
import { ServicoAtomico } from './ServicoAtomico';
import { ModoExecucao, ServicoProjeto } from './ServicoProjeto';

export interface ServicoAtomicoJson {
  tipo: 'ATOMICO';
  nome: string;
  papel: PapelTecnico;
  custo: number;
  prazoDias: number;
}

export interface PacoteServicoJson {
  tipo: 'PACOTE';
  nome: string;
  modoExecucao?: ModoExecucao;
  servicos: ServicoJson[];
}

export type ServicoJson = ServicoAtomicoJson | PacoteServicoJson;

/** Erro de estrutura ao montar uma hierarquia de serviços a partir de dados externos. */
export class ServicoInvalidoError extends Error {}

const PROFUNDIDADE_MAXIMA = 20;

export function serializarServico(servico: ServicoProjeto): ServicoJson {
  if (servico instanceof ServicoAtomico) {
    return {
      tipo: 'ATOMICO',
      nome: servico.nome,
      papel: servico.papel,
      custo: servico.custo,
      prazoDias: servico.prazoDias
    };
  }
  if (servico instanceof PacoteServico) {
    return {
      tipo: 'PACOTE',
      nome: servico.nome,
      modoExecucao: servico.modoExecucao,
      servicos: servico.listarSubservicos().map(serializarServico)
    };
  }
  throw new ServicoInvalidoError(`Tipo de serviço não suportado: "${servico.constructor.name}".`);
}

/**
 * Monta a hierarquia a partir de dados externos (corpo da API ou coluna do
 * banco). Só verifica a forma dos dados; as regras de negócio (papel válido,
 * custo, prazo) ficam em `validar()`, para que os erros sejam reportados de
 * forma uniforme.
 */
export function desserializarServico(dados: unknown, profundidade = 0): ServicoProjeto {
  if (profundidade > PROFUNDIDADE_MAXIMA) {
    throw new ServicoInvalidoError(`A hierarquia de serviços excede ${PROFUNDIDADE_MAXIMA} níveis.`);
  }
  if (typeof dados !== 'object' || dados === null) {
    throw new ServicoInvalidoError('Serviço inválido: esperado um objeto.');
  }
  const no = dados as Record<string, unknown>;

  if (no.tipo === 'ATOMICO') {
    return new ServicoAtomico(
      String(no.nome ?? ''),
      no.papel as PapelTecnico,
      Number(no.custo),
      Number(no.prazoDias)
    );
  }

  if (no.tipo === 'PACOTE') {
    if (!Array.isArray(no.servicos)) {
      throw new ServicoInvalidoError(`Pacote "${String(no.nome ?? '')}": a lista "servicos" é obrigatória.`);
    }
    const modo = (no.modoExecucao as ModoExecucao | undefined) ?? ModoExecucao.SEQUENCIAL;
    if (!Object.values(ModoExecucao).includes(modo)) {
      throw new ServicoInvalidoError(`Pacote "${String(no.nome ?? '')}": modo de execução inválido ("${String(modo)}").`);
    }
    return new PacoteServico(
      String(no.nome ?? ''),
      modo,
      no.servicos.map((filho) => desserializarServico(filho, profundidade + 1))
    );
  }

  throw new ServicoInvalidoError(`Tipo de serviço desconhecido: "${String(no.tipo)}" (use ATOMICO ou PACOTE).`);
}

/**
 * Converte a lista simples de papéis (formato anterior à hierarquia de
 * serviços) em um pacote de serviços atômicos. O orçamento é repartido entre
 * os papéis na proporção dos pesos; cada serviço dura 1 dia.
 */
export function servicoDePapeis(papeis: PapelRequerido[], orcamentoTotal: number, nome = 'Equipe'): PacoteServico {
  const orcamento = Number.isFinite(orcamentoTotal) && orcamentoTotal > 0 ? orcamentoTotal : 1;
  const somaPesos = papeis.reduce((soma, p) => soma + p.pesoImportancia, 0);

  const servicos = papeis.map((p) => {
    const parte = somaPesos > 0 ? p.pesoImportancia / somaPesos : 1 / papeis.length;
    return new ServicoAtomico(p.papel, p.papel, parte * orcamento, 1);
  });
  return new PacoteServico(nome, ModoExecucao.SEQUENCIAL, servicos);
}

/**
 * Papéis exigidos pela hierarquia, um por papel técnico distinto. O peso de
 * cada papel é a sua fatia do custo planejado (ou uma fatia igual, quando
 * nenhum serviço tem custo).
 */
export function papeisRequeridosDe(servico: ServicoProjeto): PapelRequerido[] {
  const custoPorPapel = new Map<PapelTecnico, number>();
  for (const atomico of servico.listarAtomicos()) {
    custoPorPapel.set(atomico.papel, (custoPorPapel.get(atomico.papel) ?? 0) + atomico.custo);
  }

  const custoTotal = Array.from(custoPorPapel.values()).reduce((soma, custo) => soma + custo, 0);
  return Array.from(custoPorPapel.entries()).map(([papel, custo]) => ({
    papel,
    pesoImportancia: custoTotal > 0 ? custo / custoTotal : 1 / custoPorPapel.size
  }));
}
