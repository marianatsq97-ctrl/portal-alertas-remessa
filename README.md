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
