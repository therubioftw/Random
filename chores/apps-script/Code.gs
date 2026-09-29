/* ============================================================
   Chores app backend — Google Apps Script bound to the chores Google Sheet.

   One-time setup:
   1. Create an empty Google Sheet → Extensions → Apps Script → paste this file.
   2. Run setup() once (it creates the tabs and fills in the chores list).
   3. Project Settings → Script properties → add PARENT_PIN (Ilana's code).
   4. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
      Put the /exec URL into DEFAULT_API_URL in chores/index.html.

   The chores list lives in the "מטלות" tab — edit it there, no code change needed.
   Weeks run Sunday→Saturday (Israel time); nothing is ever deleted, a new week
   simply starts counting from zero at Saturday midnight.
   ============================================================ */

var TZ = 'Asia/Jerusalem';
var KIDS = ['ליאם', 'רובי'];
var REWARD = 10;
var HISTORY_WEEKS = 8;
var LOG = 'יומן', CHORES = 'מטלות', WEEKS = 'שבועות';

var SEED = [
  // קטגוריה, אימוג'י, מטלה, הסבר, של מי
  ['חתולים', '🐈', 'לנקות חול חתולים', '', 'ליאם'],
  ['חתולים', '🐈', 'לסרק', '', 'ליאם'],
  ['מודי', '🐶', 'למלא מים', 'הצלחת תמיד צריכה להיות מלאה ונקייה', ''],
  ['מודי', '🐶', 'להוציא לטיול', 'לתאם עם אמא ורועי', 'רובי'],
  ['מודי', '🐶', 'לתת אוכל', 'לתאם עם אמא ורועי', ''],
  ['מטבח', '🍽️', 'לרוקן את הכיור', 'להכניס למדיח/לשטוף', 'רובי'],
  ['מטבח', '🍽️', 'להפעיל מדיח', '', ''],
  ['מטבח', '🍽️', 'להוציא מהמדיח', '', 'ליאם'],
  ['מטבח', '🍽️', 'לנקות כיריים', '', ''],
  ['מטבח', '🍽️', 'לנקות את השיש', '', ''],
  ['מטבח', '🍽️', 'להוציא את הפח ולזרוק אותו למטה', '', 'רובי'],
  ['נקיונות בית', '🧹', 'לטאטא סלון, מטבח ומרפסת', 'כולל חדר השירות', ''],
  ['נקיונות בית', '🧹', 'לטאטא חדרים ושירותים', 'בכל החדרים, האמבטיה והשירותים', ''],
  ['נקיונות בית', '🧹', 'לנקות ולייבש כיורים', 'בשירותים ובאמבטיה', 'רובי'],
  ['נקיונות בית', '🧹', 'לאסוף בגדים מפוזרים', 'לבדוק גם מגבות וסמרטוטים', ''],
  ['נקיונות בית', '🧹', 'להחזיר דברים למקום', 'ספרים, תיקים וכו׳', ''],
  ['כביסה', '👕', 'למיין כביסה ולהפעיל מכונה', '', 'ליאם'],
  ['כביסה', '👕', 'להעביר מהמכונה למייבש', '', 'ליאם'],
  ['כביסה', '👕', 'להוציא מהמייבש לסל', '', 'ליאם'],
  ['כביסה', '👕', 'לקפל כביסה ולפזר לחדרים', '', '']
];

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
function choresSheet() { return sheet(CHORES, ['קטגוריה', 'אימוג׳י', 'מטלה', 'הסבר', 'של מי']); }
function weeksSheet() { return sheet(WEEKS, ['שבוע', 'ילד', 'מטלות', 'החלטה', 'סכום', 'עודכן'], [1]); }

function setup() {
  logSheet(); weeksSheet();
  var ch = choresSheet();
  if (ch.getLastRow() < 2) ch.getRange(2, 1, SEED.length, SEED[0].length).setValues(SEED);
  var first = ss().getSheetByName('Sheet1') || ss().getSheetByName('גיליון1');
  if (first && first.getLastRow() === 0 && ss().getSheets().length > 1) ss().deleteSheet(first);
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
    return { cat: String(r[0]), emoji: String(r[1]), title: String(r[2]), hint: String(r[3]), owner: String(r[4]).trim() };
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

  return {
    ok: true, kids: KIDS, reward: REWARD, earned: earned,
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
