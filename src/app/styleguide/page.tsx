import { Screen } from '@/components/shell/Screen';
import {
  AccentQuoteCard,
  DropZone,
  ImagePlaceholder,
  MonoLabel,
  ParchmentCard,
  StatusPill,
} from '@/components/primitives';
import styles from './styleguide.module.css';

const SWATCHES: { token: string; note: string }[] = [
  { token: '--desk', note: 'фон вокруг листа' },
  { token: '--sheet', note: 'лист' },
  { token: '--card', note: 'карточка/поле' },
  { token: '--card-2', note: 'приглушённая' },
  { token: '--tag', note: 'тег' },
  { token: '--board', note: 'канва доски' },
  { token: '--rule', note: 'внутренние линии' },
  { token: '--rule-soft', note: 'мягкая линия' },
  { token: '--rule-sheet', note: 'внешняя рамка' },
  { token: '--dash', note: 'пунктир' },
  { token: '--accent', note: 'акцент' },
  { token: '--accent-hover', note: 'акцент, ховер' },
  { token: '--status-open', note: 'открыта' },
  { token: '--status-done', note: 'раскрыта' },
  { token: '--status-dead', note: 'тупик' },
];

export default function StyleguidePage() {
  return (
    <Screen
      title="Витрина"
      note="Служебный экран этапа 1: примитивы и токены рядом, чтобы сверять с прототипом."
    >
      <section className={styles.section}>
        <h2 className={styles.heading}>Токены цвета</h2>
        <div className={styles.swatches}>
          {SWATCHES.map(({ token, note }) => (
            <div key={token} className={styles.swatch}>
              <div className={styles.chip} style={{ background: `var(${token})` }} />
              <MonoLabel size={9} tracking="0.06em" uppercase={false} block>
                {token}
              </MonoLabel>
              <MonoLabel size={9} tracking="0.06em" tone="faint" uppercase={false} block>
                {note}
              </MonoLabel>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Составные фоны</h2>
        <div className={styles.row}>
          <div className={styles.col}>
            <div className={styles.chip} style={{ width: 240, background: 'var(--card-bg)' }} />
            <MonoLabel size={9} uppercase={false}>
              --card-bg (README)
            </MonoLabel>
          </div>
          <div className={styles.col}>
            <div className={styles.chip} style={{ width: 240, background: 'var(--card-bg-2)' }} />
            <MonoLabel size={9} uppercase={false}>
              --card-bg-2 (прототип)
            </MonoLabel>
          </div>
          <div className={styles.col}>
            <div className={styles.chip} style={{ width: 240, background: 'var(--bar-bg)' }} />
            <MonoLabel size={9} uppercase={false}>
              --bar-bg
            </MonoLabel>
          </div>
          <div className={styles.col}>
            <div className={styles.chip} style={{ width: 240, background: 'var(--aside-bg)' }} />
            <MonoLabel size={9} uppercase={false}>
              --aside-bg
            </MonoLabel>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Типографика</h2>
        <div className={styles.col}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 54,
              lineHeight: 0.98,
              fontWeight: 600,
            }}
          >
            Слёзы Мирабеллы
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 30,
              lineHeight: 1.1,
              fontWeight: 600,
            }}
          >
            Метель продала визирю его собственный перстень
          </div>
          <div style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--ink-body)', maxWidth: 620 }}>
            Пока Джаду отвлекал стражу горящим ковром, Метель успела трижды перепродать печать
            визиря Ирсафа — и в третий раз самому визирю.
          </div>
          <div
            style={{
              fontSize: 15,
              lineHeight: 1.65,
              fontStyle: 'italic',
              color: 'var(--ink-italic)',
              maxWidth: 480,
            }}
          >
            Семь артефактов, исполняющих желания. Шесть ещё не найдены, а первую мы, кажется, уже
            потратили не туда.
          </div>
          <div className={styles.row}>
            <MonoLabel size={9} tracking="0.08em">
              mono 9 · 0.08em
            </MonoLabel>
            <MonoLabel size={10} tracking="0.1em">
              mono 10 · 0.1em
            </MonoLabel>
            <MonoLabel size={11} tracking="0.16em">
              mono 11 · 0.16em
            </MonoLabel>
            <MonoLabel size={10} tracking="0.14em" tone="faint">
              mono 10 · faint
            </MonoLabel>
            <MonoLabel size={10} tracking="0.08em" tone="accent">
              mono 10 · accent
            </MonoLabel>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>StatusPill</h2>
        <div className={styles.row}>
          <StatusPill status="open" links={3} />
          <StatusPill status="resolved" links={1} />
          <StatusPill status="dead_end" links={5} />
          <StatusPill status="open" />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Карточки</h2>
        <div className={styles.grid3}>
          <ParchmentCard className={styles.span2}>
            <MonoLabel size={10} tracking="0.06em" tone="faint">
              Сессия 14 · Базар Халь-Раши · <span style={{ color: 'var(--accent)' }}>Крит 20</span>
            </MonoLabel>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 30,
                lineHeight: 1.1,
                fontWeight: 600,
                color: 'var(--ink)',
              }}
            >
              Метель продала визирю его собственный перстень
            </div>
            <div style={{ fontSize: 15, lineHeight: 1.7 }}>
              Так мы узнали, что печать открывает не дверь, а колодец Соляных путей.
            </div>
            <ImagePlaceholder caption="Скриншот или арт сцены" height={150} />
            <div className={styles.tags}>
              {['#метель', '#ирсаф', '#печать'].map((tag) => (
                <MonoLabel
                  key={tag}
                  size={10}
                  tracking="0.06em"
                  tone="muted"
                  className={styles.tag}
                >
                  {tag}
                </MonoLabel>
              ))}
            </div>
          </ParchmentCard>

          <div className={styles.col}>
            <AccentQuoteCard
              quote="Я не крал. Я взял на хранение. У себя."
              author="— Оген, сессия 13"
              meta="Цитата недели · 7 голосов"
            />
            <ParchmentCard padding="tight" interactive>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 24,
                  lineHeight: 1.3,
                  fontStyle: 'italic',
                  color: 'var(--ink)',
                }}
              >
                «Мы не заблудились. Мы разведываем.»
              </div>
              <MonoLabel size={9} tracking="0.08em" tone="faint">
                Аэлис · С14 · ♦ 5
              </MonoLabel>
            </ParchmentCard>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>Цитата недели (feature)</h2>
        <AccentQuoteCard
          variant="feature"
          eyebrow="Цитата недели · сессия 13"
          quote="Я не крал. Я взял на хранение. У себя."
          author="— Оген"
          meta="♦ 7 голосов"
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.heading}>ImagePlaceholder и DropZone</h2>
        <ImagePlaceholder caption="Скриншот или арт сцены" height={150} />
        <div className={styles.grid3}>
          <ImagePlaceholder
            caption="Соляные пути · панорама"
            align="bottom"
            hatchStep={8}
            minHeight={152}
          />
          <ImagePlaceholder caption="Гробница · С13" align="bottom" hatchStep={8} minHeight={152} />
          <ImagePlaceholder caption="Портрет визиря" align="bottom" hatchStep={8} minHeight={152} />
        </div>
        <div className={styles.grid6}>
          <ImagePlaceholder hatchStep={6} />
          <ImagePlaceholder hatchStep={6} />
          <ImagePlaceholder hatchStep={6} />
          <ImagePlaceholder hatchStep={6} />
          <ImagePlaceholder hatchStep={6} />
          <DropZone variant="cell" label="Drop img" />
        </div>
        <DropZone label="Бросьте файлы сюда · группа «Сессия 14»" />
        <DropZone label="Бросьте файлы сюда · группа «Сессия 14»" active />
      </section>
    </Screen>
  );
}
