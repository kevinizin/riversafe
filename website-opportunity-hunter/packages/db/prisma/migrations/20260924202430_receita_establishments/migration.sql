-- CreateTable
CREATE TABLE "receita_establishments" (
    "cnpj" VARCHAR(14) NOT NULL,
    "cnpjBasico" VARCHAR(8) NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "situacao" VARCHAR(2) NOT NULL,
    "matrizFilial" VARCHAR(1) NOT NULL,
    "dataInicio" TIMESTAMP(3),
    "cnaePrincipal" VARCHAR(7) NOT NULL,
    "cnaeSecundaria" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cep" VARCHAR(8),
    "uf" VARCHAR(2) NOT NULL,
    "municipioCode" VARCHAR(4),
    "municipioNome" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "porte" VARCHAR(2),
    "capitalSocial" DECIMAL(18,2),
    "naturezaJuridica" VARCHAR(4),
    "importTag" TEXT NOT NULL,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receita_establishments_pkey" PRIMARY KEY ("cnpj")
);

-- CreateIndex
CREATE INDEX "receita_establishments_uf_municipioNome_idx" ON "receita_establishments"("uf", "municipioNome");

-- CreateIndex
CREATE INDEX "receita_establishments_uf_cnaePrincipal_idx" ON "receita_establishments"("uf", "cnaePrincipal");

-- CreateIndex
CREATE INDEX "receita_establishments_dataInicio_idx" ON "receita_establishments"("dataInicio");

-- CreateIndex
CREATE INDEX "receita_establishments_situacao_idx" ON "receita_establishments"("situacao");

-- CreateIndex
CREATE INDEX "receita_establishments_importTag_idx" ON "receita_establishments"("importTag");
