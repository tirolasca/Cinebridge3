import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { PapelTecnico, StatusConvite } from './types';

/**
 * Convite enviado a um profissional para ocupar um papel em um projeto.
 * A mudança de status dispara o fluxo Observer que atualiza a composição da equipe.
 */
@Entity('convites')
export class Convite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  projetoId!: string;

  @Column({ type: 'varchar', length: 100 })
  profissionalId!: string;

  @Column({ type: 'enum', enum: PapelTecnico })
  papel!: PapelTecnico;

  @Column({ type: 'enum', enum: StatusConvite, default: StatusConvite.PENDENTE })
  status!: StatusConvite;

  @CreateDateColumn()
  criadoEm!: Date;

  @UpdateDateColumn()
  atualizadoEm!: Date;

  constructor(parcial?: Partial<Convite>) {
    if (parcial) Object.assign(this, parcial);
    if (!this.status) this.status = StatusConvite.PENDENTE;
  }

  aceitar(): void {
    this.status = StatusConvite.ACEITO;
  }

  recusar(): void {
    this.status = StatusConvite.RECUSADO;
  }
}
