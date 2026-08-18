export const levels = ["3AC", "TRC", "1BAC", "2BAC"] as const;
export type Level = (typeof levels)[number];

export const tracks = ["علوم فيزيائية", "علوم الحياة والأرض", "علوم رياضية", "آداب وعلوم إنسانية", "اقتصاد وتدبير", "تعليم أصيل"];

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
  "3AC": "الثالثة إعدادي",
  TRC: "الجذع المشترك",
  "1BAC": "الأولى باكالوريا",
  "2BAC": "الثانية باكالوريا",
};
