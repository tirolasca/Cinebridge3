export enum TipoCaptacao {
  DOCUMENTARIO = 'DOCUMENTARIO',
  FICCAO = 'FICCAO',
  ANIMACAO = 'ANIMACAO'
}

export enum TipoProjeto {
  DOCUMENTARIO = 'DOCUMENTARIO',
  ANIMACAO = 'ANIMACAO',
  PUBLICITARIO = 'PUBLICITARIO'
}

export enum PapelTecnico {
  DIRETOR = 'DIRETOR',
  DIRETOR_FOTOGRAFIA = 'DIRETOR_FOTOGRAFIA',
  SONOPLASTA = 'SONOPLASTA',
  EDITOR = 'EDITOR',
  ROTEIRISTA = 'ROTEIRISTA',
  ESPECIALISTA_VFX = 'ESPECIALISTA_VFX'
}

export enum StatusConvite {
  PENDENTE = 'PENDENTE',
  ACEITO = 'ACEITO',
  RECUSADO = 'RECUSADO'
}

export interface Localizacao {
  readonly latitude: number;
  readonly longitude: number;
  readonly cidade: string;
}

export interface PapelRequerido {
  readonly papel: PapelTecnico;
  readonly pesoImportancia: number; // 0..1, soma dos pesos deve ser considerada pelo motor
}

export interface FaixaDePreco {
  readonly minimo: number;
  readonly maximo: number;
}

export interface Disponibilidade {
  readonly inicio: Date;
  readonly fim: Date;
}
