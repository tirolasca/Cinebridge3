import { PapelTecnico } from '../../../domain/entities/types';

/** Cargos do LinkedIn (`headline`) → papel técnico da plataforma. */
export const HEADLINE_PARA_PAPEL: Record<string, PapelTecnico> = {
  'Film Director': PapelTecnico.DIRETOR,
  'Director of Photography': PapelTecnico.DIRETOR_FOTOGRAFIA,
  'Sound Designer': PapelTecnico.SONOPLASTA,
  'Video Editor': PapelTecnico.EDITOR,
  Screenwriter: PapelTecnico.ROTEIRISTA,
  'VFX Artist': PapelTecnico.ESPECIALISTA_VFX
};

/** Palavra-chave de busca no LinkedIn para cada papel técnico. */
export const PALAVRA_CHAVE_POR_PAPEL: Record<PapelTecnico, string> = Object.fromEntries(
  Object.entries(HEADLINE_PARA_PAPEL).map(([headline, papel]) => [papel, headline])
) as Record<PapelTecnico, string>;

/** Competências do LinkedIn (`skills`) → competências usadas pelas estratégias de recomendação. */
export const HABILIDADE_LINKEDIN: Record<string, string> = {
  'Actor direction': 'direcao_atores',
  'Narrative vision': 'visao_narrativa',
  'Team leadership': 'lideranca_equipe',
  'Natural lighting': 'iluminacao_natural',
  'Image composition': 'composicao_imagem',
  'Camera operation': 'operacao_camera',
  'Location sound': 'captacao_som_direto',
  'Audio mixing': 'mixagem_audio',
  'Sound design': 'design_sonoro',
  'Advanced editing': 'edicao_avancada',
  'Narrative rhythm': 'ritmo_narrativo',
  'Color grading': 'color_grading',
  'Story structure': 'estrutura_narrativa',
  Dialogue: 'dialogo',
  'Thematic research': 'pesquisa_tematica',
  'Digital compositing': 'composicao_digital',
  '3D modeling': 'modelagem_3d',
  'Motion graphics': 'motion_graphics'
};

/** Cargos do portal de emprego → papel técnico da plataforma. */
export const CARGO_PARA_PAPEL: Record<string, PapelTecnico> = {
  DIRETOR_DE_CINEMA: PapelTecnico.DIRETOR,
  DIRETOR_DE_FOTOGRAFIA: PapelTecnico.DIRETOR_FOTOGRAFIA,
  TECNICO_DE_SOM: PapelTecnico.SONOPLASTA,
  EDITOR_DE_VIDEO: PapelTecnico.EDITOR,
  ROTEIRISTA: PapelTecnico.ROTEIRISTA,
  ARTISTA_DE_EFEITOS: PapelTecnico.ESPECIALISTA_VFX
};

/** Categoria de busca do portal de emprego para cada papel técnico. */
export const CATEGORIA_POR_PAPEL: Record<PapelTecnico, string> = Object.fromEntries(
  Object.entries(CARGO_PARA_PAPEL).map(([cargo, papel]) => [papel, cargo])
) as Record<PapelTecnico, string>;

/** Habilidades do portal de emprego (texto livre) → competências da plataforma. */
export const HABILIDADE_PORTAL: Record<string, string> = {
  'direção de atores': 'direcao_atores',
  'visão narrativa': 'visao_narrativa',
  'liderança de equipe': 'lideranca_equipe',
  'iluminação natural': 'iluminacao_natural',
  'composição de imagem': 'composicao_imagem',
  'operação de câmera': 'operacao_camera',
  'captação de som direto': 'captacao_som_direto',
  'mixagem de áudio': 'mixagem_audio',
  'design sonoro': 'design_sonoro',
  'edição avançada': 'edicao_avancada',
  'ritmo narrativo': 'ritmo_narrativo',
  'correção de cor': 'color_grading',
  'estrutura narrativa': 'estrutura_narrativa',
  diálogo: 'dialogo',
  'pesquisa temática': 'pesquisa_tematica',
  'composição digital': 'composicao_digital',
  'modelagem 3d': 'modelagem_3d',
  'motion graphics': 'motion_graphics'
};

/** Competência desconhecida: vira um identificador em minúsculas, sem acentos, com sublinhados. */
export function normalizarHabilidade(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
