import csv
import json
from datetime import date, datetime
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
DATA = BASE / "data"
OUT = BASE / "alerts.json"

def parse_date(v):
    for fmt in ("%Y-%m-%d","%d/%m/%Y"):
        try:
            return datetime.strptime(v,fmt).date()
        except:
            continue
    return None

alerts=[]
today=date.today()

for f in DATA.glob("*.csv"):
    with open(f,encoding="utf-8") as file:
        reader=csv.DictReader(file,delimiter=";" if ";" in file.readline() else ",")
        file.seek(0)
        reader=csv.DictReader(file)
        for row in reader:
            d=parse_date(row["DataUltimaRemessa"])
            if d:
                dias=(today-d).days
                if dias>7:
                    alerts.append({
                        "CodCliente":row["CodCliente"],
                        "NomeCliente":row["NomeCliente"],
                        "DataUltimaRemessa":d.isoformat(),
                        "DiasSemRemessa":dias
                    })

payload={
    "gerado_em":today.isoformat(),
    "total_alertas":len(alerts),
    "alertas":alerts
}

OUT.write_text(json.dumps(payload,indent=2,ensure_ascii=False))
