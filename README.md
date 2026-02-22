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

Se aparecer `On branch main`, deu certo.

### Se a branch `work` ainda não existir no seu clone/remoto
No seu print, esse foi exatamente o erro (`src refspec work does not match any`), então crie a branch localmente a partir da `main` e publique:
```powershell
git checkout -b work
git push -u origin work
```

### Se a branch `work` já existir
```powershell
git checkout work
git push -u origin work
```

### Se aparecer `fatal: destination path '\.' already exists and is not an empty directory`
Esse erro significa que o repositório **já está clonado** na pasta atual. Nesse caso, **não rode `git clone` novamente**.

Use este fluxo:
```powershell
cd "C:\SISTEMAS MARIANA\portal-alertas-remessa"
git status
git checkout work
git pull origin work
```

### Fluxo final para publicar no GitHub Pages (quando já existe clone)
1. Atualize `work`:
   ```powershell
   git checkout work
   git pull origin work
   ```
2. No GitHub, abra o PR `work -> main`.
3. Se o PR mostrar conflito, sincronize a branch local e envie:
   ```powershell
   git checkout work
   git fetch origin
   git merge origin/main
   git add .
   git commit -m "Resolve conflitos da work com main"
   git push origin work
   ```
4. Faça o merge do PR e aguarde 1 a 3 minutos para o Pages atualizar.

## Próximos passos (sugestão de evolução)
- Cadastro digital de pedidos (cliente, material, quantidade, entrega).
- Agendamento automático de entregas com ordem de carga para motorista.
- Emissão de NF-e integrada (começando com emissão simulada e depois integração com SEFAZ).
- App leve para motoristas confirmarem carregamento/entrega.
- Fluxo de cancelamento com reemissão e redirecionamento de carga.
