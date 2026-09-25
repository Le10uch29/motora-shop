/**
 * Стартовый справочник категорий запчастей для seed-categories.ts.
 *
 * Это только начальные данные: после сида всё правится в админке, поэтому
 * менять здесь что-то ради уже созданной категории не нужно — сид ищет
 * категорию по slug и не трогает её названия и настройки.
 *
 * Подкатегорию "Разное" сид добавляет каждой категории сам, её здесь нет.
 */

export type SeedName = { ru: string; az: string; ka: string };

export type SeedCategory = {
  /** Латиницей, попадает в URL: /catalog/category/<slug>. */
  slug: string;
  name: SeedName;
  children: { slug: string; name: SeedName }[];
};

/** Техническая подкатегория, которую получает каждая категория. */
export const MISC_NAME: SeedName = { ru: "Разное", az: "Digər", ka: "სხვადასხვა" };

/** Суффикс её slug: "chassis" -> "chassis-misc". */
export const MISC_SLUG_SUFFIX = "misc";

export const CATEGORY_TAXONOMY: SeedCategory[] = [
  {
    slug: "chassis",
    name: { ru: "Ходовая часть", az: "Şassi", ka: "შასი" },
    children: [
      { slug: "chassis-control-arms", name: { ru: "Рычаги", az: "Linglər", ka: "ბერკეტები" } },
      { slug: "chassis-ball-joints", name: { ru: "Шаровые опоры", az: "Şarovoylar", ka: "სფერული სახსრები" } },
      { slug: "chassis-bushings", name: { ru: "Сайлентблоки", az: "Saylentbloklar", ka: "საილენტბლოკები" } },
      { slug: "chassis-stabilizer-links", name: { ru: "Стойки стабилизатора", az: "Stabilizator dayaqları", ka: "სტაბილიზატორის ღეროები" } },
      { slug: "chassis-stabilizer-bushings", name: { ru: "Втулки стабилизатора", az: "Stabilizator vtulkaları", ka: "სტაბილიზატორის ჩასადებები" } },
      { slug: "chassis-shock-absorbers", name: { ru: "Амортизаторы", az: "Amortizatorlar", ka: "ამორტიზატორები" } },
      { slug: "chassis-strut-mounts", name: { ru: "Опоры амортизаторов", az: "Amortizator dayaqları", ka: "ამორტიზატორის საყრდენები" } },
      { slug: "chassis-springs", name: { ru: "Пружины", az: "Yaylar", ka: "ზამბარები" } },
      { slug: "chassis-hubs", name: { ru: "Ступицы", az: "Stupitsalar", ka: "სტუპიცები" } },
      { slug: "chassis-wheel-bearings", name: { ru: "Подшипники ступицы", az: "Stupitsa podşipnikləri", ka: "სტუპიცის საკისრები" } },
    ],
  },
  {
    slug: "steering",
    name: { ru: "Рулевое управление", az: "Sükan idarəetməsi", ka: "საჭის მართვა" },
    children: [
      { slug: "steering-tie-rod-ends", name: { ru: "Рулевые наконечники", az: "Sükan uclukları", ka: "საჭის წვერები" } },
      { slug: "steering-tie-rods", name: { ru: "Рулевые тяги", az: "Sükan çubuqları", ka: "საჭის ღეროები" } },
      { slug: "steering-rack-boots", name: { ru: "Пыльники рулевой рейки", az: "Sükan reykası körükləri", ka: "საჭის რეიკის მტვერდამცავები" } },
      { slug: "steering-racks", name: { ru: "Рулевые рейки", az: "Sükan reykaları", ka: "საჭის რეიკები" } },
    ],
  },
  {
    slug: "brakes",
    name: { ru: "Тормозная система", az: "Əyləc sistemi", ka: "სამუხრუჭე სისტემა" },
    children: [
      { slug: "brakes-pads", name: { ru: "Тормозные колодки", az: "Əyləc kolodkaları", ka: "სამუხრუჭე ხუნდები" } },
      { slug: "brakes-discs", name: { ru: "Тормозные диски", az: "Əyləc diskləri", ka: "სამუხრუჭე დისკები" } },
      { slug: "brakes-drums", name: { ru: "Тормозные барабаны", az: "Əyləc barabanları", ka: "სამუხრუჭე ბარაბნები" } },
      { slug: "brakes-calipers", name: { ru: "Суппорты", az: "Supportlar", ka: "სუპორტები" } },
      { slug: "brakes-caliper-kits", name: { ru: "Ремкомплекты суппортов", az: "Support təmir dəstləri", ka: "სუპორტის სარემონტო კომპლექტები" } },
      { slug: "brakes-cylinders", name: { ru: "Тормозные цилиндры", az: "Əyləc silindrləri", ka: "სამუხრუჭე ცილინდრები" } },
    ],
  },
  {
    slug: "engine",
    name: { ru: "Двигатель", az: "Mühərrik", ka: "ძრავი" },
    children: [
      { slug: "engine-pistons", name: { ru: "Поршни", az: "Porşenlər", ka: "დგუშები" } },
      { slug: "engine-piston-rings", name: { ru: "Поршневые кольца", az: "Porşen halqaları", ka: "დგუშის რგოლები" } },
      { slug: "engine-gaskets", name: { ru: "Прокладки", az: "Araqatlar", ka: "შუასადებები" } },
      { slug: "engine-belts", name: { ru: "Ремни", az: "Qayışlar", ka: "ღვედები" } },
      { slug: "engine-timing-chains", name: { ru: "Цепи ГРМ", az: "Paylama zəncirləri", ka: "განაწილების ჯაჭვები" } },
      { slug: "engine-tensioners", name: { ru: "Натяжители", az: "Gərginlik rolikləri", ka: "დამჭიმავები" } },
      { slug: "engine-bearings", name: { ru: "Подшипники", az: "Podşipniklər", ka: "საკისრები" } },
      { slug: "engine-sensors", name: { ru: "Датчики", az: "Datçiklər", ka: "სენსორები" } },
    ],
  },
  {
    slug: "transmission",
    name: { ru: "Трансмиссия", az: "Transmissiya", ka: "ტრანსმისია" },
    children: [
      { slug: "transmission-cv-joints", name: { ru: "ШРУС", az: "ŞRUS", ka: "შრუსი" } },
      { slug: "transmission-driveshafts", name: { ru: "Приводы", az: "Ötürücü vallar", ka: "ამძრავები" } },
      { slug: "transmission-bearings", name: { ru: "Подшипники", az: "Podşipniklər", ka: "საკისრები" } },
      { slug: "transmission-clutch", name: { ru: "Сцепление", az: "Debriyaj", ka: "გადაბმულობა" } },
      { slug: "transmission-clutch-kits", name: { ru: "Комплекты сцепления", az: "Debriyaj dəstləri", ka: "გადაბმულობის კომპლექტები" } },
    ],
  },
  {
    slug: "filters",
    name: { ru: "Фильтры", az: "Filtrlər", ka: "ფილტრები" },
    children: [
      { slug: "filters-oil", name: { ru: "Масляные фильтры", az: "Yağ filtrləri", ka: "ზეთის ფილტრები" } },
      { slug: "filters-air", name: { ru: "Воздушные фильтры", az: "Hava filtrləri", ka: "ჰაერის ფილტრები" } },
      { slug: "filters-cabin", name: { ru: "Салонные фильтры", az: "Salon filtrləri", ka: "სალონის ფილტრები" } },
      { slug: "filters-fuel", name: { ru: "Топливные фильтры", az: "Yanacaq filtrləri", ka: "საწვავის ფილტრები" } },
    ],
  },
  {
    slug: "cooling",
    name: { ru: "Охлаждение", az: "Soyutma sistemi", ka: "გაგრილების სისტემა" },
    children: [
      { slug: "cooling-radiators", name: { ru: "Радиаторы", az: "Radiatorlar", ka: "რადიატორები" } },
      { slug: "cooling-thermostats", name: { ru: "Термостаты", az: "Termostatlar", ka: "თერმოსტატები" } },
      { slug: "cooling-water-pumps", name: { ru: "Водяные насосы", az: "Su nasosları", ka: "წყლის ტუმბოები" } },
      { slug: "cooling-hoses", name: { ru: "Патрубки", az: "Şlanqlar", ka: "შლანგები" } },
    ],
  },
  {
    slug: "electrical",
    name: { ru: "Электрика", az: "Elektrik", ka: "ელექტროსისტემა" },
    children: [
      { slug: "electrical-sensors", name: { ru: "Датчики", az: "Datçiklər", ka: "სენსორები" } },
      { slug: "electrical-ignition-coils", name: { ru: "Катушки зажигания", az: "Alışma katuşkaları", ka: "აალების კოჭები" } },
      { slug: "electrical-starters", name: { ru: "Стартеры", az: "Starterlər", ka: "სტარტერები" } },
      { slug: "electrical-alternators", name: { ru: "Генераторы", az: "Generatorlar", ka: "გენერატორები" } },
    ],
  },
  {
    slug: "body",
    name: { ru: "Кузов", az: "Kuzov", ka: "ძარა" },
    children: [
      { slug: "body-mirrors", name: { ru: "Зеркала", az: "Güzgülər", ka: "სარკეები" } },
      { slug: "body-handles", name: { ru: "Ручки", az: "Qulplar", ka: "სახელურები" } },
      { slug: "body-locks", name: { ru: "Замки", az: "Kilidlər", ka: "საკეტები" } },
      { slug: "body-panels", name: { ru: "Элементы кузова", az: "Kuzov elementləri", ka: "ძარის ელემენტები" } },
    ],
  },
  {
    // Пересекается с "Ходовой частью" — оставлен отдельной категорией, как в
    // присланном списке, но без своих подкатегорий: что куда относить, решает
    // владелец каталога в админке.
    slug: "suspension",
    name: { ru: "Подвеска", az: "Asqı", ka: "საკიდარი" },
    children: [],
  },
  {
    slug: "air-conditioning",
    name: { ru: "Система кондиционирования", az: "Kondisioner sistemi", ka: "კონდიციონერის სისტემა" },
    children: [
      { slug: "ac-compressors", name: { ru: "Компрессоры", az: "Kompressorlar", ka: "კომპრესორები" } },
      { slug: "ac-condensers", name: { ru: "Радиаторы кондиционера", az: "Kondisioner radiatorları", ka: "კონდიციონერის რადიატორები" } },
      { slug: "ac-driers", name: { ru: "Фильтры-осушители", az: "Quruducu filtrlər", ka: "გამშრობი ფილტრები" } },
    ],
  },
  {
    slug: "fuel-system",
    name: { ru: "Топливная система", az: "Yanacaq sistemi", ka: "საწვავის სისტემა" },
    children: [
      { slug: "fuel-pumps", name: { ru: "Топливные насосы", az: "Yanacaq nasosları", ka: "საწვავის ტუმბოები" } },
      { slug: "fuel-injectors", name: { ru: "Форсунки", az: "Forsunkalar", ka: "ინჟექტორები" } },
      { slug: "fuel-lines", name: { ru: "Топливные трубки", az: "Yanacaq boruları", ka: "საწვავის მილები" } },
    ],
  },
  {
    slug: "exhaust",
    name: { ru: "Выхлопная система", az: "Egzoz sistemi", ka: "გამოსაბოლქვი სისტემა" },
    children: [
      { slug: "exhaust-mufflers", name: { ru: "Глушители", az: "Səsboğanlar", ka: "ხმაჩამხშობები" } },
      { slug: "exhaust-catalysts", name: { ru: "Катализаторы", az: "Katalizatorlar", ka: "კატალიზატორები" } },
      { slug: "exhaust-gaskets", name: { ru: "Прокладки выхлопа", az: "Egzoz araqatları", ka: "გამოსაბოლქვის შუასადებები" } },
    ],
  },
  {
    slug: "clutch",
    name: { ru: "Сцепление", az: "Debriyaj", ka: "გადაბმულობა" },
    children: [
      { slug: "clutch-discs", name: { ru: "Диски сцепления", az: "Debriyaj diskləri", ka: "გადაბმულობის დისკები" } },
      { slug: "clutch-covers", name: { ru: "Корзины сцепления", az: "Debriyaj səbətləri", ka: "გადაბმულობის კალათები" } },
      { slug: "clutch-release-bearings", name: { ru: "Выжимные подшипники", az: "Debriyaj podşipnikləri", ka: "გადაბმულობის საკისრები" } },
    ],
  },
  {
    slug: "other",
    name: { ru: "Прочее", az: "Digər", ka: "სხვა" },
    children: [],
  },
];
