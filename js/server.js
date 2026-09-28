// the roblox server script, running locally: same config, same rules, saved in the browser
const KEY = "dontcrash_save_v1";

export const CONFIG = {
	title: "DON'T CRASH!",
	stages: [
		// towers is 6000, every map after it is 1.2x the one before
		{ id: "towers", name: "TOWERS", len: 6000 },
		{ id: "moving", name: "MOVING", len: 7200 },
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
		{ id: "moving", name: "MOVING", keys: 6, coins: 500 },
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
		{ id: "Biplane", price: 100 },
		{ id: "Paper", price: 150 },
		{ id: "UFO", price: 250 },
		{ id: "Rocket", price: 400 },
	],
	deaths: [
		{ id: "Default", price: 0 },
		{ id: "Confetti", price: 3 },
		{ id: "Pixel", price: 5 },
		{ id: "Nuke", price: 10 },
	],
	playRewards: [
		{ min: 2, coins: 50 },
		{ min: 5, coins: 100 },
		{ min: 7, coins: 150 },
		{ min: 8, coins: 150, gems: 2 },
		{ min: 10, coins: 250 },
		{ min: 15, coins: 400, gems: 5 },
		{ min: 20, coins: 500 },
		{ min: 30, coins: 800, gems: 10 },
		{ min: 50, coins: 1200, keys: 1 },
		{ min: 60, coins: 1500, gems: 20 },
		{ min: 90, coins: 2500, keys: 1 },
		{ min: 120, coins: 3500, gems: 40 },
		{ min: 180, coins: 6000, gems: 60, keys: 3 },
	],
	daily: { coins: 500, gems: 10, keys: 1 },
	hourly: { coins: 100, gems: 1 },
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
	deaths: { Default: true }, death: "Default",
	lastDaily: 0, lastHourly: 0,
	codes: {},
	bought: [],
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
function save() {
	try {
		localStorage.setItem(KEY, JSON.stringify(s.data));
		saving = true;
	} catch (e) {
		saving = false;
	}
}
const s = { data: load(), joined: now(), claimed: {}, runStart: null, runFrom: 0 };
save();

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

const handlers = {};
handlers.get = () => [true, null, true];
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
			if (d[currency] < item.price) return [false, "not enough " + currency];
			d[currency] -= item.price;
			d[ownedKey][id] = true;
			d[equipKey] = id;
			return [true, id + " unlocked"];
		}
	}
	return [false, "unknown item"];
}
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
	const mult = 1 + 0.25 * (d.power.coins || 0);
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
