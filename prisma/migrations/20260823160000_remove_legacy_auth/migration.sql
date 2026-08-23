ALTER TABLE "account" ADD COLUMN "issuer" TEXT;

UPDATE "account"
SET "issuer" = CASE
    WHEN "providerId" = 'credential' THEN 'local:credential'
    ELSE 'local:oauth:' || "providerId"
END;

ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;
DROP INDEX "account_providerId_accountId_key";
CREATE UNIQUE INDEX "account_issuer_accountId_key" ON "account"("issuer", "accountId");

ALTER TABLE "user" DROP COLUMN "passwordHash";
