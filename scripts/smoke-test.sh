#!/usr/bin/env bash
#
# Smoke test de ponta a ponta da API em execução.
#
# Verifica, contra um serviço já no ar (com banco e carga inicial prontos),
# que os três tipos de projeto geram recomendação (inclusive com hierarquia de
# serviços e pilha de decoradores), que armazenamento e pagamentos funcionam
# pelos adaptadores configurados e que as validações respondem com os códigos
# esperados.
#
# Uso:   BASE_URL=http://localhost:3000 bash scripts/smoke-test.sh
# Requer: bash, curl e GNU date (Linux).

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
ESPERA_MAXIMA_SEGUNDOS="${ESPERA_MAXIMA_SEGUNDOS:-90}"

# Datas relativas, para que o teste não envelheça.
ENTREGA="$(date -u -d '+1 year' +%Y-%m-%dT00:00:00.000Z)"
VEICULACAO="$(date -u -d '+13 months' +%Y-%m-%dT00:00:00.000Z)"

falhas=0

aguardar_servico() {
  echo "Aguardando ${BASE_URL}/health (até ${ESPERA_MAXIMA_SEGUNDOS}s)..."
  for ((i = 0; i < ESPERA_MAXIMA_SEGUNDOS; i++)); do
    if curl -fsS "${BASE_URL}/health" >/dev/null 2>&1; then
      echo "Serviço disponível."
      return 0
    fi
    sleep 1
  done
  echo "FALHA: o serviço não ficou disponível a tempo." >&2
  exit 1
}

# verificar <descrição> <código esperado> <método> <rota> [corpo JSON]
verificar() {
  local descricao="$1" esperado="$2" metodo="$3" rota="$4" corpo="${5:-}"
  local codigo
  if [[ -n "$corpo" ]]; then
    codigo="$(curl -sS -o /tmp/smoke-resposta.json -w '%{http_code}' -X "$metodo" \
      "${BASE_URL}${rota}" -H 'Content-Type: application/json' -d "$corpo")"
  else
    codigo="$(curl -sS -o /tmp/smoke-resposta.json -w '%{http_code}' -X "$metodo" "${BASE_URL}${rota}")"
  fi

  if [[ "$codigo" == "$esperado" ]]; then
    echo "  ok    ${descricao} (HTTP ${codigo})"
  else
    echo "  FALHA ${descricao}: esperado HTTP ${esperado}, recebido ${codigo}" >&2
    cat /tmp/smoke-resposta.json >&2 || true
    echo >&2
    falhas=$((falhas + 1))
  fi
}

comum="\"titulo\":\"Smoke\",\"genero\":\"drama\",\"duracaoEstimadaMinutos\":30,\"orcamentoTotal\":50000,\"dataEntrega\":\"${ENTREGA}\",\"tipoCaptacao\":\"FICCAO\",\"localizacao\":{\"latitude\":-23.55,\"longitude\":-46.63,\"cidade\":\"São Paulo\"},\"produtorId\":\"smoke\""
papeis_diretor_editor='"papeisRequeridos":[{"papel":"DIRETOR","pesoImportancia":0.5},{"papel":"EDITOR","pesoImportancia":0.5}]'
papeis_vfx='"papeisRequeridos":[{"papel":"ESPECIALISTA_VFX","pesoImportancia":1}]'

aguardar_servico

echo "Verificações:"
verificar "GET /health" 200 GET /health
verificar "GET /tipos-projeto" 200 GET /tipos-projeto

verificar "documentário válido" 201 POST /projetos/recomendacao \
  "{${comum},${papeis_diretor_editor},\"tipoProjeto\":\"DOCUMENTARIO\",\"tema\":\"Cultura popular\",\"entrevistados\":[\"Mestre Zé\"]}"

verificar "animação válida" 201 POST /projetos/recomendacao \
  "{${comum},${papeis_vfx},\"tipoProjeto\":\"ANIMACAO\",\"tecnicaAnimacao\":\"3D\",\"softwarePrincipal\":\"Blender\"}"

verificar "publicitário válido" 201 POST /projetos/recomendacao \
  "{${comum},${papeis_diretor_editor},\"tipoProjeto\":\"PUBLICITARIO\",\"marcaAnunciante\":\"Marca X\",\"dataVeiculacao\":\"${VEICULACAO}\"}"

verificar "documentário sem tema é rejeitado" 422 POST /projetos/recomendacao \
  "{${comum},${papeis_diretor_editor},\"tipoProjeto\":\"DOCUMENTARIO\"}"

verificar "requisição sem tipoProjeto é rejeitada" 400 POST /projetos/recomendacao \
  "{${comum},${papeis_diretor_editor}}"

# --- Hierarquia de serviços (Composite) e decoradores ---------------------------
servico_principal='"servicoPrincipal":{"tipo":"PACOTE","nome":"Documentário","servicos":[{"tipo":"PACOTE","nome":"Pré-produção","modoExecucao":"PARALELO","servicos":[{"tipo":"ATOMICO","nome":"Roteiro","papel":"ROTEIRISTA","custo":6000,"prazoDias":15},{"tipo":"ATOMICO","nome":"Direção","papel":"DIRETOR","custo":12000,"prazoDias":20}]},{"tipo":"PACOTE","nome":"Pós-produção","servicos":[{"tipo":"ATOMICO","nome":"Edição","papel":"EDITOR","custo":9000,"prazoDias":20}]}]}'
documentario="\"tipoProjeto\":\"DOCUMENTARIO\",\"tema\":\"Cultura popular\",\"entrevistados\":[\"Mestre Zé\"]"

verificar "documentário com hierarquia de serviços" 201 POST /projetos/recomendacao \
  "{${comum},${servico_principal},${documentario}}"

verificar "pilha de decoradores escolhida pelo produtor" 201 POST /projetos/recomendacao \
  "{${comum},${servico_principal},${documentario},\"decoradores\":[\"cache\",\"auditoria\",\"compressao\"]}"

verificar "decorador desconhecido é rejeitado" 400 POST /projetos/recomendacao \
  "{${comum},${servico_principal},${documentario},\"decoradores\":[\"magia\"]}"

servico_invalido='"servicoPrincipal":{"tipo":"PACOTE","nome":"P","servicos":[{"tipo":"ATOMICO","nome":"X","papel":"COZINHEIRO","custo":100,"prazoDias":1}]}'
verificar "hierarquia com papel inexistente é rejeitada" 422 POST /projetos/recomendacao \
  "{${comum},${servico_invalido},${documentario}}"

verificar "GET /integracoes" 200 GET /integracoes
verificar "GET /recomendacao/diagnostico" 200 GET /recomendacao/diagnostico

# --- Armazenamento (Adapter) ---------------------------------------------------
verificar "envio de arquivo ao projeto" 201 POST /projetos/smoke/arquivos \
  '{"nome":"roteiro.txt","conteudoBase64":"Q0VOQSAx","tipoConteudo":"text/plain"}'
verificar "listagem de arquivos do projeto" 200 GET /projetos/smoke/arquivos
verificar "download do arquivo enviado" 200 GET /projetos/smoke/arquivos/roteiro.txt
verificar "arquivo inexistente" 404 GET /projetos/smoke/arquivos/nao-existe.txt

# --- Pagamentos (Adapter) ------------------------------------------------------
verificar "pagamento efetuado" 201 POST /pagamentos '{"valor":1500,"origem":"produtor-smoke","destino":"profissional-smoke"}'
id_pagamento="$(sed -n 's/.*"id":"\([^"]*\)".*/\1/p' /tmp/smoke-resposta.json)"
verificar "consulta do pagamento" 200 GET "/pagamentos/${id_pagamento}"
verificar "cancelamento do pagamento" 200 POST "/pagamentos/${id_pagamento}/cancelamento"
verificar "pagamento inexistente" 404 GET /pagamentos/nao-existe

if ((falhas > 0)); then
  echo "${falhas} verificação(ões) falharam." >&2
  exit 1
fi
echo "Todas as verificações passaram."
