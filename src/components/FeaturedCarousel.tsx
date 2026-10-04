"use client";

import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react";

const AUTO_ADVANCE_MS = 4500;
/** На столько курсор должен уехать, чтобы это считалось перетаскиванием, а не
 * кликом по карточке. */
const DRAG_THRESHOLD_PX = 6;
/** Пауза после ручного перелистывания или свайпа: иначе автопрокрутка
 * дёргает ленту из-под руки у того, кто только что сам её пролистал. */
const RESUME_AFTER_MS = 9000;

/** Какая карточка сейчас стоит у левого края. Считается по DOM, а не по
 * состоянию: ленту можно крутить и пальцем, и колесом мыши, и тогда никакое
 * хранимое в React число за ней не поспевает. */
function currentIndex(track: HTMLElement): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < track.children.length; i++) {
    const distance = Math.abs((track.children[i] as HTMLElement).offsetLeft - track.scrollLeft);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/**
 * Лента товаров с автопрокруткой и стрелками.
 *
 * Карточки приходят готовыми элементами (`children`), а не данными: ProductCard
 * — серверный компонент и принимает весь словарь, в котором есть функции, а они
 * не переживают границу сервер→клиент. Клиентской здесь остаётся только сама
 * механика прокрутки. По той же причине ссылка «весь каталог» приходит готовым
 * элементом в `viewAllSlot`.
 *
 * Прокрутка — родная, со scroll-snap, а не transform у дорожки: так на телефоне
 * бесплатно работает свайп, а на десктопе — колесо и клавиатура.
 */
export default function FeaturedCarousel({
  title,
  viewAllSlot,
  labels,
  children,
}: {
  title: string;
  viewAllSlot?: ReactNode;
  labels: { prev: string; next: string };
  children: ReactNode;
}) {
  const items = Children.toArray(children);
  const trackRef = useRef<HTMLDivElement>(null);
  // Текущее перетаскивание мышью и флаг «последний клик был концом
  // перетаскивания» — в ref, а не в состоянии: они меняются на каждое
  // движение мыши, и перерисовывать из-за них ленту незачем.
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startScroll: number;
    moved: boolean;
  } | null>(null);
  const draggedRef = useRef(false);
  // Пауза на время наведения или фокуса — пока курсор на ленте, она стоит.
  const [paused, setPaused] = useState(false);
  // До какого момента лента молчит после ручного действия. Свайп пальцем не
  // заканчивается «уходом курсора», поэтому отдельный таймер на setPaused не
  // годится: mouseleave сбросил бы паузу, которую человек только что себе
  // заработал. Заодно новая отметка перезапускает эффект ниже, и следующий
  // автоматический шаг отсчитывается от клика, а не от старого тика.
  const [heldUntil, setHeldUntil] = useState(0);

  const step = useCallback((delta: number) => {
    const track = trackRef.current;
    if (!track || track.children.length === 0) return;

    const maxScroll = track.scrollWidth - track.clientWidth;
    // У правого края вперёд идти некуда — начинаем круг заново. Сравнение с
    // допуском в 1px: браузер отдаёт дробный scrollLeft при дробной ширине.
    if (delta > 0 && track.scrollLeft >= maxScroll - 1) {
      track.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    const index = currentIndex(track);
    if (delta < 0 && index === 0) {
      track.scrollTo({ left: maxScroll, behavior: "smooth" });
      return;
    }

    const next = Math.min(Math.max(index + delta, 0), track.children.length - 1);
    const left = Math.min((track.children[next] as HTMLElement).offsetLeft, maxScroll);
    track.scrollTo({ left, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (paused || items.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = setInterval(() => {
      // На скрытой вкладке крутить нечего — иначе человек возвращается к
      // ленте, уехавшей неизвестно куда.
      if (document.visibilityState !== "visible") return;
      if (Date.now() < heldUntil) return;
      step(1);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [paused, items.length, step, heldUntil]);

  const pauseTemporarily = useCallback(() => setHeldUntil(Date.now() + RESUME_AFTER_MS), []);

  function handleArrow(delta: number) {
    pauseTemporarily();
    step(delta);
  }

  // Перетаскивание мышью. Пальцем ленту крутит сам браузер (родная прокрутка
  // с инерцией), поэтому касания сюда не попадают — перехватив их, мы бы эту
  // инерцию сломали и заменили на рывки.
  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    pauseTemporarily();
    const track = trackRef.current;
    if (!track || event.pointerType !== "mouse" || event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScroll: track.scrollLeft,
      moved: false,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const track = trackRef.current;
    if (!drag || !track || event.pointerId !== drag.pointerId) return;

    const shift = event.clientX - drag.startX;
    // Пока палец/курсор не ушёл дальше порога, это ещё клик по карточке, а не
    // перетаскивание: без порога не нажать ни «в корзину», ни саму карточку.
    if (!drag.moved && Math.abs(shift) < DRAG_THRESHOLD_PX) return;
    if (!drag.moved) {
      drag.moved = true;
      track.setPointerCapture(drag.pointerId);
      // Притяжение к слайдам на время перетаскивания выключаем: оно спорит с
      // ручной установкой scrollLeft и лента дёргается под курсором.
      track.style.scrollSnapType = "none";
    }
    track.scrollLeft = drag.startScroll - shift;
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const track = trackRef.current;
    if (!drag || !track || event.pointerId !== drag.pointerId) return;
    if (drag.moved) {
      if (track.hasPointerCapture(drag.pointerId)) track.releasePointerCapture(drag.pointerId);
      track.style.scrollSnapType = "";
      // Довод до ближайшего слайда: snap сам этого уже не сделает — прокрутка
      // закончилась, пока он был выключен.
      const index = currentIndex(track);
      const maxScroll = track.scrollWidth - track.clientWidth;
      track.scrollTo({
        left: Math.min((track.children[index] as HTMLElement).offsetLeft, maxScroll),
        behavior: "smooth",
      });
    }
    draggedRef.current = drag.moved;
    dragRef.current = null;
  }

  // Клик, завершивший перетаскивание, гасим в фазе перехвата: иначе отпускание
  // мыши над карточкой уводило бы на товар после каждого листания.
  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    if (!draggedRef.current) return;
    draggedRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  const arrowClass =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300";

  return (
    <div
      className="flex flex-col gap-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
        <div className="flex items-center gap-2 sm:gap-4">
          {viewAllSlot}
          {items.length > 1 && (
            <div className="flex items-center gap-2">
              <button type="button" aria-label={labels.prev} onClick={() => handleArrow(-1)} className={arrowClass}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
              <button type="button" aria-label={labels.next} onClick={() => handleArrow(1)} className={arrowClass}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      <div
        ref={trackRef}
        // relative — чтобы offsetLeft карточек считался от самой ленты:
        // именно это число и есть нужный scrollLeft.
        // py-2 — это место для подъёма карточки при наведении и для её тени:
        // горизонтальная прокрутка делает overflow-y тоже auto, и без запаса
        // браузер срезал верхние 5px поднятой карточки вместе со скруглением.
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={handleClickCapture}
        // Карточка — ссылка, а потянутую ссылку браузер начинает перетаскивать
        // сам: после dragstart он шлёт pointercancel и поток событий обрывается,
        // так что листать мышью было нельзя вовсе. Своё перетаскивание ленты
        // нам нужнее, чем перенос ссылки в закладки.
        onDragStart={(event) => event.preventDefault()}
        className="relative flex cursor-grab snap-x snap-mandatory gap-5 overflow-x-auto py-2 select-none active:cursor-grabbing [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, index) => (
          <div
            key={index}
            // Ширина карточки повторяет сетку, которая была на месте этого
            // блока: 1 на телефоне, 2, 4, 5 и 6 на широких экранах. Из 100%
            // вычитаются промежутки (gap-5 = 1.25rem), иначе последняя
            // карточка ряда не помещается и ряд «едет».
            // grid, а не flex: карточка — единственный потомок и должна занять
            // слайд целиком. Её корень это flex-элемент с `flex: 0 1 auto`, и
            // во flex-обёртке он сжимался до ширины своего текста — карточки
            // выходили разной ширины, а вместе с ними (из-за aspect-[4/3])
            // разной высоты фото. В гриде потомок растягивается сам.
            className="grid shrink-0 grow-0 snap-start basis-full sm:basis-[calc((100%-1.25rem)/2)] lg:basis-[calc((100%-3.75rem)/4)] min-[85rem]:basis-[calc((100%-5rem)/5)] min-[100rem]:basis-[calc((100%-6.25rem)/6)]"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
