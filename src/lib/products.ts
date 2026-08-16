import type { Locale } from "@/i18n/locales";

export type LocalizedText = Record<Locale, string>;

export type CategoryId = "motorcycles" | "scooters" | "gear" | "parts";

export type ProductSpec = { label: LocalizedText; value: LocalizedText };

export type Product = {
  id: string;
  slug: string;
  name: LocalizedText;
  category: CategoryId;
  /** Base price in Georgian Lari (GEL) */
  price: number;
  oldPrice?: number;
  description: LocalizedText;
  specs: ProductSpec[];
  inStock: boolean;
  badge?: LocalizedText;
};

export function t(text: LocalizedText, locale: Locale): string {
  return text[locale];
}

export const categoryIds: CategoryId[] = [
  "motorcycles",
  "scooters",
  "gear",
  "parts",
];

export const categoryLabels: Record<CategoryId, LocalizedText> = {
  motorcycles: { ru: "Мотоциклы", az: "Motosikletlər", ka: "მოტოციკლები" },
  scooters: { ru: "Скутеры", az: "Skuterlər", ka: "სკუტერები" },
  gear: { ru: "Экипировка", az: "Ekipirovka", ka: "ეკიპირება" },
  parts: { ru: "Запчасти", az: "Ehtiyat hissələri", ka: "ნაწილები" },
};

// Reusable spec labels
const engine: LocalizedText = { ru: "Двигатель", az: "Mühərrik", ka: "ძრავი" };
const power: LocalizedText = { ru: "Мощность", az: "Güc", ka: "სიმძლავრე" };
const weight: LocalizedText = { ru: "Масса", az: "Çəki", ka: "წონა" };
const tank: LocalizedText = { ru: "Бак", az: "Bak", ka: "ბაკი" };
const consumption: LocalizedText = { ru: "Расход", az: "Sərfiyyat", ka: "ხარჯვა" };
const cargo: LocalizedText = { ru: "Багаж", az: "Baqaj", ka: "ბარგი" };
const type_: LocalizedText = { ru: "Тип", az: "Tip", ka: "ტიპი" };
const material: LocalizedText = { ru: "Материал", az: "Material", ka: "მასალა" };
const protection: LocalizedText = { ru: "Защита", az: "Qoruma", ka: "დაცვა" };
const season: LocalizedText = { ru: "Сезон", az: "Mövsüm", ka: "სეზონი" };
const sizes: LocalizedText = { ru: "Размеры", az: "Ölçülər", ka: "ზომები" };
const pitch: LocalizedText = { ru: "Шаг", az: "Addım", ka: "ბიჯი" };
const links: LocalizedText = { ru: "Звенья", az: "Halqalar", ka: "რგოლები" };
const composition: LocalizedText = { ru: "Состав", az: "Tərkib", ka: "შემადგენლობა" };
const kit: LocalizedText = { ru: "Комплект", az: "Dəst", ka: "კომპლექტი" };
const voltage: LocalizedText = { ru: "Напряжение", az: "Gərginlik", ka: "ძაბვა" };
const capacity: LocalizedText = { ru: "Ёмкость", az: "Tutum", ka: "ტევადობა" };

// Reusable badges
const bestseller: LocalizedText = { ru: "Хит продаж", az: "Ən çox satılan", ka: "გაყიდვების ლიდერი" };
const discount: LocalizedText = { ru: "Скидка", az: "Endirim", ka: "ფასდაკლება" };
const newBadge: LocalizedText = { ru: "Новинка", az: "Yenilik", ka: "სიახლე" };

export const products: Product[] = [
  {
    id: "1",
    slug: "motora-gt-650",
    name: { ru: "Motora GT 650", az: "Motora GT 650", ka: "Motora GT 650" },
    category: "motorcycles",
    price: 7900,
    description: {
      ru: "Спортивный мотоцикл среднего класса с рядным двухцилиндровым двигателем. Отзывчивая динамика и уверенное поведение на трассе.",
      az: "Orta sinif idman motosikleti, sıralı ikisilindrli mühərriklə. Həssas dinamika və trekdə etibarlı davranış.",
      ka: "საშუალო კლასის სპორტული მოტოციკლი რიგითი ორცილინდრიანი ძრავით. მგრძნობიარე დინამიკა და თავდაჯერებული ქცევა ტრასაზე.",
    },
    specs: [
      { label: engine, value: { ru: "649 см³, 2 цил.", az: "649 sm³, 2 silindr", ka: "649 სმ³, 2 ცილინდრი" } },
      { label: power, value: { ru: "68 л.с.", az: "68 a.g.", ka: "68 ცხ.ძ." } },
      { label: weight, value: { ru: "202 кг", az: "202 kq", ka: "202 კგ" } },
      { label: tank, value: { ru: "14.5 л", az: "14.5 L", ka: "14.5 ლ" } },
    ],
    inStock: true,
    badge: bestseller,
  },
  {
    id: "2",
    slug: "motora-cruiser-500",
    name: { ru: "Motora Cruiser 500", az: "Motora Cruiser 500", ka: "Motora Cruiser 500" },
    category: "motorcycles",
    price: 5900,
    oldPrice: 6500,
    description: {
      ru: "Классический круизёр для комфортных дальних поездок. Низкая посадка, мягкая подвеска, богатая комплектация.",
      az: "Uzaq səyahətlər üçün klassik kruzer. Alçaq oturacaq, yumşaq asqı, zəngin komplektasiya.",
      ka: "კლასიკური კრუიზერი კომფორტული შორ მანძილზე მოგზაურობისთვის. დაბალი ჯდომა, რბილი შეკიდვა, მდიდარი კომპლექტაცია.",
    },
    specs: [
      { label: engine, value: { ru: "471 см³, V2", az: "471 sm³, V2", ka: "471 სმ³, V2" } },
      { label: power, value: { ru: "45 л.с.", az: "45 a.g.", ka: "45 ცხ.ძ." } },
      { label: weight, value: { ru: "215 кг", az: "215 kq", ka: "215 კგ" } },
      { label: tank, value: { ru: "16 л", az: "16 L", ka: "16 ლ" } },
    ],
    inStock: true,
    badge: discount,
  },
  {
    id: "3",
    slug: "motora-enduro-300",
    name: { ru: "Motora Enduro 300", az: "Motora Enduro 300", ka: "Motora Enduro 300" },
    category: "motorcycles",
    price: 3800,
    description: {
      ru: "Лёгкий эндуро для города и бездорожья. Длинноходная подвеска и низкий вес облегчают управление в любых условиях.",
      az: "Şəhər və bezyol üçün yüngül endurо. Uzunhodlu asqı və az çəki idarəetməni asanlaşdırır.",
      ka: "მსუბუქი ენდურო ქალაქისა და უსავალო გზისთვის. გრძელი სვლის შეკიდვა და მცირე წონა აადვილებს მართვას ნებისმიერ პირობებში.",
    },
    specs: [
      { label: engine, value: { ru: "293 см³, 1 цил.", az: "293 sm³, 1 silindr", ka: "293 სმ³, 1 ცილინდრი" } },
      { label: power, value: { ru: "27 л.с.", az: "27 a.g.", ka: "27 ცხ.ძ." } },
      { label: weight, value: { ru: "142 кг", az: "142 kq", ka: "142 კგ" } },
      { label: tank, value: { ru: "9.5 л", az: "9.5 L", ka: "9.5 ლ" } },
    ],
    inStock: true,
  },
  {
    id: "4",
    slug: "motora-city-125",
    name: { ru: "Motora City 125", az: "Motora City 125", ka: "Motora City 125" },
    category: "scooters",
    price: 1450,
    description: {
      ru: "Городской скутер с экономичным расходом топлива и вместительным багажным отделением под сиденьем.",
      az: "Qənaətli yanacaq sərfiyyatı və oturacaq altında geniş baqaj bölməsi olan şəhər skuteri.",
      ka: "ქალაქის სკუტერი ეკონომიური საწვავის ხარჯვითა და ტევადი ბარგის განყოფილებით სავარძლის ქვეშ.",
    },
    specs: [
      { label: engine, value: { ru: "125 см³", az: "125 sm³", ka: "125 სმ³" } },
      { label: consumption, value: { ru: "2.1 л/100км", az: "2.1 L/100km", ka: "2.1 ლ/100კმ" } },
      { label: weight, value: { ru: "108 кг", az: "108 kq", ka: "108 კგ" } },
      { label: cargo, value: { ru: "22 л", az: "22 L", ka: "22 ლ" } },
    ],
    inStock: true,
  },
  {
    id: "5",
    slug: "motora-sport-150",
    name: { ru: "Motora Sport 150", az: "Motora Sport 150", ka: "Motora Sport 150" },
    category: "scooters",
    price: 1650,
    description: {
      ru: "Спортивный скутер с агрессивным обвесом и увеличенной мощностью для динамичной езды по городу.",
      az: "Aqressiv dizaynlı və artırılmış güclü idman skuteri, şəhərdə dinamik sürüş üçün.",
      ka: "სპორტული სკუტერი აგრესიული ტანსაცმლითა და გაზრდილი სიმძლავრით ქალაქში დინამიური სვლისთვის.",
    },
    specs: [
      { label: engine, value: { ru: "149 см³", az: "149 sm³", ka: "149 სმ³" } },
      { label: power, value: { ru: "14 л.с.", az: "14 a.g.", ka: "14 ცხ.ძ." } },
      { label: weight, value: { ru: "118 кг", az: "118 kq", ka: "118 კგ" } },
      { label: cargo, value: { ru: "18 л", az: "18 L", ka: "18 ლ" } },
    ],
    inStock: false,
  },
  {
    id: "6",
    slug: "motora-race-helmet",
    name: {
      ru: "Шлем Motora Race",
      az: "Motora Race dəbilqəsi",
      ka: "Motora Race-ის ჩაფხუტი",
    },
    category: "gear",
    price: 219,
    description: {
      ru: "Интеграл для трека и города. Аэродинамическая форма, двойной визор, вентиляционная система из 5 каналов.",
      az: "Trek və şəhər üçün inteqral dəbilqə. Aerodinamik forma, ikiqat vizor, 5 kanallı ventilyasiya sistemi.",
      ka: "ინტეგრალური ჩაფხუტი ტრასისა და ქალაქისთვის. აეროდინამიკული ფორმა, ორმაგი ვიზორი, 5 არხიანი ვენტილაციის სისტემა.",
    },
    specs: [
      { label: type_, value: { ru: "Интеграл", az: "İnteqral", ka: "ინტეგრალური" } },
      { label: material, value: { ru: "Поликарбонат", az: "Polikarbonat", ka: "პოლიკარბონატი" } },
      { label: weight, value: { ru: "1.45 кг", az: "1.45 kq", ka: "1.45 კგ" } },
      { label: sizes, value: { ru: "S–XXL", az: "S–XXL", ka: "S–XXL" } },
    ],
    inStock: true,
    badge: newBadge,
  },
  {
    id: "7",
    slug: "motora-touring-jacket",
    name: {
      ru: "Куртка Motora Touring",
      az: "Motora Touring gödəkçəsi",
      ka: "Motora Touring-ის ქურთუკი",
    },
    category: "gear",
    price: 165,
    description: {
      ru: "Текстильная куртка для дальних поездок в любую погоду. Съёмная мембрана, защита плеч, локтей и спины.",
      az: "İstənilən hava şəraitində uzun səyahətlər üçün tekstil gödəkçə. Çıxarıla bilən membran, çiyin, dirsək və bel qorunması.",
      ka: "ტექსტილის ქურთუკი შორ მანძილზე მოგზაურობისთვის ნებისმიერ ამინდში. მოსახსნელი მემბრანა, მხრების, იდაყვებისა და ზურგის დაცვა.",
    },
    specs: [
      { label: material, value: { ru: "Кордура 600D", az: "Kordura 600D", ka: "კორდურა 600D" } },
      { label: protection, value: { ru: "CE плечи/локти/спина", az: "CE çiyin/dirsək/bel", ka: "CE მხრები/იდაყვები/ზურგი" } },
      { label: season, value: { ru: "Всесезонная", az: "Hər mövsüm üçün", ka: "ყველა სეზონისთვის" } },
      { label: sizes, value: { ru: "M–3XL", az: "M–3XL", ka: "M–3XL" } },
    ],
    inStock: true,
  },
  {
    id: "8",
    slug: "motora-grip-gloves",
    name: {
      ru: "Перчатки Motora Grip",
      az: "Motora Grip əlcəkləri",
      ka: "Motora Grip-ის ხელთათმანები",
    },
    category: "gear",
    price: 38,
    description: {
      ru: "Кожаные перчатки с защитными вставками на костяшках и усиленной ладонью для надёжного хвата руля.",
      az: "Sükanı etibarlı tutmaq üçün biləklərdə qoruyucu detalları və möhkəmləndirilmiş ovucu olan dəri əlcəklər.",
      ka: "ტყავის ხელთათმანები დამცავი ჩანართებით მუწუკებზე და გამაგრებული ხელისგულით საჭის საიმედო ჩასაჭიდად.",
    },
    specs: [
      { label: material, value: { ru: "Кожа/текстиль", az: "Dəri/tekstil", ka: "ტყავი/ტექსტილი" } },
      { label: protection, value: { ru: "Костяшки, ладонь", az: "Biləklər, ovuc", ka: "მუწუკები, ხელისგული" } },
      { label: sizes, value: { ru: "S–XL", az: "S–XL", ka: "S–XL" } },
    ],
    inStock: true,
  },
  {
    id: "9",
    slug: "motora-drive-chain-520",
    name: {
      ru: "Цепь привода Motora 520",
      az: "Motora 520 ötürücü zənciri",
      ka: "Motora 520 გადამცემი ჯაჭვი",
    },
    category: "parts",
    price: 34,
    description: {
      ru: "Усиленная приводная цепь с сальниковыми кольцами для повышенного ресурса и снижения трения.",
      az: "Artırılmış resurs və sürtünmənin azaldılması üçün sallnik halqalı gücləndirilmiş ötürücü zəncir.",
      ka: "გაძლიერებული გადამცემი ჯაჭვი საკუთარი რგოლებით რესურსის გაზრდისა და ხახუნის შემცირებისთვის.",
    },
    specs: [
      { label: pitch, value: { ru: "520", az: "520", ka: "520" } },
      { label: links, value: { ru: "120", az: "120", ka: "120" } },
      { label: type_, value: { ru: "X-ring", az: "X-ring", ka: "X-ring" } },
    ],
    inStock: true,
  },
  {
    id: "10",
    slug: "motora-brake-pads-sport",
    name: {
      ru: "Тормозные колодки Motora Sport",
      az: "Motora Sport əyləc kolodkaları",
      ka: "Motora Sport სამუხრუჭე ხუნდები",
    },
    category: "parts",
    price: 19,
    description: {
      ru: "Спортивные колодки с керамическим составом для стабильного торможения и низкого износа диска.",
      az: "Stabil əyləc və diskin aşağı aşınması üçün keramik tərkibli idman kolodkaları.",
      ka: "სპორტული ხუნდები კერამიკული შემადგენლობით სტაბილური დამუხრუჭებისა და დისკის დაბალი ცვეთისთვის.",
    },
    specs: [
      { label: composition, value: { ru: "Керамика", az: "Keramika", ka: "კერამიკა" } },
      { label: kit, value: { ru: "Передняя ось", az: "Ön ox", ka: "წინა ღერძი" } },
    ],
    inStock: true,
  },
  {
    id: "11",
    slug: "motora-powercell-12v",
    name: {
      ru: "Аккумулятор Motora PowerCell 12V",
      az: "Motora PowerCell 12V akkumulyatoru",
      ka: "Motora PowerCell 12V აკუმულატორი",
    },
    category: "parts",
    price: 49,
    oldPrice: 56,
    description: {
      ru: "Необслуживаемый гелевый аккумулятор с увеличенным пусковым током для надёжного запуска в мороз.",
      az: "Şaxtada etibarlı işə salınma üçün artırılmış işə salma cərəyanlı, xidmətsiz gel akkumulyator.",
      ka: "მოუვლელი გელის აკუმულატორი გაზრდილი გაშვების დენით ყინვაში საიმედო გასაშვებად.",
    },
    specs: [
      { label: voltage, value: { ru: "12 В", az: "12 V", ka: "12 ვ" } },
      { label: capacity, value: { ru: "8 Ач", az: "8 Ah", ka: "8 ა.სთ." } },
      { label: type_, value: { ru: "Гелевый, AGM", az: "Gel, AGM", ka: "გელური, AGM" } },
    ],
    inStock: true,
    badge: discount,
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(category?: CategoryId): Product[] {
  if (!category) return products;
  return products.filter((p) => p.category === category);
}
