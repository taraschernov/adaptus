/**
 * Ролевые сценарии для практики языка
 * Task-Based Language Teaching (TBLT) — учишь язык через реальные задачи,
 * а не абстрактную грамматику. Пользователь попадает в конкретную ситуацию
 * и должен решить практическую задачу.
 */

export type ScenarioLanguage = "bg" | "en" | "both";

export interface Scenario {
  id: string;
  language: ScenarioLanguage;
  title: string;           // название для пользователя
  emoji: string;
  level: string[];         // для каких уровней подходит
  setting: string;         // где происходит сцена
  userRole: string;        // роль пользователя
  aiRole: string;          // роль AI
  goal: string;            // что нужно достичь пользователю
  starterPrompt: string;   // первая реплика AI — начинает сцену
  successHints: string[];  // ключевые фразы которые нужно использовать
  vocabularyFocus: string[]; // слова которые точно всплывут
}

// ── Болгарские сценарии (экспат-выживание) ───────────────────────────────────

export const BG_SCENARIOS: Scenario[] = [
  {
    id: "bg_pharmacy",
    language: "bg",
    title: "В аптеке",
    emoji: "💊",
    level: ["A1", "A2"],
    setting: "Аптека в центре Ямбола. У тебя болит голова и есть температура.",
    userRole: "Пациент — экспат, немного говоришь по-болгарски",
    aiRole: "Фармацевт — говорит по-болгарски, чуть понимает английский",
    goal: "Купить парацетамол или ибупрофен, объяснить симптомы",
    starterPrompt: "Добър ден! Мога ли да ви помогна? (Добрый день! Чем могу помочь?)",
    successHints: ["боли ме главата", "имам температура", "нещо за болка", "колко струва"],
    vocabularyFocus: ["аптека", "лекарство", "болка", "температура", "таблетка", "рецепта"],
  },
  {
    id: "bg_landlord",
    language: "bg",
    title: "Звонок арендодателю",
    emoji: "🏠",
    level: ["A2", "B1"],
    setting: "Ты снимаешь квартиру. Сломалась горячая вода уже 2 дня.",
    userRole: "Арендатор — пишешь/звонишь наемодателю",
    aiRole: "Наемодател — немного раздражён, говорит только по-болгарски",
    goal: "Объяснить проблему и договориться о ремонте",
    starterPrompt: "Да? Кой е? (Алло? Кто это?)",
    successHints: ["няма топла вода", "от два дни", "може ли да оправите", "кога ще дойдете"],
    vocabularyFocus: ["наем", "наемодател", "вода", "ремонт", "авария", "договор", "сметки"],
  },
  {
    id: "bg_municipality",
    language: "bg",
    title: "Адресная регистрация",
    emoji: "🏛️",
    level: ["A2", "B1"],
    setting: "Общинска администрация. Тебе нужно зарегистрироваться по адресу.",
    userRole: "Экспат с документами",
    aiRole: "Служащий — говорит быстро, использует бюрократические термины",
    goal: "Сдать документы и узнать сроки регистрации",
    starterPrompt: "Следващ! Добър ден, каква е услугата? (Следующий! Добрый день, какой вопрос?)",
    successHints: ["адресна регистрация", "имам документи", "паспорт", "договор за наем", "колко дни"],
    vocabularyFocus: ["регистрация", "лична карта", "адрес", "молба", "срок", "служител"],
  },
  {
    id: "bg_taxi",
    language: "bg",
    title: "Такси в аэропорт",
    emoji: "🚕",
    level: ["A1", "A2"],
    setting: "Ты вызвал такси. Нужно добраться до летища (аэропорта).",
    userRole: "Пассажир — тебе нужно к самолёту через 2 часа",
    aiRole: "Таксист — разговорчивый, говорит на болгарском сленге",
    goal: "Объяснить маршрут, узнать цену, попросить поторопиться",
    starterPrompt: "Здравейте! Накъде пътувате? (Здравствуйте! Куда едем?)",
    successHints: ["до летището", "колко струва", "бързо ако обичате", "имам самолет в"],
    vocabularyFocus: ["летище", "такси", "цена", "бързо", "гара", "билет", "пристигане"],
  },
  {
    id: "bg_market",
    language: "bg",
    title: "На рынке",
    emoji: "🥦",
    level: ["A1", "A2"],
    setting: "Пазар в центре города. Выбираешь овощи и фрукты.",
    userRole: "Покупатель — хочешь торговаться",
    aiRole: "Продавец — громкий, энергичный, хвалит товар",
    goal: "Купить помидоры и виноград, узнать цену за кг, поторговаться",
    starterPrompt: "Ела, ела! Хайде, зеленчуци, плодове! Какво ще вземете? (Подходите! Овощи, фрукты! Что берёте?)",
    successHints: ["колко струва килото", "дайте ми", "по-евтино", "пресни ли са", "ще взема"],
    vocabularyFocus: ["пазар", "домати", "грозде", "килограм", "цена", "пресен", "евтино"],
  },
  {
    id: "bg_doctor",
    language: "bg",
    title: "У врача",
    emoji: "👨‍⚕️",
    level: ["A2", "B1"],
    setting: "Приём у общего терапевта. У тебя симптомы простуды 3 дни.",
    userRole: "Пациент с медицинской страховкой",
    aiRole: "Лекар (врач) — спрашивает про симптомы, серьёзный",
    goal: "Описать симптомы, получить назначение",
    starterPrompt: "Добре дошли. Седнете, моля. На какво се оплаквате? (Добро пожаловать. Присаживайтесь. На что жалуетесь?)",
    successHints: ["боли ме гърлото", "кашлям", "от три дни", "имам хрема", "висока температура"],
    vocabularyFocus: ["лекар", "симптоми", "температура", "кашлица", "хрема", "рецепта", "застраховка"],
  },
  {
    id: "bg_bank",
    language: "bg",
    title: "В банке",
    emoji: "🏦",
    level: ["B1", "B2"],
    setting: "Банков офис. Хочешь открыть сметка (счёт) как чужденец (иностранец).",
    userRole: "Клиент — иностранец с болгарским ЕГН или паспортом",
    aiRole: "Банков служител — вежливый, требует документы",
    goal: "Открыть текущий счёт, понять условия карты",
    starterPrompt: "Добър ден! Имате ли час при нас? Как мога да ви помогна? (Добрый день! Вы записаны? Чем могу помочь?)",
    successHints: ["искам да открия сметка", "чужденец съм", "какви документи", "такса ли има", "дебитна карта"],
    vocabularyFocus: ["банка", "сметка", "карта", "такса", "документи", "ЕГН", "превод"],
  },
  {
    id: "bg_notary",
    language: "bg",
    title: "У нотариуса",
    emoji: "📜",
    level: ["B1", "B2"],
    setting: "Нотариальная контора. Нужно заверить договор за наем (договор аренды).",
    userRole: "Арендатор — подписываешь договор",
    aiRole: "Нотариус — объясняет документы, говорит официальным языком",
    goal: "Понять что подписываешь, заверить документ",
    starterPrompt: "Добра среща. Вие сте за заверка на договор за наем, нали? Имате ли всички документи? (Добрый день. Вы по поводу нотариального заверения договора аренды, верно? Все документы с собой?)",
    successHints: ["договор за наем", "нотариална заверка", "подпис", "какво означава", "колко струва услугата"],
    vocabularyFocus: ["нотариус", "договор", "заверка", "подпис", "собственик", "наемател", "срок"],
  },
];

// ── Английские сценарии ───────────────────────────────────────────────────────

export const EN_SCENARIOS: Scenario[] = [
  {
    id: "en_interview",
    language: "en",
    title: "Job Interview",
    emoji: "💼",
    level: ["B1", "B2"],
    setting: "Online job interview for a remote IT position at a European company.",
    userRole: "Candidate — you're applying for a project manager role",
    aiRole: "HR Manager — professional, asks standard and behavioural questions",
    goal: "Answer questions clearly, ask smart questions at the end",
    starterPrompt: "Good morning! Thanks for joining. Let's start — could you briefly tell me about yourself and your current role?",
    successHints: ["I currently work as", "my main responsibilities", "I'd like to ask about", "team structure"],
    vocabularyFocus: ["responsibilities", "stakeholders", "deadline", "collaborate", "experience", "challenges"],
  },
  {
    id: "en_client_call",
    language: "en",
    title: "Client Call",
    emoji: "📞",
    level: ["B1", "B2"],
    setting: "A Zoom call with an English-speaking client who has a problem with their CRM.",
    userRole: "IT consultant — you need to understand the issue and propose a solution",
    aiRole: "Client — frustrated, not very technical",
    goal: "Understand the problem, explain the solution clearly, set expectations",
    starterPrompt: "Hi, finally! We've been having this issue for two days and it's really affecting our team. I don't even know where to start...",
    successHints: ["could you describe", "when exactly does it happen", "I understand your frustration", "what I'd suggest is"],
    vocabularyFocus: ["troubleshoot", "workflow", "workaround", "escalate", "timeline", "follow up"],
  },
  {
    id: "en_negotiation",
    language: "en",
    title: "Price Negotiation",
    emoji: "🤝",
    level: ["B2"],
    setting: "Negotiating contract terms with an international partner over email/call.",
    userRole: "Service provider — you want a fair price for your work",
    aiRole: "Potential client — pushes for discounts, budget-conscious",
    goal: "Negotiate a deal without losing value",
    starterPrompt: "We really like your proposal, but honestly, the budget is quite tight. We were thinking more around 60% of what you've quoted...",
    successHints: ["I appreciate your interest", "our pricing reflects", "what we could offer instead", "let's find a middle ground"],
    vocabularyFocus: ["quote", "scope", "deliverables", "discount", "value proposition", "terms"],
  },
  {
    id: "en_smalltalk",
    language: "en",
    title: "Small Talk",
    emoji: "☕",
    level: ["A2", "B1"],
    setting: "Coffee break at an international conference. You meet someone new.",
    userRole: "Conference attendee — you're networking",
    aiRole: "Fellow attendee — friendly, curious about your work and background",
    goal: "Have a natural 5-minute conversation, exchange contacts",
    starterPrompt: "Hey! Is this your first time at this conference? I noticed your badge says Bulgaria — that's interesting!",
    successHints: ["I work in", "I'm originally from", "what do you do", "nice to meet you", "let's connect"],
    vocabularyFocus: ["conference", "networking", "background", "industry", "based in", "reach out"],
  },
];

export const ALL_SCENARIOS = [...BG_SCENARIOS, ...EN_SCENARIOS];

export function getScenariosForLanguage(lang: "bg" | "en"): Scenario[] {
  return ALL_SCENARIOS.filter(s => s.language === lang || s.language === "both");
}

export function getScenariosForLevel(lang: "bg" | "en", level: string): Scenario[] {
  return getScenariosForLanguage(lang).filter(s => s.level.includes(level));
}

export function getScenario(id: string): Scenario | undefined {
  return ALL_SCENARIOS.find(s => s.id === id);
}
