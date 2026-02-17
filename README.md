# مشروع موقع عرض البطولة للجمهور (الخيار B)

موقع ثابت (Static) جاهز للرفع على GitHub Pages:
- واجهة جمهور: مباريات + مجموعات + ترتيب + هدافين + فرق + لاعبين
- لوحة تحكم داخلية داخل نفس الموقع (/admin) **مخفية عن الجمهور** (حماية كلمة مرور على مستوى الواجهة فقط)

## القيود التي التزمنا بها
- ممنوع JSON / gviz / سكربتات مزدوجة
- نعتمد على Google Sheets + CSV فقط

> مهم: الموقع يقرأ CSV فقط. الكتابة المباشرة إلى Google Sheets تحتاج API/Apps Script.
> لتجنب ذلك (حسب القيود): لوحة التحكم **تجمع الإدخالات محليًا** ثم تصدر CSV (نسخ/تنزيل) لتقوم أنت بلصقه في Google Sheets.

---

## 1) تشغيل سريع (باستخدام البيانات التجريبية)
- افتح `index.html` محليًا من خلال سيرفر بسيط أو عبر GitHub Pages.
- ستعمل البيانات من مجلد `data/`.

## 2) ربط Google Sheets كمصدر بيانات (CSV)
1) افتح Google Sheets
2) File > Share > Publish to the web
3) اختر كل Sheet وحدد CSV
4) انسخ روابط CSV وضعها في:
   `assets/js/config.js` داخل `sources`

مثال:
```js
sources: {
  groups: "PASTE_CSV_LINK_HERE",
  teams: "PASTE_CSV_LINK_HERE",
  players: "PASTE_CSV_LINK_HERE",
  matches: "PASTE_CSV_LINK_HERE",
  goals: "PASTE_CSV_LINK_HERE",
  cards: "PASTE_CSV_LINK_HERE"
}
```

## 3) كلمة مرور لوحة التحكم
غيّرها من:
`assets/js/config.js`
```js
admin: { password: "ChangeMe-2026" }
```

## 4) ملفات CSV المطلوبة (الرؤوس Headers)
راجع الملفات داخل `data/` كمثال جاهز:

### groups.csv
- group_id, group_name

### teams.csv
- team_id, team_name, short_name, group_id, coach

### players.csv
- player_id, player_name, team_id, position, shirt_no

### matches.csv
- match_id, group_id, stage, match_date, match_time, venue, home_team_id, away_team_id, home_score, away_score, match_label

### goals.csv
- goal_id, match_id, player_id, minute, goal_type, note

### cards.csv
- card_id, match_id, player_id, minute, card_color, note

---

## 5) طريقة العمل اليومية (Admin -> Sheets -> Public)
1) ادخل لوحة التحكم: `/admin`
2) أضف نتيجة مباراة / هدف / بطاقة
3) صدّر CSV (Copy أو Download)
4) الصق الصفوف داخل Google Sheets في الورقة المناسبة
5) الموقع العام سيقرأ البيانات فورًا عند التحديث

---

## 6) الهوية البصرية (شعارات وخلفيات)
ضع ملفاتك هنا:
- `assets/img/logo-tournament.png`
- `assets/img/logo-cup-white.png` (اختياري)
- `assets/img/logo-committee-white.png` (اختياري)
- `assets/img/bg-hero.jpg` (اختياري)

حالياً هناك Placeholders فقط.