from __future__ import annotations

import csv
import json
from datetime import date, datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
OUTPUT_FILE = BASE_DIR / "alerts.json"

SUPPORTED_EXTENSIONS = {".csv", ".csc", ".xls", ".xlsx"}

DATE_COLUMNS = ["DataUltimaRemessa", "Data_ultima_remessa", "data_ultima_remessa", "UltimaRemessa"]
CLIENT_CODE_COLUMNS = ["CodCliente", "CodigoCliente", "Cliente", "Cod_Cliente"]
CLIENT_NAME_COLUMNS = ["NomeCliente", "Nome", "RazaoSocial", "ClienteNome"]


def parse_date(value: str) -> date | None:
    value = (value or "").strip()
    if not value:
        return None

    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return None


def first_value(row: dict[str, str], candidates: list[str], default: str = "") -> str:
    for key in candidates:
        if key in row and str(row.get(key, "")).strip():
            return str(row[key]).strip()
    return default


def read_delimited_rows(path: Path) -> list[dict[str, str]]:
    content = path.read_text(encoding="utf-8").splitlines()
    if not content:
        return []

    delimiter = ";" if content[0].count(";") > content[0].count(",") else ","
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle, delimiter=delimiter)
        return [dict(row) for row in reader]


def read_excel_rows(path: Path) -> list[dict[str, str]]:
    try:
        import pandas as pd  # type: ignore
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            "Para processar XLS/XLSX no GitHub Action, instale pandas+openpyxl+xlrd."
        ) from exc

    rows: list[dict[str, str]] = []
    data_frame = pd.read_excel(path)  # primeira aba
    for _, row in data_frame.fillna("").iterrows():
        rows.append({str(key): str(value) for key, value in row.to_dict().items()})
    return rows


def read_rows(path: Path) -> list[dict[str, str]]:
    extension = path.suffix.lower()
    if extension in {".csv", ".csc"}:
        return read_delimited_rows(path)
    if extension in {".xls", ".xlsx"}:
        return read_excel_rows(path)
    return []


def discover_input_files() -> list[Path]:
    if not DATA_DIR.exists():
        return []
    return sorted(
        file
        for file in DATA_DIR.iterdir()
        if file.is_file() and file.suffix.lower() in SUPPORTED_EXTENSIONS
    )


def main() -> None:
    today = date.today()
    alerts: list[dict[str, str | int]] = []

    input_files = discover_input_files()
    for data_file in input_files:
        for row in read_rows(data_file):
            remessa_raw = first_value(row, DATE_COLUMNS)
            last_shipment = parse_date(remessa_raw)
            if not last_shipment:
                continue

            days_without = (today - last_shipment).days
            if days_without <= 7:
                continue

            client_code = first_value(row, CLIENT_CODE_COLUMNS, "SEM_COD")
            client_name = first_value(row, CLIENT_NAME_COLUMNS, "Cliente sem nome")

            alerts.append(
                {
                    "Fonte": data_file.name,
                    "CodCliente": client_code,
                    "NomeCliente": client_name,
                    "DataUltimaRemessa": last_shipment.isoformat(),
                    "DiasSemRemessa": days_without,
                    "Status": "PLANO_DE_ACAO",
                    "Acao": "Criar PLANO DE AÇÃO",
                }
            )

    alerts.sort(key=lambda item: int(item["DiasSemRemessa"]), reverse=True)

    payload = {
        "gerado_em": today.isoformat(),
        "regra": "data_hoje - data_ultima_remessa > 7",
        "formatos_suportados": ["CSC", "CSV", "XLS", "XLSX"],
        "total_alertas": len(alerts),
        "alertas": alerts,
    }

    OUTPUT_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK: {len(alerts)} alertas gerados em {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
