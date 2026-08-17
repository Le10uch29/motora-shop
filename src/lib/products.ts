import type { Locale } from "@/i18n/locales";

export type LocalizedText = Record<Locale, string>;

export type CategoryId = "cars" | "trucks" | "vans";

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
  /** Units currently in stock. 0 means made-to-order. */
  stock: number;
  badge?: LocalizedText;
};

export function t(text: LocalizedText, locale: Locale): string {
  return text[locale];
}

export const categoryIds: CategoryId[] = ["cars", "trucks", "vans"];

export const categoryLabels: Record<CategoryId, LocalizedText> = {
  cars: { ru: "Легковые авто", az: "Yüngül avtomobillər", ka: "მსუბუქი ავტომობილები" },
  trucks: { ru: "Грузовики", az: "Yük maşınları", ka: "სატვირთოები" },
  vans: {
    ru: "Спринтеры / микроавтобусы",
    az: "Sprinterlər / mikroavtobuslar",
    ka: "სპრინტერები / მიკროავტობუსები",
  },
};

// Reusable spec labels
const partNumber: LocalizedText = { ru: "Артикул", az: "Artikul", ka: "არტიკული" };
const compatibility: LocalizedText = { ru: "Совместимость", az: "Uyğunluq", ka: "თავსებადობა" };
const position: LocalizedText = { ru: "Расположение", az: "Yerləşmə", ka: "მდებარეობა" };
const material: LocalizedText = { ru: "Материал", az: "Material", ka: "მასალა" };
const composition: LocalizedText = { ru: "Состав", az: "Tərkib", ka: "შემადგენლობა" };
const kit: LocalizedText = { ru: "Комплект", az: "Dəst", ka: "კომპლექტი" };
const type_: LocalizedText = { ru: "Тип", az: "Tip", ka: "ტიპი" };
const voltage: LocalizedText = { ru: "Напряжение", az: "Gərginlik", ka: "ძაბვა" };
const capacity: LocalizedText = { ru: "Ёмкость", az: "Tutum", ka: "ტევადობა" };
const output: LocalizedText = { ru: "Выходной ток", az: "Çıxış cərəyanı", ka: "გამომავალი დენი" };
const size: LocalizedText = { ru: "Размер", az: "Ölçü", ka: "ზომა" };

// Reusable badges
const bestseller: LocalizedText = { ru: "Хит продаж", az: "Ən çox satılan", ka: "გაყიდვების ლიდერი" };
const discount: LocalizedText = { ru: "Скидка", az: "Endirim", ka: "ფასდაკლება" };
const newBadge: LocalizedText = { ru: "Новинка", az: "Yenilik", ka: "სიახლე" };

export const products: Product[] = [
  {
    id: "AP-1001",
    slug: "brake-pads-front-camry",
    name: {
      ru: "Тормозные колодки передние Motora для Toyota Camry",
      az: "Toyota Camry üçün ön əyləc kolodkaları Motora",
      ka: "წინა სამუხრუჭე ხუნდები Motora Toyota Camry-სთვის",
    },
    category: "cars",
    price: 89,
    description: {
      ru: "Комплект передних тормозных колодок с керамическим составом. Пониженный шум и минимум пыли на дисках.",
      az: "Keramik tərkibli ön əyləc kolodkaları dəsti. Aşağı səviyyəli səs-küy və disklərdə minimum toz.",
      ka: "წინა სამუხრუჭე ხუნდების ნაკრები კერამიკული შემადგენლობით. დაბალი ხმაური და მინიმალური მტვერი დისკებზე.",
    },
    specs: [
      { label: partNumber, value: { ru: "MTP-4302", az: "MTP-4302", ka: "MTP-4302" } },
      { label: compatibility, value: { ru: "Toyota Camry XV70, 2018–2024", az: "Toyota Camry XV70, 2018–2024", ka: "Toyota Camry XV70, 2018–2024" } },
      { label: composition, value: { ru: "Керамика", az: "Keramika", ka: "კერამიკა" } },
      { label: kit, value: { ru: "Передняя ось", az: "Ön ox", ka: "წინა ღერძი" } },
    ],
    stock: 24,
    badge: bestseller,
  },
  {
    id: "AP-1002",
    slug: "battery-60ah",
    name: {
      ru: "Аккумулятор Motora PowerCell 60Ач",
      az: "Motora PowerCell 60Ah akkumulyatoru",
      ka: "Motora PowerCell 60Ah აკუმულატორი",
    },
    category: "cars",
    price: 72,
    oldPrice: 82,
    description: {
      ru: "Необслуживаемый аккумулятор увеличенной ёмкости для легковых автомобилей. Устойчив к глубокому разряду, надёжный пуск в мороз.",
      az: "Yüngül avtomobillər üçün artırılmış tutumlu, xidmətsiz akkumulyator. Dərin boşalmaya davamlıdır, şaxtada etibarlı işə salınma təmin edir.",
      ka: "მსუბუქი ავტომობილებისთვის განკუთვნილი გაზრდილი ტევადობის მოუვლელი აკუმულატორი. მდგრადია ღრმა განმუხტვის მიმართ და უზრუნველყოფს საიმედო გაშვებას ყინვაში.",
    },
    specs: [
      { label: voltage, value: { ru: "12 В", az: "12 V", ka: "12 ვ" } },
      { label: capacity, value: { ru: "60 Ач", az: "60 Ah", ka: "60 ა.სთ." } },
      { label: type_, value: { ru: "Необслуживаемый, AGM", az: "Xidmətsiz, AGM", ka: "მოუვლელი, AGM" } },
    ],
    stock: 15,
    badge: discount,
  },
  {
    id: "AP-1003",
    slug: "shock-absorber-front-solaris",
    name: {
      ru: "Амортизатор передний Motora Ride для Hyundai Solaris",
      az: "Hyundai Solaris üçün ön amortizator Motora Ride",
      ka: "წინა ამორტიზატორი Motora Ride Hyundai Solaris-ისთვის",
    },
    category: "cars",
    price: 118,
    description: {
      ru: "Газомасляный амортизатор для передней подвески. Стабильное поведение автомобиля на неровностях и увеличенный ресурс.",
      az: "Ön asqı üçün qaz-yağlı amortizator. Nahamar yollarda avtomobilin sabit davranışı və artırılmış resurs.",
      ka: "წინა შეკიდვისთვის გაზ-ზეთის ამორტიზატორი. ავტომობილის სტაბილური ქცევა უსწორმასწორო გზაზე და გაზრდილი რესურსი.",
    },
    specs: [
      { label: partNumber, value: { ru: "MSA-2210", az: "MSA-2210", ka: "MSA-2210" } },
      { label: compatibility, value: { ru: "Hyundai Solaris / Accent, 2017+", az: "Hyundai Solaris / Accent, 2017+", ka: "Hyundai Solaris / Accent, 2017+" } },
      { label: type_, value: { ru: "Газомасляный", az: "Qaz-yağlı", ka: "გაზ-ზეთის" } },
      { label: position, value: { ru: "Передний", az: "Ön", ka: "წინა" } },
    ],
    stock: 9,
  },
  {
    id: "AP-1004",
    slug: "oil-filter-universal",
    name: {
      ru: "Масляный фильтр Motora OilGuard",
      az: "Motora OilGuard yağ filtri",
      ka: "Motora OilGuard ზეთის ფილტრი",
    },
    category: "cars",
    price: 19,
    description: {
      ru: "Масляный фильтр с антидренажным клапаном для бензиновых и дизельных двигателей объёмом 1.4–2.0 л.",
      az: "1.4–2.0 L həcmli benzin və dizel mühərriklər üçün əks-drenaj klapanlı yağ filtri.",
      ka: "ანტიდრენაჟის სარქველიანი ზეთის ფილტრი 1.4–2.0 ლ მოცულობის ბენზინისა და დიზელის ძრავებისთვის.",
    },
    specs: [
      { label: partNumber, value: { ru: "MOF-1120", az: "MOF-1120", ka: "MOF-1120" } },
      { label: compatibility, value: { ru: "VAG / PSA 1.4–2.0 TSI/TDI/HDi", az: "VAG / PSA 1.4–2.0 TSI/TDI/HDi", ka: "VAG / PSA 1.4–2.0 TSI/TDI/HDi" } },
      { label: material, value: { ru: "Бумажный фильтрующий элемент", az: "Kağız filtrləyici element", ka: "ქაღალდის ფილტრის ელემენტი" } },
      { label: type_, value: { ru: "Резьбовой", az: "Yivli", ka: "სახრახნისებრი" } },
    ],
    stock: 60,
  },
  {
    id: "AP-1005",
    slug: "air-filter-corolla",
    name: {
      ru: "Воздушный фильтр Motora AirFlow для Toyota Corolla",
      az: "Toyota Corolla üçün Motora AirFlow hava filtri",
      ka: "Motora AirFlow ჰაერის ფილტრი Toyota Corolla-სთვის",
    },
    category: "cars",
    price: 24,
    description: {
      ru: "Панельный воздушный фильтр из синтетического волокна. Эффективная защита двигателя от пыли и абразива.",
      az: "Sintetik lifdən hazırlanmış panel hava filtri. Mühərriki toz və abraziv hissəciklərdən effektiv qoruyur.",
      ka: "სინთეტური ბოჭკოსგან დამზადებული პანელური ჰაერის ფილტრი. ძრავის ეფექტური დაცვა მტვერისა და აბრაზივისგან.",
    },
    specs: [
      { label: partNumber, value: { ru: "MAF-3305", az: "MAF-3305", ka: "MAF-3305" } },
      { label: compatibility, value: { ru: "Toyota Corolla E210, 2019+", az: "Toyota Corolla E210, 2019+", ka: "Toyota Corolla E210, 2019+" } },
      { label: material, value: { ru: "Синтетическое волокно", az: "Sintetik lif", ka: "სინთეტური ბოჭკო" } },
      { label: type_, value: { ru: "Панельный", az: "Panel", ka: "პანელური" } },
    ],
    stock: 40,
  },
  {
    id: "AP-1006",
    slug: "brake-pads-heavy-kamaz",
    name: {
      ru: "Тормозные колодки Motora HD для КАМАЗ",
      az: "KamAZ üçün Motora HD əyləc kolodkaları",
      ka: "Motora HD სამუხრუჭე ხუნდები КАМАЗ-ისთვის",
    },
    category: "trucks",
    price: 145,
    description: {
      ru: "Усиленные тормозные колодки для грузовой техники. Повышенная термостойкость и стабильное торможение под нагрузкой.",
      az: "Yük texnikası üçün gücləndirilmiş əyləc kolodkaları. Artırılmış istiliyə davamlılıq və yük altında sabit əyləc.",
      ka: "სატვირთო ტექნიკისთვის გაძლიერებული სამუხრუჭე ხუნდები. გაზრდილი თერმომედეგობა და სტაბილური დამუხრუჭება დატვირთვის ქვეშ.",
    },
    specs: [
      { label: partNumber, value: { ru: "MTH-5010", az: "MTH-5010", ka: "MTH-5010" } },
      { label: compatibility, value: { ru: "КАМАЗ 5320 / 65115", az: "KamAZ 5320 / 65115", ka: "КАМАЗ 5320 / 65115" } },
      { label: composition, value: { ru: "Керамика/металл", az: "Keramika/metal", ka: "კერამიკა/მეტალი" } },
      { label: kit, value: { ru: "Передняя ось", az: "Ön ox", ka: "წინა ღერძი" } },
    ],
    stock: 12,
  },
  {
    id: "AP-1007",
    slug: "timing-belt-kit-actros",
    name: {
      ru: "Ремень ГРМ Motora TimeBelt HD для Mercedes Actros",
      az: "Mercedes Actros üçün Motora TimeBelt HD qayış dəsti",
      ka: "Motora TimeBelt HD დროშის ღვედი Mercedes Actros-ისთვის",
    },
    category: "trucks",
    price: 235,
    description: {
      ru: "Комплект ремня ГРМ с роликами для двигателей OM 501/502. Армированная резина повышенной прочности.",
      az: "OM 501/502 mühərrikləri üçün diyircəkli qayış dəsti. Artırılmış möhkəmlikli armaturlu rezin.",
      ka: "OM 501/502 ძრავებისთვის დროშის ღვედის ნაკრები რგოლებით. გამაგრებული, გაზრდილი სიმტკიცის რეზინი.",
    },
    specs: [
      { label: partNumber, value: { ru: "MTB-6100", az: "MTB-6100", ka: "MTB-6100" } },
      { label: compatibility, value: { ru: "Mercedes-Benz Actros, OM 501/502", az: "Mercedes-Benz Actros, OM 501/502", ka: "Mercedes-Benz Actros, OM 501/502" } },
      { label: kit, value: { ru: "Комплект с роликами", az: "Diyircəklərlə dəst", ka: "ნაკრები რგოლებით" } },
      { label: material, value: { ru: "Армированная резина", az: "Armaturlu rezin", ka: "გამაგრებული რეზინი" } },
    ],
    stock: 6,
  },
  {
    id: "AP-1008",
    slug: "alternator-24v-man",
    name: {
      ru: "Генератор Motora Dynamo 24V для MAN TGX",
      az: "MAN TGX üçün Motora Dynamo 24V generatoru",
      ka: "Motora Dynamo 24V გენერატორი MAN TGX-ისთვის",
    },
    category: "trucks",
    price: 380,
    oldPrice: 420,
    description: {
      ru: "Генератор на 24 В для магистральных тягачей. Высокий выходной ток для стабильной работы бортовой электроники.",
      az: "Magistral qatarlar üçün 24 V generator. Bort elektronikasının sabit işləməsi üçün yüksək çıxış cərəyanı.",
      ka: "სატვირთო სატრანსპორტო საშუალებებისთვის 24 ვ გენერატორი. მაღალი გამომავალი დენი ბორტული ელექტრონიკის სტაბილური მუშაობისთვის.",
    },
    specs: [
      { label: partNumber, value: { ru: "MDY-7040", az: "MDY-7040", ka: "MDY-7040" } },
      { label: compatibility, value: { ru: "MAN TGX / TGS", az: "MAN TGX / TGS", ka: "MAN TGX / TGS" } },
      { label: voltage, value: { ru: "24 В", az: "24 V", ka: "24 ვ" } },
      { label: output, value: { ru: "120 А", az: "120 A", ka: "120 ა" } },
    ],
    stock: 0,
    badge: discount,
  },
  {
    id: "AP-1009",
    slug: "leaf-spring-rear-zil",
    name: {
      ru: "Рессора задняя Motora Leaf Spring для ЗИЛ/КАМАЗ",
      az: "ZİL/KamAZ üçün arxa Motora Leaf Spring resorası",
      ka: "უკანა ზამბარა Motora Leaf Spring ЗИЛ/КАМАЗ-ისთვის",
    },
    category: "trucks",
    price: 168,
    description: {
      ru: "Многолистовая рессора задней подвески из рессорной стали. Выдерживает высокие нагрузки при перевозке грузов.",
      az: "Resor poladından hazırlanmış arxa asqı üçün çoxvərəqli resora. Yük daşınarkən yüksək yükə davam gətirir.",
      ka: "ზამბარის ფოლადისგან დამზადებული უკანა შეკიდვის მრავალფურცლიანი ზამბარა. უძლებს მაღალ დატვირთვას ტვირთის გადაზიდვისას.",
    },
    specs: [
      { label: partNumber, value: { ru: "MLS-8020", az: "MLS-8020", ka: "MLS-8020" } },
      { label: compatibility, value: { ru: "ЗИЛ-130, КАМАЗ 4308", az: "ZİL-130, KamAZ 4308", ka: "ЗИЛ-130, КАМАЗ 4308" } },
      { label: position, value: { ru: "Задняя", az: "Arxa", ka: "უკანა" } },
      { label: material, value: { ru: "Рессорная сталь", az: "Resor poladı", ka: "ზამბარის ფოლადი" } },
    ],
    stock: 8,
  },
  {
    id: "AP-1010",
    slug: "fuel-filter-sprinter",
    name: {
      ru: "Топливный фильтр Motora Sprinter FuelGuard",
      az: "Motora Sprinter FuelGuard yanacaq filtri",
      ka: "Motora Sprinter FuelGuard საწვავის ფილტრი",
    },
    category: "vans",
    price: 32,
    description: {
      ru: "Топливный фильтр тонкой очистки для дизельных двигателей 2.2 CDI. Защищает форсунки от загрязнений и воды.",
      az: "2.2 CDI dizel mühərriklər üçün incə təmizləmə yanacaq filtri. Forsunkaları çirklənmə və sudan qoruyur.",
      ka: "2.2 CDI დიზელის ძრავებისთვის წვრილი გაწმენდის საწვავის ფილტრი. იცავს ინჟექტორებს დაბინძურებისა და წყლისგან.",
    },
    specs: [
      { label: partNumber, value: { ru: "MFG-9012", az: "MFG-9012", ka: "MFG-9012" } },
      { label: compatibility, value: { ru: "Mercedes Sprinter / VW Crafter 2.2 CDI", az: "Mercedes Sprinter / VW Crafter 2.2 CDI", ka: "Mercedes Sprinter / VW Crafter 2.2 CDI" } },
      { label: type_, value: { ru: "Дизельный", az: "Dizel", ka: "დიზელის" } },
      { label: material, value: { ru: "Бумажный элемент с водоотделителем", az: "Su ayırıcılı kağız element", ka: "წყალგამყოფიანი ქაღალდის ელემენტი" } },
    ],
    stock: 20,
  },
  {
    id: "AP-1011",
    slug: "serpentine-belt-sprinter",
    name: {
      ru: "Ремень навесного оборудования Motora Serpentine для Sprinter",
      az: "Sprinter üçün Motora Serpentine ötürücü qayışı",
      ka: "Motora Serpentine დამხმარე აგრეგატების ღვედი Sprinter-ისთვის",
    },
    category: "vans",
    price: 27,
    description: {
      ru: "Поликлиновой ремень привода генератора и насосов. Устойчив к перегреву и растяжению.",
      az: "Generator və nasosların ötürülməsi üçün polikin qayış. İstiyə və dartılmaya davamlıdır.",
      ka: "გენერატორისა და ტუმბოების ამძრავი პოლიკლინური ღვედი. მედეგია გადახურებისა და გაწელვის მიმართ.",
    },
    specs: [
      { label: partNumber, value: { ru: "MSB-1155", az: "MSB-1155", ka: "MSB-1155" } },
      { label: compatibility, value: { ru: "Mercedes Sprinter 906/907", az: "Mercedes Sprinter 906/907", ka: "Mercedes Sprinter 906/907" } },
      { label: material, value: { ru: "Резина с полиэстером", az: "Poliesterli rezin", ka: "პოლიესტერიანი რეზინი" } },
      { label: size, value: { ru: "6PK1560", az: "6PK1560", ka: "6PK1560" } },
    ],
    stock: 18,
  },
  {
    id: "AP-1012",
    slug: "glow-plug-sprinter",
    name: {
      ru: "Свеча накаливания Motora GlowPlug для Sprinter CDI",
      az: "Sprinter CDI üçün Motora GlowPlug qızdırıcı şam",
      ka: "Motora GlowPlug გავარვარების სანთელი Sprinter CDI-სთვის",
    },
    category: "vans",
    price: 38,
    description: {
      ru: "Комплект свечей накаливания для дизельных двигателей OM651. Быстрый прогрев и надёжный холодный пуск.",
      az: "OM651 dizel mühərrikləri üçün qızdırıcı şam dəsti. Sürətli qızma və etibarlı soyuq start.",
      ka: "OM651 დიზელის ძრავებისთვის გავარვარების სანთლების ნაკრები. სწრაფი გახურება და საიმედო ცივი გაშვება.",
    },
    specs: [
      { label: partNumber, value: { ru: "MGP-2244", az: "MGP-2244", ka: "MGP-2244" } },
      { label: compatibility, value: { ru: "Mercedes Sprinter, OM651", az: "Mercedes Sprinter, OM651", ka: "Mercedes Sprinter, OM651" } },
      { label: voltage, value: { ru: "11 В", az: "11 V", ka: "11 ვ" } },
      { label: kit, value: { ru: "Комплект 4 шт.", az: "4 ədəd dəst", ka: "4 ცალიანი ნაკრები" } },
    ],
    stock: 35,
    badge: newBadge,
  },
  {
    id: "AP-1013",
    slug: "cabin-filter-sprinter",
    name: {
      ru: "Салонный фильтр Motora CabinPure для Sprinter/Crafter",
      az: "Sprinter/Crafter üçün Motora CabinPure salon filtri",
      ka: "Motora CabinPure სალონის ფილტრი Sprinter/Crafter-ისთვის",
    },
    category: "vans",
    price: 23,
    description: {
      ru: "Угольный салонный фильтр с многослойной очисткой воздуха от пыли, пыльцы и запахов.",
      az: "Tozu, tozcuğu və qoxuları çoxqatlı təmizləyən kömürlü salon filtri.",
      ka: "ნახშირბადოვანი სალონის ფილტრი მრავალშრიანი გაწმენდით მტვრის, მტვრიანასა და სუნისგან.",
    },
    specs: [
      { label: partNumber, value: { ru: "MCF-3390", az: "MCF-3390", ka: "MCF-3390" } },
      { label: compatibility, value: { ru: "Mercedes Sprinter / VW Crafter", az: "Mercedes Sprinter / VW Crafter", ka: "Mercedes Sprinter / VW Crafter" } },
      { label: type_, value: { ru: "Угольный", az: "Kömürlü", ka: "ნახშირბადოვანი" } },
      { label: material, value: { ru: "Активированный уголь + нетканый материал", az: "Aktivləşdirilmiş kömür + toxunmamış material", ka: "გააქტიურებული ნახშირბადი + არაქსოვილი მასალა" } },
    ],
    stock: 28,
  },
];

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(category?: CategoryId): Product[] {
  if (!category) return products;
  return products.filter((p) => p.category === category);
}
