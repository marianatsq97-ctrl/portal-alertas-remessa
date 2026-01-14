import os, json, smtplib
from email.message import EmailMessage
from pathlib import Path

ALERTS = Path("portal/alerts.json")

def env(name, required=True, default=None):
    v = os.getenv(name, default)
    if required and (v is None or str(v).strip() == ""):
        raise SystemExit(f"Faltou secret/env: {name}")
    return v

def main():
    data = json.loads(ALERTS.read_text(encoding="utf-8"))
    total = int(data.get("total_plano_de_acao", 0))

    if total <= 0:
        print("Sem PLANO_DE_ACAO. Email não enviado.")
        return

    host = env("SMTP_HOST")
    port = int(env("SMTP_PORT", required=False, default="587"))
    user = env("SMTP_USER")
    pwd  = env("SMTP_PASS")

    recipients = env("ALERT_RECIPIENTS")
    to_list = [x.strip() for x in recipients.split(",") if x.strip()]

    msg = EmailMessage()
    msg["From"] = user
    msg["To"] = ", ".join(to_list)
    msg["Subject"] = f"⚠️ ALERTA Remessa: {total} cliente(s) > 7 dias sem remessa"

    lines = [
        f"Gerado em: {data.get('gerado_em')}",
        f"Plano de ação (>7 dias): {total}",
        "",
        "Clientes em PLANO DE AÇÃO:",
        ""
    ]

    shown = 0
    for r in data.get("registros", []):
        if r.get("Status") != "PLANO_DE_ACAO":
            continue
        shown += 1
        lines.append(f"• {r.get('CodCliente','')} - {r.get('NomeCliente','')} | {r.get('DiasSemRemessa')} dias | Última: {r.get('DataUltimaRemessa')}")
        if shown >= 200:
            lines.append("")
            lines.append("(limitado a 200 itens)")
            break

    msg.set_content("\n".join(lines))

    with smtplib.SMTP(host, port) as s:
        s.starttls()
        s.login(user, pwd)
        s.send_message(msg)

    print("Email enviado.")

if __name__ == "__main__":
    main()
