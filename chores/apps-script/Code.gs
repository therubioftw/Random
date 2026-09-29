/* ============================================================
   Chores app backend — Google Apps Script bound to the chores Google Sheet.

   One-time setup:
   1. Create an empty Google Sheet → Extensions → Apps Script → paste this file.
   2. Run setup() once (it creates the tabs and fills in the chores list).
   3. Project Settings → Script properties → add PARENT_PIN (Ilana's code).
   4. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
      Put the /exec URL into DEFAULT_API_URL in chores/index.html.

   Updating the code later: paste the new version, run setup() again (it only adds
   what's missing), then Deploy → Manage deployments → ✏️ → Version: New version →
   Deploy. Editing the existing deployment keeps the same /exec URL.

   The chores list lives in the "מטלות" tab, with up to 5 praise lines and 3 nag
   lines per chore ({n} = the kid's name) — edit it there, no code change needed.
   The weekly target (evolution at half, and again at the full target) is in "הגדרות".
   Weeks run Sunday→Saturday (Israel time); nothing is ever deleted, a new week
   simply starts counting from zero at Saturday midnight.
   ============================================================ */

var TZ = 'Asia/Jerusalem';
var KIDS = ['ליאם', 'רובי'];
var REWARD = 10;
var HISTORY_WEEKS = 8;
var LOG = 'יומן', CHORES = 'מטלות', WEEKS = 'שבועות', SETTINGS = 'הגדרות';
var DEFAULT_TARGET = 10;
var PRAISE_COLS = 5, NAG_COLS = 3;   // columns F–J and K–M of the chores tab

// קטגוריה, אימוג'י, מטלה, הסבר, של מי, [שבחים], [נדנודים] — {n} is the kid's name
var SEED = [
  ['חתולים', '🐈', 'לנקות חול חתולים', '', 'ליאם',
    ['החתולים מודים לך, {n}. הם לא יגידו את זה, כי הם חתולים.', 'ארגז החול נקי. האף של כל הבית אומר תודה 👃', '{n} התמודד עם משהו שאף גיבור של מארוול לא היה נוגע בו', 'החתול עשה לך פרצוף. אצל חתולים זה אומר תודה 😼', 'משימה מסריחה, גיבור אמיתי 🦸'],
    ['החתולים התחילו לחפש ארגז חול אחר. אולי הנעליים שלך?', 'ריח מוזר מגיע מכיוון הארגז. גם לאשמה יש ריח.', 'החתול הסתכל עליי היום במבט מאוכזב. הוא ביקש שאמסור לך.']],
  ['חתולים', '🐈', 'לסרק', '', 'ליאם',
    ['החתול נראה עכשיו כמו דוגמן של פרסומת לאוכל חתולים 😼', 'פחות שיער על הספה, יותר אהבה בבית', '{n}, הספר הרשמי של החתולים ✂️', 'הגרגור הזה? זו הכרת תודה', 'חתול מסורק = חתול מרוצה = בית שקט'],
    ['יש יותר שיער חתול על הספה מאשר על החתול.', 'מהשערות על הספה אפשר כבר להרכיב חתול שני.', 'החתול התחיל לסרק את עצמו עם הלשון. זה לא נגמר טוב לאף אחד.']],
  ['מודי', '🐶', 'למלא מים', 'הצלחת תמיד צריכה להיות מלאה ונקייה', '',
    ['מודי שתה, נשם, והודה לך מכל הלב 💧', 'הצלחת מלאה ומודי מאושר', '{n} מנע התייבשות כלבית. גיבור שקט.', 'מים נקיים — אפילו Squirtle היה מקנא', 'מודי רוצה שתדע שאתה הבנאדם האהוב עליו (היום)'],
    ['מודי ליקק את הצלחת הריקה ושלח מבט לכיוון שלך.', 'מודי שוקל לשתות מהאסלה. בגללך.', 'הצלחת של מודי יבשה כמו הבדיחות של אבא.']],
  ['מודי', '🐶', 'להוציא לטיול', 'לתאם עם אמא ורועי', 'רובי',
    ['מודי מכשכש בזנב ברמות שלא נראו כאן מעולם 🐕', 'מודי מדרג את הטיול: ⭐⭐⭐⭐⭐', 'גם אתה יצאת קצת לאוויר. win-win', '{n}, המלווה הרשמי של מודי לעולם הגדול', 'טיול נעשה, צעדים נספרו, מודי מאושר'],
    ['מודי יושב ליד הדלת. הוא לא אומר כלום. הוא רק מחכה.', 'מודי כבר כמעט יודע לפתוח את הדלת לבד. זה עניין של זמן.', 'מודי שמע מישהו אומר "טיול" והתרגש. אחר כך הבין שזה לא אתה.']],
  ['מודי', '🐶', 'לתת אוכל', 'לתאם עם אמא ורועי', '',
    ['מודי אכל, ועכשיו הוא אוהב אותך פי 3', 'הקערה מלאה והזנב במצב טורבו', '{n} האכיל את החיה. החיה אסירת תודה.', 'השף מודי מאשר את הארוחה 👨‍🍳', 'מודי מוסר: "היה טעים, תבוא שוב"'],
    ['מודי מסתכל על הקערה הריקה, ואז עליך. ואז שוב על הקערה.', 'מודי התחיל לרחרח את הנעליים שלך בתור תחליף.', 'מודי כותב מכתב תלונה. בכפות.']],
  ['מטבח', '🍽️', 'לרוקן את הכיור', 'להכניס למדיח/לשטוף', 'רובי',
    ['הכיור ריק! רואים את התחתית בפעם הראשונה מזה שבוע', '{n} ניצח את מפלצת הכלים 🍽️', 'כיור ריק, אמא שמחה, העולם בסדר', 'מגדל הכלים פורק. אפילו בלגו לא בונים כזה גבוה', 'הספוג מצדיע לך 🧽'],
    ['הכלים בכיור התחילו לפתח תודעה. אחד מהם קרא לך בשם.', 'מגדל הכלים בכיור כבר גבוה ממך, {n}.', 'בכיור יש כבר מערכת אקולוגית. מדענים בדרך.']],
  ['מטבח', '🍽️', 'להפעיל מדיח', '', '',
    ['המדיח רץ, ואתה חופשי', 'כפתור אחד, בית אחד נקי. יעילות.', '{n} לחץ על הכפתור והציל ערב שלם', 'המדיח מזמזם לכבודך 🎵', 'משימה של שנייה, תודה של שבוע'],
    ['המדיח מלא ומחכה ללחיצה אחת. אחת.', 'המדיח עומד מלא כבר יום. הוא מתחיל להרגיש לא רצוי.', 'מישהו בבית לא לחץ על כפתור אחד. לא אומרים שמות.']],
  ['מטבח', '🍽️', 'להוציא מהמדיח', '', 'ליאם',
    ['הכלים הנקיים חזרו הביתה 🏠', '{n} פינה את המדיח. עכשיו הכיור יכול לנשום', 'צלחות במקום, כוסות במקום, שקט בבית', 'משימה משעממת, ביצוע מושלם', 'אמא ראתה מגירה מסודרת ודמעה קצת מאושר'],
    ['המדיח מלא כלים נקיים והכיור מלא כלים מלוכלכים. פקק תנועה קלאסי.', 'הכלים הנקיים במדיח מתחילים לשכוח שהם נקיים.', 'אמא פתחה את המדיח. אמא סגרה את המדיח. אמא נאנחה.']],
  ['מטבח', '🍽️', 'לנקות כיריים', '', '',
    ['הכיריים מבריקות כמו כדור דרקון 🐉', 'אפשר לראות את ההשתקפות שלך בכיריים. ברצינות.', '{n} ניצח את השומן. השומן לא הבין מה קרה', 'גורדון רמזי היה נותן לך להיכנס למטבח שלו', 'כיריים נקיות = אמא מבשלת בכיף'],
    ['על הכיריים יש שכבות היסטוריות. ארכיאולוגים מתעניינים.', 'הכיריים זוכרות כל ארוחה מהחודש האחרון. כל אחת.', 'אפשר לנחש מה אכלנו בשבוע שעבר רק לפי הכיריים.']],
  ['מטבח', '🍽️', 'לנקות את השיש', '', '',
    ['השיש נקי כמו דף חדש', '{n} החזיר לשיש את הצבע המקורי', 'אפשר להכין עליו סנדוויץ׳ בלי פחד', 'פירורים: 0. {n}: 1', 'השיש מבריק, אמא מרוצה. זה כל החשבון.'],
    ['על השיש יש פירורים מתקופת האבן.', 'משהו על השיש דביק. לא ברור מה. לא כדאי לבדוק.', 'הנמלים שלחו הזמנה לכל החברים שלהן. השיש פתוח.']],
  ['מטבח', '🍽️', 'להוציא את הפח ולזרוק אותו למטה', '', 'רובי',
    ['הפח ירד, והמטבח נושם שוב 🗑️', '{n}, מנהל הפינוי הרשמי של הבית', 'אפילו אוסקר מרחוב סומסום היה גאה', 'הזבל הלך, והכבוד נשאר', 'משלוח יצא לדרך. יעד: למטה.'],
    ['הפח כל כך מלא שהוא מתחיל לבנות קומה שנייה.', 'הפח מתחיל להריח כמו הגרביים של הומר.', 'הזבל כבר מכיר את כולנו בשמות.']],
  ['נקיונות בית', '🧹', 'לטאטא סלון, מטבח ומרפסת', 'כולל חדר השירות', '',
    ['הרצפה נקייה! אפשר ללכת יחפים בלי הפתעות', '{n} ניצח את הפירורים בקרב פתוח', 'המטאטא מצדיע 🧹', 'טאטוא ברמת סופר סאייאן ⚡', 'אפילו מודי מחליק עכשיו באלגנטיות'],
    ['הפירורים על הרצפה הקימו ועד בית.', 'יש שביל פירורים מהמטבח לסלון. עמי ותמי בדרך.', 'הרצפה נהייתה מעניינת מדי בשביל מודי.']],
  ['נקיונות בית', '🧹', 'לטאטא חדרים ושירותים', 'בכל החדרים, האמבטיה והשירותים', '',
    ['כל החדרים נקיים. זה לא חלום.', '{n} טאטא בכל מקום, גם איפה שאף אחד לא מסתכל', 'האבק ברח בבהלה', 'משימה כבדה, גיבור כבד 💪', 'הבית מרגיש כמו מלון. בזכותך.'],
    ['האבק מתחת למיטה הקים משפחה.', 'יש כדורי אבק בגודל של פוקבול.', 'משהו זז בפינה. זה רק אבק. כנראה.']],
  ['נקיונות בית', '🧹', 'לנקות ולייבש כיורים', 'בשירותים ובאמבטיה', 'רובי',
    ['הכיורים בוהקים ✨', '{n} הפך את השירותים למקום נעים. כמעט.', 'אין כתמים, אין טיפות, יש כבוד', 'משחת שיניים על הכיור? לא היום!', 'הכיור מחייך אליך בחזרה'],
    ['על הכיור יש מפה של כל משחת השיניים של השבוע.', 'הכיור בשירותים ביקש שאמסור לך דרישת שלום. דחוף.', 'הכתמים בכיור התחילו לקבל שמות.']],
  ['נקיונות בית', '🧹', 'לאסוף בגדים מפוזרים', 'לבדוק גם מגבות וסמרטוטים', '',
    ['הבגדים חזרו לסל. הרצפה חזרה להיות רצפה', '{n} מצא גרב שנעלם לפני חודש', 'הבית נראה פתאום יותר גדול', 'מגבות וסמרטוטים — במקום. אמא מתרגשת', 'נאסף, סודר, ניצחון 🏆'],
    ['הגרביים על הרצפה מתכננות מרד.', 'יש בגדים על הרצפה שכבר שכחו למי הם שייכים.', 'מודי התחיל לבנות קן מהבגדים שלך.']],
  ['נקיונות בית', '🧹', 'להחזיר דברים למקום', 'ספרים, תיקים וכו׳', '',
    ['כל דבר במקומו. מארי קונדו מוחאת כפיים', '{n} החזיר את הסדר ליקום', 'התיקים, הספרים, הכל במקום. קסם.', 'עכשיו אפשר למצוא דברים! איזה כיף', 'בית מסודר, ראש מסודר'],
    ['יש ספר על הספה שכבר בטוח שהוא כרית.', 'התיק בכניסה הפך לרהיט קבוע.', 'אבא נתקל במשהו בחושך. הוא לא שכח מי השאיר אותו שם.']],
  ['כביסה', '👕', 'למיין כביסה ולהפעיל מכונה', '', 'ליאם',
    ['הכביסה בפנים והמכונה מסתובבת 🌀', 'לבנים עם לבנים, צבעוניים עם צבעוניים. מקצוען.', '{n} מנהל את חדר הכביסה כמו בוס', 'המכונה מסתובבת כמו ספינר. בזכותך', 'בגדים נקיים בדרך, באדיבות {n}'],
    ['סל הכביסה עולה על גדותיו. הוא צריך עזרה.', 'אין לאף אחד תחתונים נקיים. אני רק אומר.', 'ערימת הכביסה גבוהה יותר ממגדל לגו.']],
  ['כביסה', '👕', 'להעביר מהמכונה למייבש', '', 'ליאם',
    ['העברה חלקה, כמו מסירה במונדיאל ⚽', 'הבגדים לא הספיקו להסריח. תזמון מושלם.', '{n} הציל את הכביסה מריח של טחב', 'רטוב ← יבש. מדע!', 'המייבש מאשר: קיבלתי, תודה'],
    ['הכביסה במכונה מתחילה להריח כמו ים. לא במובן הטוב.', 'הבגדים הרטובים מחכים במכונה. קר להם והם בודדים.', 'אם מחכים עוד קצת, צריך לכבס שוב. ככה זה עובד.']],
  ['כביסה', '👕', 'להוציא מהמייבש לסל', '', 'ליאם',
    ['בגדים חמים ונעימים בסל 🔥', '{n} סגר את הסבב. כבוד.', 'המייבש פנוי לסיבוב הבא', 'יש משהו יותר נעים מבגד חם מהמייבש? אין.', 'משימה קצרה, השפעה גדולה'],
    ['המייבש מחזיק את הבגדים כבני ערובה.', 'הבגדים במייבש התקמטו מרוב המתנה.', 'מישהו ילבש היום משהו מקומט, וכולנו יודעים למה.']],
  ['כביסה', '👕', 'לקפל כביסה ולפזר לחדרים', '', '',
    ['הכל מקופל ומחולק. מכונת קיפול אנושית', '{n} מקפל כמו מאסטר אוריגמי', 'כל אחד קיבל את הבגדים שלו. צדק!', 'הערימה על הספה נעלמה. קסם 🪄', 'אמא: 😍'],
    ['ערימת הכביסה על הספה תופסת כבר מקום של בן משפחה.', 'הכביסה הנקייה מתחילה לחשוב שהיא מלוכלכת.', 'מחפשים חולצה? היא בערימה. בתחתית. בהצלחה.']]
];

// a SEED entry as one sheet row: 5 base columns, then praise and nag columns
function seedRow(s) {
  var r = s.slice(0, 5), i;
  for (i = 0; i < PRAISE_COLS; i++) r.push(s[5][i] || '');
  for (i = 0; i < NAG_COLS; i++) r.push(s[6][i] || '');
  return r;
}
function choreHeaders() {
  var h = ['קטגוריה', 'אימוג׳י', 'מטלה', 'הסבר', 'של מי'], i;
  for (i = 1; i <= PRAISE_COLS; i++) h.push('שבח ' + i);
  for (i = 1; i <= NAG_COLS; i++) h.push('נדנוד ' + i);
  return h;
}

/* ---------- sheets ---------- */
function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheet(name, headers, textCols) {
  var sh = ss().getSheetByName(name);
  if (!sh) {
    sh = ss().insertSheet(name);
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.setRightToLeft(true);
    // week keys stay plain text so Sheets doesn't turn them into dates
    (textCols || []).forEach(function (c) { sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@'); });
  }
  return sh;
}
function logSheet() { return sheet(LOG, ['זמן', 'שבוע', 'ילד', 'קטגוריה', 'מטלה', 'מזהה'], [2, 6]); }
function choresSheet() { return sheet(CHORES, choreHeaders()); }
function weeksSheet() { return sheet(WEEKS, ['שבוע', 'ילד', 'מטלות', 'החלטה', 'סכום', 'עודכן'], [1]); }
function settingsSheet() { return sheet(SETTINGS, ['הגדרה', 'ערך']); }

// Safe to run again: creates what's missing and fills empty praise/nag cells,
// never overwrites anything already written in the sheet.
function setup() {
  logSheet(); weeksSheet();

  var ch = choresSheet(), headers = choreHeaders();
  ch.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  if (ch.getLastRow() < 2) {
    ch.getRange(2, 1, SEED.length, headers.length).setValues(SEED.map(seedRow));
  } else {
    var v = ch.getRange(1, 1, ch.getLastRow(), headers.length).getValues();
    for (var i = 1; i < v.length; i++) {
      var s = SEED.filter(function (x) { return x[2] === String(v[i][2]); })[0];
      if (!s) continue;
      var want = seedRow(s), changed = false;
      for (var c = 5; c < headers.length; c++) if (!v[i][c] && want[c]) { v[i][c] = want[c]; changed = true; }
      if (changed) ch.getRange(i + 1, 1, 1, headers.length).setValues([v[i]]);
    }
  }

  var st = settingsSheet();
  if (st.getLastRow() < 2) st.appendRow(['יעד שבועי', DEFAULT_TARGET]);

  var first = ss().getSheetByName('Sheet1') || ss().getSheetByName('גיליון1');
  if (first && first.getLastRow() === 0 && ss().getSheets().length > 1) ss().deleteSheet(first);
}

function setting(name, fallback) {
  var r = rows(settingsSheet()).filter(function (x) { return String(x[0]).trim() === name; })[0];
  return r && r[1] !== '' ? r[1] : fallback;
}

function rows(sh) {
  var v = sh.getDataRange().getValues();
  v.shift();
  return v;
}

/* ---------- dates ---------- */
function ymd(v) {
  return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v);
}
function addDays(key, n) {
  var p = key.split('-');
  return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)).toISOString().slice(0, 10);
}
// Sunday that starts the week containing `d`, in Israel time
function weekOf(d) {
  var dow = Number(Utilities.formatDate(d, TZ, 'u')) % 7;   // u: Mon=1..Sun=7 → Sun=0
  return addDays(Utilities.formatDate(d, TZ, 'yyyy-MM-dd'), -dow);
}

/* ---------- read ---------- */
function chores() {
  return rows(choresSheet()).filter(function (r) { return r[2]; }).map(function (r) {
    var texts = function (from, n) {
      return r.slice(from, from + n).map(String).filter(function (s) { return s.trim(); });
    };
    return {
      cat: String(r[0]), emoji: String(r[1]), title: String(r[2]), hint: String(r[3]), owner: String(r[4]).trim(),
      praise: texts(5, PRAISE_COLS), nag: texts(5 + PRAISE_COLS, NAG_COLS)
    };
  });
}

function state() {
  var now = new Date(), week = weekOf(now);
  var log = rows(logSheet()).map(function (r) {
    var t = r[0] instanceof Date ? r[0] : new Date(r[0]);
    return {
      ts: t.getTime(), week: ymd(r[1]), kid: String(r[2]), cat: String(r[3]), chore: String(r[4]), id: String(r[5]),
      day: Number(Utilities.formatDate(t, TZ, 'u')) % 7, time: Utilities.formatDate(t, TZ, 'HH:mm')
    };
  });

  var decisions = {}, earned = {};
  KIDS.forEach(function (k) { earned[k] = 0; });
  rows(weeksSheet()).forEach(function (r) {
    var w = ymd(r[0]), kid = String(r[1]);
    decisions[w + '|' + kid] = { decision: String(r[3]), amount: Number(r[4]) || 0, count: Number(r[2]) || 0 };
    if (earned[kid] !== undefined) earned[kid] += Number(r[4]) || 0;
  });

  var history = [];
  for (var i = 0; i < HISTORY_WEEKS; i++) {
    var w = addDays(week, -7 * i), kids = {}, any = i === 0;
    KIDS.forEach(function (k) {
      var done = log.filter(function (x) { return x.week === w && x.kid === k; });
      var d = decisions[w + '|' + k] || null;
      if (done.length || d) any = true;
      kids[k] = { count: done.length, chores: done.map(function (x) { return x.chore; }), decision: d ? d.decision : '' };
    });
    if (any) history.push({ week: w, end: addDays(w, 6), kids: kids });
  }

  // chores this calendar month (for the every-25th "shiny"), and when each kid last logged each chore
  var monthKey = Utilities.formatDate(now, TZ, 'yyyy-MM'), month = {}, lastDone = {};
  KIDS.forEach(function (k) { month[k] = 0; lastDone[k] = {}; });
  log.forEach(function (x) {
    if (month[x.kid] === undefined) return;
    if (Utilities.formatDate(new Date(x.ts), TZ, 'yyyy-MM') === monthKey) month[x.kid]++;
    if (!(lastDone[x.kid][x.chore] >= x.ts)) lastDone[x.kid][x.chore] = x.ts;
  });

  return {
    ok: true, kids: KIDS, reward: REWARD, earned: earned,
    target: Number(setting('יעד שבועי', DEFAULT_TARGET)) || DEFAULT_TARGET,
    now: now.getTime(), month: month, lastDone: lastDone,
    week: { start: week, end: addDays(week, 6) },
    chores: chores(),
    entries: log.filter(function (x) { return x.week === week; }),
    history: history
  };
}

/* ---------- write ---------- */
function add(b) {
  if (KIDS.indexOf(b.kid) < 0) throw 'unknown-kid';
  var c = chores().filter(function (x) { return x.title === b.chore; })[0];
  if (!c) throw 'unknown-chore';
  var now = new Date();
  logSheet().appendRow([now, weekOf(now), b.kid, c.cat, c.title, Utilities.getUuid().slice(0, 8)]);
}

function remove(b) {
  var sh = logSheet(), v = sh.getDataRange().getValues(), week = weekOf(new Date());
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][5]) === String(b.id)) {
      if (ymd(v[i][1]) !== week) throw 'past-week';
      sh.deleteRow(i + 1);
      return;
    }
  }
  throw 'not-found';
}

function checkPin(pin) {
  var real = PropertiesService.getScriptProperties().getProperty('PARENT_PIN');
  if (!real) throw 'no-pin-set';
  if (String(pin) !== String(real)) throw 'bad-pin';
}

function decide(b) {
  checkPin(b.pin);
  if (KIDS.indexOf(b.kid) < 0) throw 'unknown-kid';
  if (['yes', 'no', 'clear'].indexOf(b.decision) < 0) throw 'bad-decision';
  var w = String(b.week);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(w) || w > weekOf(new Date())) throw 'bad-week';

  var count = rows(logSheet()).filter(function (r) { return ymd(r[1]) === w && String(r[2]) === b.kid; }).length;
  var sh = weeksSheet(), v = sh.getDataRange().getValues(), at = -1;
  for (var i = 1; i < v.length; i++) if (ymd(v[i][0]) === w && String(v[i][1]) === b.kid) at = i + 1;

  if (b.decision === 'clear') { if (at > 0) sh.deleteRow(at); return; }
  var row = [w, b.kid, count, b.decision === 'yes' ? 'מגיע' : 'לא', b.decision === 'yes' ? REWARD : 0, new Date()];
  if (at > 0) sh.getRange(at, 1, 1, row.length).setValues([row]);
  else sh.appendRow(row);
}

/* ---------- web app ---------- */
function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  try { return json(state()); } catch (e) { return json({ ok: false, error: String(e) }); }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var b = JSON.parse(e.postData.contents);
    if (b.action === 'add') add(b);
    else if (b.action === 'delete') remove(b);
    else if (b.action === 'decide') decide(b);
    else if (b.action === 'checkPin') checkPin(b.pin);
    else throw 'unknown-action';
    return json(state());
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}
