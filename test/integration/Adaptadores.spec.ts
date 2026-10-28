import { AdaptadorArmazenamento } from '../../src/application/ports/AdaptadorArmazenamento';
import { AdaptadorPagamento } from '../../src/application/ports/AdaptadorPagamento';
import { AdaptadorProfissional } from '../../src/application/ports/AdaptadorProfissional';
import {
  ArgumentoInvalidoError,
  ArquivoNaoEncontradoError,
  AvaliacaoInvalidaError,
  ErroDeIntegracao,
  PagamentoInvalidoError,
  PagamentoNaoEncontradoError,
  PagamentoRecusadoError,
  ProfissionalNaoEncontradoError
} from '../../src/application/ports/ErrosDeIntegracao';
import { AdaptadorGoogleCloud } from '../../src/infrastructure/integracao/armazenamento/AdaptadorGoogleCloud';
import { AdaptadorLocal } from '../../src/infrastructure/integracao/armazenamento/AdaptadorLocal';
import { AdaptadorS3 } from '../../src/infrastructure/integracao/armazenamento/AdaptadorS3';
import { ArmazenamentoExterno } from '../../src/infrastructure/integracao/armazenamento/ArmazenamentoExterno';
import { ClienteGoogleCloudSimulado } from '../../src/infrastructure/integracao/armazenamento/ClienteGoogleCloudSimulado';
import { ClienteS3Simulado } from '../../src/infrastructure/integracao/armazenamento/ClienteS3Simulado';
import { AdaptadorPagSeguro } from '../../src/infrastructure/integracao/pagamento/AdaptadorPagSeguro';
import { AdaptadorPayPal } from '../../src/infrastructure/integracao/pagamento/AdaptadorPayPal';
import { AdaptadorStripe } from '../../src/infrastructure/integracao/pagamento/AdaptadorStripe';
import { GatewayPagamento } from '../../src/infrastructure/integracao/pagamento/GatewayPagamento';
import { PagSeguroSimulado } from '../../src/infrastructure/integracao/pagamento/PagSeguroSimulado';
import { StripeSimulado } from '../../src/infrastructure/integracao/pagamento/StripeSimulado';
import { AdaptadorIndeed } from '../../src/infrastructure/integracao/profissionais/AdaptadorIndeed';
import { AdaptadorInterno } from '../../src/infrastructure/integracao/profissionais/AdaptadorInterno';
import { AdaptadorLinkedIn } from '../../src/infrastructure/integracao/profissionais/AdaptadorLinkedIn';
import { ApiProfissionalExterna, PERFIS_PORTAL_PADRAO } from '../../src/infrastructure/integracao/profissionais/ApiProfissionalExterna';
import {
  LinkedInSimulado,
  PERFIS_LINKEDIN_PADRAO,
  PerfilLinkedIn
} from '../../src/infrastructure/integracao/profissionais/LinkedInSimulado';
import { Profissional } from '../../src/domain/entities/Profissional';
import { PapelTecnico } from '../../src/domain/entities/types';
import { criarAvaliacao, criarCompetencia, criarProfissional } from '../fixtures/builders';
import { completarRepositorio } from '../fixtures/adaptadores';

// ===================================================================== armazenamento

const provedoresDeArmazenamento: Array<{ nome: string; criar: () => AdaptadorArmazenamento }> = [
  { nome: 's3', criar: () => new AdaptadorS3(new ClienteS3Simulado(), 'bucket-teste') },
  { nome: 'google-cloud', criar: () => new AdaptadorGoogleCloud(new ClienteGoogleCloudSimulado(), 'bucket-teste') },
  { nome: 'local', criar: () => new AdaptadorLocal(new ArmazenamentoExterno()) }
];

describe.each(provedoresDeArmazenamento)('AdaptadorArmazenamento — contrato ($nome)', ({ nome, criar }) => {
  const roteiro = Buffer.from('CENA 1 — INT. ESTÚDIO — DIA');

  it('identifica o provedor', () => {
    expect(criar().provedor).toBe(nome);
  });

  it('salva um arquivo e o recupera íntegro, devolvendo o caminho como id', async () => {
    const armazenamento = criar();

    const id = await armazenamento.salvarArquivo(roteiro, { nome: 'roteiro.txt', prefixo: 'projetos/p1/' });

    expect(id).toBe('projetos/p1/roteiro.txt');
    expect((await armazenamento.recuperarArquivo(id)).equals(roteiro)).toBe(true);
  });

  it('normaliza o prefixo (barra inicial ausente/presente e barra final)', async () => {
    const armazenamento = criar();

    const a = await armazenamento.salvarArquivo(roteiro, { nome: 'a.txt', prefixo: '/projetos/p1' });
    const b = await armazenamento.salvarArquivo(roteiro, { nome: 'b.txt' });

    expect(a).toBe('projetos/p1/a.txt');
    expect(b).toBe('b.txt');
  });

  it('lista, em ordem alfabética, apenas os arquivos do prefixo', async () => {
    const armazenamento = criar();
    await armazenamento.salvarArquivo(roteiro, { nome: 'b.txt', prefixo: 'projetos/p1/' });
    await armazenamento.salvarArquivo(roteiro, { nome: 'a.txt', prefixo: 'projetos/p1/' });
    await armazenamento.salvarArquivo(roteiro, { nome: 'c.txt', prefixo: 'projetos/p2/' });

    expect(await armazenamento.listarArquivos('projetos/p1/')).toEqual(['projetos/p1/a.txt', 'projetos/p1/b.txt']);
    expect(await armazenamento.listarArquivos('projetos/p9/')).toEqual([]);
  });

  it('sobrescreve o arquivo quando o mesmo caminho é salvo de novo', async () => {
    const armazenamento = criar();
    const id = await armazenamento.salvarArquivo(Buffer.from('v1'), { nome: 'x.txt' });
    await armazenamento.salvarArquivo(Buffer.from('v2'), { nome: 'x.txt' });

    expect((await armazenamento.recuperarArquivo(id)).toString()).toBe('v2');
    expect(await armazenamento.listarArquivos('')).toHaveLength(1);
  });

  it('guarda uma cópia: alterar o buffer original ou o recuperado não afeta o armazenado', async () => {
    const armazenamento = criar();
    const original = Buffer.from('abc');
    const id = await armazenamento.salvarArquivo(original, { nome: 'x.txt' });

    original.fill(0);
    (await armazenamento.recuperarArquivo(id)).fill(1);

    expect((await armazenamento.recuperarArquivo(id)).toString()).toBe('abc');
  });

  it('recuperar um id inexistente lança ArquivoNaoEncontradoError', async () => {
    await expect(criar().recuperarArquivo('projetos/p1/nao-existe.txt')).rejects.toThrow(ArquivoNaoEncontradoError);
  });

  it.each([
    ['nome vazio', { nome: '  ' }],
    ['nome com barra', { nome: 'a/b.txt' }],
    ['prefixo com ".."', { nome: 'a.txt', prefixo: 'projetos/../segredo/' }]
  ])('rejeita %s', async (_descricao, metadados) => {
    await expect(criar().salvarArquivo(roteiro, metadados)).rejects.toThrow(ArgumentoInvalidoError);
  });
});

describe('Adaptadores de armazenamento — particularidades de cada provedor', () => {
  it('S3: grava com Bucket/Key/Metadata do SDK, separando os metadados extras do nome e do prefixo', async () => {
    const cliente = new ClienteS3Simulado();
    const adaptador = new AdaptadorS3(cliente, 'meu-bucket');

    await adaptador.salvarArquivo(Buffer.from('x'), {
      nome: 'storyboard.png', prefixo: 'projetos/p1/', tipoConteudo: 'image/png', autor: 'Ana'
    });

    const objeto = await cliente.getObject({ Bucket: 'meu-bucket', Key: 'projetos/p1/storyboard.png' });
    expect(objeto.Metadata).toEqual({ tipoConteudo: 'image/png', autor: 'Ana', 'content-type': 'image/png' });
  });

  it('S3: erros que não são "arquivo inexistente" viram ErroDeIntegracao', async () => {
    const quebrado = { getObject: async () => { throw new Error('timeout'); } } as unknown as ClienteS3Simulado;
    const erro = await new AdaptadorS3(quebrado, 'b').recuperarArquivo('x').catch((e) => e);

    expect(erro).toBeInstanceOf(ErroDeIntegracao);
    expect(erro.provedor).toBe('s3');
  });

  it('Google Cloud: um erro 404 vira arquivo inexistente; outros viram ErroDeIntegracao', async () => {
    const cliente = new ClienteGoogleCloudSimulado();
    await expect(new AdaptadorGoogleCloud(cliente, 'b').recuperarArquivo('nada')).rejects.toThrow(ArquivoNaoEncontradoError);

    const quebrado = { uploadObject: async () => { throw new Error('quota'); } } as unknown as ClienteGoogleCloudSimulado;
    await expect(new AdaptadorGoogleCloud(quebrado, 'b').salvarArquivo(Buffer.from('x'), { nome: 'a.txt' })).rejects.toThrow(ErroDeIntegracao);
  });

  it('buckets diferentes são isolados', async () => {
    const cliente = new ClienteS3Simulado();
    await new AdaptadorS3(cliente, 'bucket-a').salvarArquivo(Buffer.from('x'), { nome: 'a.txt' });

    expect(await new AdaptadorS3(cliente, 'bucket-b').listarArquivos('')).toEqual([]);
  });

  it('falhas ao salvar e ao listar também viram ErroDeIntegracao', async () => {
    const s3 = { putObject: async () => { throw new Error('x'); }, listObjectsV2: async () => { throw new Error('x'); } } as unknown as ClienteS3Simulado;
    const gcs = { getFiles: async () => { throw new Error('x'); }, downloadObject: async () => { throw new Error('x'); } } as unknown as ClienteGoogleCloudSimulado;

    await expect(new AdaptadorS3(s3, 'b').salvarArquivo(Buffer.from('x'), { nome: 'a' })).rejects.toThrow(ErroDeIntegracao);
    await expect(new AdaptadorS3(s3, 'b').listarArquivos('')).rejects.toThrow(ErroDeIntegracao);
    await expect(new AdaptadorGoogleCloud(gcs, 'b').listarArquivos('')).rejects.toThrow(ErroDeIntegracao);
    await expect(new AdaptadorGoogleCloud(gcs, 'b').recuperarArquivo('a')).rejects.toThrow(ErroDeIntegracao);
  });
});

// ===================================================================== pagamento

const provedoresDePagamento: Array<{ nome: string; criar: (limiteEmReais?: number) => AdaptadorPagamento }> = [
  { nome: 'stripe', criar: (limite = Infinity) => new AdaptadorStripe(new StripeSimulado(limite * 100)) },
  { nome: 'pagseguro', criar: (limite = Infinity) => new AdaptadorPagSeguro(new PagSeguroSimulado(limite)) },
  { nome: 'paypal', criar: (limite = Infinity) => new AdaptadorPayPal(new GatewayPagamento(limite)) }
];

describe.each(provedoresDePagamento)('AdaptadorPagamento — contrato ($nome)', ({ nome, criar }) => {
  it('identifica o provedor', () => {
    expect(criar().provedor).toBe(nome);
  });

  it('efetua o pagamento, devolve um id e o status passa a ser CONFIRMADO', async () => {
    const pagamento = criar();

    const id = await pagamento.efetuarPagamento(1500.5, 'produtor-1', 'profissional-9');

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(await pagamento.verificarPagamento(id)).toBe('CONFIRMADO');
  });

  it('gera ids distintos para pagamentos distintos', async () => {
    const pagamento = criar();
    const a = await pagamento.efetuarPagamento(10, 'p', 'q');
    const b = await pagamento.efetuarPagamento(10, 'p', 'q');
    expect(a).not.toBe(b);
  });

  it('cancela um pagamento: true na primeira vez, false na segunda, e o status vira CANCELADO', async () => {
    const pagamento = criar();
    const id = await pagamento.efetuarPagamento(100, 'p', 'q');

    expect(await pagamento.cancelarPagamento(id)).toBe(true);
    expect(await pagamento.verificarPagamento(id)).toBe('CANCELADO');
    expect(await pagamento.cancelarPagamento(id)).toBe(false);
  });

  it('id inexistente lança PagamentoNaoEncontradoError ao consultar e ao cancelar', async () => {
    const pagamento = criar();
    await expect(pagamento.verificarPagamento('nao-existe')).rejects.toThrow(PagamentoNaoEncontradoError);
    await expect(pagamento.cancelarPagamento('nao-existe')).rejects.toThrow(PagamentoNaoEncontradoError);
  });

  it.each([
    ['valor zero', 0, 'p', 'q'],
    ['valor negativo', -5, 'p', 'q'],
    ['valor não numérico', Number.NaN, 'p', 'q'],
    ['origem vazia', 10, ' ', 'q'],
    ['destino vazio', 10, 'p', '']
  ])('rejeita %s antes de chamar o provedor', async (_descricao, valor, origem, destino) => {
    await expect(criar().efetuarPagamento(valor, origem, destino)).rejects.toThrow(PagamentoInvalidoError);
  });

  it('um pagamento recusado pelo provedor lança PagamentoRecusadoError', async () => {
    const pagamento = criar(1000); // recusa acima de R$ 1.000
    await expect(pagamento.efetuarPagamento(1000.01, 'p', 'q')).rejects.toThrow(PagamentoRecusadoError);
    await expect(pagamento.efetuarPagamento(1000, 'p', 'q')).resolves.toEqual(expect.any(String));
  });
});

describe('Adaptadores de pagamento — particularidades de cada provedor', () => {
  it('Stripe: converte reais em centavos inteiros (sem erro de ponto flutuante) e guarda origem/destino', async () => {
    const stripe = new StripeSimulado();
    const id = await new AdaptadorStripe(stripe).efetuarPagamento(19.99, 'produtor', 'profissional');

    const intent = await stripe.paymentIntents.retrieve(id);
    expect(intent.amount).toBe(1999);
    expect(intent.currency).toBe('brl');
    expect(intent.metadata).toEqual({ origem: 'produtor', destino: 'profissional' });
    expect(id).toMatch(/^pi_sim_/);
  });

  it('PagSeguro: envia o valor como texto com duas casas decimais', async () => {
    const pagseguro = new PagSeguroSimulado();
    const espiao = jest.spyOn(pagseguro, 'criarCobranca');

    await new AdaptadorPagSeguro(pagseguro).efetuarPagamento(7, 'produtor', 'profissional');

    expect(espiao).toHaveBeenCalledWith({ valor: '7.00', moeda: 'BRL', pagador: 'produtor', recebedor: 'profissional' });
  });

  it('PayPal: usa o gateway genérico com o valor em reais', async () => {
    const gateway = new GatewayPagamento();
    const id = await new AdaptadorPayPal(gateway).efetuarPagamento(42.5, 'a', 'b');

    expect(id).toMatch(/^PAYID-/);
    expect(gateway.consultarStatus(id)).toBe('APROVADA');
  });

  it('cada provedor expressa o status no seu vocabulário, mas o adaptador devolve o mesmo', async () => {
    const stripe = new StripeSimulado();
    const pagseguro = new PagSeguroSimulado();
    const gateway = new GatewayPagamento();

    const idStripe = await new AdaptadorStripe(stripe).efetuarPagamento(10, 'p', 'q');
    const idPagSeguro = await new AdaptadorPagSeguro(pagseguro).efetuarPagamento(10, 'p', 'q');
    const idPayPal = await new AdaptadorPayPal(gateway).efetuarPagamento(10, 'p', 'q');

    expect((await stripe.paymentIntents.retrieve(idStripe)).status).toBe('succeeded');
    expect((await pagseguro.consultarCobranca(idPagSeguro)).situacao).toBe('PAGO');
    expect(gateway.consultarStatus(idPayPal)).toBe('APROVADA');

    for (const adaptador of [new AdaptadorStripe(stripe), new AdaptadorPagSeguro(pagseguro), new AdaptadorPayPal(gateway)]) {
      const id = { stripe: idStripe, pagseguro: idPagSeguro, paypal: idPayPal }[adaptador.provedor]!;
      expect(await adaptador.verificarPagamento(id)).toBe('CONFIRMADO');
    }
  });

  it('falhas inesperadas do provedor viram ErroDeIntegracao, sem vazar o erro original como tipo', async () => {
    const stripeQuebrado = { paymentIntents: { create: async () => { throw new Error('rede'); }, retrieve: async () => { throw new Error('rede'); } }, refunds: { create: async () => { throw new Error('rede'); } } } as unknown as StripeSimulado;
    const adaptador = new AdaptadorStripe(stripeQuebrado);

    await expect(adaptador.efetuarPagamento(10, 'p', 'q')).rejects.toThrow(ErroDeIntegracao);
    await expect(adaptador.verificarPagamento('x')).rejects.toThrow(ErroDeIntegracao);
    await expect(adaptador.cancelarPagamento('x')).rejects.toThrow(ErroDeIntegracao);

    const pagseguroQuebrado = { criarCobranca: async () => { throw new Error('rede'); }, consultarCobranca: async () => { throw new Error('rede'); }, cancelarCobranca: async () => { throw new Error('rede'); } } as unknown as PagSeguroSimulado;
    const ps = new AdaptadorPagSeguro(pagseguroQuebrado);
    await expect(ps.efetuarPagamento(10, 'p', 'q')).rejects.toThrow(ErroDeIntegracao);
    await expect(ps.verificarPagamento('x')).rejects.toThrow(ErroDeIntegracao);
    await expect(ps.cancelarPagamento('x')).rejects.toThrow(ErroDeIntegracao);

    const gatewayQuebrado = { processarPagamento: () => { throw new Error('rede'); }, estornarPagamento: () => { throw new Error('rede'); }, consultarStatus: () => { throw new Error('rede'); } } as unknown as GatewayPagamento;
    const paypal = new AdaptadorPayPal(gatewayQuebrado);
    await expect(paypal.cancelarPagamento('x')).rejects.toThrow(ErroDeIntegracao);
    await expect(paypal.verificarPagamento('x')).rejects.toThrow(ErroDeIntegracao);
  });

  it('Stripe: um pagamento recusado nunca foi capturado, então não pode ser cancelado', async () => {
    const stripe = new StripeSimulado(1000); // recusa acima de R$ 10,00
    const adaptador = new AdaptadorStripe(stripe);
    await expect(adaptador.efetuarPagamento(10.01, 'p', 'q')).rejects.toThrow(PagamentoRecusadoError);

    // o id do pagamento recusado existe no Stripe, mas o adaptador não o expôs;
    // consultar o primeiro intent diretamente mostra o status de falha traduzido.
    const intent = await stripe.paymentIntents.retrieve('pi_sim_000001');
    expect(intent.status).toBe('requires_payment_method');
    expect(await adaptador.verificarPagamento('pi_sim_000001')).toBe('FALHOU');
    expect(await adaptador.cancelarPagamento('pi_sim_000001')).toBe(false);
  });
});

// ===================================================================== profissionais

function repositorioDeTeste() {
  const profissionais: Profissional[] = [
    criarProfissional({
      id: 'int-1', nome: 'Diretora Interna', especialidadePrincipal: PapelTecnico.DIRETOR,
      faixaDePreco: { minimo: 8000, maximo: 12000 }, localizacao: { latitude: 0, longitude: 0, cidade: 'São Paulo' },
      competencias: [criarCompetencia('direcao_atores', 0.9)], avaliacoes: [criarAvaliacao(5)]
    }),
    criarProfissional({
      id: 'int-2', nome: 'Diretor Carioca', especialidadePrincipal: PapelTecnico.DIRETOR,
      faixaDePreco: { minimo: 3000, maximo: 5000 }, localizacao: { latitude: 0, longitude: 0, cidade: 'Rio de Janeiro' }
    }),
    criarProfissional({ id: 'int-3', nome: 'Editor Interno', especialidadePrincipal: PapelTecnico.EDITOR })
  ];
  return completarRepositorio({
    buscarPorPapel: async (papel) => profissionais.filter((p) => p.especialidadePrincipal === papel)
  });
}

const provedoresDeProfissionais: Array<{
  nome: string;
  criar: () => AdaptadorProfissional;
  idExistente: string;
  idDeOutroProvedor: string;
  idInexistente: string;
  /** Quantidade de diretores no cadastro do provedor. */
  diretores: number;
  /** Cidade com exatamente um diretor, e o preço máximo que deixa só o mais barato. */
  cidade: string;
}> = [
  { nome: 'interno', criar: () => new AdaptadorInterno(repositorioDeTeste()), idExistente: 'int-1', idDeOutroProvedor: 'linkedin:urn:li:person:1001', idInexistente: 'int-999', diretores: 2, cidade: 'Rio de Janeiro' },
  { nome: 'linkedin', criar: () => new AdaptadorLinkedIn(new LinkedInSimulado()), idExistente: 'linkedin:urn:li:person:1001', idDeOutroProvedor: 'indeed:ind-201', idInexistente: 'linkedin:urn:li:person:9999', diretores: 1, cidade: 'São Paulo' },
  { nome: 'indeed', criar: () => new AdaptadorIndeed(new ApiProfissionalExterna()), idExistente: 'indeed:ind-201', idDeOutroProvedor: 'linkedin:urn:li:person:1001', idInexistente: 'indeed:ind-999', diretores: 1, cidade: 'Rio de Janeiro' }
];

describe.each(provedoresDeProfissionais)('AdaptadorProfissional — contrato ($nome)', (provedor) => {
  it('identifica o provedor', () => {
    expect(provedor.criar().provedor).toBe(provedor.nome);
  });

  it('lista profissionais como entidades Profissional do domínio, filtrados pelo papel', async () => {
    const profissionais = await provedor.criar().listarProfissionais({ papel: PapelTecnico.DIRETOR });

    expect(profissionais).toHaveLength(provedor.diretores);
    for (const p of profissionais) {
      expect(p).toBeInstanceOf(Profissional);
      expect(p.especialidadePrincipal).toBe(PapelTecnico.DIRETOR);
      expect(p.id).toBeTruthy();
      expect(p.nome).toBeTruthy();
      expect(p.faixaDePreco.minimo).toBeLessThanOrEqual(p.faixaDePreco.maximo);
    }
  });

  it('sem critério de papel, devolve profissionais de várias especialidades', async () => {
    const todos = await provedor.criar().listarProfissionais({});
    expect(new Set(todos.map((p) => p.especialidadePrincipal)).size).toBeGreaterThan(1);
  });

  it('filtra por cidade', async () => {
    const profissionais = await provedor.criar().listarProfissionais({ papel: PapelTecnico.DIRETOR, cidade: provedor.cidade });

    expect(profissionais).toHaveLength(1);
    expect(profissionais[0].localizacao.cidade).toBe(provedor.cidade);
  });

  it('filtra pelo preço máximo (o preço mínimo do profissional não pode passar dele)', async () => {
    const baratos = await provedor.criar().listarProfissionais({ papel: PapelTecnico.DIRETOR, precoMaximo: 3500 });

    expect(baratos.every((p) => p.faixaDePreco.minimo <= 3500)).toBe(true);
    const todos = await provedor.criar().listarProfissionais({ papel: PapelTecnico.DIRETOR });
    expect(baratos.length).toBeLessThanOrEqual(todos.length);
    expect(await provedor.criar().listarProfissionais({ papel: PapelTecnico.DIRETOR, precoMaximo: 1 })).toEqual([]);
  });

  it('detalha um profissional pelo id devolvido na listagem', async () => {
    const adaptador = provedor.criar();

    const detalhado = await adaptador.detalharProfissional(provedor.idExistente);

    expect(detalhado.id).toBe(provedor.idExistente);
    expect(detalhado.especialidadePrincipal).toBe(PapelTecnico.DIRETOR);
  });

  it('detalhar um id inexistente, ou de outro provedor, lança ProfissionalNaoEncontradoError', async () => {
    const adaptador = provedor.criar();
    await expect(adaptador.detalharProfissional(provedor.idInexistente)).rejects.toThrow(ProfissionalNaoEncontradoError);
    await expect(adaptador.detalharProfissional(provedor.idDeOutroProvedor)).rejects.toThrow(ProfissionalNaoEncontradoError);
  });

  it('registra uma avaliação, que passa a constar no detalhe do profissional', async () => {
    const adaptador = provedor.criar();
    const antes = (await adaptador.detalharProfissional(provedor.idExistente)).avaliacoesSeguras.length;

    await adaptador.registrarAvaliacao(provedor.idExistente, { nota: 4.6, projetoId: 'proj-1', comentario: 'Ótimo' });

    expect((await adaptador.detalharProfissional(provedor.idExistente)).avaliacoesSeguras).toHaveLength(antes + 1);
  });

  it.each([-1, 5.1, Number.NaN])('rejeita a nota %p', async (nota) => {
    await expect(provedor.criar().registrarAvaliacao(provedor.idExistente, { nota, projetoId: 'p' })).rejects.toThrow(AvaliacaoInvalidaError);
  });

  it('avaliar um profissional inexistente lança ProfissionalNaoEncontradoError', async () => {
    await expect(provedor.criar().registrarAvaliacao(provedor.idInexistente, { nota: 4, projetoId: 'p' })).rejects.toThrow(ProfissionalNaoEncontradoError);
  });
});

describe('Adaptadores de profissionais — tradução dos formatos externos', () => {
  it('LinkedIn: converte perfil, competências endossadas, preço, localização e recomendações', async () => {
    const helena = await new AdaptadorLinkedIn(new LinkedInSimulado()).detalharProfissional('linkedin:urn:li:person:1001');

    expect(helena.nome).toBe('Helena Duarte');
    expect(helena.especialidadePrincipal).toBe(PapelTecnico.DIRETOR);
    expect(helena.faixaDePreco).toEqual({ minimo: 7000, maximo: 12000 });
    expect(helena.localizacao.cidade).toBe('São Paulo');
    expect(helena.historicoProjetos).toEqual(['li-ficcao-2025', 'li-doc-2024']);
    expect(helena.competenciasSeguras.map((c) => [c.nome, c.nivel])).toEqual([
      ['direcao_atores', 0.9], // 18 endossos / 20
      ['visao_narrativa', 0.8],
      ['lideranca_equipe', 0.6]
    ]);
    expect(helena.avaliacoesSeguras.map((a) => a.nota)).toEqual([5, 4]);
    expect(helena.estaDisponivelEm(new Date('2026-06-01'), new Date('2026-07-01'))).toBe(true);
  });

  it('LinkedIn: limita o nível de uma competência a 1 e normaliza competências desconhecidas', async () => {
    const perfil: PerfilLinkedIn = {
      ...structuredClone(PERFIS_LINKEDIN_PADRAO[0]),
      urn: 'urn:li:person:7',
      skills: [{ name: 'Actor direction', endorsementCount: 400 }, { name: 'Direção Subaquática', endorsementCount: 5 }]
    };
    const profissional = await new AdaptadorLinkedIn(new LinkedInSimulado([perfil])).detalharProfissional('linkedin:urn:li:person:7');

    expect(profissional.competenciasSeguras.map((c) => [c.nome, c.nivel])).toEqual([
      ['direcao_atores', 1],
      ['direcao_subaquatica', 0.25]
    ]);
  });

  it('LinkedIn: perfis com cargo sem correspondência ficam fora da listagem e falham ao detalhar', async () => {
    const perfil: PerfilLinkedIn = { ...structuredClone(PERFIS_LINKEDIN_PADRAO[0]), urn: 'urn:li:person:8', headline: 'Chef de Cozinha' };
    const adaptador = new AdaptadorLinkedIn(new LinkedInSimulado([perfil]));

    expect(await adaptador.listarProfissionais({})).toEqual([]);
    await expect(adaptador.detalharProfissional('linkedin:urn:li:person:8')).rejects.toThrow(ErroDeIntegracao);
  });

  it('LinkedIn: a nota (0 a 5, fracionária) vira de 1 a 5 estrelas inteiras', async () => {
    const cliente = new LinkedInSimulado();
    const espiao = jest.spyOn(cliente, 'createRecommendation');
    const adaptador = new AdaptadorLinkedIn(cliente);

    await adaptador.registrarAvaliacao('linkedin:urn:li:person:1001', { nota: 0, projetoId: 'a' });
    await adaptador.registrarAvaliacao('linkedin:urn:li:person:1001', { nota: 3.5, projetoId: 'b' });
    await adaptador.registrarAvaliacao('linkedin:urn:li:person:1001', { nota: 5, projetoId: 'c' });

    expect(espiao.mock.calls.map(([, r]) => r.rating)).toEqual([1, 4, 5]);
  });

  it('Indeed: converte cargo por código, habilidades em texto livre, pretensão salarial e notas soltas', async () => {
    const larissa = await new AdaptadorIndeed(new ApiProfissionalExterna()).detalharProfissional('indeed:ind-202');

    expect(larissa.nome).toBe('Larissa Prado');
    expect(larissa.especialidadePrincipal).toBe(PapelTecnico.EDITOR);
    expect(larissa.faixaDePreco).toEqual({ minimo: 3500, maximo: 7000 });
    expect(larissa.competenciasSeguras.map((c) => c.nome)).toEqual(['edicao_avancada', 'ritmo_narrativo', 'color_grading']);
    expect(larissa.avaliacoesSeguras.map((a) => [a.nota, a.projetoId])).toEqual([
      [4.5, 'ind-doc-2025'],
      [5, 'ind-publi-2025'],
      [4.8, 'portal-sem-projeto'] // nota sem projeto correspondente
    ]);
  });

  it('Indeed: perfis com cargo desconhecido ficam fora da listagem e falham ao detalhar', async () => {
    const perfil = { ...structuredClone(PERFIS_PORTAL_PADRAO[0]), id: 'ind-x', cargo: 'CONFEITEIRO' };
    const adaptador = new AdaptadorIndeed(new ApiProfissionalExterna([perfil]));

    expect(await adaptador.listarProfissionais({})).toEqual([]);
    await expect(adaptador.detalharProfissional('indeed:ind-x')).rejects.toThrow(ErroDeIntegracao);
  });

  it('as três origens produzem o mesmo tipo de objeto, que as estratégias de recomendação usam sem distinção', async () => {
    const origens: AdaptadorProfissional[] = [
      new AdaptadorInterno(repositorioDeTeste()),
      new AdaptadorLinkedIn(new LinkedInSimulado()),
      new AdaptadorIndeed(new ApiProfissionalExterna())
    ];
    for (const origem of origens) {
      const [primeiro] = await origem.listarProfissionais({ papel: PapelTecnico.EDITOR });
      expect(primeiro).toBeInstanceOf(Profissional);
      expect(typeof primeiro.notaMedia()).toBe('number');
    }
  });

  it('falhas do sistema externo viram ErroDeIntegracao', async () => {
    const linkedinQuebrado = { searchPeople: async () => { throw new Error('rede'); }, getProfile: async () => { throw new Error('rede'); }, createRecommendation: async () => { throw new Error('rede'); } } as unknown as LinkedInSimulado;
    const linkedin = new AdaptadorLinkedIn(linkedinQuebrado);
    await expect(linkedin.listarProfissionais({})).rejects.toThrow(ErroDeIntegracao);
    await expect(linkedin.detalharProfissional('linkedin:urn:x')).rejects.toThrow(ErroDeIntegracao);
    await expect(linkedin.registrarAvaliacao('linkedin:urn:x', { nota: 3, projetoId: 'p' })).rejects.toThrow(ErroDeIntegracao);

    const portalQuebrado = { buscarProfissionais: () => { throw new Error('rede'); }, obterPerfil: () => { throw new Error('rede'); }, avaliarProfissional: () => { throw new Error('rede'); } } as unknown as ApiProfissionalExterna;
    const indeed = new AdaptadorIndeed(portalQuebrado);
    await expect(indeed.listarProfissionais({})).rejects.toThrow(ErroDeIntegracao);
    await expect(indeed.detalharProfissional('indeed:x')).rejects.toThrow(ErroDeIntegracao);
    await expect(indeed.registrarAvaliacao('indeed:x', { nota: 3, projetoId: 'p' })).rejects.toThrow(ErroDeIntegracao);
  });
});
