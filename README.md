# Portal de Alertas - Remessas (SQL42 + TopCon)

Portal no estilo **Areia Ana** para monitorar remessas e gerar alerta automático quando um cliente ficar **mais de 7 dias sem remessa**.

## Acesso correto no GitHub

Para abrir o portal funcionando, use a URL do **GitHub Pages** (não a tela de código/commits do repositório):

- Formato: `https://<usuario>.github.io/portal-alertas-remessa/`
- Exemplo: `https://mariantasq97-ctrl.github.io/portal-alertas-remessa/`

Credenciais de acesso:

- `admin / 1234` (importa arquivos e visualiza)
- `usuario / 1234` (somente visualização)

## Regra de negócio

```text
DiasSemRemessa = DataHoje - DataUltimaRemessa
Se DiasSemRemessa > 7 => Status = PLANO_DE_ACAO
```

## Formatos de importação aceitos

- **CSC**
- **CSV**
- **XLS**
- **XLSX**
- JSON (mantido como compatibilidade)

## O que foi implementado

## Painel ADM para importação (visível aos usuários)

- O upload é feito no **Painel ADM (importação)** dentro do portal.
- Após importar, os dados ficam salvos no navegador (localStorage) e a visão do usuário já mostra os novos registros.
- O painel ADM mantém um histórico das últimas importações (arquivo, formato, data/hora e quantidade de registros).


- Interface web para visualização de indicadores e detalhamento.
- Bloco de **Alertas automáticos (SQL42 / TopCon)** carregado de `alerts.json`.
- Script `scripts/gerar_alertas.py` para processar relatórios em CSC/CSV/XLS/XLSX e gerar alertas.
- Workflow `.github/workflows/processar-relatorios.yml` para:
  - processar relatórios ao atualizar `data/**`;
  - gerar/atualizar `alerts.json`;
  - criar/atualizar Issue com os alertas (notificação por e-mail/app GitHub).
- SQL de referência em `sql/consultas_alerta.sql` com coluna `DiasSemRemessa` e status.

## Estrutura

```text
.
├─ data/
│  ├─ sql42_complementar.csv
│  └─ topcon_ultimo_consumo.csv
├─ scripts/
│  └─ gerar_alertas.py
├─ .github/workflows/
│  ├─ processar-relatorios.yml
│  └─ deploy-pages.yml
├─ sql/
│  └─ consultas_alerta.sql
├─ alerts.json
├─ index.html
├─ styles.css
└─ script.js
```

## Colunas mínimas esperadas

- Código do cliente (`CodCliente` ou equivalente)
- Nome do cliente (`NomeCliente` ou equivalente)
- Data da última remessa (`DataUltimaRemessa`)

Exemplo:

```csv
CodCliente;NomeCliente;DataUltimaRemessa;Volume
001;Construtora XPTO;2026-01-01;120
```

## Como usar

1. Atualize os arquivos na pasta `data/` com seu SQL42 Complementar e TopCon (CSC/CSV/XLS/XLSX).
2. Faça `push` no GitHub.
3. O GitHub Action gera `alerts.json` e atualiza a issue:
   - **ALERTAS – Último consumo (Dias sem remessa > 7)**
4. Abra o portal (GitHub Pages) para visualizar os alertas no painel.

## Rodar localmente

```bash
python3 scripts/gerar_alertas.py
python3 -m http.server 4180
```

Acesse: `http://127.0.0.1:4180`
