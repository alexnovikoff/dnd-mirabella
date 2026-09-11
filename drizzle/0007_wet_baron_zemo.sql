-- Анонс следующей игры над лентой «Хроники».
ALTER TABLE "campaigns" ADD COLUMN "next_game" text;
--> statement-breakpoint
-- Первый анонс ставим здесь же: на засеянной базе сид уже не отработает,
-- а пустой блок на главной выглядел бы как недоделка. Дальше его правят
-- прямо со страницы.
UPDATE "campaigns" SET "next_game" = '16 сентября (среда), старт в 20.00' WHERE "next_game" IS NULL;
