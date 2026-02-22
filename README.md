# Portal de Alertas – Remessas

Sistema visual para monitorar clientes sem remessa.

## Funcionalidades
- Login com perfis (`admin` e `usuario`).
- Recuperação de senha local por chave de recuperação.
- Importação de planilhas `.csv`, `.xlsx` e `.xls`.
- Consolidação por cliente usando CNPJ como chave principal.
- Dashboard com 4 níveis de alerta:
  - 0 a 7 dias: **OK**
  - 8 a 14 dias: **Atenção**
  - 15 a 21 dias: **Atenção grave**
  - acima de 21 dias: **Plano de ação**
- Detalhamento com colunas de volume e nome da obra.
- Filtro por cliente/CNPJ, contrato, mês e status.
- Ritmo da última remessa exibido em dias, meses ou anos.

## Acessos padrão
- `admin` / `1234`
- `usuario` / `1234`

## Chaves de recuperação
- admin: `AREIAANA-ADMIN`
- usuario: `AREIAANA-USUARIO`

Hospedado via GitHub Pages.
