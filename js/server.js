// the roblox server script, running locally: same config, same rules, saved in the browser
const KEY = "dontcrash_save_v1";

export const CONFIG = {
	title: "DON'T CRASH!",
	stages: [
		// towers is 6000, every map after it is 1.2x the one before
		{ id: "towers", name: "TOWERS", len: 3000 },
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
		{ id: "Jet", price: 50 },
		{ id: "Glider", price: 60 },
		{ id: "Banana", price: 90 },
		{ id: "Biplane", price: 100 },
		{ id: "Duck", price: 120 },
		{ id: "Paper", price: 150 },
		{ id: "Toaster", price: 160 },
		{ id: "Chopper", price: 180 },
		{ id: "Blimp", price: 200 },
		{ id: "Shark", price: 220 },
		{ id: "UFO", price: 250 },
		{ id: "Neon", price: 350 },
		{ id: "Rocket", price: 400 },
		{ id: "Dragon", price: 450 },
		{ id: "Firebird", price: 600 },
		{ id: "Gold", price: 800 },
		{ id: "Trident", price: 800 },
		// real money only, the price is what the button says
		{ id: "Phoenix", price: 1000, eur: "1,99 €", pack: "phoenix" },
		{ id: "Galaxy", price: 1000, eur: "1,99 €", pack: "galaxy" },
		{ id: "Razor", price: 1000, eur: "1,99 €", pack: "razor" },
		{ id: "Royal", price: 1000, eur: "SPECIAL PACK", pack: "special" },
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
export function xpNeed(level) {
	return Math.floor(100 * Math.pow(level, 1.5)) + 50;
}
export function levelReward(level) {
	return { coins: 100 * level, gems: level % 5 === 0 ? 15 : 0, keys: level % 10 === 0 ? 2 : 0 };
}

const DEFAULT = {
	coins: 0, gems: 0, keys: 0, best: 0, revives: 0, farthest: 0,
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
	// best run of the current week, for the weekly leaderboard
	week: { id: "", best: 0 },
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
		d = JSON.parse(localStorage.getItem(KEY) || "null");
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
export function setOnSave(fn) {
	onSave = fn;
}
function save(bump = true) {
	try {
		if (bump) s.data.savedAt = Date.now();
		localStorage.setItem(KEY, JSON.stringify(s.data));
		saving = true;
	} catch (e) {
		saving = false;
	}
	if (onSave) onSave();
}
export function exportData() {
	return copy(s.data);
}
// logging in swaps in the save from your account. settings stay the ones from this device
export function importData(d) {
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
// the monday this week started on
export const weekId = () => {
	const t = new Date();
	t.setHours(0, 0, 0, 0);
	t.setDate(t.getDate() - ((t.getDay() + 6) % 7));
	return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
};
const today = () => {
	const t = new Date();
	return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
};
function ensureMissions(d) {
	const day = today();
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
	const c = left[Math.floor(Math.random() * left.length)];
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
			if (item.eur) return [false, "this one's only in the gem shop"];
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
	s.runStart = performance.now() / 1000;
	s.runFrom = from;
	return [true];
};
handlers.run_end = (r) => {
	if (typeof r !== "object" || !s.runStart) return [false, "no run"];
	const elapsed = performance.now() / 1000 - s.runStart;
	s.runStart = null;
	const num = (v, max) => {
		v = Number(v) || 0;
		return Math.max(0, Math.min(max, Math.floor(v)));
	};
	const d = s.data;
	const dist = num(r.dist, Math.floor(elapsed * 3000));
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
	if (!d.week || d.week.id !== weekId()) d.week = { id: weekId(), best: 0 };
	d.week.best = Math.max(d.week.best, dist);
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
	st.loops = Math.max(st.loops, num(r.loop, 100));
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
handlers.ach = (id) => {
	if (typeof id !== "string" || id.length > 30) return [false, "bad id"];
	if (s.data.ach[id]) return [false, "already"];
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
export function resetData() {
	s.data = copy(DEFAULT);
	s.claimed = {};
	s.joined = now();
	s.runStart = null;
	save();
	return snapshot(false);
}

// the client calls this like the remote function: returns [ok, msg, snapshot]
export function call(action, arg) {
	const h = handlers[action];
	if (!h) return [false, "unknown action", snapshot(false)];
	const [ok, msg, withConfig] = h(arg);
	if (ok && action !== "get") save();
	return [ok, msg, snapshot(withConfig)];
}
