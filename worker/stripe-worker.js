// the game's rules. this exact file runs twice: in the browser, so everything reacts right away,
// and inside the cloudflare worker, which is the one that counts. the browser copy is only a guess until the worker answers
const KEY = "dontcrash_save_v1";
const LS = typeof localStorage !== "undefined" ? localStorage : null;
// true inside the worker
let HOST = false;
function setHost(on) {
	HOST = !!on;
}

const CONFIG = {
	title: "DON'T CRASH!",
	stages: [
		// towers is 6000, every map after it is 1.2x the one before
		{ id: "towers", name: "BLOCKS", len: 3000 },
		{ id: "moving", name: "WALLS", len: 7200 },
		{ id: "canyon", name: "CANYON", len: 8600 },
		{ id: "smash", name: "SMASH", len: 10400 },
	],
	turretsLen: 12400,
	cityLen: 14900,
	mapBonus: 250,
	bossBonus: 750,
	// boss 2 is out until it's reworked, flip this back on and it's all there again
	boss2: false,
	closeBonus: 15,
	seaLen: 17900,
	beyondGap: 3000,
	starts: [
		{ id: "moving", name: "WALLS", keys: 6, coins: 500 },
		{ id: "canyon", name: "CANYON", keys: 6, coins: 1000 },
		{ id: "smash", name: "SMASH", keys: 6, coins: 1500 },
		{ id: "boss", name: "BOSS 1", keys: 6, coins: 2500 },
		{ id: "turrets", name: "TURRETS", keys: 10, coins: 3500 },
		{ id: "city", name: "CITY", keys: 10, coins: 4500 },
		{ id: "boss2", name: "BOSS 2", keys: 10, coins: 5500 },
		{ id: "sea", name: "SEA", keys: 16, coins: 7000 },
		{ id: "space", name: "SPACE", keys: 16, coins: 8500 },
	],
	bossHp: 8,
	powers: [{ id: "coins", name: "Coin multiplier", desc: "+25% coins per level", max: 10, base: 300 }],
	skins: [
		{ id: "Default", price: 0 },
		{ id: "Jet", price: 60 },
		{ id: "Glider", price: 72 },
		{ id: "Banana", price: 108 },
		{ id: "Biplane", price: 120 },
		{ id: "Duck", price: 144 },
		{ id: "Paper", price: 180 },
		{ id: "Toaster", price: 192 },
		{ id: "Chopper", price: 216 },
		{ id: "Blimp", price: 240 },
		{ id: "Shark", price: 264 },
		{ id: "UFO", price: 300 },
		{ id: "Neon", price: 420 },
		{ id: "Rocket", price: 480 },
		{ id: "Dragon", price: 540 },
		{ id: "Firebird", price: 720 },
		{ id: "Gold", price: 960 },
		{ id: "Trident", price: 960 },
		// these used to cost real money. now they're the big goal to save up for. keep: a reset doesn't take them away
		{ id: "Phoenix", price: 5000, keep: true },
		{ id: "Galaxy", price: 5000, keep: true },
		{ id: "Razor", price: 5000, keep: true },
		// came with the special pack. not for sale right now, whoever has it keeps it
		{ id: "Royal", price: 0, keep: true, gone: true },
	],
	deaths: [
		{ id: "Default", price: 0 },
		{ id: "SmokeBomb", price: 2 },
		{ id: "Confetti", price: 3 },
		{ id: "Bubbles", price: 3 },
		{ id: "Hearts", price: 3 },
		{ id: "Firework", price: 4 },
		{ id: "Freeze", price: 4 },
		{ id: "Pixel", price: 5 },
		{ id: "Lightning", price: 5 },
		{ id: "Coins", price: 6 },
		{ id: "Glitch", price: 6 },
		{ id: "BlackHole", price: 8 },
		{ id: "Nuke", price: 10 },
		{ id: "Supernova", price: 12 },
	],
	playRewards: [
		{ min: 2, coins: 400 },
		{ min: 5, coins: 800, gems: 5 },
		{ min: 10, coins: 1500, gems: 10 },
		{ min: 15, coins: 2000, keys: 1 },
		{ min: 20, coins: 2500, gems: 15 },
		{ min: 30, coins: 4000, gems: 20, keys: 1 },
		{ min: 45, coins: 5000, gems: 30 },
		{ min: 60, coins: 8000, gems: 40, keys: 2 },
		{ min: 90, coins: 12000, gems: 60, keys: 2 },
		{ min: 120, coins: 16000, gems: 80, keys: 3 },
		{ min: 180, coins: 25000, gems: 150, keys: 5 },
	],
	daily: { coins: 5000, gems: 40, keys: 3 },
	hourly: { coins: 1200, gems: 8 },
};

const CODES = {
	RQUW: { coins: 500 },
	XRACER: { gems: 15 },
	TOWERS: { coins: 1000, keys: 1 },
	COINS: { coins: 1000 },
	GEMS: { gems: 2 },
	KEYS: { keys: 1 },
	MOREKEYS: { keys: 2 },
	REVIVE: { revives: 1 },
	GIAN: { revives: 5 },
	TURRETS: { coins: 100, gems: 10 },
	UNLOCK: { keys: 5 },
	FABIO: { coins: 67 },
	BLASCHEGG: { coins: 125, gems: 41 },
	ARTHUR: { coins: 123, gems: 3, keys: 1 },
	FUCHSI: { coins: 88, gems: 2 },
	MATTHEO: { coins: 1 },
	NIKLAS: { gems: 1 },
	JONAS: { keys: 1 },
	SECRET: { coins: 100, gems: 10, keys: 1 },
	VERYSECRETCODE: { keys: 3 },
	FREESTUFF: { coins: 450, gems: 10 },
	PIETROPIZZI: { coins: 1000, gems: 20, keys: 1 },
	HOFFELBOI: { coins: 4600, gems: 16, keys: 1 },
	HOFFELBOY: { coins: 1 },
};
// the ones hidden around the game, the shop sells these too
const HIDDEN = ["COINS", "GEMS", "KEYS", "MOREKEYS", "REVIVE", "TURRETS", "UNLOCK", "FABIO", "BLASCHEGG", "ARTHUR", "FUCHSI", "MATTHEO", "NIKLAS", "JONAS", "SECRET", "VERYSECRETCODE", "FREESTUFF", "PIETROPIZZI", "HOFFELBOI"];
const CODE_BUYS = 5;

let acc = 0;
for (const s of CONFIG.stages) {
	s.start = acc;
	acc += s.len;
	s.finish = acc;
}
const BOSS_START = acc;
const BEYOND = BOSS_START + CONFIG.beyondGap;
const SEA_AT = BEYOND + CONFIG.turretsLen + CONFIG.cityLen + (CONFIG.boss2 ? 1500 : 100);
CONFIG.beyondAt = BEYOND;
CONFIG.seaAt = SEA_AT;
const AT = { boss: BOSS_START, turrets: BEYOND, city: BEYOND + CONFIG.turretsLen, boss2: BEYOND + CONFIG.turretsLen + CONFIG.cityLen, sea: SEA_AT, space: SEA_AT + CONFIG.seaLen + 1500 };
for (const st of CONFIG.stages) AT[st.id] = st.start;
const startById = {};
if (!CONFIG.boss2) CONFIG.starts = CONFIG.starts.filter((st) => st.id !== "boss2");
for (const st of CONFIG.starts) {
	st.at = AT[st.id];
	startById[st.id] = st;
}
// the client reads stage start/finish from CONFIG too, so reset those it recomputes
for (const s of CONFIG.stages) {
	delete s.start;
	delete s.finish;
}

// xp you need to get from a level to the next one
function xpNeed(level) {
	return Math.floor(100 * Math.pow(level, 1.5)) + 50;
}
function levelReward(level) {
	return { coins: 100 * level, gems: level % 5 === 0 ? 15 : 0, keys: level % 10 === 0 ? 2 : 0 };
}

const DEFAULT = {
	coins: 0, gems: 0, keys: 0, best: 0, revives: 0, farthest: 0, points: 0,
	style: { own: {}, color: "", title: "", trail: "" },
	power: { coins: 0 },
	skins: { Default: true }, skin: "Default",
	// what you fly after the first boss and in space. empty = the standard jet / stealth
	skin2: "", skin3: "",
	deaths: { Default: true }, death: "Default",
	lastDaily: 0, lastHourly: 0,
	codes: {},
	bought: [],
	shopHint: false,
	missions: null,
	// best run of today, this week and this month, plus the period before each, for the leaderboards and their prizes
	lb: {},
	// the most you managed in a single run, some achievements ask for that
	maxRun: { glass: 0, close: 0, kills: 0 },
	achPaid: {},
	paid: {},
	ach: {},
	boost: 1, boostUntil: 0,
	starts: {},
	tutDone: false,
	name: "",
	xp: 0, level: 1,
	stats: { runs: 0, dist: 0, coins: 0, bosses: 0, kills: 0, glass: 0, maps: 0, pickups: 0, hearts: 0, revives: 0, time: 0, loops: 0 },
	created: 0,
	settings: { view: 6, music: true, musicVol: 0.5, sfx: false, sfxVol: 0.7, fov: 70, low: false, shake: true, binds: {} },
};

function copy(t) {
	return JSON.parse(JSON.stringify(t));
}
function fill(t, def) {
	for (const k in def) {
		if (t[k] === undefined || t[k] === null) t[k] = typeof def[k] === "object" ? copy(def[k]) : def[k];
		else if (typeof def[k] === "object" && !Array.isArray(def[k]) && typeof t[k] === "object") fill(t[k], def[k]);
	}
}
const now = () => Math.floor(Date.now() / 1000);

let saving = true;
function load() {
	let d = null;
	try {
		d = LS ? JSON.parse(LS.getItem(KEY) || "null") : null;
	} catch (e) {
		d = null;
	}
	if (typeof d !== "object" || !d) d = {};
	fill(d, DEFAULT);
	// sounds start off for everyone, even saves from before, you turn them on in settings
	if (!d.sfxOptIn) {
		d.settings.sfx = false;
		d.sfxOptIn = true;
	}
	if (!d.created) d.created = Date.now();
	return d;
}
// the game hooks in here to copy every save to your account
let onSave = null;
function setOnSave(fn) {
	onSave = fn;
}
function save(bump = true) {
	try {
		if (bump) s.data.savedAt = Date.now();
		if (LS) LS.setItem(KEY, JSON.stringify(s.data));
		saving = true;
	} catch (e) {
		saving = false;
	}
	if (onSave) onSave();
}
function exportData() {
	return copy(s.data);
}
// logging in swaps in the save from your account. settings stay the ones from this device
function importData(d) {
	if (!d || typeof d !== "object") return false;
	const keepSettings = s.data.settings;
	d = copy(d);
	fill(d, DEFAULT);
	d.settings = keepSettings;
	s.data = d;
	s.claimed = {};
	save();
	return true;
}
const s = { data: load(), joined: now(), claimed: {}, runStart: null, runFrom: 0 };
save(false);

// ---------------- the worker's side: it loads a player's real save, runs the same handlers on it and stores the result
function setState(data, sess, name) {
	const d = data && typeof data === "object" ? copy(data) : {};
	fill(d, DEFAULT);
	if (!d.created) d.created = Date.now();
	if (name) d.name = name;
	// saves from before the daily and monthly boards only knew the week, carry that over
	if (d.week && d.week.id && !(d.lb && d.lb.week)) {
		d.lb = d.lb || {};
		d.lb.week = { id: d.week.id, best: d.week.best || 0 };
	}
	delete d.week;
	sess = sess || {};
	s.data = d;
	s.joined = sess.joined || now();
	s.claimed = sess.claimed || {};
	s.runStart = sess.runStart || null;
	s.runFrom = sess.runFrom || 0;
	s.mines = sess.mines || null;
	// firebase drops empty lists, so a game with nothing opened yet comes back without one
	if (s.mines && !Array.isArray(s.mines.picked)) s.mines.picked = [];
	s.casUsed = !!sess.casUsed;
	s.bj = sess.bj && Array.isArray(sess.bj.p) && Array.isArray(sess.bj.d) ? sess.bj : null;
}
function getState() {
	return copy({ data: s.data, sess: { joined: s.joined, claimed: s.claimed, runStart: s.runStart, runFrom: s.runFrom, mines: s.mines, bj: s.bj, casUsed: !!s.casUsed } });
}
// a fresh page load starts a new session for the playtime rewards
function newSession() {
	s.joined = now();
	s.claimed = {};
	s.runStart = null;
}
// the browser takes over what the worker says. settings stay the ones from this device, a run that's going on keeps its clock
function importAuth(data, sess) {
	if (!data || typeof data !== "object") return false;
	const keep = s.data.settings;
	const d = copy(data);
	fill(d, DEFAULT);
	d.settings = keep;
	d.sfxOptIn = true;
	s.data = d;
	if (sess) {
		if (sess.joined) s.joined = sess.joined;
		s.claimed = sess.claimed || {};
	}
	save(false);
	return true;
}
// what everyone else gets to see of you: leaderboards and your profile
function profileOf(d) {
	const p = {
		name: d.name || "player", best: d.best || 0, level: d.level || 1, xp: d.xp || 0, skin: d.skin, death: d.death,
		stats: d.stats, created: d.created || 0, updated: Date.now(), ach: Object.keys(d.ach || {}).length,
		nc: (d.style && d.style.color) || "", tt: (d.style && d.style.title) || "",
	};
	for (const [k, kind] of [["d", "day"], ["w", "week"], ["m", "month"]]) {
		const o = (d.lb || {})[kind] || {};
		p[k + "k"] = o.id || "";
		p[k + "b"] = o.best || 0;
		p[k + "pk"] = o.pid || "";
		p[k + "pb"] = o.pbest || 0;
	}
	return p;
}

function describe(r) {
	const parts = [];
	if (r.coins > 0) parts.push("+" + r.coins + " coins");
	if (r.gems > 0) parts.push("+" + r.gems + " gems");
	if (r.keys > 0) parts.push("+" + r.keys + " keys");
	if (r.revives > 0) parts.push("+" + r.revives + (r.revives === 1 ? " revive" : " revives"));
	if (r.boost) parts.push(r.boost + "x coins for 1h");
	return parts.join("  ");
}
function grant(d, r) {
	d.coins += r.coins || 0;
	d.gems += r.gems || 0;
	d.keys += r.keys || 0;
	d.revives = (d.revives || 0) + (r.revives || 0);
}

function snapshot(withConfig) {
	const d = copy(s.data);
	return { data: d, session: now() - s.joined, claimed: { ...s.claimed }, now: now(), config: withConfig ? CONFIG : null, saving };
}

// ---------------- daily missions: three a day, the same ones for everybody, new ones at midnight
const MISSION_POOL = [
	{ id: "dist", text: "FLY {n} STUDS", goals: [15000, 25000, 40000], gems: 15 },
	{ id: "one", text: "FLY {n} STUDS IN ONE RUN", goals: [6000, 10000, 15000], gems: 20, max: true },
	{ id: "glass", text: "SMASH {n} GLASS TOWERS", goals: [20, 40, 60], gems: 15 },
	{ id: "kills", text: "DESTROY {n} THINGS", goals: [25, 50, 80], gems: 15 },
	{ id: "close", text: "GET {n} CLOSE! CALLS", goals: [10, 20, 30], gems: 15 },
	{ id: "runs", text: "PLAY {n} RUNS", goals: [3, 5, 8], gems: 10 },
	{ id: "maps", text: "CLEAR {n} MAPS", goals: [3, 6, 10], gems: 15 },
	{ id: "boss", text: "BEAT {n} BOSSES", goals: [1, 2], gems: 25 },
	{ id: "coins", text: "EARN {n} COINS", goals: [3000, 6000, 10000], gems: 15 },
	{ id: "pickups", text: "PICK UP {n} GEMS OR KEYS", goals: [5, 10], gems: 15 },
];
const MISSION_BONUS = { gems: 30, keys: 1 };
// ---------------- days, weeks and months. always counted in austrian time, so the worker and every browser agree on when a day ends
const TZ = "Europe/Vienna";
const dayFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const wdFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const noon = (day) => Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)), 12);
const today = (ms) => dayFmt.format(new Date(ms || Date.now()));
// the id of the day / week (its monday) / month a moment falls in
function periodId(kind, ms) {
	const day = today(ms);
	if (kind === "day") return day;
	if (kind === "month") return day.slice(0, 7);
	const wd = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wdFmt.format(new Date(ms || Date.now())));
	return iso(noon(day) - wd * 86400000);
}
// the one right before the current one
function prevPeriodId(kind, ms) {
	const cur = periodId(kind, ms);
	if (kind === "day") return iso(noon(cur) - 86400000);
	if (kind === "week") return iso(noon(cur) - 7 * 86400000);
	const y = Number(cur.slice(0, 4)), m = Number(cur.slice(5, 7));
	return m === 1 ? y - 1 + "-12" : y + "-" + String(m - 1).padStart(2, "0");
}
const weekId = () => periodId("week");
// prizes when a leaderboard closes, places 1 to 3. only paid out when at least 3 people were on it
const LB_REWARDS = {
	day: [{ gems: 60 }, { gems: 30 }, { gems: 15 }],
	week: [{ gems: 200, keys: 3 }, { gems: 100, keys: 1 }, { gems: 50 }],
	month: [{ gems: 600, keys: 10 }, { gems: 300, keys: 5 }, { gems: 150, keys: 2 }],
};
const LB_MIN_PLAYERS = 3;
CONFIG.lbRewards = LB_REWARDS;
CONFIG.lbMin = LB_MIN_PLAYERS;
function bumpLb(d, dist) {
	d.lb = d.lb || {};
	for (const kind of ["day", "week", "month"]) {
		const cur = periodId(kind);
		const o = d.lb[kind] || (d.lb[kind] = { id: cur, best: 0 });
		if (o.id !== cur) {
			// a new period: what you had becomes "last time", that's what the prizes look at
			o.pid = o.id;
			o.pbest = o.best;
			o.id = cur;
			o.best = 0;
		}
		o.best = Math.max(o.best || 0, dist);
	}
}
function ensureMissions(d) {
	const day = periodId("day");
	if (d.missions && d.missions.day === day && Array.isArray(d.missions.list)) return d.missions;
	// the date decides which three, so the whole class has the same ones
	let h = 0;
	for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
	const rnd = () => {
		h = (h * 1664525 + 1013904223) >>> 0;
		return h / 4294967296;
	};
	const pool = MISSION_POOL.slice();
	const list = [];
	for (let i = 0; i < 3; i++) {
		const m = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
		const gi = Math.floor(rnd() * m.goals.length);
		const goal = m.goals[gi];
		list.push({ id: m.id, text: m.text.replace("{n}", goal.toLocaleString("en-US")).replace("1 BOSSES", "A BOSS"), goal, gems: Math.round(m.gems * (1 + gi * 0.5)), prog: 0, claimed: false });
	}
	d.missions = { day, list, bonus: false, bonusReward: MISSION_BONUS };
	return d.missions;
}
function missionProgress(d, got) {
	const m = ensureMissions(d);
	const done = [];
	for (const x of m.list) {
		const def = MISSION_POOL.find((p) => p.id === x.id);
		if (!def || x.prog >= x.goal) continue;
		const v = got[x.id] || 0;
		x.prog = Math.min(x.goal, def.max ? Math.max(x.prog, v) : x.prog + v);
		if (x.prog >= x.goal) done.push(x.text);
	}
	return done;
}

const handlers = {};
handlers.get = () => {
	ensureMissions(s.data);
	return [true, null, true];
};
handlers.mission_claim = (i) => {
	const m = ensureMissions(s.data);
	const x = m.list[Number(i)];
	if (!x) return [false, "unknown mission"];
	if (x.claimed) return [false, "already claimed"];
	if (x.prog < x.goal) return [false, "not done yet"];
	x.claimed = true;
	grant(s.data, { gems: x.gems });
	return [true, "mission done: +" + x.gems + " gems"];
};
handlers.mission_bonus = () => {
	const m = ensureMissions(s.data);
	if (m.bonus) return [false, "already claimed"];
	if (!m.list.every((x) => x.claimed)) return [false, "finish all three first"];
	m.bonus = true;
	grant(s.data, MISSION_BONUS);
	return [true, "all missions done: " + describe(MISSION_BONUS)];
};
handlers.claim_daily = () => {
	const d = s.data;
	if (now() - d.lastDaily < 86400) return [false, "not ready yet"];
	d.lastDaily = now();
	grant(d, CONFIG.daily);
	return [true, "gold chest: " + describe(CONFIG.daily)];
};
handlers.claim_hourly = () => {
	const d = s.data;
	if (now() - d.lastHourly < 3600) return [false, "not ready yet"];
	d.lastHourly = now();
	grant(d, CONFIG.hourly);
	return [true, "small chest: " + describe(CONFIG.hourly)];
};
handlers.claim_play = (i) => {
	const r = CONFIG.playRewards[(Number(i) || 0) - 1];
	if (!r) return [false, "unknown reward"];
	const key = "p" + i;
	if (s.claimed[key]) return [false, "already claimed"];
	if (now() - s.joined < r.min * 60) return [false, "keep playing"];
	s.claimed[key] = true;
	grant(s.data, r);
	return [true, describe(r)];
};
handlers.redeem = (code) => {
	if (typeof code !== "string") return [false, "invalid code"];
	code = code.toUpperCase().replace(/\s/g, "");
	const r = CODES[code];
	if (!r) return [false, "invalid code"];
	if (s.data.codes[code]) return [false, "already redeemed"];
	s.data.codes[code] = true;
	grant(s.data, r);
	return [true, "code redeemed: " + describe(r)];
};
// the "you've got gems, go spend them" nudge only shows once
handlers.shop_hint = () => {
	s.data.shopHint = true;
	return [true];
};
handlers.buy_code = () => {
	const d = s.data;
	d.bought = d.bought || [];
	if (d.bought.length >= CODE_BUYS) return [false, "sold out"];
	if (d.keys < 1) return [false, "not enough keys"];
	const left = HIDDEN.filter((c) => !d.codes[c] && !d.bought.includes(c));
	if (!left.length) return [false, "you already found every code"];
	// not random: the browser and the worker have to pick the same one
	const c = left[(d.bought.length * 7 + (Math.floor((d.created || 0) / 1000) % 97)) % left.length];
	d.keys -= 1;
	d.bought.push(c);
	return [true, "your code: " + c];
};
handlers.buy_power = (id) => {
	const d = s.data;
	for (const p of CONFIG.powers) {
		if (p.id === id) {
			const lvl = d.power[id] || 0;
			if (lvl >= p.max) return [false, "already maxed"];
			const price = p.base * (lvl + 1) ** 2;
			if (d.coins < price) return [false, "not enough coins"];
			d.coins -= price;
			d.power[id] = lvl + 1;
			return [true, p.name + " → level " + (lvl + 1)];
		}
	}
	return [false, "unknown item"];
};
function cosmetic(list, ownedKey, equipKey, currency, id) {
	const d = s.data;
	for (const item of list) {
		if (item.id === id) {
			if (d[ownedKey][id]) {
				d[equipKey] = id;
				return [true, id + " equipped"];
			}
			if (item.gone) return [false, "that one isn't for sale right now"];
			if (d[currency] < item.price) return [false, "not enough " + currency];
			d[currency] -= item.price;
			d[ownedKey][id] = true;
			d[equipKey] = id;
			return [true, id + " unlocked"];
		}
	}
	return [false, "unknown item"];
}
// the backpack: which plane goes in which of the three slots
handlers.loadout = (a) => {
	if (!a || ![1, 2, 3].includes(a.slot)) return [false, "unknown slot"];
	const d = s.data;
	const id = a.id || "";
	if (id && !d.skins[id]) return [false, "you don't own that one"];
	if (a.slot === 1) {
		if (!id) return [false, "pick a plane"];
		d.skin = id;
	} else d["skin" + a.slot] = id;
	return [true, "equipped"];
};
handlers.skin = (id) => cosmetic(CONFIG.skins, "skins", "skin", "gems", id);
handlers.death = (id) => cosmetic(CONFIG.deaths, "deaths", "death", "keys", id);
handlers.settings = (t) => {
	if (typeof t !== "object" || !t) return [false];
	const st = s.data.settings;
	const n = (v, lo, hi, def) => {
		v = Number(v);
		if (!isFinite(v)) return def;
		return Math.min(hi, Math.max(lo, v));
	};
	st.view = Math.floor(n(t.view, 3, 50, 6));
	st.music = t.music === true;
	st.musicVol = n(t.musicVol, 0, 1, 0.5);
	st.sfx = t.sfx === true;
	st.sfxVol = n(t.sfxVol, 0, 1, 0.7);
	st.fov = Math.floor(n(t.fov, 50, 110, 70));
	st.low = t.low === true;
	st.shake = t.shake !== false;
	const binds = {};
	if (t.binds && typeof t.binds === "object") {
		for (const action in t.binds) {
			const list = t.binds[action];
			if (Array.isArray(list)) binds[action] = [0, 1].map((i) => (typeof list[i] === "string" && list[i].length <= 20 && /^\w*$/.test(list[i]) ? list[i] : ""));
		}
	}
	st.binds = binds;
	return [true];
};
handlers.badge = () => [true];
handlers.tut_done = () => {
	s.data.tutDone = true;
	return [true];
};
handlers.unlock_start = (id) => {
	const st = startById[id];
	if (!st) return [false, "unknown start"];
	const d = s.data;
	if (d.starts[id]) return [false, "already unlocked"];
	const i = CONFIG.starts.indexOf(st);
	if (i > 0 && !d.starts[CONFIG.starts[i - 1].id]) return [false, "unlock " + CONFIG.starts[i - 1].name.toLowerCase() + " first"];
	if (Math.max(d.farthest || 0, d.best) < st.at) return [false, "fly there once first"];
	if (d.keys < st.keys) return [false, "not enough keys"];
	d.keys -= st.keys;
	d.starts[id] = true;
	return [true, st.name + " unlocked"];
};
handlers.use_revive = () => {
	if (!s.runStart) return [false, "no run"];
	if ((s.data.revives || 0) < 1) return [false, "no revives left"];
	s.data.revives -= 1;
	return [true];
};
// revive on the spot when you crash, paid with gems. the price depends on the stage, the client shows the same number
handlers.revive_gems = (price) => {
	price = Math.floor(Number(price) || 0);
	if (!s.runStart) return [false, "no run"];
	if (price < 100 || price > 5000) return [false, "invalid price"];
	if (s.data.gems < price) return [false, "not enough gems"];
	s.data.gems -= price;
	s.data.stats.revives = (s.data.stats.revives || 0) + 1;
	return [true];
};
// gems bought with real money. the payment itself is checked by the worker, this just makes sure one payment counts once
handlers.paid = (g) => {
	if (!g || typeof g.id !== "string") return [false, "bad payment"];
	// on the worker this only ever gets what it read from the database itself
	if (HOST && !g._fromDb) return [false, "bad payment"];
	const n = (v, max) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
	s.data.paid = s.data.paid || {};
	if (s.data.paid[g.id]) return [false, "already got those"];
	s.data.paid[g.id] = now();
	s.data.gems += n(g.gems, 100000);
	s.data.coins += n(g.coins, 1000000);
	s.data.keys += n(g.keys, 1000);
	s.data.revives = (s.data.revives || 0) + n(g.revives, 1000);
	if (typeof g.skin === "string" && CONFIG.skins.some((x) => x.id === g.skin)) {
		s.data.skins[g.skin] = true;
		s.data.skin = g.skin;
	}
	if (typeof g.death === "string" && CONFIG.deaths.some((x) => x.id === g.death)) {
		s.data.deaths[g.death] = true;
		s.data.death = g.death;
	}
	// a gift can open the casino: it's in the canyon on every run until they've been in
	if (g.casino === true) s.data.casinoNext = true;
	return [true, "thanks!"];
};
handlers.buy_revive = (n) => {
	const PACKS = { 1: 200, 5: 500 };
	const price = PACKS[n];
	if (!price) return [false, "unknown pack"];
	if (s.data.gems < price) return [false, "not enough gems"];
	s.data.gems -= price;
	s.data.revives = (s.data.revives || 0) + n;
	return [true, "+" + n + (n === 1 ? " revive" : " revives")];
};
handlers.run_start = (id) => {
	let from = 0;
	if (id && id !== "towers") {
		const st = startById[id];
		if (!st) return [false, "unknown start"];
		if (!s.data.starts[id]) return [false, "unlock it first"];
		if (s.data.coins < st.coins) return [false, "not enough coins"];
		s.data.coins -= st.coins;
		from = st.at;
	}
	// points from a casino visit that was never finished are settled now
	if (s.data.points > 0 || s.mines || s.bj) handlers.cas_leave();
	s.casUsed = false;
	s.runStart = runClock() / 1000;
	s.runFrom = from;
	return [true];
};
// when a run started and ended. the worker sets this from what the browser says, but never outside of what's possible
let clockAt = null;
function setRunClock(ms) {
	clockAt = ms;
}
const runClock = () => (clockAt === null ? Date.now() : clockAt);
handlers.run_end = (r) => {
	if (typeof r !== "object" || !s.runStart) return [false, "no run"];
	const elapsed = runClock() / 1000 - s.runStart;
	s.runStart = null;
	const num = (v, max) => {
		v = Number(v) || 0;
		return Math.max(0, Math.min(max, Math.floor(v)));
	};
	const d = s.data;
	// nobody flies faster than this on average, nitro and all. keeps made-up records out
	const dist = num(r.dist, Math.floor(elapsed * 1200) + 1000);
	const traveled = dist;
	const maps = num(r.maps, Math.floor(traveled / 2500) + 1);
	const bosses = num(r.bosses, Math.floor(traveled / 5000) + 1);
	const cap = Math.floor(traveled / 200) + 1;
	const kills = num(r.kills, cap * 4);
	const gemPads = num(r.gems, cap), keyPads = num(r.keys, cap);
	const glass = num(r.glass, cap * 3);
	const closes = num(r.close, Math.floor(elapsed / 1.1) + 1);
	const hearts = num(r.hearts, Math.floor(traveled / 4000) + 1);
	// versus: time in the lead multiplies your coins, up to x3
	const raceMult = Math.max(1, Math.min(3, Number(r.raceMult) || 1));
	const mult = (1 + 0.25 * (d.power.coins || 0)) * raceMult;
	const award = {
		coins: Math.floor((Math.floor(traveled / 10) + maps * CONFIG.mapBonus + bosses * CONFIG.bossBonus + glass * 10 + kills * 5 + closes * CONFIG.closeBonus) * mult),
		gems: gemPads * 5,
		keys: keyPads,
	};
	grant(d, award);
	if (hearts > 0) {
		d.revives = (d.revives || 0) + hearts;
		award.revives = hearts;
	}
	d.farthest = Math.max(d.farthest || 0, (s.runFrom || 0) + dist);
	d.best = Math.max(d.best, dist);
	bumpLb(d, dist);
	d.maxRun = d.maxRun || { glass: 0, close: 0, kills: 0 };
	d.maxRun.glass = Math.max(d.maxRun.glass || 0, glass);
	d.maxRun.close = Math.max(d.maxRun.close || 0, closes);
	d.maxRun.kills = Math.max(d.maxRun.kills || 0, kills);
	// lifetime stats for the profile
	const st = d.stats;
	st.runs++;
	st.dist += dist;
	st.coins += award.coins;
	st.bosses += bosses;
	st.kills += kills;
	st.glass += glass;
	st.maps += maps;
	st.pickups += gemPads + keyPads;
	st.hearts += hearts;
	st.revives += num(r.revives, 50);
	st.loops = Math.max(st.loops, num(r.loop, Math.floor(dist / 60000)));
	st.time += Math.min(elapsed, 36000);
	// xp, and a reward for every level you hit
	const xp = Math.max(5, Math.floor(dist / 25) + maps * 40 + bosses * 150 + kills * 2 + glass * 3 + (gemPads + keyPads) * 10);
	award.xp = xp;
	award.levelFrom = d.level;
	award.xpFrom = d.xp;
	d.xp += xp;
	award.levelUps = [];
	while (d.xp >= xpNeed(d.level)) {
		d.xp -= xpNeed(d.level);
		d.level++;
		const rw = levelReward(d.level);
		grant(d, rw);
		award.levelUps.push({ level: d.level, ...rw });
	}
	award.levelTo = d.level;
	award.xpTo = d.xp;
	award.best = d.best;
	award.dist = dist;
	award.mult = mult;
	award.missionsDone = missionProgress(d, { dist, one: dist, glass, kills, close: closes, runs: 1, maps, boss: bosses, coins: award.coins, pickups: gemPads + keyPads });
	return [true, award];
};
handlers.set_name = (name) => {
	// on the worker your name is your account name, nothing to set
	if (HOST) return [false, ""];
	if (typeof name !== "string") return [false, "invalid name"];
	name = name.trim().replace(/\s+/g, " ");
	if (name.length < 2 || name.length > 16) return [false, "2 to 16 characters"];
	if (!/^[A-Za-z0-9_ .-]+$/.test(name)) return [false, "letters, numbers, _ . - only"];
	s.data.name = name;
	return [true, "hi " + name + "!"];
};
// versus prize for your place, the size of the match decides it
handlers.race_prize = (info) => {
	const n = Math.max(0, Math.min(12, Math.floor(Number(info && info.n) || 0)));
	const place = Math.floor(Number(info && info.place) || 0);
	const bonus = place === 1 ? 100 * n : place === 2 && n >= 3 ? 50 * n : 0;
	if (bonus <= 0) return [true, ""];
	// one prize per match, a match takes a while
	if (now() - (s.data.lastRacePrize || 0) < 45) return [false, "too soon"];
	s.data.lastRacePrize = now();
	grant(s.data, { coins: bonus });
	return [true, "+" + bonus + " coins for your place"];
};
handlers.vs_played = () => {
	s.data.vsGames = (s.data.vsGames || 0) + 1;
	return [true];
};
// what every achievement pays out
const ACH_REWARDS = {
	towers: { gems: 10 }, moving: { gems: 15 }, canyon: { gems: 20 }, smash: { gems: 25 }, boss: { gems: 40 }, turrets: { gems: 40 }, city: { gems: 50 }, sea: { gems: 60 },
	space: { gems: 100, keys: 2 }, fullcircle: { gems: 300, keys: 5 },
	run5k: { gems: 10 }, run25k: { gems: 60 }, glass50: { gems: 25 }, close10: { gems: 15 }, kills50: { gems: 25 }, saved: { gems: 15 }, nodamage: { gems: 30 },
	heart: { gems: 10 }, revive: { gems: 10 }, pickups100: { gems: 40 }, rich: { gems: 30 }, skins3: { gems: 30 }, codes5: { gems: 20 },
	dist100k: { gems: 50 }, runs100: { gems: 50 }, level10: { gems: 50, keys: 2 }, vswin: { gems: 40 }, vs10: { gems: 50 },
};
CONFIG.achRewards = ACH_REWARDS;
// can the save back the achievement up? the worker only hands one out when it can
function earned(d, id) {
	const st = d.stats || {};
	const far = Math.max(d.farthest || 0, d.best || 0);
	const mr = d.maxRun || {};
	const stage = { towers: 3000, moving: 10200, canyon: 18800, smash: 29200, turrets: BEYOND + CONFIG.turretsLen, city: BEYOND + CONFIG.turretsLen + CONFIG.cityLen, sea: SEA_AT + CONFIG.seaLen };
	if (stage[id]) return far >= stage[id] - 50;
	switch (id) {
		case "boss": return (st.bosses || 0) >= 1;
		case "space": case "fullcircle": return (st.loops || 0) >= 1;
		case "run5k": return d.best >= 5000;
		case "run25k": return d.best >= 25000;
		case "glass50": return (mr.glass || 0) >= 50;
		case "close10": return (mr.close || 0) >= 10;
		case "kills50": return (mr.kills || 0) >= 50;
		case "saved": return (st.glass || 0) >= 1;
		case "nodamage": return far >= 3000;
		case "heart": return (st.hearts || 0) >= 1 || (d.revives || 0) >= 1;
		case "revive": return (st.revives || 0) >= 1;
		case "pickups100": return (st.pickups || 0) >= 100;
		case "rich": return d.coins >= 10000;
		case "skins3": return Object.keys(d.skins || {}).length >= 5;
		case "codes5": return Object.keys(d.codes || {}).length >= 5;
		case "dist100k": return (st.dist || 0) >= 100000;
		case "runs100": return (st.runs || 0) >= 100;
		case "level10": return (d.level || 1) >= 10;
		case "vswin": return (d.vsGames || 0) >= 1;
		case "vs10": return (d.vsGames || 0) >= 10;
	}
	return false;
}
// the ones you earn in the middle of a run: the save can't show them yet, so it goes by how far this run can be by now
function earnedNow(id) {
	if (!s.runStart) return false;
	const elapsed = runClock() / 1000 - s.runStart;
	const dist = elapsed * 1200 + 1000;
	const from = s.runFrom || 0, far = from + dist;
	const cap = Math.floor(dist / 200) + 1;
	const stage = { towers: 3000, moving: 10200, canyon: 18800, smash: 29200, turrets: BEYOND + CONFIG.turretsLen, city: BEYOND + CONFIG.turretsLen + CONFIG.cityLen, sea: SEA_AT + CONFIG.seaLen };
	if (stage[id]) return far >= stage[id] - 50;
	switch (id) {
		case "boss": return far >= BOSS_START;
		case "space": return far >= AT.space;
		case "fullcircle": return from === 0 && dist >= AT.space;
		case "run5k": return dist >= 5000;
		case "run25k": return dist >= 25000;
		case "glass50": return cap * 3 >= 50;
		case "kills50": return cap * 4 >= 50;
		case "close10": return elapsed / 1.1 + 1 >= 10;
		case "nodamage": return from === 0 && dist >= 3000;
		case "saved": case "heart": case "revive": return true;
	}
	return false;
}
// the worker hands out everything the save has earned by now, whatever the browser claimed
function checkAch() {
	const d = s.data;
	d.ach = d.ach || {};
	d.achPaid = d.achPaid || {};
	for (const id of ["towers", "moving", "canyon", "smash", "turrets", "city", "sea", "boss", "space", "run5k", "run25k", "glass50", "close10", "kills50", "heart", "revive", "pickups100", "rich", "skins3", "codes5", "dist100k", "runs100", "level10", "vs10"]) {
		if (d.ach[id] || !earned(d, id)) continue;
		d.ach[id] = Date.now();
		if (ACH_REWARDS[id] && !d.achPaid[id]) {
			d.achPaid[id] = true;
			grant(d, ACH_REWARDS[id]);
		}
	}
}
// ---------------- things to spend coins on. none of it makes you fly better, it's all for showing off
CONFIG.style = {
	color: [
		{ id: "red", hex: "#ff5d6c", price: 4000 }, { id: "orange", hex: "#ff9d3c", price: 6000 }, { id: "green", hex: "#5df08a", price: 8000 },
		{ id: "cyan", hex: "#5fdcff", price: 12000 }, { id: "purple", hex: "#b98aff", price: 18000 }, { id: "pink", hex: "#ff7ad8", price: 25000 },
		{ id: "gold", hex: "#ffd35a", price: 40000 }, { id: "rainbow", hex: "rainbow", price: 90000 },
	],
	title: [
		{ id: "rookie", name: "ROOKIE", price: 2000 }, { id: "pilot", name: "PILOT", price: 6000 }, { id: "ace", name: "ACE", price: 15000 },
		{ id: "daredevil", name: "DAREDEVIL", price: 25000 }, { id: "menace", name: "MENACE", price: 40000 }, { id: "legend", name: "LEGEND", price: 75000 },
		{ id: "myth", name: "MYTH", price: 150000 },
	],
	trail: [
		{ id: "red", hex: "#ff4050", price: 3000 }, { id: "green", hex: "#4dff8a", price: 5000 }, { id: "cyan", hex: "#40e0ff", price: 5000 },
		{ id: "pink", hex: "#ff60d0", price: 8000 }, { id: "gold", hex: "#ffd040", price: 12000 }, { id: "rainbow", hex: "rainbow", price: 50000 },
	],
};
// buy it, or put it on if it's yours. id "" takes it off
handlers.style = (a) => {
	if (!a || typeof a !== "object" || !CONFIG.style[a.kind]) return [false, "unknown item"];
	const st = s.data.style;
	if (a.id === "") {
		st[a.kind] = "";
		return [true, "taken off"];
	}
	const item = CONFIG.style[a.kind].find((x) => x.id === a.id);
	if (!item) return [false, "unknown item"];
	const key = a.kind + ":" + item.id;
	if (!st.own[key]) {
		if (s.data.coins < item.price) return [false, "not enough coins"];
		s.data.coins -= item.price;
		st.own[key] = true;
	}
	st[a.kind] = item.id;
	return [true, "it's yours"];
};
// gems for keys, the only way to trade one thing for another
CONFIG.gemPacks = [
	{ id: "k1", keys: 1, gems: 15 },
	{ id: "k5", keys: 5, gems: 85 },
	{ id: "k10", keys: 10, gems: 180 },
];
handlers.buy_gems = (id) => {
	const p = CONFIG.gemPacks.find((x) => x.id === id);
	if (!p) return [false, "unknown pack"];
	if ((s.data.keys || 0) < p.keys) return [false, "not enough keys"];
	s.data.keys -= p.keys;
	s.data.gems += p.gems;
	return [true, "+" + p.gems + " gems"];
};
// ---------------- the casino. the worker rolls everything, the browser only shows it. the house is always a bit ahead
const CASINO = {
	// you never bet anything you own. every visit hands you points for free, and only what you carry out
	// above the line turns into coins, one for one
	gift: 1000,
	cashAt: 2500,
	min: { points: 50 },
	max: { points: 50000 },
	// the wheel of fortune, 24 fields. on average you get back about 92%
	wheel: [0, 1.5, 0, 0.5, 2, 0, 1.5, 0, 0.5, 3, 0, 2, 0, 1.5, 0.5, 0, 5, 0, 2, 0, 0.5, 1.5, 0, 0],
	// minefield: 5x5, the fair multiplier times this
	minesEdge: 0.94,
	minesMax: 20,
	minesCap: 100,
	// blackjack: what a natural 21 pays on top of your bet. 6 to 5, the stingy kind
	bjNatural: 1.2,
	reds: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
};
CONFIG.casino = CASINO;
function rnd(n) {
	if (typeof crypto !== "undefined" && crypto.getRandomValues) {
		const a = new Uint32Array(1);
		crypto.getRandomValues(a);
		return Math.floor((a[0] / 4294967296) * n);
	}
	return Math.floor(Math.random() * n);
}
const CAS_CUR = ["points"];
CASINO.curs = CAS_CUR;
function stake(cur, amt) {
	if (!CAS_CUR.includes(cur)) return "you can only bet casino points";
	if (!Number.isInteger(amt) || amt < CASINO.min[cur]) return "the smallest bet is " + CASINO.min[cur];
	if (amt > CASINO.max[cur]) return "the biggest bet is " + CASINO.max[cur];
	if ((s.data[cur] || 0) < amt) return "not enough " + cur;
	return null;
}
function casinoStat(cur, bet, won) {
	const c = (s.data.casino = s.data.casino || { plays: 0 });
	c.plays++;
	c[cur + "In"] = (c[cur + "In"] || 0) + bet;
	c[cur + "Out"] = (c[cur + "Out"] || 0) + won;
}
handlers.cas_wheel = (a) => {
	if (!a || typeof a !== "object") return [false, "bad bet"];
	const bad = stake(a.cur, a.amt);
	if (bad) return [false, bad];
	const i = rnd(CASINO.wheel.length);
	const mult = CASINO.wheel[i];
	const win = Math.floor(a.amt * mult);
	s.data[a.cur] += win - a.amt;
	casinoStat(a.cur, a.amt, win);
	return [true, { i, mult, win, bet: a.amt, cur: a.cur }];
};
// one zero, 36 numbers. colours and halves pay double, a dozen triple, a single number 36 times
handlers.cas_roulette = (a) => {
	if (!a || typeof a !== "object" || !Array.isArray(a.bets) || a.bets.length < 1 || a.bets.length > 20) return [false, "bad bet"];
	let total = 0;
	for (const b of a.bets) {
		if (!b || !Number.isInteger(b.amt) || b.amt < 1) return [false, "bad bet"];
		if (!["red", "black", "even", "odd", "low", "high", "d1", "d2", "d3", "n"].includes(b.k)) return [false, "bad bet"];
		if (b.k === "n" && !(Number.isInteger(b.n) && b.n >= 0 && b.n <= 36)) return [false, "bad bet"];
		total += b.amt;
	}
	const bad = stake(a.cur, total);
	if (bad) return [false, bad];
	const n = rnd(37);
	const red = CASINO.reds.includes(n);
	let win = 0;
	for (const b of a.bets) {
		let m = 0;
		if (b.k === "n") m = b.n === n ? 36 : 0;
		else if (n === 0) m = 0;
		else if (b.k === "red") m = red ? 2 : 0;
		else if (b.k === "black") m = red ? 0 : 2;
		else if (b.k === "even") m = n % 2 === 0 ? 2 : 0;
		else if (b.k === "odd") m = n % 2 === 1 ? 2 : 0;
		else if (b.k === "low") m = n <= 18 ? 2 : 0;
		else if (b.k === "high") m = n >= 19 ? 2 : 0;
		else m = Math.ceil(n / 12) === Number(b.k[1]) ? 3 : 0;
		win += b.amt * m;
	}
	s.data[a.cur] += win - total;
	casinoStat(a.cur, total, win);
	return [true, { n, win, bet: total, cur: a.cur }];
};
// minefield. there is no hidden board: every pick is rolled when you make it, with the odds a real board would have.
// so there's nothing to peek at, and where the bombs "were" is only made up at the end for the picture
const minesMult = (n, k) => {
	let m = CASINO.minesEdge;
	for (let j = 0; j < k; j++) m *= (25 - j) / (25 - n - j);
	return Math.min(CASINO.minesCap, Math.floor(m * 100) / 100);
};
function minesBoard(g, hit) {
	const free = [];
	for (let i = 0; i < 25; i++) if (!g.picked.includes(i) && i !== hit) free.push(i);
	const out = hit == null ? [] : [hit];
	while (out.length < g.n && free.length) out.push(free.splice(rnd(free.length), 1)[0]);
	return out;
}
handlers.cas_mines_start = (a) => {
	if (!a || typeof a !== "object") return [false, "bad bet"];
	if (!Number.isInteger(a.mines) || a.mines < 1 || a.mines > CASINO.minesMax) return [false, "1 to " + CASINO.minesMax + " bombs"];
	// a game that was left lying around gets paid out first
	if (s.mines) handlers.cas_mines_cash();
	const bad = stake(a.cur, a.amt);
	if (bad) return [false, bad];
	s.data[a.cur] -= a.amt;
	s.mines = { cur: a.cur, amt: a.amt, n: a.mines, picked: [] };
	return [true, { next: minesMult(a.mines, 1) }];
};
handlers.cas_mines_pick = (i) => {
	const g = s.mines;
	if (!g) return [false, "no game"];
	if (!Number.isInteger(i) || i < 0 || i > 24 || g.picked.includes(i)) return [false, "bad field"];
	const left = 25 - g.picked.length;
	if (rnd(left) < g.n) {
		s.mines = null;
		casinoStat(g.cur, g.amt, 0);
		return [true, { boom: true, mines: minesBoard(g, i), bet: g.amt, cur: g.cur }];
	}
	g.picked.push(i);
	const mult = minesMult(g.n, g.picked.length);
	// nothing but bombs left: that's a full clear, paid out right away
	if (g.picked.length >= 25 - g.n) {
		const win = Math.floor(g.amt * mult);
		s.data[g.cur] += win;
		s.mines = null;
		casinoStat(g.cur, g.amt, win);
		return [true, { boom: false, mult, done: true, win, mines: minesBoard(g), bet: g.amt, cur: g.cur }];
	}
	return [true, { boom: false, mult, next: minesMult(g.n, g.picked.length + 1) }];
};
handlers.cas_mines_cash = () => {
	const g = s.mines;
	if (!g) return [false, "no game"];
	// nothing opened yet, nothing was rolled: the bet just goes back
	const mult = g.picked.length ? minesMult(g.n, g.picked.length) : 1;
	const win = Math.floor(g.amt * mult);
	s.data[g.cur] += win;
	s.mines = null;
	casinoStat(g.cur, g.amt, win);
	return [true, { mult, win, mines: minesBoard(g), bet: g.amt, cur: g.cur }];
};
// blackjack. cards are 0 to 51, drawn fresh every time, so there's no deck to count and the dealer's
// second card doesn't exist until it's turned over. the dealer stands on every 17
const bjVal = (cards) => {
	let v = 0, aces = 0;
	for (const c of cards) {
		const r = c % 13;
		if (r === 0) {
			aces++;
			v += 11;
		} else v += Math.min(10, r + 1);
	}
	while (v > 21 && aces-- > 0) v -= 10;
	return v;
};
function bjEnd(g, win, out) {
	win = Math.floor(win);
	s.data[g.cur] += win;
	s.bj = null;
	casinoStat(g.cur, g.amt, win);
	return [true, { p: g.p, d: g.d, done: true, out, win, bet: g.amt, cur: g.cur }];
}
function bjDealer(g) {
	while (bjVal(g.d) < 17) g.d.push(rnd(52));
	const p = bjVal(g.p), d = bjVal(g.d);
	// 21 with two cards beats 21 with three
	const dNat = d === 21 && g.d.length === 2, pNat = p === 21 && g.p.length === 2 && !g.doubled;
	if (pNat && !dNat) return bjEnd(g, g.amt * (2 + CASINO.bjNatural - 1), "blackjack");
	if (dNat && !pNat) return bjEnd(g, 0, "lose");
	if (d > 21 || p > d) return bjEnd(g, g.amt * 2, "win");
	if (p === d) return bjEnd(g, g.amt, "push");
	return bjEnd(g, 0, "lose");
}
handlers.cas_bj_start = (a) => {
	if (!a || typeof a !== "object") return [false, "bad bet"];
	// a hand that was left lying around is played out first, as if you stood
	if (s.bj) bjDealer(s.bj);
	const bad = stake(a.cur, a.amt);
	if (bad) return [false, bad];
	s.data[a.cur] -= a.amt;
	const g = (s.bj = { cur: a.cur, amt: a.amt, p: [rnd(52), rnd(52)], d: [rnd(52)] });
	if (bjVal(g.p) === 21) return bjDealer(g);
	return [true, { p: g.p, d: g.d }];
};
handlers.cas_bj_hit = () => {
	const g = s.bj;
	if (!g) return [false, "no hand"];
	g.p.push(rnd(52));
	const v = bjVal(g.p);
	if (v > 21) return bjEnd(g, 0, "bust");
	if (v === 21) return bjDealer(g);
	return [true, { p: g.p, d: g.d }];
};
handlers.cas_bj_stand = () => (s.bj ? bjDealer(s.bj) : [false, "no hand"]);
// twice the bet, exactly one more card
handlers.cas_bj_double = () => {
	const g = s.bj;
	if (!g) return [false, "no hand"];
	if (g.p.length !== 2) return [false, "only on your first two cards"];
	if ((s.data[g.cur] || 0) < g.amt) return [false, "not enough " + g.cur];
	s.data[g.cur] -= g.amt;
	g.amt *= 2;
	g.doubled = true;
	g.p.push(rnd(52));
	if (bjVal(g.p) > 21) return bjEnd(g, 0, "bust");
	return bjDealer(g);
};
// the way in: once per run, and only if you can have reached the canyon's end by now
handlers.cas_enter = () => {
	if (HOST) {
		if (!s.runStart || s.casUsed) return [false, "the casino is closed"];
		const far = (Date.now() / 1000 - s.runStart) * 1200 + 1000 + (s.runFrom || 0);
		if (far < AT.smash - 1000 || (s.runFrom || 0) >= AT.smash - 1000) return [false, "the casino is closed"];
	}
	s.casUsed = true;
	s.data.casinoNext = false;
	s.mines = null;
	s.bj = null;
	s.data.points = CASINO.gift;
	return [true, { points: CASINO.gift }];
};
// the way out: enough points become coins, too few are just gone
handlers.cas_leave = () => {
	if (s.mines) handlers.cas_mines_cash();
	if (s.bj) bjDealer(s.bj);
	const p = Math.floor(s.data.points || 0);
	s.data.points = 0;
	if (p >= CASINO.cashAt) {
		s.data.coins += p;
		return [true, { paid: p }];
	}
	return [true, { paid: 0, lost: p }];
};
// start over. what you paid real money for stays yours
handlers.reset = () => {
	const old = s.data;
	const d = copy(DEFAULT);
	d.name = old.name;
	d.created = Date.now();
	d.paid = old.paid || {};
	d.settings = old.settings;
	d.sfxOptIn = true;
	for (const item of CONFIG.skins) if (item.keep && old.skins && old.skins[item.id]) d.skins[item.id] = true;
	s.data = d;
	s.claimed = {};
	s.runStart = null;
	ensureMissions(d);
	return [true, "fresh start"];
};
handlers.ach = (id) => {
	if (typeof id !== "string" || id.length > 30) return [false, "bad id"];
	if (s.data.ach[id]) return [false, "already"];
	if (HOST && !earned(s.data, id) && !earnedNow(id)) return [false, "not yet"];
	s.data.ach[id] = Date.now();
	s.data.achPaid = s.data.achPaid || {};
	const rw = ACH_REWARDS[id];
	if (rw && !s.data.achPaid[id]) {
		s.data.achPaid[id] = true;
		grant(s.data, rw);
	}
	return [true, rw ? describe(rw) : ""];
};
// the ones you unlocked before achievements paid anything
handlers.ach_retro = () => {
	const d = s.data;
	d.achPaid = d.achPaid || {};
	const total = { gems: 0, keys: 0, coins: 0 };
	let n = 0;
	for (const id in d.ach) {
		const rw = ACH_REWARDS[id];
		if (!rw || d.achPaid[id]) continue;
		d.achPaid[id] = true;
		n++;
		for (const k in rw) total[k] += rw[k];
	}
	if (!n) return [false, ""];
	grant(d, total);
	return [true, n + (n === 1 ? " achievement: " : " achievements: ") + describe(total)];
};
handlers.spawn_char = () => [true];
handlers.despawn_char = () => [true];

// "resetdata" typed into the code box wipes everything, like the chat command in the roblox version
function resetData() {
	s.data = copy(DEFAULT);
	s.claimed = {};
	s.joined = now();
	s.runStart = null;
	save();
	return snapshot(false);
}

// the client calls this like the remote function: returns [ok, msg, snapshot]
function call(action, arg) {
	const h = handlers[action];
	if (!h) return [false, "unknown action", snapshot(false)];
	const [ok, msg, withConfig] = h(arg);
	if (ok && action !== "get") save();
	return [ok, msg, snapshot(withConfig)];
}

// =====================================================================================================================
// DON'T CRASH! worker (cloudflare). everything above this line is the game's rule book, the same file the browser runs.
// down here: the part that makes it count. every player's real save lives in firebase under vault/<player>, only this
// worker can write there. the browser sends what the player did, the worker replays it on the real save and answers
// with the result. so gems, skins and records typed into the browser console are gone again on the next sync.
// it also takes the payment notices from stripe and pays out the leaderboard prizes.
//
// needs 3 variables in the worker settings:
//   STRIPE_WEBHOOK_SECRET  whsec_... from the stripe webhook
//   FIREBASE_SECRET        database secret from firebase (project settings > service accounts > database secrets)
//   FIREBASE_DB            https://dontcrash-7a1db-default-rtdb.europe-west1.firebasedatabase.app

const DEV_UID = "Jj2BGaR4ZBSqqQxmWtX8Vym95Ji1";
const FIREBASE_KEY = "AIzaSyDbXhlHYOlbbTTU2xm7QfytbQXiT58uIDw";

// what every pack costs (in cents) and gives. has to match the payment links and PACKS in the game
const PAY_PACKS = {
	special: { amt: 999, gems: 1000, coins: 50000, revives: 10, keys: 15, skin: "Royal" },
	gems500: { amt: 299, gems: 500 },
	gems1000: { amt: 499, gems: 1000 },
	gems2500: { amt: 999, gems: 2500 },
	phoenix: { amt: 199, skin: "Phoenix" },
	galaxy: { amt: 199, skin: "Galaxy" },
	razor: { amt: 199, skin: "Razor" },
};

// ---------------- firebase, with the admin secret
const fbUrl = (env, path, q) => `${env.FIREBASE_DB.replace(/\/+$/, "")}/${path}.json?${q ? q + "&" : ""}${env.FB_QUERY || "auth=" + env.FIREBASE_SECRET}`;
async function fbGet(env, path, q) {
	const r = await fetch(fbUrl(env, path, q));
	if (!r.ok) throw new Error("db read " + r.status);
	return await r.json();
}
async function fbWrite(env, method, path, value) {
	const r = await fetch(fbUrl(env, path), { method, body: JSON.stringify(value) });
	if (!r.ok) throw new Error("db write " + r.status);
}

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (obj, status) => new Response(JSON.stringify(obj), { status: status || 200, headers: { "content-type": "application/json", ...CORS } });

// ---------------- who is asking: the login token from the game, checked with google
const whoCache = new Map();
async function whoIs(env, token) {
	if (typeof token !== "string" || token.length < 20) return null;
	const hit = whoCache.get(token);
	if (hit && hit.until > Date.now()) return hit;
	const r = await fetch(`${env.AUTH_URL || "https://identitytoolkit.googleapis.com"}/v1/accounts:lookup?key=${FIREBASE_KEY}`, {
		method: "POST",
		headers: { "content-type": "application/json", referer: "https://rquw.github.io/dontcrash/" },
		body: JSON.stringify({ idToken: token }),
	});
	if (!r.ok) return null;
	const u = ((await r.json()).users || [])[0];
	// only real accounts (name + password) have a save up here
	if (!u || !u.localId || !u.email || !u.email.endsWith("@dontcrash.game")) return null;
	const who = { uid: u.localId, name: u.email.split("@")[0], until: Date.now() + 10 * 60000 };
	if (whoCache.size > 500) whoCache.clear();
	whoCache.set(token, who);
	return who;
}

// what the browser may ask for. everything else isn't a thing
const ACTIONS = new Set(["mission_claim", "mission_bonus", "claim_daily", "claim_hourly", "claim_play", "redeem", "shop_hint", "buy_code", "buy_power", "loadout", "skin", "death", "tut_done", "unlock_start", "use_revive", "revive_gems", "paid", "buy_revive", "run_start", "run_end", "race_prize", "vs_played", "ach", "ach_retro", "reset", "cas_wheel", "cas_roulette", "cas_mines_start", "cas_mines_pick", "cas_mines_cash", "cas_bj_start", "cas_bj_hit", "cas_bj_stand", "cas_bj_double", "cas_enter", "cas_leave", "buy_gems", "style"]);

async function sync(req, env, ctx) {
	let body;
	try {
		body = await req.json();
	} catch (e) {
		return json({ ok: false, error: "bad request" }, 400);
	}
	const who = await whoIs(env, body.token);
	if (!who) return json({ ok: false, error: "login" }, 401);
	const uid = who.uid;
	const actions = Array.isArray(body.actions) ? body.actions.slice(0, 40) : [];

	// who is who: only the dev may ask, and only the dev gets an answer
	if (body.names !== undefined) {
		if (uid !== DEV_UID) return json({ ok: false, error: "not for you" }, 403);
		const n = body.names;
		if (n && typeof n === "object" && typeof n.id === "string" && /^[A-Za-z0-9-]{6,128}$/.test(n.id)) {
			const name = String(n.name || "").trim().slice(0, 60);
			await fbWrite(env, name ? "PUT" : "DELETE", `realnames/${n.id}`, name || undefined);
		}
		return json({ ok: true, names: (await fbGet(env, "realnames")) || {} });
	}

	if (body.remove === true) {
		await Promise.all([fbWrite(env, "DELETE", `vault/${uid}`), fbWrite(env, "DELETE", `players/${uid}`), fbWrite(env, "DELETE", `saves/${uid}`), fbWrite(env, "DELETE", `grants/${uid}`)]);
		return json({ ok: true, removed: true });
	}

	let v = await fbGet(env, `vault/${uid}`);
	if (!v || !v.data) {
		// first time: take over the save this account had before the worker kept the books
		const old = await fbGet(env, `saves/${uid}`);
		v = { data: old && typeof old === "object" ? old : null, sess: {} };
	}
	// purchases and gifts: the worker reads them itself, the browser only says which one to collect
	const grants = {};
	for (const a of actions) {
		const id = a && a.a === "paid" && a.arg && typeof a.arg.id === "string" && /^[A-Za-z0-9_-]{3,120}$/.test(a.arg.id) ? a.arg.id : null;
		if (id && !(id in grants)) grants[id] = await fbGet(env, `grants/${uid}/${id}`);
	}

	// ---- from here to the end of the block nothing waits, so two players can never get mixed up
	setHost(true);
	setState(v.data, v.sess, who.name);
	if (body.hello === true) newSession();
	const results = [];
	const collected = [];
	let clock = Math.min(Date.now(), Number(v.at) || Date.now());
	for (const a of actions) {
		if (!a || !ACTIONS.has(a.a)) {
			results.push([false, "unknown action"]);
			continue;
		}
		let arg = a.arg;
		if (a.a === "paid") {
			const g = arg && grants[arg.id];
			if (!g || !g.pack) {
				results.push([false, "no such payment"]);
				continue;
			}
			arg = { ...g, id: a.arg.id, _fromDb: true };
			collected.push(a.arg.id);
		}
		// runs are timed by the browser's clock, but only between the last time we heard from it and now.
		// so a run can come in late (bad wifi) and still count, and nobody can claim an hour they didn't fly
		const nowMs = Date.now();
		clock = Math.min(nowMs, Math.max(clock, Number(a.t) || nowMs));
		setRunClock(a.a === "run_start" || a.a === "run_end" ? clock : null);
		let r;
		try {
			r = call(a.a, arg);
		} catch (e) {
			r = [false, "error"];
		}
		setRunClock(null);
		results.push([r[0], typeof r[1] === "string" || (r[1] && typeof r[1] === "object") ? r[1] : null]);
	}
	// big wins and cash outs go on the ticker everyone in the casino sees
	const feed = [];
	actions.forEach((a, i) => {
		const r = results[i], o = r && r[0] && r[1];
		if (!o || typeof o !== "object" || !a || typeof a.a !== "string") return;
		if (a.a === "cas_leave" && o.paid > 0) feed.push({ n: who.name, k: "cash", w: o.paid });
		else if (a.a.startsWith("cas_") && o.win >= 600 && o.bet > 0 && o.win >= o.bet * 3) feed.push({ n: who.name, k: "win", w: o.win, g: a.a.split("_")[1] });
	});
	call("get");
	checkAch();
	const out = getState();
	out.at = Date.now();
	const profile = profileOf(out.data);
	// ----

	const writes = [fbWrite(env, "PUT", `vault/${uid}`, out), fbWrite(env, "PATCH", `players/${uid}`, profile)];
	for (const id of collected) writes.push(fbWrite(env, "PUT", `grants/${uid}/${id}/claimed`, true));
	for (const f of feed.slice(0, 3)) writes.push(fbWrite(env, "POST", "meta/feed", { ...f, at: { ".sv": "timestamp" } }));
	if (feed.length) ctx.waitUntil(trimFeed(env).catch(() => {}));
	await Promise.all(writes);
	ctx.waitUntil(settle(env).catch(() => {}));
	return json({ ok: true, results, data: out.data, sess: { joined: out.sess.joined, claimed: out.sess.claimed }, now: Math.floor(Date.now() / 1000) });
}

// the ticker only ever needs the last few
async function trimFeed(env) {
	const keys = Object.keys((await fbGet(env, "meta/feed", "shallow=true")) || {}).sort();
	for (const k of keys.slice(0, Math.max(0, keys.length - 25))) await fbWrite(env, "DELETE", `meta/feed/${k}`);
}

// ---------------- leaderboard prizes. when a day, week or month is over the top 3 of it get something,
// but only if at least 3 people were on that board. checked whenever someone syncs, at most every few minutes
let settledAt = 0;
async function settle(env) {
	if (Date.now() - settledAt < (env.SETTLE_EVERY ?? 5 * 60000)) return;
	settledAt = Date.now();
	const meta = (await fbGet(env, "meta/lb")) || {};
	const due = ["day", "week", "month"].filter((kind) => meta[kind] !== prevPeriodId(kind));
	if (!due.length) return;
	const players = (await fbGet(env, "players")) || {};
	const NAMES = { day: "THE DAY", week: "THE WEEK", month: "THE MONTH" };
	for (const kind of due) {
		const pid = prevPeriodId(kind);
		const k = kind[0];
		const board = [];
		for (const uid in players) {
			const p = players[uid];
			if (!p || typeof p.name !== "string") continue;
			// someone who hasn't played since still has it as their current one
			const best = p[k + "k"] === pid ? p[k + "b"] || (k === "w" ? p.wbest : 0) : p[k + "pk"] === pid ? p[k + "pb"] : 0;
			if (best > 0) board.push({ uid, best });
		}
		board.sort((a, b) => b.best - a.best);
		if (board.length >= LB_MIN_PLAYERS) {
			for (let i = 0; i < Math.min(3, board.length); i++) {
				const rw = CONFIG.lbRewards[kind][i];
				// the id is the same every time, so paying out twice by accident changes nothing
				const path = `grants/${board[i].uid}/lb_${kind}_${pid}`;
				if (!(await fbGet(env, path))) await fbWrite(env, "PUT", path, { ...rw, pack: "lb", place: i + 1, kind, note: "#" + (i + 1) + " OF " + NAMES[kind], best: board[i].best, at: { ".sv": "timestamp" } });
			}
		}
		await fbWrite(env, "PUT", `meta/lb/${kind}`, pid);
	}
}

// ---------------- stripe: a payment came in
async function stripe(req, env) {
	const body = await req.text();
	if (!(await verifyStripe(body, req.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET))) {
		return new Response("bad signature", { status: 400 });
	}
	const ev = JSON.parse(body);
	if (ev.type !== "checkout.session.completed" && ev.type !== "checkout.session.async_payment_succeeded") return new Response("ignored");

	const cs = ev.data.object;
	// a 100% coupon comes through as "no_payment_required"
	if (cs.payment_status !== "paid" && cs.payment_status !== "no_payment_required") return new Response("not paid yet");
	// the game sends "<player>__<pack>", the price before any coupon has to match the pack so nobody gets the big one for 1,99
	const [uid, packId] = String(cs.client_reference_id || "").split("__");
	const pack = PAY_PACKS[packId];
	if (!uid || !/^[A-Za-z0-9-]{6,128}$/.test(uid) || !pack || pack.amt !== (cs.amount_subtotal ?? cs.amount_total)) return new Response("no player or wrong pack");

	// stripe sometimes sends the same event twice, one payment only counts once.
	// a wrong secret shouldn't silently eat a payment: fail, and stripe tries again later
	try {
		const had = await fbGet(env, `grants/${uid}/${cs.id}`);
		if (!had) await fbWrite(env, "PUT", `grants/${uid}/${cs.id}`, { ...pack, amt: undefined, pack: packId, eur: cs.amount_total / 100, at: { ".sv": "timestamp" } });
	} catch (e) {
		return new Response("database failed", { status: 500 });
	}
	return new Response("ok");
}

async function verifyStripe(body, header, secret) {
	if (!header || !secret) return false;
	let t = null;
	const sigs = [];
	for (const part of header.split(",")) {
		const [k, val] = part.split("=");
		if (k === "t") t = val;
		if (k === "v1") sigs.push(val);
	}
	if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(t + "." + body));
	const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
	return sigs.includes(hex);
}

export default {
	async fetch(req, env, ctx) {
		if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
		if (req.method !== "POST") return new Response("dont crash");
		if (new URL(req.url).pathname.replace(/\/+$/, "") === "/sync") {
			try {
				return await sync(req, env, ctx);
			} catch (e) {
				return json({ ok: false, error: "server" }, 500);
			}
		}
		return stripe(req, env);
	},
};
