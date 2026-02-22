# Portal de Alertas – Remessas

Portal web para acompanhar clientes sem remessa, com importação de planilhas e priorização operacional.

## Funcionalidades
- Login com perfis `admin` e `usuario`.
- Recuperação de senha por chave local (sem backend).
- Importação de `.csv`, `.xlsx` e `.xls` com fallback de codificação (UTF-8/Windows-1252/ISO-8859-1).
- Seleção automática da aba com mais linhas em arquivos Excel.
- Mapeamento resiliente de cabeçalhos (com/sem acento e nomes alternativos).
- Sanitização de texto e parsing robusto de datas/valores.
- Consolidação por cliente usando CNPJ como chave principal.
- Dashboard com resumo por status, gráfico de evolução e detalhamento paginado.

## Acessos padrão
- `admin` / `1234`
- `usuario` / `1234`

## Chaves de recuperação
- admin: `AREIAANA-ADMIN`
- usuario: `AREIAANA-USUARIO`

## Publicação (cache busting)
O frontend usa a tag de build `2026-02-22d` em recursos e no rodapé para facilitar validação de atualização no GitHub Pages.
