import type { Dictionary } from "@/i18n/dictionary";

function pluralProducts(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  let word = "товаров";
  if (mod10 === 1 && mod100 !== 11) word = "товар";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = "товара";
  return `${n} ${word}`;
}

const ru: Dictionary = {
  header: {
    allCatalog: "Весь каталог",
    cartAriaLabel: "Корзина",
  },
  home: {
    brand: "Motora Shop",
    heroTitle: "Запчасти для легковых авто, грузовиков и микроавтобусов",
    heroSubtitle:
      "Держим на складе оригинальные и аналоговые детали для самых востребованных марок и моделей — от седанов до Sprinter.",
    ctaCatalog: "Смотреть каталог",
    popular: "Популярное",
    viewAll: "Весь каталог →",
  },
  catalog: {
    title: "Каталог",
    all: "Все",
    empty: "В этой категории пока нет товаров.",
    productCount: pluralProducts,
    inCategory: (categoryLabel) => ` в категории «${categoryLabel}»`,
  },
  product: {
    breadcrumbCatalog: "Каталог",
    inStock: "В наличии",
    onOrder: "Под заказ",
    addToCart: "В корзину",
    added: "Добавлено ✓",
    idLabel: "ID товара",
    stockCount: (n) => `${n} шт. на складе`,
  },
  cart: {
    title: "Корзина",
    emptyTitle: "Корзина пуста",
    emptyText: "Загляните в каталог, чтобы выбрать мотоцикл, скутер или экипировку.",
    goToCatalog: "Перейти в каталог",
    decreaseAria: "Уменьшить количество",
    increaseAria: "Увеличить количество",
    removeAria: "Удалить из корзины",
    total: "Итого:",
    clear: "Очистить корзину",
    checkout: "Оформить заказ",
  },
};

export default ru;
