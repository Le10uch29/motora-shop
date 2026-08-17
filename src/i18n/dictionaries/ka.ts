import type { Dictionary } from "@/i18n/dictionary";

const ka: Dictionary = {
  header: {
    allCatalog: "მთელი კატალოგი",
    cartAriaLabel: "კალათა",
  },
  home: {
    brand: "Motora Shop",
    heroTitle: "ნაწილები მსუბუქი ავტომობილების, სატვირთოებისა და მიკროავტობუსებისთვის",
    heroSubtitle:
      "საწყობში ვინახავთ ორიგინალურ და ანალოგურ ნაწილებს ყველაზე მოთხოვნად მარკებისთვის — სედანიდან Sprinter-მდე.",
    ctaCatalog: "კატალოგის ნახვა",
    popular: "პოპულარული",
    viewAll: "მთელი კატალოგი →",
  },
  catalog: {
    title: "კატალოგი",
    all: "ყველა",
    empty: "ამ კატეგორიაში ჯერ არ არის პროდუქტები.",
    productCount: (n) => `${n} პროდუქტი`,
    inCategory: (categoryLabel) => ` კატეგორიაში „${categoryLabel}“`,
  },
  product: {
    breadcrumbCatalog: "კატალოგი",
    inStock: "მარაგშია",
    onOrder: "შეკვეთით",
    addToCart: "კალათაში დამატება",
    added: "დამატებულია ✓",
    idLabel: "პროდუქტის ID",
    stockCount: (n) => `საწყობში ${n} ცალი`,
  },
  cart: {
    title: "კალათა",
    emptyTitle: "კალათა ცარიელია",
    emptyText: "შეხედეთ კატალოგს მოტოციკლის, სკუტერის ან ეკიპირების ასარჩევად.",
    goToCatalog: "კატალოგში გადასვლა",
    decreaseAria: "რაოდენობის შემცირება",
    increaseAria: "რაოდენობის გაზრდა",
    removeAria: "კალათიდან წაშლა",
    total: "სულ:",
    clear: "კალათის გასუფთავება",
    checkout: "შეკვეთის გაფორმება",
  },
};

export default ka;
