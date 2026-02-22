# Portal de Alertas - Remessas

Sistema web para importar dados de remessas (`.xlsx`, `.xls`, `.csv`, `.json`) e gerar alertas por contrato.

## Link oficial
- Repositório: `marianatsq97-ctrl/portal-alertas-remessa`
- GitHub Pages: `https://marianatsq97-ctrl.github.io/portal-alertas-remessa/`

## Uso rápido (sem instalar nada)
1. Abra o portal no GitHub Pages.
2. Clique em **Selecionar arquivo** e importe sua planilha.
3. Ajuste os filtros (ano, mês e período inicial/final).
4. Confira os cards de resumo, gráfico e tabela detalhada.

## Executar localmente (opcional)
Na pasta do projeto:

```bash
python3 -m http.server 4173
```

Depois abra:

`http://localhost:4173`

## Publicar atualização no GitHub (fluxo completo)
> Faça exatamente 1 comando por linha no PowerShell/terminal.

```bash
git checkout work
git pull origin work
git add .
git commit -m "Atualiza portal"
git push origin work
```

Abra o GitHub e faça PR **work -> main**:
1. **Pull requests** -> **New pull request**
2. Base: `main` / Compare: `work`
3. **Create pull request** -> **Merge pull request**

## Publicação no Pages
No GitHub: **Settings -> Pages**
- Source: `Deploy from a branch`
- Branch: `main` / `/root`

Após merge, aguarde 1–3 minutos e atualize a página com `Ctrl + F5`.
