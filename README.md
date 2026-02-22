# Portal de Alertas – Remessas

Sistema em layout dashboard para monitorar clientes sem remessa.

## Ajustes desta versão
- Mantido o layout do portal e removidos elementos extras que estavam poluindo o topo.
- Corrigida importação de arquivo para aceitar: **CSV, JSON, XLSX e XLS**.
- Correção principal para seu problema: arquivo Excel agora é lido como planilha (binário), evitando texto corrompido no detalhamento.
- Filtros de ano/mês continuam atualizando resumo, tabela e gráfico.
- Regras de alerta:
  - OK: 0 a 7 dias
  - Atenção: 8 a 14 dias
  - Atenção grave: 15 a 21 dias
  - Plano de ação: acima de 21 dias

## Como usar
1. Clique em **Selecionar arquivo** e escolha seu `.xlsx`.
2. Clique em **Carregar arquivo**.
3. Se necessário, marque **Mostrar materiais/produtos** para ver a coluna extra.

## Publicação automática no GitHub Pages
Se o GitHub estiver mostrando implantação antiga (ex.: "10 horas atrás"), normalmente é porque não houve novo deploy no branch correto.

Este repositório agora inclui workflow em `.github/workflows/pages.yml` para publicar automaticamente quando houver push no branch `main`.

Checklist:
1. Confirme que o commit está no branch `main` no GitHub.
2. Em **Settings → Pages**, deixe **Build and deployment = GitHub Actions**.
3. Faça um novo push para `main` (ou rode manualmente em **Actions → Deploy GitHub Pages → Run workflow**).
4. Aguarde o job `deploy` finalizar e atualize a página.

## Se o link abrir versão antiga
- Este projeto agora força atualização com versão nos assets (`?v=20260222b`).
- O workflow de Pages foi ampliado para `main`, `master` e `work` para evitar deploy no branch errado.
- Se ainda aparecer versão antiga, faça `Ctrl+F5`/limpeza de cache e reimporte o `.xlsx`.
- Tabela com paginação para melhorar desempenho em arquivos grandes.
- Importação com tratamento de codificação (UTF-8/Windows-1252) para evitar caracteres quebrados.

