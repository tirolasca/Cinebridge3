import { Entity, PrimaryGeneratedColumn, Column, TableInheritance } from 'typeorm';
import { TipoCaptacao, PapelRequerido, Localizacao, TipoProjeto } from './types';
import { ServicoProjeto, ResultadoValidacaoServico } from '../servicos/ServicoProjeto';
import { PacoteServico } from '../servicos/PacoteServico';
import {
  ServicoJson,
  desserializarServico,
  papeisRequeridosDe,
  serializarServico,
  servicoDePapeis
} from '../servicos/ServicoJson';

/** Grava a hierarquia de serviços como JSON e a reconstrói ao ler do banco. */
const transformadorDeServico = {
  to: (servico?: ServicoProjeto | null): ServicoJson | null => (servico ? serializarServico(servico) : null),
  from: (dados?: ServicoJson | null): ServicoProjeto | null => (dados ? desserializarServico(dados) : null)
};

const MILISSEGUNDOS_POR_DIA = 86_400_000;

/**
 * Projeto audiovisual submetido por um produtor para composição de equipe.
 * Nó raiz da estrutura visitada pelos Visitors de validação/relatório.
 *
 * Classe base do padrão Prototype: cada subclasse concreta (ProjetoDocumentario,
 * ProjetoAnimacao, ProjetoPublicitario) implementa `clonar()` retornando uma
 * cópia profunda de si mesma — incluindo papéis requeridos, localização e
 * quaisquer restrições específicas do gênero — sem que o código cliente
 * precise conhecer a classe concreta para duplicá-la. A persistência usa
 * herança de tabela única do TypeORM (discriminador `tipoProjeto`).
 */
type SemMetodos<T> = { [K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K]: T[K] };

/**
 * Tipo utilitário: extrai apenas os campos de dados de uma subclasse de
 * Projeto (excluindo métodos e o discriminador `tipoProjeto`), para uso nos
 * construtores e nas fábricas — evita que `clonar`/`tipoProjeto`, que têm
 * tipo de retorno/literal específico por subclasse, vazem para dentro do
 * `Partial<...>` aceito ao instanciar.
 *
 * `papeisRequeridos` é aceito apenas como atalho de entrada: a lista é
 * convertida em um pacote de serviços atômicos (ver `servicoDePapeis`). Se
 * `servicoPrincipal` também for informado, ele prevalece.
 */
export type DadosProjeto<T extends Projeto> = Partial<Omit<SemMetodos<T>, 'tipoProjeto' | 'papeisRequeridos'>> & {
  papeisRequeridos?: PapelRequerido[];
};

@Entity('projetos')
@TableInheritance({ column: { type: 'varchar', name: 'tipoProjeto' } })
export abstract class Projeto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  titulo!: string;

  @Column({ type: 'varchar', length: 100 })
  genero!: string;

  @Column({ type: 'int' })
  duracaoEstimadaMinutos!: number;

  @Column({ type: 'float' })
  orcamentoTotal!: number;

  @Column({ type: 'timestamp' })
  dataEntrega!: Date;

  @Column({ type: 'enum', enum: TipoCaptacao })
  tipoCaptacao!: TipoCaptacao;

  @Column({ type: 'simple-json' })
  localizacao!: Localizacao;

  /**
   * Composite: raiz da hierarquia de serviços do projeto — um pacote que pode
   * conter serviços atômicos e outros pacotes. Substitui a antiga lista simples
   * de papéis. (Coluna opcional para que bases criadas antes dessa mudança
   * continuem sendo sincronizadas.)
   */
  @Column({ type: 'simple-json', nullable: true, transformer: transformadorDeServico })
  servicoPrincipal!: ServicoProjeto;

  @Column({ type: 'varchar', length: 100 })
  produtorId!: string;

  @Column({ type: 'varchar', length: 50, default: 'similaridade_cosseno' })
  estrategiaRecomendacao!: string;

  /** Discriminador do tipo concreto, usado pelas fábricas (Abstract Factory) para selecionar a família de objetos correta. */
  abstract readonly tipoProjeto: TipoProjeto;

  constructor(parcial?: DadosProjeto<Projeto>) {
    if (parcial) {
      const { papeisRequeridos, ...dados } = parcial;
      Object.assign(this, dados);
      if (!this.servicoPrincipal && papeisRequeridos) {
        this.servicoPrincipal = servicoDePapeis(papeisRequeridos, this.orcamentoTotal);
      }
    }
    if (!this.servicoPrincipal) this.servicoPrincipal = new PacoteServico('Equipe');
  }

  /**
   * Papéis técnicos exigidos pelo projeto, derivados dos serviços atômicos da
   * hierarquia (um item por papel distinto, com o peso proporcional ao custo
   * planejado). Somente leitura: para alterar, altere `servicoPrincipal`.
   */
  get papeisRequeridos(): PapelRequerido[] {
    return papeisRequeridosDe(this.servicoPrincipal);
  }

  /** Custo planejado do projeto: delega ao serviço principal, que o propaga por toda a hierarquia. */
  calcularCustoTotal(): number {
    return this.servicoPrincipal.calcularCusto();
  }

  /** Prazo planejado, em dias, conforme os modos de execução dos pacotes. */
  obterPrazoTotalDias(): number {
    return this.servicoPrincipal.obterPrazo();
  }

  /**
   * Valida a estrutura do projeto: a hierarquia de serviços (recursivamente)
   * e a coerência dela com o orçamento e com a data de entrega.
   */
  validarEstrutura(agora: Date = new Date()): ResultadoValidacaoServico {
    const erros = [...this.servicoPrincipal.validar().erros];

    const diasDisponiveis = Math.floor((new Date(this.dataEntrega).getTime() - agora.getTime()) / MILISSEGUNDOS_POR_DIA);
    const prazo = this.obterPrazoTotalDias();
    if (prazo > diasDisponiveis) {
      erros.push(`O prazo planejado (${prazo} dias) excede o tempo disponível até a entrega (${diasDisponiveis} dias).`);
    }

    const custo = this.calcularCustoTotal();
    if (custo > this.orcamentoTotal + 0.005) {
      erros.push(`O custo planejado (R$ ${custo.toFixed(2)}) excede o orçamento do projeto (R$ ${this.orcamentoTotal.toFixed(2)}).`);
    }

    return { valido: erros.length === 0, erros };
  }

  /**
   * Prototype: retorna uma cópia profunda desta instância, incluindo papéis
   * requeridos, localização e atributos específicos da subclasse. Útil para
   * oferecer modelos pré-configurados de projeto e reduzir a repetição de
   * lógica de criação/validação ao cadastrar um novo projeto semelhante a
   * um já existente.
   */
  abstract clonar(): Projeto;

  /** Orçamento máximo sugerido para um papel específico, proporcional ao seu peso. */
  orcamentoMaximoParaPapel(papel: string): number {
    const requerido = this.papeisRequeridos.find((p) => p.papel === papel);
    if (!requerido) return 0;
    const somaPesos = this.papeisRequeridos.reduce((acc, p) => acc + p.pesoImportancia, 0);
    if (somaPesos === 0) return 0;
    return (requerido.pesoImportancia / somaPesos) * this.orcamentoTotal;
  }

  /**
   * Copia os campos comuns da classe base para uma nova instância, usado
   * pelas subclasses dentro de `clonar()` para evitar duplicação de lógica
   * de cópia profunda dos atributos herdados.
   */
  protected clonarCamposBase(): DadosProjeto<Projeto> {
    return {
      titulo: this.titulo,
      genero: this.genero,
      duracaoEstimadaMinutos: this.duracaoEstimadaMinutos,
      orcamentoTotal: this.orcamentoTotal,
      dataEntrega: new Date(this.dataEntrega),
      tipoCaptacao: this.tipoCaptacao,
      localizacao: { ...this.localizacao },
      servicoPrincipal: this.servicoPrincipal.clonar(),
      produtorId: this.produtorId,
      estrategiaRecomendacao: this.estrategiaRecomendacao
    };
  }
}
