export const levels = ["3AC", "TRC", "1BAC", "2BAC"] as const;
export type Level = (typeof levels)[number];

export const tracks = ["علوم فيزيائية", "علوم الحياة والأرض", "علوم رياضية", "آداب وعلوم إنسانية", "اقتصاد وتدبير", "تعليم أصيل"];

export const trackLabels: Record<string, string> = {
  "علوم فيزيائية": "Sciences physiques",
  "علوم الحياة والأرض": "Sciences de la vie et de la Terre",
  "علوم رياضية": "Sciences mathématiques",
  "آداب وعلوم إنسانية": "Lettres et sciences humaines",
  "اقتصاد وتدبير": "Économie et gestion",
  "تعليم أصيل": "Enseignement originel",
};

// FIX from the audit: the old list was missing "التربية الإسلامية" and
// "الاجتماعيات", both explicitly named in the doc's regional-exam subject
// list (section 3.1).
export const subjects = [
  "الرياضيات",
  "الفيزياء والكيمياء",
  "علوم الحياة والأرض",
  "اللغة العربية",
  "اللغة الفرنسية",
  "التربية الإسلامية",
  "الاجتماعيات",
  "الفلسفة",
  "التاريخ والجغرافيا",
  "الإنجليزية",
];

export const regions = [
  "الدار البيضاء–سطات",
  "الرباط–سلا–القنيطرة",
  "مراكش–آسفي",
  "فاس–مكناس",
  "طنجة–تطوان–الحسيمة",
  "سوس–ماسة",
  "الشرق",
  "بني ملال–خنيفرة",
  "درعة–تافيلالت",
  "كلميم–واد نون",
  "العيون–الساقية الحمراء",
  "الداخلة–وادي الذهب",
];

export const labelForLevel: Record<Level, string> = {
  "3AC": "3e année collège",
  TRC: "Tronc commun",
  "1BAC": "1re année bac",
  "2BAC": "2e année bac",
};

export const subjectLabels: Record<string, string> = {
  "الرياضيات": "Mathématiques",
  "الفيزياء والكيمياء": "Physique-chimie",
  "علوم الحياة والأرض": "Sciences de la vie et de la Terre",
  "اللغة العربية": "Langue arabe",
  "اللغة الفرنسية": "Langue française",
  "التربية الإسلامية": "Éducation islamique",
  "الاجتماعيات": "Études sociales",
  "الفلسفة": "Philosophie",
  "التاريخ والجغرافيا": "Histoire-géographie",
  "الإنجليزية": "Anglais",
};

export const regionLabels: Record<string, string> = {
  "الدار البيضاء–سطات": "Casablanca-Settat",
  "الرباط–سلا–القنيطرة": "Rabat-Salé-Kénitra",
  "مراكش–آسفي": "Marrakech-Safi",
  "فاس–مكناس": "Fès-Meknès",
  "طنجة–تطوان–الحسيمة": "Tanger-Tétouan-Al Hoceïma",
  "سوس–ماسة": "Souss-Massa",
  "الشرق": "L’Oriental",
  "بني ملال–خنيفرة": "Béni Mellal-Khénifra",
  "درعة–تافيلالت": "Drâa-Tafilalet",
  "كلميم–واد نون": "Guelmim-Oued Noun",
  "العيون–الساقية الحمراء": "Laâyoune-Sakia El Hamra",
  "الداخلة–وادي الذهب": "Dakhla-Oued Ed-Dahab",
};
