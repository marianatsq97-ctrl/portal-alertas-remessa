import pandas as pd
import json
from datetime import date

df = pd.read_excel("data/SQL42.xlsx")

df["Data Remessa"] = pd.to_datetime(df["Data Remessa"])
ult = df.groupby(["Cod Cliente","Cliente"])["Data Remessa"].max().reset_index()

hoje = pd.Timestamp(date.today())
ult["DiasSemRemessa"] = (hoje - ult["Data Remessa"]).dt.days

def status(d):
    if d > 7: return "PLANO_DE_ACAO"
    if d >= 5: return "ATENCAO"
    return "OK"

ult["Status"] = ult["DiasSemRemessa"].apply(status)

registros = []
for _, r in ult.iterrows():
    registros.append({
        "CodCliente": r["Cod Cliente"],
        "NomeCliente": r["Cliente"],
        "DataUltimaRemessa": r["Data Remessa"].date().isoformat(),
        "DiasSemRemessa": int(r["DiasSemRemessa"]),
        "Status": r["Status"]
    })

with open("portal/alerts.json","w",encoding="utf-8") as f:
    json.dump({"registros": registros}, f, ensure_ascii=False, indent=2)
