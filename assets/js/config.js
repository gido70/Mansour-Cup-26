/**
 * Config: ضع روابط CSV المنشورة من Google Sheets هنا.
 * طريقة الحصول على رابط CSV:
 * 1) File > Share > Publish to the web
 * 2) اختر Sheet معين + CSV
 * 3) انسخ الرابط وضعه هنا.
 *
 * ملاحظة: نحن نقرأ CSV فقط (بدون JSON / gviz).
 */
window.APP_CONFIG = {
  tournamentName: "بطولة كأس منصور بن زايد 2026",
  seasonLabel: "موسم 2026",
  // روابط Google Sheets (CSV) — ضع روابطك هنا
  sources: {
    groups: "data/groups.csv",
    teams: "data/teams.csv",
    players: "data/players.csv",
    matches: "data/matches.csv",
    goals: "data/goals.csv",
    cards: "data/cards.csv"
  },
  // إعدادات لوحة التحكم
  admin: {
    // كلمة مرور بسيطة (حماية على مستوى الواجهة فقط). غيّرها قبل النشر.
    password: "ChangeMe-2026"
  }
};