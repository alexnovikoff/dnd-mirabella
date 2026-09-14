-- Размер плитки на доске связей: ширина и высота в пикселях полотна на 100%,
-- null — плитка по умолчанию. Координаты становятся дробными: при
-- растягивании стоит левый верхний угол, а центр сдвигается на доли процента.
--
-- Колонка size — от первой версии этой ветки, в main её не было. Если её
-- успели накатить, она уходит; на чистой базе строка ничего не делает.
--
-- Накатывать ДО мёржа: колонки добавляются, а real вместо integer прежняя
-- сборка читает теми же числами и пишет в него свои целые.
ALTER TABLE "board_positions" DROP COLUMN IF EXISTS "size";--> statement-breakpoint
ALTER TABLE "board_positions" ALTER COLUMN "x" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "board_positions" ALTER COLUMN "y" SET DATA TYPE real;--> statement-breakpoint
ALTER TABLE "board_positions" ADD COLUMN "width" integer;--> statement-breakpoint
ALTER TABLE "board_positions" ADD COLUMN "height" integer;
