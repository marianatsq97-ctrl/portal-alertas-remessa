/*
  SQL42 COMPLEMENTAR
  Regra: DiasSemRemessa = Data de hoje - Data da última remessa
  Se DiasSemRemessa > 7 então Status = PLANO_DE_ACAO
*/

SELECT
    c.CodCliente,
    c.NomeCliente,
    MAX(r.DataRemessa) AS DataUltimaRemessa,
    DATEDIFF(DAY, MAX(r.DataRemessa), GETDATE()) AS DiasSemRemessa,
    CASE
        WHEN DATEDIFF(DAY, MAX(r.DataRemessa), GETDATE()) > 7 THEN 'PLANO_DE_ACAO'
        ELSE 'OK'
    END AS Status,
    CASE
        WHEN DATEDIFF(DAY, MAX(r.DataRemessa), GETDATE()) > 7 THEN 'Criar PLANO DE AÇÃO'
        ELSE 'Sem ação'
    END AS Acao
FROM Remessas r
INNER JOIN Clientes c ON c.CodCliente = r.CodCliente
GROUP BY c.CodCliente, c.NomeCliente;

/*
  TOPCON - ALERTA DE ÚLTIMO CONSUMO POR CLIENTE
  Considera TopCon com data de último consumo/remessa
*/

SELECT
    t.CodCliente,
    t.NomeCliente,
    t.DataUltimaRemessa,
    DATEDIFF(DAY, t.DataUltimaRemessa, GETDATE()) AS DiasSemRemessa,
    CASE
        WHEN DATEDIFF(DAY, t.DataUltimaRemessa, GETDATE()) > 7 THEN 'PLANO_DE_ACAO'
        ELSE 'OK'
    END AS Status
FROM TopConUltimoConsumo t
WHERE DATEDIFF(DAY, t.DataUltimaRemessa, GETDATE()) > 7
ORDER BY DATEDIFF(DAY, t.DataUltimaRemessa, GETDATE()) DESC;
