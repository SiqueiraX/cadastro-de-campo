# Cadastro de campo

Formulário público, GPS, fotos e exportação administrativa em Excel e ZIP.

## Publicação na Vercel

1. Importe este repositório como projeto, usando a raiz e o preset Other.
2. Conecte um banco Neon Postgres ao projeto. Confirme a variável DATABASE_URL no ambiente Production.
3. Adicione ADMIN_PASSWORD com uma senha longa e exclusiva em Environment Variables.
4. Faça o deploy. A compilação cria a tabela campo_registros. Um novo deploy aplica variáveis adicionadas depois da primeira tentativa.

Compartilhe a raiz do site com a equipe. Em /admin, use a senha para exportar a planilha e as fotos. As imagens maiores são comprimidas pelo celular antes do envio.
