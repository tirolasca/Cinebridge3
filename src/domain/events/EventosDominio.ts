import { Recomendacao } from '../entities/Recomendacao';
import { Convite } from '../entities/Convite';
import { PapelTecnico } from '../entities/types';

/** Nomes dos eventos emitidos pelo sujeito (Subject) do padrão Observer. */
export enum NomeEvento {
  RECOMENDACAO_GERADA = 'RECOMENDACAO_GERADA',
  CONVITE_ACEITO = 'CONVITE_ACEITO',
  CONVITE_RECUSADO = 'CONVITE_RECUSADO',
  EQUIPE_FORMADA = 'EQUIPE_FORMADA'
}

export interface EventoRecomendacaoGerada {
  readonly tipo: NomeEvento.RECOMENDACAO_GERADA;
  readonly recomendacao: Recomendacao;
}

export interface EventoConviteAceito {
  readonly tipo: NomeEvento.CONVITE_ACEITO;
  readonly convite: Convite;
}

export interface EventoConviteRecusado {
  readonly tipo: NomeEvento.CONVITE_RECUSADO;
  readonly convite: Convite;
  readonly papelParaNovaRecomendacao: PapelTecnico;
}

export interface EventoEquipeFormada {
  readonly tipo: NomeEvento.EQUIPE_FORMADA;
  readonly projetoId: string;
  readonly composicaoFinal: ReadonlyArray<{ papel: PapelTecnico; profissionalId: string }>;
}

export type EventoDominio =
  | EventoRecomendacaoGerada
  | EventoConviteAceito
  | EventoConviteRecusado
  | EventoEquipeFormada;
