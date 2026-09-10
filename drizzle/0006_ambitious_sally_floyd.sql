-- Кадр переезжает в свою колонку. До этой миграции portrait хранил
-- вырезанный кадр, а оригинал лежал в portrait_source — из-за этого кадр
-- подменял портрет и на странице персонажа, и в аватарах Хроники.
-- Возвращаем portrait оригиналу, кадр уводим в portrait_crop_url:
-- его читает только карточка в «Партии».
UPDATE "characters"
   SET "portrait_crop_url" = "portrait",
       "portrait" = "portrait_source"
 WHERE "portrait_source" IS NOT NULL
   AND "portrait_source" IS DISTINCT FROM "portrait";
--> statement-breakpoint
-- Рамка без файла кадра ничего не значит: держим их вместе.
UPDATE "characters" SET "portrait_crop" = NULL WHERE "portrait_crop_url" IS NULL;
--> statement-breakpoint
ALTER TABLE "characters" DROP COLUMN "portrait_source";
