export interface Topic {
  id: string;
  lang: "bg" | "en" | "both";
  category: TopicCategory;
  title: string;          // на русском (для отображения)
  titleBg?: string;       // на болгарском
  emoji: string;
  description: string;    // краткое описание для UI
  context: string;        // контекст для AI системного промпта
  level: string[];        // подходящие CEFR уровни
  kidFriendly: boolean;
}

export type TopicCategory =
  | "news"        // Новости
  | "history"     // История
  | "culture"     // Культура
  | "nature"      // Природа и география
  | "science"     // Наука и технологии
  | "sports"      // Спорт
  | "food"        // Еда и кулинария
  | "travel"      // Путешествия
  | "kids"        // Детские темы
  | "custom";     // Пользовательская тема

export const TOPIC_CATEGORIES: Record<TopicCategory, { label: string; emoji: string }> = {
  news:    { label: "Новости",       emoji: "📰" },
  history: { label: "История",       emoji: "🏛️" },
  culture: { label: "Культура",      emoji: "🎭" },
  nature:  { label: "Природа",       emoji: "🌿" },
  science: { label: "Наука и IT",    emoji: "🔬" },
  sports:  { label: "Спорт",        emoji: "⚽" },
  food:    { label: "Еда",           emoji: "🍽️" },
  travel:  { label: "Путешествия",   emoji: "✈️" },
  kids:    { label: "Для детей",     emoji: "🎮" },
  custom:  { label: "Своя тема",     emoji: "✏️" },
};

// ── Болгарский — заготовленные темы ──────────────────────────────────────────
export const BG_TOPICS: Topic[] = [
  // История
  {
    id: "bg_cyril_method",
    lang: "bg", category: "history",
    title: "Кирилл и Мефодий",
    emoji: "📜", level: ["A2","B1","B2"],
    description: "Создатели славянской письменности и болгарское наследие",
    context: `Тема урока: Кирилл и Мефодий — создатели славянской азбуки.
Ключевые факты: 863 год, создание глаголицы, потом кириллицы учениками. Болгария — центр распространения. 24 мая — День болгарской просвещённости. Важнейшие слова: азбука, писменост, просвещение.
Обсуждай с пользователем эту тему на болгарском, задавай вопросы, объясняй слова.`,
    kidFriendly: true,
  },
  {
    id: "bg_liberation",
    lang: "bg", category: "history",
    title: "Освобождение Болгарии",
    emoji: "⚔️", level: ["A2","B1","B2"],
    description: "Русско-турецкая война 1877-78 и освобождение от османского ига",
    context: `Тема урока: Освобождение Болгарии (Освобождението).
Ключевые факты: 1878 год, Русско-турецкая война, Шипка, Плевен, Сан-Стефанский договор. 3 марта — День освобождения (национальный праздник).
Ключевые слова: свобода, война, герой, Русия, Шипка, победа.`,
    kidFriendly: false,
  },
  {
    id: "bg_rose_valley",
    lang: "bg", category: "culture",
    title: "Долина роз и розовое масло",
    emoji: "🌹", level: ["A1","A2","B1"],
    description: "Казанлык, производство розового масла, фестиваль роз",
    context: `Тема урока: Долината на розите — Казанлык, розово масло.
Болгария производит 70% мирового розового масла. Розобер — июнь. Фестиваль роз в Казанлык. Цена: 1 кг масла = 4000-5000 лв.
Ключевые слова: роза, масло, долина, фестивал, берем, аромат.`,
    kidFriendly: true,
  },
  {
    id: "bg_rila",
    lang: "bg", category: "nature",
    title: "Рила и Рильский монастырь",
    emoji: "⛰️", level: ["A1","A2","B1"],
    description: "Самая высокая гора Балканского полуострова и знаменитый монастырь",
    context: `Тема урока: Рила — планината и Рилският манастир.
Рила — 2925 м (Мусала), самая высокая точка Балкан. Рильский монастырь — ЮНЕСКО, 10 век, Иван Рилски. Семь Рильских озёр.
Ключевые слова: планина, езеро, манастир, природа, туризъм, изкачване.`,
    kidFriendly: true,
  },
  {
    id: "bg_yambol",
    lang: "bg", category: "culture",
    title: "Ямбол и Тракия",
    emoji: "🏛️", level: ["A1","A2"],
    description: "История Ямбола, фракийское наследие и современный город",
    context: `Тема урока: Ямбол — история и съвременен живот.
Ямбол — 2500 лет истории, фракийцы, римляне. Безистен — один из старейших крытых рынков на Балканах. Тунджа — река. Карнавал в Ямболе. Близость к Котлу, Сливену.
Ключевые слова: история, град, река, тракийци, карнавал, пазар.`,
    kidFriendly: true,
  },
  {
    id: "bg_food",
    lang: "bg", category: "food",
    title: "Болгарская кухня",
    emoji: "🥗", level: ["A1","A2","B1"],
    description: "Национальные блюда: баница, шопска салата, кебапче",
    context: `Тема урока: Българска кухня.
Баница — слоёное тесто с брынзой. Шопска салата — помидоры, огурцы, перец, лук, брынза. Кебапче — колбаска на гриле. Айряк — кисломолочный напиток. Таратор — холодный суп.
Ключевые слова: ям, готвя, вкусно, рецепта, сирене, зеленчуци.`,
    kidFriendly: true,
  },
  {
    id: "bg_economy",
    lang: "bg", category: "news",
    title: "Болгария в ЕС и еврозоне",
    emoji: "🇪🇺", level: ["B1","B2"],
    description: "Вступление в Шенген, переход на евро, экономика",
    context: `Тема урока: България в ЕС — Шенген и еврото.
Болгария вступила в Шенген в 2024. Переход на евро — планируется. ВВП, туризм, IT-сектор растёт. Эмиграция болгар в Западную Европу.
Ключевые слова: икономика, евро, членство, туризъм, бизнес, работа.`,
    kidFriendly: false,
  },
  {
    id: "bg_sports",
    lang: "bg", category: "sports",
    title: "Спорт в Болгарии",
    emoji: "🏋️", level: ["A2","B1"],
    description: "Борьба, тяжёлая атлетика, футбол — достижения болгарского спорта",
    context: `Тема урока: Спортът в България.
Борьба и тяжёлая атлетика — исторически сильны. Стефка Костадинова — рекорд мира в прыжках в высоту. ЦСКА и Левски — главные футбольные клубы. Валентина Шевченко родилась в Болгарии.
Ключевые слова: спорт, шампион, рекорд, отбор, мач, победа.`,
    kidFriendly: true,
  },
];

// ── Английский — заготовленные темы ──────────────────────────────────────────
export const EN_TOPICS: Topic[] = [
  {
    id: "en_ai_tech",
    lang: "en", category: "science",
    title: "AI & Technology",
    emoji: "🤖", level: ["B1","B2"],
    description: "Artificial intelligence, ChatGPT, automation in business",
    context: `Topic: Artificial Intelligence and technology trends.
Key points: ChatGPT, LLMs, automation, jobs, Bitrix24 and CRM automation, AI assistants.
Discuss tech news, share opinions, practice business vocabulary. Focus on IT and CRM context relevant for the user.
Key vocabulary: automation, integration, workflow, assistant, data, efficiency.`,
    kidFriendly: false,
  },
  {
    id: "en_business_talk",
    lang: "en", category: "culture",
    title: "Business Small Talk",
    emoji: "💼", level: ["B1","B2"],
    description: "Office culture, networking, professional conversations",
    context: `Topic: Business small talk and professional communication.
Scenarios: conference introductions, project updates, client relations, remote work culture.
Practice: polite disagreement, asking for clarification, presenting ideas.
Key phrases: "I was wondering if...", "Could you elaborate on...", "That's a fair point".`,
    kidFriendly: false,
  },
  {
    id: "en_travel_airport",
    lang: "en", category: "travel",
    title: "Travel & Airports",
    emoji: "✈️", level: ["A2","B1"],
    description: "Navigating airports, booking hotels, asking for directions",
    context: `Topic: Travel English — airports, hotels, transportation.
Practical situations: check-in, customs, asking for help, booking, complaints.
Key vocabulary: departure, arrival, boarding pass, reservation, refund, transit.`,
    kidFriendly: true,
  },
  {
    id: "en_current_news",
    lang: "en", category: "news",
    title: "World News Discussion",
    emoji: "🌍", level: ["B1","B2"],
    description: "Discuss current events, express opinions, debate",
    context: `Topic: Current world news — discuss recent events.
Practice: expressing opinion ("In my view...", "I believe that..."), agreeing/disagreeing politely, summarising news.
Encourage the user to share their perspective on world events relevant to Bulgaria and Europe.`,
    kidFriendly: false,
  },
  {
    id: "en_science_space",
    lang: "en", category: "science",
    title: "Space & Science",
    emoji: "🚀", level: ["B1","B2"],
    description: "Space exploration, discoveries, scientific debates",
    context: `Topic: Space exploration and science news.
Key points: Mars missions, James Webb telescope, climate science, future of humanity.
Practice complex sentences, hypotheticals ("If we colonize Mars..."), passive voice in science writing.`,
    kidFriendly: true,
  },
];

// ── Детские темы ──────────────────────────────────────────────────────────────
export const KIDS_TOPICS: Topic[] = [
  {
    id: "kids_animals",
    lang: "both", category: "kids",
    title: "Животные",
    emoji: "🐾", level: ["A1","A2"],
    description: "Домашние и дикие животные, как они называются",
    context: `Детская тема: Животни / Animals.
Обучай ребёнка (6 класс) словам про животных на болгарском/английском.
Используй простые вопросы: "Какво е това?" / "What is this?", загадки, угадайки.
Слова: куче/dog, котка/cat, кон/horse, слон/elephant, лъв/lion, рибка/fish.
Используй смайлики и простой язык. Хвали за правильные ответы.`,
    kidFriendly: true,
  },
  {
    id: "kids_school",
    lang: "both", category: "kids",
    title: "Школа и учёба",
    emoji: "📚", level: ["A1","A2"],
    description: "Предметы, учителя, расписание — болгарский и английский",
    context: `Детская тема: Училище / School.
Слова болгарский: клас, учител, урок, домашно, оценка, приятел, почивка.
Слова английский: class, teacher, lesson, homework, grade, friend, break.
Ролевые ситуации: разговор с учителем, знакомство с одноклассником.
Говори с ребёнком просто и весело. Используй примеры из школьной жизни.`,
    kidFriendly: true,
  },
  {
    id: "kids_food",
    lang: "both", category: "kids",
    title: "Еда и напитки",
    emoji: "🍕", level: ["A1","A2"],
    description: "Назвать любимые блюда, попросить еду",
    context: `Детская тема: Храна / Food.
Учим слова: хляб/bread, мляко/milk, пица/pizza, ябълка/apple, сок/juice, вода/water.
Ролевые ситуации: в кафе, в магазине, дома за столом.
Диалоги: "Искам..." / "I would like...", "Харесва ми..." / "I like...".
Игра: назови 5 любимых продуктов!`,
    kidFriendly: true,
  },
  {
    id: "kids_numbers",
    lang: "both", category: "kids",
    title: "Числа и цвета",
    emoji: "🔢", level: ["A1"],
    description: "Считать, называть цвета на болгарском и английском",
    context: `Детская тема: Числа и цветове / Numbers and Colors.
Болгарский: едно, две, три, четири, пет, шест, седем, осем, девет, десет.
Английский: one, two, three, four, five, six, seven, eight, nine, ten.
Цветове: червено/red, синьо/blue, зелено/green, жълто/yellow.
Игры: угадай число, назови цвет предмета, посчитай что-то в комнате.`,
    kidFriendly: true,
  },
  {
    id: "kids_sports_games",
    lang: "both", category: "kids",
    title: "Спорт и игры",
    emoji: "⚽", level: ["A1","A2"],
    description: "Любимые виды спорта, игры, хобби — разговор об активностях",
    context: `Детская тема: Спорт и игри / Sports and Games.
Слова: футбол/football, баскетбол/basketball, плуване/swimming, колоездене/cycling.
Игры: шах/chess, компютърни игри/computer games, рисуване/drawing.
Диалог: "Какво правиш след училище?" / "What do you do after school?".
Обсуди любимый вид спорта, правила игры, любимые команды.`,
    kidFriendly: true,
  },
];

// ── Объединённый список ───────────────────────────────────────────────────────
export const ALL_TOPICS: Topic[] = [...BG_TOPICS, ...EN_TOPICS, ...KIDS_TOPICS];

export function getTopicsForLanguage(lang: "bg" | "en", kidMode = false): Topic[] {
  if (kidMode) return ALL_TOPICS.filter(t => t.kidFriendly);
  return ALL_TOPICS.filter(t => (t.lang === lang || t.lang === "both") && !t.kidFriendly);
}

export function getTopic(id: string): Topic | undefined {
  return ALL_TOPICS.find(t => t.id === id);
}
