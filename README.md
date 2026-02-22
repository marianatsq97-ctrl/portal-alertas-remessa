# Portal de Alertas - Remessas

Sistema visual para monitorar clientes sem remessa.

## Funcionalidades
- Importação de Excel (SQL42)
- Dashboard com status
- Tabela com filtros por coluna
- Visual moderno (preto + laranja)

## Publicação oficial deste projeto
- Este portal deve permanecer publicado neste repositório: `marianatsq97-ctrl/portal-alertas-remessa`.
- URL oficial do GitHub Pages: `https://marianatsq97-ctrl.github.io/portal-alertas-remessa/`.
- Em **Settings → Pages**, mantenha a publicação pela branch principal deste mesmo repositório.

## Erro comum no Windows: `fatal: not a git repository`
Se você estiver vendo esse erro no PowerShell, normalmente está executando comandos Git na pasta errada.

### Passo a passo (copiar e colar)
```powershell
cd "C:\SISTEMAS MARIANA\portal-alertas-remessa"
Get-ChildItem -Force
```

- Se a pasta estiver **vazia**, execute:
```powershell
git clone https://github.com/marianatsq97-ctrl/portal-alertas-remessa.git .
```

- Se a pasta **não estiver vazia**, execute:
```powershell
cd "C:\SISTEMAS MARIANA"
git clone https://github.com/marianatsq97-ctrl/portal-alertas-remessa.git
cd "C:\SISTEMAS MARIANA\portal-alertas-remessa"
```

Depois valide:
```powershell
git status
git branch -a
```

Se aparecer `On branch main`, deu certo. A partir daí, para publicar a branch de trabalho:
```powershell
git checkout work
git push -u origin work
```

## Próximos passos (sugestão de evolução)
- Cadastro digital de pedidos (cliente, material, quantidade, entrega).
- Agendamento automático de entregas com ordem de carga para motorista.
- Emissão de NF-e integrada (começando com emissão simulada e depois integração com SEFAZ).
- App leve para motoristas confirmarem carregamento/entrega.
- Fluxo de cancelamento com reemissão e redirecionamento de carga.
