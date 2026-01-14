import json
from datetime import date
from pathlib import Path
import pandas as pd

ARQUIVO = Path("data/SQL42.xlsx")
SAIDA = Path("portal/alerts.json")

# Regras
ATENCAO_MIN = 5
ATENCAO_MAX = 7
PLANO_DE_ACAO_MIN = 8  # >7

# Colunas esperadas na planilha (ajuste aqui se o nome for diferente)
COL_COD = "Cod Cliente"
COL_CLIENTE = "Cliente"
COL_DATA = "Data Remessa"

def definir_status(dias: int) -> str:
    if dias >= PLANO_DE_ACAO_MIN:
        return "PLANO_DE_ACAO"
    if ATENCAO_MIN <= dias <= ATENCAO_MAX:
        return "ATENCAO"
    return "OK"

def definir_acao(status: str) -> str:
    if status == "PLANO_DE_ACAO":
        return "Criar PLANO DE AÇÃO"
    if status == "ATENCAO":
        return "Acompanhar / confirmar programação"
    return "OK"

def main():
    if not ARQUIVO.exists():
        raise SystemExit(f"Arquivo não encontrado: {ARQUIVO}")

    xls = pd.ExcelFile(ARQUIVO)
    df = None
    aba_usada = None

    for aba in xls.sheet_names:
        tmp = pd.read_excel(ARQUIVO, sheet_name=aba)
        cols = set(tmp.columns.astype(str))
        if {COL_COD, COL_CLIENTE, COL_DATA}.issubset(cols):
            df = tmp
            aba_usada = aba
            break

    if df is None:
        raise SystemExit(f"Não achei as colunas: {COL_COD}, {COL_CLIENTE}, {COL_DATA} em nenhuma aba.")

    df[COL_DATA] = pd.to_datetime(df[COL_DATA], errors="coerce")
    df = df.dropna(subset=[COL_DATA, COL_COD, COL_CLIENTE])

    ult = (
        df.groupby([COL_COD, COL_CLIENTE], as_index=False)[COL_DATA]
          .max()
          .rename(columns={COL_DATA: "DataUltimaRemessa"})
    )

    hoje = pd.Timestamp(date.today())
    ult["DiasSemRemessa"] = (hoje - ult["DataUltimaRemessa"]).dt.days.astype(int)

    ult["Status"] = ult["DiasSemRemessa"].apply(definir_status)
    ult["Acao"] = ult["Status"].apply(definir_acao)

    registros = []
    for _, r in ult.iterrows():
        registros.append({
            "CodCliente": str(r[COL_COD]).strip(),
            "NomeCliente": str(r[COL_CLIENTE]).strip(),
            "DataUltimaRemessa": pd.Timestamp(r["DataUltimaRemessa"]).date().isoformat(),
            "DiasSemRemessa": int(r["DiasSemRemessa"]),
            "Status": str(r["Status"]),
            "Acao": str(r["Acao"])
        })

    order = {"PLANO_DE_ACAO": 0, "ATENCAO": 1, "OK": 2}
    registros.sort(key=lambda x: (order.get(x["Status"], 9), -x["DiasSemRemessa"]))

    cont = {"OK": 0, "ATENCAO": 0, "PLANO_DE_ACAO": 0}
    for r in registros:
        cont[r["Status"]] += 1

    payload = {
        "fonte": ARQUIVO.name,
        "aba_usada": aba_usada,
        "gerado_em": date.today().isoformat(),
        "total_clientes": len(registros),
        "contagem_status": cont,
        "total_plano_de_acao": cont["PLANO_DE_ACAO"],
        "registros": registros
    }

    SAIDA.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print("OK: alerts.json gerado")

if __name__ == "__main__":
    main()
