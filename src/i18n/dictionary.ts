export type Dictionary = {
  header: {
    allCatalog: string;
    cartAriaLabel: string;
  };
  home: {
    brand: string;
    heroTitle: string;
    heroSubtitle: string;
    ctaCatalog: string;
    popular: string;
    viewAll: string;
  };
  catalog: {
    title: string;
    all: string;
    empty: string;
    productCount: (count: number) => string;
    inCategory: (categoryLabel: string) => string;
  };
  product: {
    breadcrumbCatalog: string;
    inStock: string;
    onOrder: string;
    addToCart: string;
    added: string;
  };
  cart: {
    title: string;
    emptyTitle: string;
    emptyText: string;
    goToCatalog: string;
    decreaseAria: string;
    increaseAria: string;
    removeAria: string;
    total: string;
    clear: string;
    checkout: string;
  };
};
