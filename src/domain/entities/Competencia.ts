import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index } from 'typeorm';
import { Profissional } from './Profissional';

/**
 * Representa um componente do vetor de competências técnicas de um profissional.
 * O conjunto de Competencia de um Profissional forma o "vetor de competências"
 * usado pelas estratégias de similaridade.
 */
@Entity('competencias')
export class Competencia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  nome!: string; // ex: "edicao_avancada", "iluminacao_natural", "roteiro_documental"

  @Column({ type: 'float' })
  nivel!: number; // 0..1, intensidade da competência

  @ManyToOne(() => Profissional, (profissional) => profissional.competencias, {
    onDelete: 'CASCADE'
  })
  profissional!: Profissional;

  constructor(nome?: string, nivel?: number) {
    if (nome !== undefined) this.nome = nome;
    if (nivel !== undefined) this.nivel = nivel;
  }
}
