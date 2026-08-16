import type { Dictionary } from "@/i18n/dictionary";

const az: Dictionary = {
  header: {
    allCatalog: "Bütün kataloq",
    cartAriaLabel: "Səbət",
  },
  home: {
    brand: "Motora Shop",
    heroTitle: "Hərəkətdə olanlar üçün motosikletlər, skuterlər və ekipirovka",
    heroSubtitle:
      "Texnikanı sürüş tərzinizə uyğun seçirik və ən çox lazım olan ehtiyat hissələrini anbarda saxlayırıq.",
    ctaCatalog: "Kataloqa bax",
    popular: "Populyar",
    viewAll: "Bütün kataloq →",
  },
  catalog: {
    title: "Kataloq",
    all: "Hamısı",
    empty: "Bu kateqoriyada hələ məhsul yoxdur.",
    productCount: (n) => `${n} məhsul`,
    inCategory: (categoryLabel) => ` «${categoryLabel}» kateqoriyasında`,
  },
  product: {
    breadcrumbCatalog: "Kataloq",
    inStock: "Stokda var",
    onOrder: "Sifarişlə",
    addToCart: "Səbətə at",
    added: "Əlavə edildi ✓",
  },
  cart: {
    title: "Səbət",
    emptyTitle: "Səbət boşdur",
    emptyText: "Motosiklet, skuter və ya ekipirovka seçmək üçün kataloqa baxın.",
    goToCatalog: "Kataloqa keç",
    decreaseAria: "Miqdarı azalt",
    increaseAria: "Miqdarı artır",
    removeAria: "Səbətdən sil",
    total: "Cəmi:",
    clear: "Səbəti təmizlə",
    checkout: "Sifarişi rəsmiləşdir",
  },
};

export default az;
