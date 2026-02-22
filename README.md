# Portal de Alertas – Remessas

Aplicativo web para acompanhar clientes/contratos sem remessa e agir com prioridade.

## Melhorias implementadas
- Novas faixas de alerta:
  - **OK**: 0 a 7 dias;
  - **Atenção**: 8 a 14 dias;
  - **Atenção grave**: 15 a 21 dias;
  - **Plano de ação**: acima de 21 dias.
- Exibição em **dias/meses/anos** quando ultrapassa 31 e 365 dias.
- Ordenação por ritmo da última remessa (maior tempo sem remessa primeiro).
- Chave de vínculo por **CNPJ + contrato**, agregando produtos.
- Inclusão de **nome da obra** e **volume da obra** no detalhamento.
- Opção para ocultar/mostrar coluna de materiais/produtos.
- Filtro de ano/mês que atualiza automaticamente cards, tabela e gráfico.
- Logo Areia Ana exibida no cabeçalho.

## Como usar
1. Abra `index.html`.
2. Clique em **Carregar demo** para testar ou importe um arquivo `.csv`/`.json`.
3. Use filtros de ano e mês para analisar períodos.

> Compatível com GitHub Pages (site estático).
