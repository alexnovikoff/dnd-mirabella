-- Голосования за цитаты, крита и провалов в проекте нет: кнопки голоса не
-- было с db0f740, отметить крит или провал нельзя ни в шите, ни в экшенах.
-- Колонки и таблица уходят вместе с кодом, который их читал.
--
-- Миграция удаляет — на Neon её накатывают ПОСЛЕ деплоя кода без этих
-- колонок: прежняя сборка их ещё выбирает и упала бы на первом запросе.
DROP TABLE "votes" CASCADE;--> statement-breakpoint
ALTER TABLE "entries" DROP COLUMN "roll";--> statement-breakpoint
ALTER TABLE "entries" DROP COLUMN "is_crit";--> statement-breakpoint
ALTER TABLE "entries" DROP COLUMN "is_fail";