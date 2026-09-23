# Diretorios espelhados — nao editar aqui

`contracts/`, `states/`, `permissions/` e `constants/` sao copia controlada do
repositorio **tironirifa-backend**, onde os contratos sao versionados.

`npm run contracts:verify` recalcula o sha256 de cada arquivo e compara com
`packages/shared/CONTRACTS_SNAPSHOT.json`. O CI roda essa verificacao antes do
build: uma edicao feita so deste lado reprova, com o arquivo divergente
nomeado.

Para mudar um contrato: altere no backend, rode `npm run contracts:snapshot`
la (subindo a versao de `@campaigns/shared`), e traga as arvores junto com o
manifesto.

Permissao no frontend e apresentacao — esconder um botao. A autorizacao
continua sendo decidida pela API, contra o vinculo no PostgreSQL.
