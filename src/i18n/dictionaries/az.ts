import type { Dictionary } from "@/i18n/dictionary";

const az: Dictionary = {
  header: {
    allCatalog: "Bütün kataloq",
    cartAriaLabel: "Səbət",
  },
  home: {
    brand: "Motora Shop",
    heroTitle: "Yüngül avtomobillər, yük maşınları və mikroavtobuslar üçün ehtiyat hissələri",
    heroSubtitle:
      "Ən çox tələb olunan markalar üçün orijinal və analoq hissələri anbarda saxlayırıq — sedandan Sprinter-ə qədər.",
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
    idLabel: "Məhsul ID",
    stockCount: (n) => `Anbarda ${n} ədəd`,
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
