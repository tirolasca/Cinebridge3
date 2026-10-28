import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index
} from 'typeorm';
import { Competencia } from './Competencia';
import { Avaliacao } from './Avaliacao';
import { PapelTecnico, FaixaDePreco, Disponibilidade, Localizacao } from './types';

/**
 * Profissional cadastrado na plataforma cinebridge, candidato a compor
 * equipes de produção audiovisual.
 */
@Entity('profissionais')
export class Profissional {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 150 })
  nome!: string;

  @Index()
  @Column({ type: 'enum', enum: PapelTecnico })
  especialidadePrincipal!: PapelTecnico;

  @Column({ type: 'simple-json' })
  faixaDePreco!: FaixaDePreco;

  @Column({ type: 'simple-json' })
  disponibilidade!: Disponibilidade[];

  @Column({ type: 'simple-json' })
  localizacao!: Localizacao;

  @Column({ type: 'simple-array', default: '' })
  historicoProjetos!: string[]; // IDs de projetos anteriores

  @OneToMany(() => Competencia, (competencia) => competencia.profissional, {
    cascade: true,
    eager: true
  })
  competencias!: Competencia[];

  @OneToMany(() => Avaliacao, (avaliacao) => avaliacao.profissional, {
    cascade: true,
    eager: true
  })
  avaliacoes!: Avaliacao[];

  constructor(parcial?: Partial<Profissional>) {
    if (parcial) Object.assign(this, parcial);
  }

  /**
   * Acesso seguro à lista de competências: o TypeORM não permite
   * inicializar arrays de relação diretamente na classe/construtor, então
   * a propriedade pode chegar `undefined` em instâncias montadas fora do
   * ORM (ex.: `new Profissional({...})` sem o campo). Este getter garante
   * um array vazio nesses casos, sem exigir null-checks espalhados pelo domínio.
   */
  get competenciasSeguras(): Competencia[] {
    return this.competencias ?? [];
  }

  get avaliacoesSeguras(): Avaliacao[] {
    return this.avaliacoes ?? [];
  }

  get historicoProjetosSeguro(): string[] {
    return this.historicoProjetos ?? [];
  }

  /** Nota média das avaliações recebidas; 0 se não houver histórico. */
  notaMedia(): number {
    const avaliacoes = this.avaliacoesSeguras;
    if (avaliacoes.length === 0) return 0;
    const soma = avaliacoes.reduce((acc, a) => acc + a.nota, 0);
    return soma / avaliacoes.length;
  }

  /** Verifica se o profissional está disponível no período informado. */
  estaDisponivelEm(inicio: Date, fim: Date): boolean {
    return (this.disponibilidade ?? []).some((janela) => {
      const janelaInicio = new Date(janela.inicio);
      const janelaFim = new Date(janela.fim);
      return janelaInicio <= inicio && janelaFim >= fim;
    });
  }

  /** Verifica se o preço do profissional cabe dentro de um orçamento máximo para o papel. */
  cabeNoOrcamento(orcamentoMaximoParaPapel: number): boolean {
    return this.faixaDePreco.minimo <= orcamentoMaximoParaPapel;
  }
}
