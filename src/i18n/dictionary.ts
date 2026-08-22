export type Dictionary = {
  header: {
    allCatalog: string;
    cartAriaLabel: string;
    promotions: string;
    about: string;
    brands: string;
    products: string;
    contacts: string;
    menuAriaLabel: string;
    closeMenuAriaLabel: string;
  };
  pages: {
    comingSoon: string;
  };
  search: {
    placeholder: string;
    ariaLabel: string;
    submitAriaLabel: string;
    filtersAriaLabel: string;
    closeFiltersAriaLabel: string;
    filtersTitle: string;
    yearLabel: string;
    yearFrom: string;
    yearTo: string;
    priceLabel: string;
    priceFrom: string;
    priceTo: string;
    makeLabel: string;
    brandLabel: string;
    allMakes: string;
    allBrands: string;
    apply: string;
    reset: string;
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
    forQuery: (query: string) => string;
    clearFilters: string;
  };
  product: {
    breadcrumbCatalog: string;
    inStock: string;
    onOrder: string;
    addToCart: string;
    added: string;
    originCodeLabel: string;
    productCodeLabel: string;
    brandLabel: string;
    makeLabel: string;
    stockCount: (count: number) => string;
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
