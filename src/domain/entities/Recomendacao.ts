import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { PapelTecnico } from './types';

/** Um item individual de recomendação: um profissional sugerido para um papel. */
export interface ItemRecomendacao {
  readonly papel: PapelTecnico;
  readonly profissionalId: string;
  readonly pontuacao: number; // 0..1, calculada pela estratégia aplicada
  readonly justificativa: string;
}

/**
 * Resultado consolidado de uma rodada de recomendação para um projeto:
 * uma sugestão de equipe completa (ou parcial, em caso de fallback).
 */
@Entity('recomendacoes')
export class Recomendacao {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  projetoId!: string;

  @Column({ type: 'varchar', length: 50 })
  estrategiaUtilizada!: string;

  @Column({ type: 'simple-json' })
  itens!: ItemRecomendacao[];

  @Column({ type: 'boolean', default: false })
  parcial!: boolean; // true quando gerada em modo fallback (fonte de dados indisponível)

  @CreateDateColumn()
  geradaEm!: Date;

  constructor(parcial?: Partial<Recomendacao>) {
    if (parcial) Object.assign(this, parcial);
    if (!this.itens) this.itens = [];
  }
}
