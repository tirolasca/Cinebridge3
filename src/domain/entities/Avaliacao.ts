import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Profissional } from './Profissional';

/**
 * Avaliação recebida por um profissional ao final de um projeto anterior.
 * Usada pela estratégia de filtragem colaborativa.
 */
@Entity('avaliacoes')
export class Avaliacao {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'float' })
  nota!: number; // 0..5

  @Column({ type: 'varchar', length: 100 })
  projetoId!: string;

  @Column({ type: 'text', nullable: true })
  comentario!: string | null;

  @ManyToOne(() => Profissional, (profissional) => profissional.avaliacoes, {
    onDelete: 'CASCADE'
  })
  profissional!: Profissional;

  @CreateDateColumn()
  criadaEm!: Date;

  constructor(nota?: number, projetoId?: string, comentario: string | null = null) {
    if (nota !== undefined) this.nota = nota;
    if (projetoId !== undefined) this.projetoId = projetoId;
    this.comentario = comentario;
  }
}
