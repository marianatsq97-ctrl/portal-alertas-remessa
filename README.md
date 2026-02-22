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

### Se no GitHub aparecer "There isn't anything to compare"
Se a tela de **Comparing changes** mostrar que `main` e `work` são idênticas, significa que **não existe PR pendente** para mergear.

Nesse caso, faça estas validações em sequência:
1. Abra **Actions** e confirme o último workflow `pages build and deployment` com status verde.
2. Abra **Settings → Pages** e clique em **Visit site**.
3. Faça atualização forçada no navegador (`Ctrl+F5`) ou teste em aba anônima.
4. Se ainda não refletir, aguarde 2 a 5 minutos e recarregue novamente (cache/CDN do Pages).

Se você precisar publicar mudança nova, primeiro gere um commit novo na `work`:
```powershell
git checkout work
git add .
git commit -m "Nova atualização do portal"
git push origin work
```
Depois abra o PR `work -> main`.

### Se você estiver na tela de conflito do GitHub (editor com `<<<<<<<`/`=======`/`>>>>>>>`)
Quando abrir a tela **Resolve conflicts** do PR (como no seu print), faça assim:
1. Resolva um arquivo por vez (`app.js`, `index.html`, `style.css`).
2. Apague os marcadores de conflito: `<<<<<<<`, `=======`, `>>>>>>>`.
3. Mantenha **apenas um bloco final** por arquivo (sem código duplicado).
4. Clique em **Mark as resolved** em cada arquivo.
5. Clique em **Commit merge**.
6. Volte ao PR e clique em **Merge pull request**.

Dica prática:
- Se aparecer duas versões completas do arquivo, mantenha somente a versão correta e remova a outra inteira.
- O arquivo só pode ficar com um conteúdo final limpo, sem nenhum marcador de conflito.

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
