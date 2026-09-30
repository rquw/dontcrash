import {
	THREE, clamp, lerp, sign, rad, random, Vector3, Vector2, Color3, CFrame, UDim2, UDim, Random, clock, osTime, task, Signal, RunService,
	camera, Lighting, Instance, workspace, markQueryRoot, Enum, OverlapParams, TweenService, TweenInfo, Debris, UIS, playSfx, loopSound, loadSounds, setSfxVolume,
	NumberSequence, NumberSequenceKeypoint, NumberRange, ColorSequence, ColorSequenceKeypoint, guiRootInst, setUiScale, setLowGraphics, physicsGround,
	mergeFloor, start, perf,
} from "./engine.js?v=1790759340";
import * as Server from "./server.js?v=1790759340";
import * as Online from "./online.js?v=1790759340";

const V3 = (x, y, z) => new Vector3(x, y, z);
const RGB = Color3.fromRGB;
const CFn = (x, y, z) => CFrame.new(x, y, z);
const Ang = CFrame.Angles;
const U2 = (a, b, c, d) => new UDim2(a, b, c, d);
const US = UDim2.fromScale;
const UO = UDim2.fromOffset;
const V2 = (x, y) => new Vector2(x, y);
const mod = (a, b) => a - Math.floor(a / b) * b;
const idiv = (a, b) => Math.floor(a / b);
const deg = (r) => (r * 180) / Math.PI;
const EASE = Enum.EasingStyle;
const EDIR = Enum.EasingDirection;

// name: [file, pitch, volume, pitch jitter]
const SFX = {
	hover: ["ui_hover", 1, 0.15, 0.05], click: ["ui_click", 1, 0.8, 0.04], open: ["ui_open", 1, 0.55, 0], close: ["ui_close", 1, 0.45, 0],
	good: ["ui_good", 1, 0.6, 0], bad: ["ui_bad", 1, 0.6, 0], tick: ["ui_tick", 1, 0.15, 0], whoosh: ["whoosh_ui", 1, 0.5, 0.05],
	portal: ["pick_fuel", 1, 0.8, 0], crash: ["crash", 1, 1, 0],
	crash_confetti: ["crash_confetti", 1, 1, 0], crash_pixel: ["crash_pixel", 1, 1, 0], crash_nuke: ["crash_nuke", 1, 1, 0],
	coin_land: ["coin_land", 1, 0.3, 0.04], pick_fuel: ["pick_fuel", 1, 0.8, 0.06], pick_gem: ["pick_gem", 1, 0.8, 0.04], pick_key: ["pick_key", 1, 0.9, 0], pick_heart: ["pick_heart", 1, 1, 0],
	nitro_on: ["nitro_on", 1, 0.45, 0.05], roll: ["roll", 1, 0.45, 0.08], near: ["near", 1, 0.45, 0.08],
	stage: ["stage", 1, 0.45, 0], map_clear: ["map_clear", 1, 0.7, 0], loop_banner: ["loop_banner", 1, 0.9, 0],
	glass: ["glass", 1, 0.85, 0.1], shatter: ["shatter", 1, 0.5, 0.12], hit: ["hit", 1, 0.2, 0.15], shield: ["shield", 1, 0.5, 0.1],
	gun: ["gun", 1, 0.12, 0.08], gun_plasma: ["gun_plasma", 1, 0.12, 0.08],
	laser_charge: ["laser_charge", 1, 0.3, 0.05], laser_fire: ["laser_fire", 1, 0.5, 0.08],
	missile_launch: ["missile_launch", 1, 0.7, 0.08], missile_pass: ["missile_pass", 1, 0.9, 0.06], blast: ["blast", 1, 0.5, 0.1], orb: ["orb", 1, 0.15, 0.05],
	shield_down: ["shield_down", 1, 0.8, 0],
	tower_fall: ["tower_fall", 1, 0.9, 0.05], tower_land: ["tower_land", 1, 1, 0.05],
	boss_in: ["boss_in", 1, 1, 0], boss2_in: ["boss2_in", 1, 1, 0], boss_phase: ["boss_phase", 1, 0.9, 0], boss_down: ["boss_down", 1, 1, 0], boss_flyover: ["boss_flyover", 1, 0.9, 0],
	jet_arrive: ["jet_arrive", 1, 0.9, 0], swap: ["swap", 1, 0.9, 0], plane_down: ["plane_down", 1, 0.8, 0], carrier: ["carrier", 1, 0.7, 0],
	land: ["land", 1, 1, 0], launch: ["launch", 1, 1, 0], reentry_hit: ["reentry_hit", 1, 0.9, 0],
	alarm: ["alarm", 1, 0.18, 0], fuel_out: ["fuel_out", 1, 0.7, 0], count: ["count", 1, 0.6, 0], go: ["go", 1, 0.8, 0], revive: ["revive", 1, 0.9, 0], record: ["record", 1, 0.9, 0],
};
const LOOPS = ["loop_prop", "loop_jet", "loop_wind", "loop_nitro", "loop_space", "loop_reentry", "loop_boss"];
await loadSounds([...new Set(Object.values(SFX).map((d) => d[0]))].map((f) => [f, f + ".mp3"]).concat(LOOPS.map((f) => [f, f + ".wav"])), "./sfx/");

// ------------------------------------------------------------------ data

let data, claimed, CONFIG, saveState;
let sessionBase = 0, snapNow = osTime(), snapClock = clock();
let refreshUI = null;

function apply(s) {
	if (typeof s !== "object" || !s) return;
	data = s.data;
	claimed = s.claimed;
	sessionBase = s.session;
	snapNow = s.now;
	snapClock = clock();
	if (s.config) CONFIG = JSON.parse(JSON.stringify(s.config));
	saveState = s.saving;
	if (refreshUI) refreshUI();
}

function request(action, arg) {
	let r;
	try {
		r = Server.call(action, arg);
	} catch (e) {
		console.error(e);
		return [false, "error"];
	}
	apply(r[2]);
	return [r[0], r[1]];
}

request("get");

const settings = JSON.parse(JSON.stringify(data.settings));

const serverNow = () => snapNow + (clock() - snapClock);
const sessionTime = () => sessionBase + (clock() - snapClock);
const boostMult = () => (data.boostUntil > serverNow() ? data.boost : 1);

function fmt(n) {
	const s = String(Math.floor(Math.abs(n)));
	const out = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	return (n < 0 ? "-" : "") + out;
}
function fmtTime(s) {
	s = Math.max(0, Math.floor(s));
	const h = idiv(s, 3600), m = idiv(s % 3600, 60), sec = s % 60;
	const p2 = (v) => String(v).padStart(2, "0");
	if (h > 0) return `${h}:${p2(m)}:${p2(sec)}`;
	return `${m}:${p2(sec)}`;
}
function describe(r) {
	const parts = [];
	if (r.coins && r.coins > 0) parts.push("+" + fmt(r.coins) + " ●");
	if (r.gems && r.gems > 0) parts.push("+" + fmt(r.gems) + " ◆");
	if (r.keys && r.keys > 0) parts.push("+" + fmt(r.keys) + " ✦");
	return parts.join("   ");
}

// ------------------------------------------------------------------ sound

function sfx(name, pitch, vol, pan) {
	const d = SFX[name];
	if (!settings.sfx || !d) return;
	const jit = d[3] ? 1 + (Math.random() * 2 - 1) * d[3] : 1;
	playSfx(d[0], (pitch || d[1]) * jit, d[2] * (vol === undefined ? 1 : vol), pan || 0);
}
// louder the closer it is to the plane, panned to its side
function sfxAt(name, at, range, pitch) {
	const d = at.sub(pos).Magnitude;
	const k = clamp(1 - d / (range || 600), 0, 1);
	if (k <= 0.02) return;
	sfx(name, pitch, k * k * 0.9 + 0.1 * k, clamp((at.X - pos.X) / 120, -0.8, 0.8));
}

// ------------------------------------------------------------------ constants

const BASE_SPEED = 90;
const STRAFE = 70;
const STEER = 6;
const ALT = 25;
const SOFT = 1600;
const ARENA = 1600;
const HITBOX = V3(10, 2, 7);
const PICKBOX = V3(16, 16, 8);

const CHUNK = 200;
const SAFE_ROWS = 2;

const BLAST_RADIUS = 45;
const BLAST_POWER = 140;
const CORE = 9;
const CRATER = 28;

const FUEL = { max: 100, drain: 4.5, pad: 18, nitro: 30, sink: 4, mult: 10 };

const TOWER = RGB(70, 70, 80);

const STAGE_BY_ID = {};
let BOSS_START;
(() => {
	let acc = 0;
	for (const s of CONFIG.stages) {
		s.start = acc;
		acc += s.len;
		s.finish = acc;
		STAGE_BY_ID[s.id] = s;
	}
	BOSS_START = acc;
})();
const MAP_STAGES = { towers: true, moving: true, canyon: true, smash: true, turrets: true, city: true, sea: true };

const PAD = {
	fuel: [RGB(255, 45, 35), "FUEL"],
	gem: [RGB(90, 220, 255), "+5 ◆"],
	key: [RGB(255, 200, 70), "+1 ✦"],
	heart: [RGB(255, 40, 70), "+1 REVIVE"],
};

// ------------------------------------------------------------------ state

let mode = "menu";
let dead = false;
let runId = 0;
let pos = V3(0, ALT, 0);
let vx = 0;
let runTime = 0;
let shake = 0;
let speedNow = BASE_SPEED;
let fuel = FUEL.max, nitroK = 0;
const roll = { dir: 0, cd: 0, kick: 0 };
const Missiles = {};
const Game = { SPACE_LEN: 8000, flow: { tier: 1 }, boss2: {}, guns: {}, marks: {}, cam: {}, fallers: new Map(), SEA_LEN: CONFIG.seaLen || 5000, loop: 0, loopBase: 0, voidT: 0, gravity: workspace.Gravity, touch: {} };
window.Game = Game;
let devK = 0;

(() => {
	const DEFAULT = {
		left: ["A", "Left"],
		right: ["D", "Right"],
		nitro: ["W", "Space"],
		dashL: ["Q", "MouseButton1"],
		dashR: ["E", "MouseButton2"],
		shoot: ["LeftShift", "RightShift"],
		pause: ["P", ""],
	};
	const NICE = {
		LeftShift: "SHIFT", RightShift: "R-SHIFT", LeftControl: "CTRL", RightControl: "R-CTRL", LeftAlt: "ALT", RightAlt: "R-ALT",
		MouseButton1: "LEFT CLICK", MouseButton2: "RIGHT CLICK", MouseButton3: "MIDDLE CLICK",
		Space: "SPACE", Return: "ENTER", Left: "LEFT", Right: "RIGHT", Up: "UP", Down: "DOWN", Tab: "TAB",
	};
	Game.BIND_DEFAULT = DEFAULT;
	Game.BIND_ORDER = ["left", "right", "nitro", "dashL", "dashR", "shoot", "pause"];
	Game.BIND_NAMES = { left: "STEER LEFT", right: "STEER RIGHT", nitro: "NITRO", dashL: "DASH LEFT", dashR: "DASH RIGHT", shoot: "SHOOT", pause: "PAUSE" };

	Game.binds = () => {
		settings.binds = typeof settings.binds === "object" && settings.binds && !Array.isArray(settings.binds) ? settings.binds : {};
		for (const action in DEFAULT) {
			const b = settings.binds[action];
			if (!Array.isArray(b)) settings.binds[action] = [DEFAULT[action][0], DEFAULT[action][1]];
		}
		return settings.binds;
	};
	const mouseName = (n) => n.slice(0, 11) === "MouseButton";
	Game.down = (action) => {
		for (const n of Game.binds()[action]) {
			if (n !== "") {
				if (mouseName(n)) {
					if (!Game.touch.on && UIS.IsMouseButtonPressed(n)) return true;
				} else if (UIS.IsKeyDown(n)) return true;
			}
		}
		return false;
	};
	Game.isBind = (action, input) => {
		const name = input.UserInputType === "Keyboard" ? input.KeyCode : input.UserInputType;
		if (mouseName(name) && Game.touch.on) return false;
		for (const n of Game.binds()[action]) if (n !== "" && n === name) return true;
		return false;
	};
	Game.niceKey = (n) => {
		if (n === "") return "-";
		return NICE[n] || n.toUpperCase();
	};
	Game.keyName = (action) => {
		const b = Game.binds()[action];
		return Game.niceKey(b[0] !== "" ? b[0] : b[1]);
	};
})();

const isDev = false;
let ghost = false;
let menuX = 0, menuZ = 0;
let curStage;
let stats;
const buff = { immortal: 0 };
let boss = null, bossDone = false, beyondStart = null;

let seed = 0;
let canyonOffset = 0;
let chunks = new Map();
let queued = new Map();
let lastKey;
let maxRow = -1;
const pads = new Map();

const world = Instance.new("Folder");
world.Name = "World";
world.Parent = workspace;
markQueryRoot(world);

const pickups = Instance.new("Folder");
pickups.Name = "Pickups";
pickups.Parent = workspace;
markQueryRoot(pickups);

const junk = Instance.new("Folder");
junk.Name = "Junk";
junk.Parent = workspace;

const params = OverlapParams.new();
params.FilterType = "Include";
params.FilterDescendantsInstances = [world];

const pickParams = OverlapParams.new();
pickParams.FilterType = "Include";
pickParams.FilterDescendantsInstances = [pickups];

// ------------------------------------------------------------------ world

function stageFor(d) {
	if (Game.introEnd && d < Game.introEnd) return ["intro", 0];
	for (const s of CONFIG.stages) {
		if (d < s.finish) return [s.id, clamp((d - s.start) / s.len, 0, 1)];
	}
	if (beyondStart != null && d >= beyondStart) {
		const k = d - beyondStart;
		const tl = CONFIG.turretsLen || 4000, cl = CONFIG.cityLen || 4000;
		if (k < tl) return ["turrets", k / tl];
		if (k < tl + cl) return ["city", (k - tl) / cl];
		const m = Game.marks;
		// boss 2 switched off: a short beach after the city, then the sea
		if (m.sea == null && CONFIG.boss2 === false) {
			m.sea = beyondStart + tl + cl + 100;
			Game.boss2.done = true;
		}
		if (m.sea == null || d < m.sea) return ["boss2", 0];
		if (m.final == null || d < m.final) return ["sea", Math.min((d - m.sea) / Game.SEA_LEN, 1)];
		return ["beyond", (d - m.final) / 1000];
	}
	return ["boss", 0];
}

function stageName(id) {
	const n = STAGE_BY_ID[id] ? STAGE_BY_ID[id].name : { boss: "BOSS", turrets: "TURRETS", city: "CITY", boss2: CONFIG.boss2 === false ? "SEA" : "BOSS", sea: "SEA", beyond: "SPACE", intro: "" }[id];
	return (n === undefined ? String(id) : n).replace(/^\d+\s*/, "");
}

function block(size, p, color, parent) {
	const b = Instance.new("Part");
	b.Anchored = true;
	b.Size = size;
	b.Position = p;
	b.Color = color;
	b.Parent = parent;
	return b;
}

let trackChunks, updateMovers, regenerate, canyonPath, canyonHalfGap, updatePads;
(() => {
	function floorColor(stage, h, x, d) {
		let s = 90 + h * 6;
		if (stage === "moving") return RGB(s, s * 0.8, s * 0.5);
		if (stage === "canyon") return RGB(s * 0.9, s * 0.5, s * 0.35);
		if (stage === "smash") {
			s = 60 + h * 5;
			return RGB(s * 0.45, s * 0.35, s * 0.8);
		}
		if (stage === "chill") return Color3.fromHSV(mod((x + d) / 500, 1), 0.55, 0.95);
		if (stage === "boss") return RGB(30 + h * 4, 20, 25);
		if (stage === "beyond") return RGB(20, 25 + h * 3, 45 + h * 4);
		if (stage === "turrets") return RGB(s * 0.55, s * 0.75, s * 0.45);
		if (stage === "city") return RGB(35 + h * 2, 35 + h * 2, 42 + h * 2);
		if (stage === "boss2" && CONFIG.boss2 === false) return RGB(s * 0.95, s * 0.85, s * 0.6);
		if (stage === "boss2") return RGB(s * 0.6, s * 0.45, s * 0.35);
		if (stage === "sea") return RGB(20 + h * 8, 70 + h * 14, 140 + h * 12);
		return RGB(s * 0.6, s, s * 0.5);
	}

	canyonPath = (d) => {
		const k = clamp((d - STAGE_BY_ID.canyon.start) / 400, 0, 1);
		return (Math.sin((d + canyonOffset) / 300) * 60 + Math.sin((d + canyonOffset) / 130) * 22) * k;
	};

	canyonHalfGap = (d) => {
		const c = STAGE_BY_ID.canyon;
		const k = d - c.start;
		const funnel = 1700 - k * 0.6;
		const tight = (1700 - 60) / 0.6;
		const t = clamp((k - tight) / Math.max(c.len - tight, 1), 0, 1);
		const narrow = 60 - t * 18;
		return [Math.max(narrow, funnel), funnel > narrow];
	};

	const amount = (rng, n) => Math.floor(n + rng.NextNumber());

	// smash: nothing may stand inside a glass tower or in the stretch right behind it, you can't see through
	const smashSpots = [];
	function behindGlass(x, z, hw, hd, isGlass) {
		for (let i = smashSpots.length - 1; i >= 0; i--) {
			const g = smashSpots[i];
			if (!g.part.Parent) {
				smashSpots.splice(i, 1);
				continue;
			}
			if (g.glass === isGlass || Math.abs(x - g.x) >= hw + g.hw + 14) continue;
			if (!isGlass && z <= g.z + g.hw + hd + 6 && z >= g.z - 220) return true;
			if (isGlass && g.z <= z + hw + g.hd + 6 && g.z >= z - 220) return true;
		}
		return false;
	}
	function towers(folder, rng, x0, z0, count, color, smash) {
		for (let i = 0; i < count; i++) {
			const w = rng.NextInteger(14, 30);
			const d = rng.NextInteger(14, 30);
			const h = rng.NextInteger(100, 120);
			let x = null, z = 0;
			for (let k = 0; k < (smash ? 5 : 1); k++) {
				x = x0 + rng.NextNumber(w / 2, CHUNK - w / 2);
				z = z0 - rng.NextNumber(d / 2, CHUNK - d / 2);
				if (!smash || !behindGlass(x, z, w / 2, d / 2, false)) break;
				x = null;
			}
			if (x === null) continue;
			const t = block(V3(w, h, d), V3(x, h / 2, z), color || TOWER, folder);
			t.SetAttribute("Break", true);
			if (smash) smashSpots.push({ part: t, glass: false, x, z, hw: w / 2, hd: d / 2 });
		}
	}

	function movingWall(folder, movers, rng, x0, z0, t) {
		const p = block(V3(rng.NextInteger(40, 110), 45, 8), V3(x0 + rng.NextNumber(0, CHUNK), 10, z0 - rng.NextNumber(15, CHUNK - 15)), RGB(230, 120, 50), folder);
		p.SetAttribute("Break", true);
		movers.push({ part: p, base: p.Position, a: Vector3.yAxis.mul(22), f: (0.8 + t * 0.7) * rng.NextNumber(0.85, 1.15), ph: rng.NextNumber(0, 6.28) });
	}

	function turretTowers(folder, rng, x0, z0, count) {
		for (let i = 0; i < count; i++) {
			const w = rng.NextInteger(18, 26);
			const h = rng.NextInteger(95, 115);
			const x = x0 + rng.NextNumber(w / 2, CHUNK - w / 2);
			const z = z0 - rng.NextNumber(w / 2, CHUNK - w / 2);
			const t = block(V3(w, h, w), V3(x, h / 2, z), RGB(60, 35, 40), folder);
			t.SetAttribute("Break", true);
			const head = block(V3(w + 2, 6, w + 2), V3(x, h + 3, z), RGB(30, 20, 22), t);
			head.CanQuery = false;
			const eye = block(V3(6, 2.5, 1), V3(x, h + 3, z + w / 2 + 1.2), RGB(255, 40, 40), t);
			eye.Material = "Neon";
			eye.CanQuery = false;
			Missiles.addTurret(t);
		}
	}

	function cityBlocks(folder, rng, x0, z0, count, plain) {
		const neon = [RGB(0, 220, 255), RGB(255, 60, 200), RGB(255, 210, 60)];
		for (let i = 0; i < count; i++) {
			const w = rng.NextInteger(28, 52), d = rng.NextInteger(28, 60), h = rng.NextInteger(160, 340);
			const x = x0 + rng.NextNumber(w / 2, CHUNK - w / 2);
			const z = z0 - rng.NextNumber(d / 2, CHUNK - d / 2);
			const shade = rng.NextInteger(70, 105);
			const b = block(V3(w, h, d), V3(x, h / 2, z), RGB(shade, shade, shade + 15), folder);
			b.SetAttribute("Break", true);
			b.SetAttribute("HP", 8);
			const col = neon[rng.NextInteger(1, neon.length) - 1];
			const n = plain || settings.low ? 0 : 3;
			for (let j = 0; j < n; j++) {
				const band = block(V3(w + 0.4, 2, d + 0.4), V3(x, rng.NextNumber(8, h - 6), z), col, b);
				band.Material = "Neon";
				band.CanQuery = false;
				band.CastShadow = false;
			}
			if (!plain && h < 230 && rng.NextNumber() < 0.35) {
				const warn = block(V3(w * 0.6, 3, d * 0.6), V3(x, h + 1.5, z), RGB(255, 40, 40), b);
				warn.Material = "Neon";
				warn.CanQuery = false;
				Game.fallers.set(b, { warn });
			}
		}
	}

	// every ship's footprint, so a new one never lands inside another one
	const shipRects = new Map();
	function shipFits(key, x0, x1, z0, z1) {
		for (const [k, r] of shipRects) {
			if (k === key) continue;
			if (!r.parts[0].Parent) shipRects.delete(k);
			else if (r.x1 + 30 > x0 && r.x0 - 30 < x1 && r.z1 + 40 > z0 && r.z0 - 40 < z1) return false;
		}
		return true;
	}

	function ships(folder, rng, x0, z0, count) {
		const hullC = RGB(88, 94, 104), deckC = RGB(62, 66, 74), superC = RGB(122, 128, 138);
		for (let i = 0; i < count; i++) {
			const x = x0 + rng.NextNumber(30, CHUNK - 30);
			const z = z0 - rng.NextNumber(0, CHUNK);
			const L = rng.NextInteger(220, 300), W = rng.NextInteger(40, 56);
			const key = x0 + ":" + z0 + ":" + i;
			const rx0 = x - W / 2, rx1 = x + W / 2, rz0 = z - L / 2 - 50, rz1 = z + L / 2;
			if (!shipFits(key, rx0, rx1, rz0, rz1)) continue;
			const before = folder.GetChildren().length;

			const hull = block(V3(W, 26, L), V3(x, 13, z), hullC, folder);
			hull.SetAttribute("Floor", true);
			const bow = Instance.new("WedgePart");
			bow.Anchored = true;
			bow.Size = V3(W, 26, 50);
			bow.Color = hullC;
			bow.CFrame = CFn(x, 13, z - L / 2 - 25);
			bow.SetAttribute("Floor", true);
			bow.Parent = folder;
			const deck = block(V3(W - 4, 0.6, L - 10), V3(x, 26.3, z), deckC, hull);
			deck.CanQuery = false;
			const stripe = block(V3(W + 0.4, 2, L + 0.4), V3(x, 4, z), RGB(150, 40, 40), hull);
			stripe.CanQuery = false;

			const sz = z + L * 0.12;
			const s1 = block(V3(W * 0.55, 42, 60), V3(x, 26 + 21, sz), superC, folder);
			s1.SetAttribute("Break", true);
			s1.SetAttribute("HP", 8);
			const s2 = block(V3(W * 0.4, 24, 36), V3(x, 68 + 12, sz + 4), superC, folder);
			s2.SetAttribute("Break", true);
			s2.SetAttribute("HP", 6);
			const win = block(V3(W * 0.4 + 0.4, 2, 36.4), V3(x, 86, sz + 4), RGB(150, 220, 255), s2);
			win.Material = "Neon";
			win.CanQuery = false;
			const mast = block(V3(2.5, 40, 2.5), V3(x, 92 + 20, sz + 4), RGB(60, 60, 65), folder);
			mast.SetAttribute("Break", true);
			mast.SetAttribute("HP", 1);
			const radar = block(V3(16, 6, 1), V3(x, 126, sz + 4), RGB(150, 155, 160), mast);
			radar.CanQuery = false;
			const beacon = block(V3(2, 2, 2), V3(x, 133, sz + 4), RGB(255, 40, 40), mast);
			beacon.Material = "Neon";
			beacon.CanQuery = false;

			for (const gz of [z - L * 0.32, z + L * 0.38]) {
				const base = block(V3(14, 6, 14), V3(x, 29, gz), superC, hull);
				base.CanQuery = false;
				for (const bx of [-2, 2]) {
					const barrel = block(V3(1.2, 1.2, 18), V3(x + bx, 30, gz - 12), RGB(50, 50, 55), hull);
					barrel.CanQuery = false;
				}
			}

			if (rng.NextNumber() < 0.7) {
				const lz = z - L * 0.15;
				const launcher = block(V3(16, 3, 24), V3(x, 27.5, lz), RGB(45, 45, 50), s1);
				launcher.CanQuery = false;
				for (let k = 0; k <= 2; k++) {
					const cell = block(V3(14, 0.4, 2), V3(x, 29.1, lz - 8 + k * 8), RGB(255, 40, 40), s1);
					cell.Material = "Neon";
					cell.CanQuery = false;
				}
				Missiles.addTurret(launcher);
			}
			shipRects.set(key, { x0: rx0, x1: rx1, z0: rz0, z1: rz1, parts: folder.GetChildren().slice(before) });
		}
	}

	function asteroids(folder, movers, rng, x0, z0, count, t) {
		for (let i = 0; i < count; i++) {
			const size = rng.NextInteger(10, 38);
			const p = block(
				V3(size, size * rng.NextNumber(0.6, 1.2), size * rng.NextNumber(0.6, 1.2)),
				V3(x0 + rng.NextNumber(0, CHUNK), rng.NextNumber(-10, 60), z0 - rng.NextNumber(0, CHUNK)),
				RGB(rng.NextInteger(70, 110), rng.NextInteger(60, 90), rng.NextInteger(55, 80)),
				folder,
			);
			p.Material = "Slate";
			p.CFrame = CFrame.fromPos(p.Position).mul(Ang(rng.NextNumber(0, 6), rng.NextNumber(0, 6), rng.NextNumber(0, 6)));
			p.SetAttribute("Break", true);
			p.SetAttribute("HP", 3);
			if (rng.NextNumber() < 0.3) {
				movers.push({ part: p, base: p.Position, a: Vector3.xAxis.mul(rng.NextNumber(20, 60)), f: (0.4 + t * 0.05) * rng.NextNumber(0.7, 1.3), ph: rng.NextNumber(0, 6.28) });
			}
		}
	}

	function glassTowers(folder, rng, x0, z0, count) {
		for (let i = 0; i < count; i++) {
			const w = rng.NextInteger(16, 26);
			const h = rng.NextInteger(90, 115);
			let x = null, z = 0;
			for (let k = 0; k < 5; k++) {
				x = x0 + rng.NextNumber(w / 2, CHUNK - w / 2);
				z = z0 - rng.NextNumber(w / 2, CHUNK - w / 2);
				if (!behindGlass(x, z, w / 2, w / 2, true)) break;
				x = null;
			}
			if (x === null) continue;
			const t = block(V3(w, h, w), V3(x, h / 2, z), RGB(120, 220, 255), folder);
			t.Material = "Glass";
			t.Transparency = 0.35;
			t.SetAttribute("Glass", true);
			const cap = block(V3(w + 1, 2, w + 1), V3(x, h + 1, z), RGB(255, 60, 45), folder);
			cap.Material = "Neon";
			cap.CanQuery = false;
			const core = block(V3(w * 0.3, h * 0.85, w * 0.3), V3(x, h * 0.45, z), RGB(255, 50, 35), folder);
			core.Material = "Neon";
			core.Transparency = 0.15;
			core.CanQuery = false;
			core.CastShadow = false;
			t.Name = "Glass";
			cap.Parent = t;
			core.Parent = t;
			smashSpots.push({ part: t, glass: true, x, z, hw: w / 2, hd: w / 2 });
		}
	}

	function makePad(kind, x, z, parent) {
		const m = Instance.new("Model");
		m.SetAttribute("Kind", kind);
		const S = 1.3;
		let main = null;
		function part(size, color, cf, props) {
			const p = Instance.new("Part");
			p.Anchored = true;
			p.CanCollide = false;
			p.CastShadow = false;
			p.Size = size.mul(S);
			p.Color = color;
			p.CFrame = CFrame.fromPos(cf.Position.mul(S)).mul(cf.Rotation);
			if (props) for (const k in props) p[k] = props[k];
			p.Parent = m;
			main = main || p;
			return p;
		}

		if (kind === "fuel") {
			const red = RGB(225, 55, 40), dark = RGB(110, 22, 18), cap = RGB(245, 200, 60);
			part(V3(3.6, 4.6, 1.8), red, CFn());
			for (const zz of [-0.92, 0.92]) {
				for (const a of [0.62, -0.62]) {
					part(V3(0.35, 4.2, 0.1), RGB(255, 70, 50), CFn(0, -0.1, zz).mul(Ang(0, 0, a)), { Material: "Neon" });
				}
			}
			part(V3(2.2, 0.4, 0.6), dark, CFn(0.5, 3.1, 0));
			part(V3(0.4, 0.8, 0.6), dark, CFn(-0.4, 2.7, 0));
			part(V3(0.4, 0.8, 0.6), dark, CFn(1.4, 2.7, 0));
			part(V3(0.9, 1.2, 0.9), cap, CFn(-1.3, 2.7, 0).mul(Ang(0, 0, 0.5)));
		} else if (kind === "gem") {
			const tip = Ang(rad(35.26), 0, rad(45));
			part(Vector3.one.mul(3.6), RGB(80, 200, 255), tip, { Material: "Glass", Transparency: 0.2, Reflectance: 0.15 });
			part(Vector3.one.mul(2), RGB(200, 245, 255), tip, { Material: "Neon", Transparency: 0.1 });
		} else if (kind === "heart") {
			const red = RGB(235, 30, 60), gold = RGB(255, 200, 50);
			for (const sx of [-0.75, 0.75]) part(Vector3.one.mul(2.3), red, CFn(sx, 0.55, 0), { Shape: "Ball", Material: "Neon" });
			part(V3(2.5, 2.5, 1.9), red, CFn(0, -0.45, 0).mul(Ang(0, 0, rad(45))), { Material: "Neon" });
			// a golden rim: the same heart a bit bigger just behind it, plus a ring of gold around it
			for (const sx of [-0.75, 0.75]) part(Vector3.one.mul(2.9), gold, CFn(sx, 0.55, 0.45), { Shape: "Ball", Material: "Neon" });
			part(V3(3.1, 3.1, 1.2), gold, CFn(0, -0.45, 0.6).mul(Ang(0, 0, rad(45))), { Material: "Neon" });
			for (let i = 0; i < 12; i++) {
				const a = (i * Math.PI) / 6;
				part(V3(0.5, 1.5, 0.5), gold, CFn(Math.cos(a) * 3.4, Math.sin(a) * 3.4, 0).mul(Ang(0, 0, a)), { Material: "Neon" });
			}
		} else {
			const gold = RGB(255, 190, 45);
			part(V3(0.7, 3.8, 0.7), gold, CFn(0, -1.3, 0), { Material: "Metal" });
			for (let i = 0; i <= 7; i++) {
				const a = (i * Math.PI) / 4;
				part(V3(0.7, 1.05, 0.7), gold, CFn(Math.cos(a) * 1.25, 1.9 + Math.sin(a) * 1.25, 0).mul(Ang(0, 0, a)), { Material: "Metal" });
			}
			part(V3(1, 0.55, 0.7), gold, CFn(0.75, -2.9, 0), { Material: "Metal" });
			part(V3(0.8, 0.55, 0.7), gold, CFn(0.65, -2, 0), { Material: "Metal" });
		}

		if (!settings.low) {
			const light = Instance.new("PointLight");
			light.Color = PAD[kind][0];
			light.Range = 22;
			light.Brightness = 3;
			light.Parent = main;
			const glow = Instance.new("ParticleEmitter");
			glow.Texture = "smoke";
			glow.Color = new ColorSequence(PAD[kind][0]);
			glow.LightEmission = 1;
			glow.LightInfluence = 0;
			glow.Size = new NumberSequence(7 * S);
			glow.Transparency = new NumberSequence([NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.4, 0.65), NumberSequenceKeypoint.new(1, 1)]);
			glow.Lifetime = new NumberRange(0.8);
			glow.Rate = 6;
			glow.Speed = new NumberRange(0);
			glow.Rotation = new NumberRange(0, 360);
			glow.LockedToPart = true;
			glow.Parent = main;
			if (kind !== "fuel") {
				const sp = Instance.new("ParticleEmitter");
				sp.Texture = "sparkles";
				sp.Color = new ColorSequence(PAD[kind][0]);
				sp.LightEmission = 1;
				sp.Size = new NumberSequence(0.6, 0);
				sp.Lifetime = new NumberRange(0.5, 0.9);
				sp.Rate = 8;
				sp.Speed = new NumberRange(2, 5);
				sp.SpreadAngle = V2(180, 180);
				sp.Parent = main;
			}
		}

		m.WorldPivot = CFn();
		m.PivotTo(CFn(x, ALT, z));
		m.Parent = parent;
		pads.set(m, { x, z, ph: Math.random() * 6 });
	}
	Game.makePad = makePad;

	function rollKind(rng) {
		const r = rng.NextNumber();
		if (r < 0.0018) return "heart";
		if (r < 0.04) return "key";
		if (r < 0.14) return "gem";
		return "fuel";
	}

	function placePad(pick, rng, x0, z0, kind) {
		for (let i = 0; i < 8; i++) {
			const x = x0 + rng.NextNumber(12, CHUNK - 12), z = z0 - rng.NextNumber(20, CHUNK - 20);
			if (workspace.GetPartBoundsInBox(CFn(x, ALT, z), V3(20, 20, 40), params).length === 0) {
				makePad(kind, x, z, pick);
				return;
			}
		}
	}

	updatePads = (y, z) => {
		const t = clock();
		for (const [m, p] of pads) {
			if (!m.Parent) pads.delete(m);
			else if (Math.abs(p.z - z) < 1500) {
				m.PivotTo(CFn(p.x, y + Math.sin(t * 2 + p.ph) * 0.8, p.z).mul(Ang(0, t * 1.8 + p.ph, 0)));
			}
		}
	};

	const key = (cx, cz) => cx + ":" + cz;

	function build(cx, cz) {
		const rng = new Random(seed + cz * 7919 + cx * 104729);
		const folder = Instance.new("Folder");
		const pick = Instance.new("Folder");
		const movers = [];
		const d0 = cz * CHUNK;
		const z0 = -d0;
		const x0 = cx * CHUNK;
		const x1 = x0 + CHUNK;
		const [stage, t] = stageFor(Math.max(d0, 0) + 1);
		const mult = 1;
		const safe = cz < SAFE_ROWS || (Game.safeRow != null && cz >= Game.safeRow && cz < Game.safeRow + SAFE_ROWS);
		const playable = x1 > -SOFT && x0 < SOFT;

		const tile = x0 >= -400 && x1 <= 400 && !settings.low ? 20 : 40;
		const tiles = [];
		if (stage === "city") {
			const slab = block(V3(CHUNK, 2, CHUNK), V3(x0 + CHUNK / 2, 1, z0 - CHUNK / 2), RGB(34, 34, 42), folder);
			slab.SetAttribute("Floor", true);
			slab.CastShadow = false;
		} else if (stage !== "beyond") {
			for (let x = x0; x <= x1 - tile; x += tile) {
				for (let z = 0; z <= CHUNK - tile; z += tile) {
					const tx = x + tile / 2;
					const d = d0 + z + tile / 2;
					let h;
					if (stage === "chill") h = Math.max(1, 3 + 2.5 * Math.sin(tx / 35 + d / 50) + 2.5 * Math.cos(d / 80 - tx / 60));
					else if (stage === "boss" || stage === "boss2") h = rng.NextInteger(1, 2);
					else if (stage === "sea") h = 1.5 + Math.sin(tx / 40 + d / 55) * 0.6 + Math.cos(d / 70 - tx / 90) * 0.5;
					else h = rng.NextInteger(1, 10);
					// floor tiles are merged into one mesh per chunk, they still exist for queries
					const f = Instance.new("Part");
					f._noMesh = true;
					f.Anchored = true;
					f.Size = V3(tile, h, tile);
					f.Position = V3(tx, h / 2, z0 - z - tile / 2);
					f.Color = floorColor(stage, h, tx, d);
					f.SetAttribute("Floor", true);
					f.CastShadow = false;
					f.Parent = folder;
					tiles.push(f);
				}
			}
		}
		if (tiles.length) mergeFloor(folder, tiles);

		if (!safe) {
			if (stage === "towers") towers(folder, rng, x0, z0, amount(rng, (1.5 + t * 4) * mult));
			else if (stage === "moving") {
				towers(folder, rng, x0, z0, amount(rng, (0.4 + t * 0.8) * mult));
				const n = amount(rng, (0.65 + t * 0.9) * mult);
				for (let i = 0; i < n; i++) movingWall(folder, movers, rng, x0, z0, t);
			} else if (stage === "canyon") {
				const rock = RGB(150, 80, 55);
				for (let z = 0; z <= CHUNK - 20; z += 20) {
					const d = d0 + z + 10;
					const c = canyonPath(d);
					const hg = canyonHalfGap(d)[0];
					const tint = rock.Lerp(new Color3(0, 0, 0), rng.NextNumber(0, 0.25));
					const zc = z0 - z - 10;
					const lx1 = Math.min(x1, c - hg);
					if (lx1 - x0 > 1) block(V3(lx1 - x0, 130, 20), V3((x0 + lx1) / 2, 65, zc), tint, folder);
					const rx0 = Math.max(x0, c + hg);
					if (x1 - rx0 > 1) block(V3(x1 - rx0, 130, 20), V3((rx0 + x1) / 2, 65, zc), tint, folder);
				}
				if (rng.NextNumber() < 0.5) {
					const d = d0 + rng.NextNumber(30, CHUNK - 30);
					const x = canyonPath(d);
					if (x >= x0 && x < x1) makePad("fuel", x + rng.NextNumber(-8, 8), -d, pick);
				}
			} else if (stage === "smash") {
				// glass first so the towers know where not to stand
				glassTowers(folder, rng, x0, z0, amount(rng, 0.8 - t * 0.3));
				towers(folder, rng, x0, z0, amount(rng, (1 + t * 2.5) * mult), RGB(35, 35, 45), true);
			} else if (stage === "turrets") {
				towers(folder, rng, x0, z0, amount(rng, (1.2 + t * 1.8) * mult));
				turretTowers(folder, rng, x0, z0, amount(rng, 0.15 + t * 0.2));
			} else if (stage === "city") {
				const far = Math.abs(x0 + CHUNK / 2 - pos.X) > 900;
				cityBlocks(folder, rng, x0, z0, far ? Math.min(1, amount(rng, 0.7)) : amount(rng, (0.6 + t * 0.8) * mult), far);
			} else if (stage === "sea") {
				ships(folder, rng, x0, z0, amount(rng, 0.18 + t * 0.2));
			} else if (stage === "beyond") {
				asteroids(folder, movers, rng, x0, z0, amount(rng, Math.min(1.5 + t / 3, 5) * mult), t);
			}
		}

		folder.Parent = world;
		pick.Parent = pickups;

		let chance = 0.65;
		if (safe || !playable || stage === "boss" || stage === "boss2" || stage === "smash") chance = 0;
		if (rng.NextNumber() < chance) {
			placePad(pick, rng, x0, z0, stage === "intro" ? "fuel" : rollKind(rng));
			if (rng.NextNumber() < 0.25) placePad(pick, rng, x0, z0, stage === "intro" ? "fuel" : rollKind(rng));
		}

		chunks.set(key(cx, cz), { folder, pick, movers });
		maxRow = Math.max(maxRow, cz);
	}

	function updateChunks(x, z) {
		const row = Math.floor(-z / CHUNK);
		const col = Math.floor(x / CHUNK);
		const keep = new Set();
		let view = settings.low ? Math.min(settings.view, 4) : settings.view;
		// cutscenes swing the camera around, so build a lot more around you there
		const cine = !!Game.flow.cine;
		if (cine) view = Math.max(view, 9);
		for (let r = row - (cine ? 3 : 1); r <= row + view; r++) {
			const ahead = Math.max(0, r - row) * CHUNK;
			const half = Math.min((cine ? 1000 : 400) + ahead * (settings.low ? 0.8 : 1.25), SOFT + 400);
			for (let cx = Math.floor((x - half) / CHUNK); cx <= Math.floor((x + half) / CHUNK); cx++) {
				const k = key(cx, r);
				keep.add(k);
				if (!chunks.has(k) && !queued.has(k)) queued.set(k, { key: k, cx, cz: r, prio: Math.abs(r - row) * 2 + Math.abs(cx - col) });
			}
		}
		for (const [k, c] of chunks) {
			if (!keep.has(k)) {
				c.folder.Destroy();
				c.pick.Destroy();
				chunks.delete(k);
			}
		}
		for (const k of [...queued.keys()]) if (!keep.has(k)) queued.delete(k);
	}

	function processQueue(budget) {
		if (queued.size === 0) return;
		const list = [...queued.values()].sort((a, b) => a.prio - b.prio);
		const t0 = clock();
		for (const q of list) {
			if (q.prio > 4 && clock() - t0 > budget) break;
			queued.delete(q.key);
			build(q.cx, q.cz);
		}
	}

	// throws away everything built from this row on, so a stage that starts now isn't stuck behind view distance worth of empty chunks
	Game.cutAhead = (row) => {
		for (const [k, c] of chunks) {
			if (Number(k.split(":")[1]) >= row) {
				c.folder.Destroy();
				c.pick.Destroy();
				chunks.delete(k);
			}
		}
		for (const [k, q] of queued) if (q.cz >= row) queued.delete(k);
		maxRow = Math.min(maxRow, row - 1);
		lastKey = null;
	};
	// where the next stage can start: a few chunks in front of you
	Game.nextStart = () => {
		const row = Math.floor(-pos.Z / CHUNK) + 3;
		Game.cutAhead(row);
		return row * CHUNK;
	};

	trackChunks = (x, z) => {
		const cine = !!Game.flow.cine;
		const k = key(Math.floor(x / CHUNK), Math.floor(-z / CHUNK)) + (cine ? "c" : "");
		if (k !== lastKey) {
			lastKey = k;
			updateChunks(x, z);
		}
		processQueue(cine ? 0.01 : 0.004);
	};

	updateMovers = () => {
		for (const c of chunks.values()) {
			for (const m of c.movers) {
				if (m.part.Parent) {
					let off = m.a.mul(Math.sin(runTime * m.f + m.ph));
					if (m.a2) off = off.add(m.a2.mul(Math.sin(runTime * m.f2 + m.ph)));
					m.part.Position = m.base.add(off);
				}
			}
		}
	};

	Game.buildChunk = (cx, cz) => {
		if (!chunks.has(key(cx, cz))) build(cx, cz);
	};

	regenerate = (x, z) => {
		for (const c of chunks.values()) {
			c.folder.Destroy();
			c.pick.Destroy();
		}
		chunks = new Map();
		queued = new Map();
		world.ClearAllChildren();
		pickups.ClearAllChildren();
		junk.ClearAllChildren();
		// in versus everyone gets the same map, loops included
		if (Game.race) {
			seed = Game.race.seed + (Game.loop || 0) * 7919;
			canyonOffset = (seed * 37) % 1000;
		} else {
			seed = random(1, 1e6);
			canyonOffset = Math.random() * 1000;
		}
		maxRow = -1;
		lastKey = null;
		updateChunks(x || 0, z || 0);
		processQueue(0.05);
	};
})();

// ------------------------------------------------------------------ side walls

const walls = {};
(() => {
	const wallFolder = Instance.new("Folder");
	wallFolder.Name = "Walls";
	wallFolder.Parent = workspace;
	// each wall is a row of segments that get fainter further out, so it fades into the distance instead of ending hard
	for (const side of [-1, 1]) {
		const segs = [];
		for (let i = 0; i < 18; i++) {
			const w = Instance.new("Part");
			w.Anchored = true;
			w.CanCollide = false;
			w.CanQuery = false;
			w.CastShadow = false;
			w.Material = "Neon";
			w.Color = RGB(170, 220, 255);
			w.Size = V3(2, 400, 300);
			w.Transparency = 1;
			w._uniqueMat = true;
			w.SetAttribute("Side", side);
			w.Parent = wallFolder;
			segs.push(w);
		}
		walls[side] = segs;
	}
})();

const BOSS_ARENA = 320;
const bound = () => (boss || Game.boss2.active ? BOSS_ARENA : SOFT);
const center = () => (boss || Game.boss2.active ? Game.arenaX || 0 : 0);

function updateWalls(show) {
	const b = bound();
	for (const side of [-1, 1]) {
		walls[side].forEach((w, i) => {
			if (!show || b >= SOFT) w.Transparency = 1;
			else {
				w.CFrame = CFn(center() + side * b, 190, pos.Z + 150 - (i + 0.5) * 300);
				w.Transparency = 0.8 + 0.2 * (i / 17) ** 0.8;
			}
		});
	}
}

// ------------------------------------------------------------------ effects

function ball(at, size, color, time) {
	const p = Instance.new("Part");
	p.Shape = "Ball";
	p.Anchored = true;
	p.CanCollide = false;
	p.CanQuery = false;
	p.CastShadow = false;
	p.Material = "Neon";
	p.Color = color;
	p.Size = Vector3.one.mul(2);
	p.Position = at;
	p.Parent = junk;
	TweenService.Create(p, new TweenInfo(time, "Quint"), { Size: Vector3.one.mul(size), Transparency: 1 }).Play();
	Debris.AddItem(p, time);
}

function sparks(at, n, size, colorFn, speed) {
	for (let i = 0; i < n; i++) {
		const d = Instance.new("Part");
		d.Size = Vector3.one.mul((size * random(6, 14)) / 10);
		d.Color = colorFn();
		d.Material = "Neon";
		d.CanQuery = false;
		d.Position = at;
		d.Parent = junk;
		d.AssemblyLinearVelocity = V3(random(-speed, speed), random(idiv(speed, 4), speed), random(-speed, speed));
		d.AssemblyAngularVelocity = V3(random(-10, 10), random(-10, 10), random(-10, 10));
		Debris.AddItem(d, 8);
	}
}

function smoke(at, n, spread, size, time, color) {
	for (let i = 0; i < n; i++) {
		const off = V3(random(-spread, spread), random(idiv(-spread, 2), spread), random(-spread, spread));
		ball(at.add(off), random(size, size * 2), color || RGB(50, 50, 50), random(time * 10, time * 18) / 10);
	}
}

// every death effect as a recipe on a few building blocks, the shop preview uses the exact same ones.
// fx.ball(size, color, time)  fx.sparks(n, size, colorFn, speed)  fx.smoke(n, spread, size, time, color)  fx.ring(size, color, time)  fx.later(sec, fn)
const DEATHS = {
	Default: { sfx: "crash", run(fx) {
		fx.ball(70, RGB(255, 240, 180), 0.4);
		fx.ball(50, RGB(255, 120, 30), 0.9);
		fx.smoke(5, 12, 18, 1.5);
		fx.sparks(20, 1, () => (Math.random() < 0.5 ? RGB(255, 140, 40) : RGB(40, 40, 40)), 80);
		return [0.8, 1];
	} },
	Confetti: { sfx: "crash_confetti", run(fx) {
		fx.ball(30, new Color3(1, 1, 1), 0.3);
		fx.sparks(70, 0.8, () => Color3.fromHSV(Math.random(), 0.8, 1), 90);
		return [0.5, 1];
	} },
	Pixel: { sfx: "crash_pixel", run(fx) {
		const cyan = RGB(60, 240, 255), pink = RGB(255, 60, 220);
		fx.ball(45, cyan, 0.5);
		fx.sparks(40, 2, () => (Math.random() < 0.5 ? cyan : pink), 70);
		return [0.6, 1.2];
	} },
	Nuke: { sfx: "crash_nuke", run(fx) {
		fx.ball(200, new Color3(1, 1, 0.9), 0.9);
		fx.ball(130, RGB(255, 120, 30), 1.6);
		fx.smoke(10, 30, 40, 2.5);
		fx.sparks(30, 1.5, () => RGB(255, 160, 50), 120);
		return [1.6, 1.7];
	} },
	Firework: { sfx: "crash_confetti", run(fx) {
		fx.ball(20, new Color3(1, 1, 1), 0.25);
		fx.sparks(40, 0.7, () => Color3.fromHSV(Math.random(), 0.9, 1), 130);
		fx.later(0.35, () => {
			fx.ball(35, Color3.fromHSV(Math.random(), 0.7, 1), 0.4);
			fx.sparks(40, 0.7, () => Color3.fromHSV(Math.random(), 0.9, 1), 110);
		});
		fx.later(0.7, () => fx.sparks(30, 0.6, () => RGB(255, 230, 150), 90));
		return [0.5, 1.3];
	} },
	Freeze: { sfx: "glass", run(fx) {
		fx.ball(40, RGB(200, 240, 255), 0.5);
		fx.ring(60, RGB(160, 225, 255), 0.7);
		fx.sparks(45, 1.6, () => (Math.random() < 0.6 ? RGB(170, 230, 255) : RGB(240, 250, 255)), 70);
		fx.smoke(6, 10, 14, 1.4, RGB(225, 240, 255));
		return [0.5, 1.2];
	} },
	BlackHole: { sfx: "crash_nuke", run(fx) {
		fx.ball(110, RGB(40, 0, 70), 1.4);
		fx.ball(50, RGB(170, 60, 255), 0.8);
		fx.ring(140, RGB(190, 90, 255), 1.2);
		fx.sparks(50, 0.8, () => (Math.random() < 0.5 ? RGB(150, 60, 255) : RGB(20, 0, 30)), 40);
		return [1, 1.6];
	} },
	Lightning: { sfx: "laser_fire", run(fx) {
		fx.ball(90, RGB(255, 255, 210), 0.18);
		fx.ball(40, RGB(120, 190, 255), 0.5);
		fx.sparks(60, 0.45, () => (Math.random() < 0.5 ? RGB(255, 250, 150) : RGB(150, 210, 255)), 160);
		fx.later(0.2, () => fx.ball(70, RGB(255, 255, 230), 0.15));
		return [0.9, 1.1];
	} },
	Coins: { sfx: "coin_land", run(fx) {
		fx.ball(40, RGB(255, 215, 80), 0.4);
		fx.sparks(60, 1.3, () => (Math.random() < 0.8 ? RGB(255, 200, 50) : RGB(255, 245, 180)), 95);
		return [0.5, 1.3];
	} },
	Hearts: { sfx: "crash_confetti", run(fx) {
		fx.ball(35, RGB(255, 150, 190), 0.4);
		fx.sparks(50, 1.1, () => (Math.random() < 0.5 ? RGB(255, 70, 120) : RGB(255, 170, 200)), 75);
		fx.ring(50, RGB(255, 120, 170), 0.6);
		return [0.4, 1.1];
	} },
	Glitch: { sfx: "crash_pixel", run(fx) {
		const cols = [RGB(255, 40, 60), RGB(40, 255, 120), RGB(40, 120, 255)];
		fx.ball(40, RGB(255, 40, 255), 0.15);
		fx.sparks(55, 2.2, () => cols[random(0, 2)], 55);
		fx.later(0.12, () => fx.ball(30, RGB(40, 255, 255), 0.12));
		fx.later(0.25, () => fx.ball(35, RGB(255, 255, 40), 0.12));
		return [0.7, 1.1];
	} },
	Bubbles: { sfx: "crash_confetti", run(fx) {
		fx.smoke(16, 18, 7, 1.8, RGB(150, 215, 255));
		fx.ball(30, RGB(200, 240, 255), 0.4);
		fx.sparks(20, 0.9, () => RGB(220, 245, 255), 50);
		return [0.3, 1.2];
	} },
	SmokeBomb: { sfx: "crash", run(fx) {
		fx.ball(40, RGB(90, 90, 95), 0.3);
		fx.smoke(16, 22, 24, 2.2, RGB(70, 70, 75));
		return [0.6, 1.4];
	} },
	Supernova: { sfx: "crash_nuke", run(fx) {
		fx.ball(260, new Color3(1, 1, 1), 0.7);
		fx.ball(170, RGB(255, 210, 90), 1.4);
		fx.ring(320, RGB(255, 220, 120), 1.3);
		fx.later(0.25, () => fx.ring(220, RGB(255, 255, 255), 1));
		fx.sparks(50, 1.4, () => (Math.random() < 0.5 ? RGB(255, 230, 140) : new Color3(1, 1, 1)), 170);
		return [2, 1.8];
	} },
};
Game.DEATHS = DEATHS;

function ring(at, size, color, time) {
	const p = Instance.new("Part");
	p.Shape = "Cylinder";
	p.Anchored = true;
	p.CanCollide = false;
	p.CanQuery = false;
	p.CastShadow = false;
	p.Material = "Neon";
	p.Color = color;
	p.Size = V3(0.6, 4, 4);
	p.CFrame = CFrame.fromPos(at).mul(Ang(0, 0, Math.PI / 2));
	p.Transparency = 0.2;
	p._uniqueMat = true;
	p.Parent = junk;
	TweenService.Create(p, new TweenInfo(time, "Quint"), { Size: V3(0.3, size, size), Transparency: 1 }).Play();
	Debris.AddItem(p, time);
}

function deathEffect(at) {
	const d = DEATHS[data.death] || DEATHS.Default;
	const fx = {
		ball: (size, color, time) => ball(at, size, color, time),
		sparks: (n, size, colorFn, speed) => sparks(at, n, size, colorFn, speed),
		smoke: (n, spread, size, time, color) => smoke(at, n, spread, size, time, color),
		ring: (size, color, time) => ring(at, size, color, time),
		later: (t, fn) => task.delay(t, fn),
	};
	const [sh, dur] = d.run(fx);
	shake = sh;
	return dur;
}

let shatter;
(() => {
	function cuts(length, min, max) {
		const out = [];
		let at = 0;
		while (at < length) {
			let s = random(Math.ceil(min * 10), Math.floor(max * 10)) / 10;
			if (length - (at + s) < min) s = length - at;
			out.push([at, s]);
			at += s;
		}
		return out;
	}

	shatter = (target, at, mult, big, life) => {
		mult = mult || 1;
		const radius = BLAST_RADIUS * mult, power = BLAST_POWER * mult, core = CORE * mult;
		const size = target.Size;
		const origin = target.Position.sub(size.div(2));
		const base = target.Color;
		const mat = target.Material;
		const trans = target.Transparency;
		target.Destroy();

		const s = big ? 2.2 : 1;
		let count = 0;
		for (const ly of cuts(size.Y, 4 * s, 8 * s)) {
			for (const lx of cuts(size.X, 5 * s, 9 * s)) {
				for (const lz of cuts(size.Z, 5 * s, 9 * s)) {
					const c = origin.add(V3(lx[0] + lx[1] / 2, ly[0] + ly[1] / 2, lz[0] + lz[1] / 2));
					const offset = c.sub(at);
					const dist = offset.Magnitude;
					if (dist > core + random(-3, 3)) {
						const b = Instance.new("Part");
						b.Size = V3(lx[1], ly[1], lz[1]).sub(Vector3.one.mul(0.05));
						b.Position = c;
						b.Color = base.Lerp(new Color3(0, 0, 0), Math.random() * 0.35);
						b.Transparency = trans;
						b.Material = mat;
						b.CanQuery = false;
						b.Parent = junk;
						// bricks settle and vanish after a while, roblox streams them out the same way
						Debris.AddItem(b, life ? life + Math.random() : 25 + Math.random() * 5);
						count++;
						const force = Math.max(0, 1 - dist / radius) * power * (0.6 + Math.random() * 0.8);
						if (force > 0) {
							b.AssemblyLinearVelocity = offset.add(V3(0, 4, 0)).Unit.mul(force);
							const spin = force / 8;
							b.AssemblyAngularVelocity = V3((Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin);
						} else {
							b._sleep = true;
						}
					}
				}
			}
		}
	};
})();

// no csg in the browser: tiles near the blast sink and get scorched instead
function crater(at) {
	const ground = V3(at.X, 0, at.Z);
	for (const tile of workspace.GetPartBoundsInRadius(ground, CRATER, params)) {
		if (tile.IsA("Part") && !tile.GetAttribute("Break") && tile.Size.Y <= 12 && !tile.GetAttribute("Crater")) {
			const p = tile.Position;
			const d = Math.hypot(p.X - at.X, p.Z - at.Z);
			const k = clamp(1 - d / (CRATER + 6), 0.15, 1);
			const h = Math.max(0.2, tile.Size.Y * (1 - 0.85 * k));
			tile.SetAttribute("Crater", true);
			tile.Size = V3(tile.Size.X, h, tile.Size.Z);
			tile.Position = V3(p.X, h / 2, p.Z);
			tile.Color = tile.Color.Lerp(RGB(40, 30, 20), 0.4 + 0.3 * k);
		}
	}
}

// ------------------------------------------------------------------ plane skins

let planeModel, planeMain, planeParts;
let buildPlane;
(() => {
	const SKIN_BUILD = {};
	SKIN_BUILD.Default = (add) => {
		const red = RGB(230, 60, 60), white = RGB(240, 240, 240);
		add("Part", V3(2, 2, 8), red, CFn());
		add("Part", V3(12, 0.5, 3), white, CFn(0, 0, -0.5));
		add("Part", V3(5, 0.4, 1.5), white, CFn(0, 0, 3.3));
		add("Part", V3(0.4, 2, 1.5), red, CFn(0, 1.4, 3.3));
	};
	SKIN_BUILD.Jet = (add) => {
		const grey = RGB(150, 155, 165), dark = RGB(60, 65, 75);
		add("Part", V3(1.6, 1.6, 11), grey, CFn());
		add("Part", V3(7, 0.3, 4), dark, CFn(-3.2, 0, 0.5).mul(Ang(0, -0.45, 0)));
		add("Part", V3(7, 0.3, 4), dark, CFn(3.2, 0, 0.5).mul(Ang(0, 0.45, 0)));
		add("Part", V3(0.3, 2.4, 2), dark, CFn(-0.8, 1.3, 4.4).mul(Ang(0, 0, 0.3)));
		add("Part", V3(0.3, 2.4, 2), dark, CFn(0.8, 1.3, 4.4).mul(Ang(0, 0, -0.3)));
		add("Part", V3(1.1, 0.8, 2.6), RGB(80, 200, 255), CFn(0, 0.9, -2), { Transparency: 0.3 });
		add("Part", V3(1.2, 1.2, 0.6), RGB(255, 140, 40), CFn(0, 0, 5.7), { Material: "Neon" });
	};
	SKIN_BUILD.Biplane = (add) => {
		const yellow = RGB(255, 200, 40), brown = RGB(110, 70, 40);
		add("Part", V3(2, 2, 7), yellow, CFn());
		add("Part", V3(13, 0.4, 2.6), yellow, CFn(0, 1.3, -0.8));
		add("Part", V3(13, 0.4, 2.6), yellow, CFn(0, -1.1, -0.8));
		add("Part", V3(0.3, 2.4, 0.3), brown, CFn(-4.5, 0.1, -0.8));
		add("Part", V3(0.3, 2.4, 0.3), brown, CFn(4.5, 0.1, -0.8));
		add("Part", V3(4.5, 0.4, 0.3), brown, CFn(0, 0, -3.7));
		add("Part", V3(4, 0.3, 1.4), yellow, CFn(0, 0, 3));
		add("Part", V3(0.3, 1.8, 1.4), brown, CFn(0, 1.1, 3));
	};
	SKIN_BUILD.Paper = (add) => {
		const white = RGB(245, 245, 240);
		add("Part", V3(0.3, 1.2, 9), white, CFn());
		add("Part", V3(5, 0.15, 8), white, CFn(-2.4, 0.5, 0.3).mul(Ang(0, -0.3, 0.15)));
		add("Part", V3(5, 0.15, 8), white, CFn(2.4, 0.5, 0.3).mul(Ang(0, 0.3, -0.15)));
	};
	SKIN_BUILD.UFO = (add) => {
		add("Part", V3(1.2, 12, 12), RGB(190, 195, 205), Ang(0, 0, Math.PI / 2), { Shape: "Cylinder" });
		add("Part", V3(5, 5, 5), RGB(80, 230, 255), CFn(0, 0.8, 0), { Shape: "Ball", Transparency: 0.3 });
		add("Part", V3(0.3, 13, 13), RGB(80, 255, 120), CFn(0, -0.4, 0).mul(Ang(0, 0, Math.PI / 2)), { Shape: "Cylinder", Material: "Neon" });
	};
	SKIN_BUILD.Rocket = (add) => {
		const white = RGB(240, 240, 240), red = RGB(220, 50, 50);
		add("Part", V3(10, 2.4, 2.4), white, Ang(0, Math.PI / 2, 0), { Shape: "Cylinder" });
		add("Part", V3(2.4, 2.4, 2.4), red, CFn(0, 0, -5), { Shape: "Ball" });
		add("Part", V3(0.3, 2.5, 2), red, CFn(0, 1.8, 4));
		add("Part", V3(0.3, 2.5, 2), red, CFn(0, -1.8, 4));
		add("Part", V3(2.5, 0.3, 2), red, CFn(1.8, 0, 4));
		add("Part", V3(2.5, 0.3, 2), red, CFn(-1.8, 0, 4));
		add("Part", V3(1.5, 1.8, 1.8), RGB(255, 150, 40), CFn(0, 0, 5.6).mul(Ang(0, Math.PI / 2, 0)), { Shape: "Cylinder", Material: "Neon" });
	};
	SKIN_BUILD.TeamJet = (add) => {
		const grey = RGB(150, 160, 170), dark = RGB(70, 75, 85), blue = RGB(40, 120, 255);
		add("Part", V3(1.8, 1.8, 12), grey, CFn());
		add("Part", V3(1.2, 1.2, 3), grey, CFn(0, 0, -7));
		for (const side of [-1, 1]) {
			add("Part", V3(8, 0.3, 5), dark, CFn(side * 4, 0, 1).mul(Ang(0, side * 0.5, 0)));
			add("Part", V3(3.5, 0.25, 2.5), dark, CFn(side * 2.2, 0, 5.5).mul(Ang(0, side * 0.4, 0)));
			add("Part", V3(0.3, 2.6, 2.4), dark, CFn(side * 0.9, 1.4, 5).mul(Ang(0, 0, -side * 0.25)));
			add("Part", V3(0.2, 0.3, 10), blue, CFn(side * 0.95, 0.3, 0), { Material: "Neon" });
		}
		add("Part", V3(1.1, 0.8, 3), RGB(90, 200, 255), CFn(0, 1, -3), { Transparency: 0.3 });
		add("Part", V3(1.3, 1.3, 0.6), RGB(255, 140, 40), CFn(0, 0, 6.3), { Material: "Neon" });
	};
	SKIN_BUILD.Stealth = (add) => {
		const black = RGB(25, 25, 30), edge = RGB(170, 80, 255);
		add("Part", V3(2.4, 1.2, 10), black, CFn());
		for (const side of [-1, 1]) {
			add("Part", V3(9, 0.4, 7), black, CFn(side * 4.2, 0, 1.5).mul(Ang(0, side * 0.6, 0)));
			add("Part", V3(0.2, 0.2, 9), edge, CFn(side * 4.6, 0.25, -1).mul(Ang(0, side * 0.6, 0)), { Material: "Neon" });
			add("Part", V3(0.3, 2, 2), black, CFn(side * 1.2, 1, 4).mul(Ang(0, 0, -side * 0.5)));
		}
		add("Part", V3(1, 0.6, 2.4), edge, CFn(0, 0.8, -2.5), { Material: "Neon", Transparency: 0.2 });
		add("Part", V3(2, 0.6, 0.4), edge, CFn(0, 0, 5.2), { Material: "Neon" });
	};

	SKIN_BUILD.Glider = (add) => {
		const white = RGB(235, 238, 245), blue = RGB(60, 120, 220);
		add("Part", V3(1, 1, 8), white, CFn());
		add("Part", V3(16, 0.25, 1.8), white, CFn(0, 0.3, -0.3));
		add("Part", V3(0.2, 0.3, 1.8), blue, CFn(-8, 0.3, -0.3), { Material: "Neon" });
		add("Part", V3(0.2, 0.3, 1.8), blue, CFn(8, 0.3, -0.3), { Material: "Neon" });
		add("Part", V3(3.5, 0.2, 1), white, CFn(0, 0.2, 3.6));
		add("Part", V3(0.2, 1.6, 1), blue, CFn(0, 1, 3.6));
	};
	SKIN_BUILD.Banana = (add) => {
		const y = RGB(255, 220, 60), brown = RGB(110, 80, 40);
		add("Part", V3(1.8, 1.8, 3.4), y, CFn(0, 0, 0));
		add("Part", V3(1.6, 1.6, 3), y, CFn(0, 0.5, -2.8).mul(Ang(-0.35, 0, 0)));
		add("Part", V3(1.6, 1.6, 3), y, CFn(0, 0.5, 2.8).mul(Ang(0.35, 0, 0)));
		add("Part", V3(0.6, 0.6, 0.8), brown, CFn(0, 1.2, -4.5).mul(Ang(-0.6, 0, 0)));
		add("Part", V3(0.6, 0.6, 0.6), brown, CFn(0, 1, 4.3));
		add("Part", V3(9, 0.3, 2), RGB(120, 200, 80), CFn(0, 0, 0));
	};
	SKIN_BUILD.Duck = (add) => {
		const y = RGB(255, 215, 40), o = RGB(255, 130, 30);
		add("Part", V3(3, 2.6, 5), y, CFn(0, 0, 0.5));
		add("Part", V3(2.4, 2.4, 2.4), y, CFn(0, 1.8, -2), { Shape: "Ball" });
		add("Part", V3(1.4, 0.5, 1.2), o, CFn(0, 1.6, -3.4));
		add("Part", V3(0.4, 0.4, 0.4), RGB(20, 20, 20), CFn(-0.7, 2.2, -2.9), { Shape: "Ball" });
		add("Part", V3(0.4, 0.4, 0.4), RGB(20, 20, 20), CFn(0.7, 2.2, -2.9), { Shape: "Ball" });
		add("Part", V3(9, 0.4, 2.4), y, CFn(0, 0.2, 0.6));
		add("Part", V3(1.4, 1.2, 1.2), y, CFn(0, 1, 3.3).mul(Ang(0.5, 0, 0)));
	};
	SKIN_BUILD.Toaster = (add) => {
		const metal = RGB(190, 195, 205), toast = RGB(210, 150, 80), dark = RGB(60, 60, 70);
		add("Part", V3(4, 3, 5), metal, CFn(), { Material: "Metal" });
		add("Part", V3(0.9, 1.4, 3.4), toast, CFn(-0.9, 2, 0));
		add("Part", V3(0.9, 1.4, 3.4), toast, CFn(0.9, 2.2, 0));
		add("Part", V3(0.3, 0.8, 0.5), dark, CFn(2.1, 0.8, 1.6));
		add("Part", V3(10, 0.3, 2.2), RGB(240, 240, 245), CFn(0, 0.3, 0.2));
		add("Part", V3(3.6, 0.25, 1.2), RGB(240, 240, 245), CFn(0, 0.2, 3));
	};
	SKIN_BUILD.Chopper = (add) => {
		const green = RGB(80, 110, 70), dark = RGB(40, 45, 45);
		add("Part", V3(2.8, 2.6, 5), green, CFn(0, 0, -0.5));
		add("Part", V3(2.2, 1.6, 1.6), RGB(90, 200, 255), CFn(0, 0.2, -3.2), { Transparency: 0.3 });
		add("Part", V3(0.8, 0.8, 5), green, CFn(0, 0.5, 4));
		add("Part", V3(0.2, 2, 1.2), green, CFn(0, 1.2, 6.2));
		add("Part", V3(0.4, 0.8, 0.4), dark, CFn(0, 1.7, -0.5));
		add("Part", V3(13, 0.12, 0.6), dark, CFn(0, 2.1, -0.5).mul(Ang(0, 0.4, 0)));
		add("Part", V3(13, 0.12, 0.6), dark, CFn(0, 2.1, -0.5).mul(Ang(0, 0.4 + Math.PI / 2, 0)));
		add("Part", V3(0.2, 0.3, 4), dark, CFn(-1.2, -1.6, -0.5));
		add("Part", V3(0.2, 0.3, 4), dark, CFn(1.2, -1.6, -0.5));
	};
	SKIN_BUILD.Blimp = (add) => {
		const silver = RGB(210, 212, 220), red = RGB(220, 60, 60);
		add("Part", V3(9, 4, 4), silver, Ang(0, Math.PI / 2, 0), { Shape: "Cylinder" });
		add("Part", V3(4, 4, 4), silver, CFn(0, 0, -4.5), { Shape: "Ball" });
		add("Part", V3(4, 4, 4), silver, CFn(0, 0, 4.5), { Shape: "Ball" });
		add("Part", V3(0.2, 4.1, 1.2), red, CFn(0, 0, -1), { Material: "Neon" });
		add("Part", V3(1.4, 1, 2.4), RGB(60, 60, 70), CFn(0, -2.4, 0));
		add("Part", V3(0.3, 2.4, 1.8), red, CFn(0, 2, 5.5));
		add("Part", V3(4, 0.3, 1.8), red, CFn(0, 0, 5.5));
	};
	SKIN_BUILD.Shark = (add) => {
		const grey = RGB(120, 135, 150), white = RGB(230, 235, 240);
		add("Part", V3(2.4, 2.2, 9), grey, CFn());
		add("Part", V3(2, 0.6, 7), white, CFn(0, -1, 0));
		add("Part", V3(0.3, 2.6, 2.2), grey, CFn(0, 2.2, 0).mul(Ang(0.35, 0, 0)));
		add("Part", V3(0.3, 3.2, 1.6), grey, CFn(0, 0.6, 5.2).mul(Ang(0.25, 0, 0)));
		add("Part", V3(8, 0.3, 2.4), grey, CFn(0, -0.4, -0.5).mul(Ang(0, 0, 0)));
		add("Part", V3(1.8, 0.2, 0.4), RGB(250, 250, 250), CFn(0, -0.3, -4.4));
		add("Part", V3(0.35, 0.35, 0.35), RGB(10, 10, 10), CFn(-1, 0.4, -3.6), { Shape: "Ball" });
		add("Part", V3(0.35, 0.35, 0.35), RGB(10, 10, 10), CFn(1, 0.4, -3.6), { Shape: "Ball" });
	};
	SKIN_BUILD.Neon = (add) => {
		const black = RGB(15, 15, 20), cyan = RGB(40, 240, 255);
		add("Part", V3(1.8, 1.4, 9), black, CFn());
		add("Part", V3(11, 0.3, 3), black, CFn(0, 0, 0.5));
		for (const side of [-1, 1]) {
			add("Part", V3(0.25, 0.35, 3), cyan, CFn(side * 5.5, 0, 0.5), { Material: "Neon" });
			add("Part", V3(5.5, 0.35, 0.2), cyan, CFn(side * 2.75, 0, -1), { Material: "Neon" });
			add("Part", V3(0.2, 0.2, 9), cyan, CFn(side * 0.9, 0.7, 0), { Material: "Neon" });
		}
		add("Part", V3(4, 0.25, 1.4), black, CFn(0, 0, 4));
		add("Part", V3(0.25, 1.8, 1.4), cyan, CFn(0, 1, 4), { Material: "Neon" });
	};
	SKIN_BUILD.Dragon = (add) => {
		const green = RGB(60, 160, 80), dark = RGB(30, 90, 45), red = RGB(230, 70, 40);
		add("Part", V3(2.2, 2, 7), green, CFn());
		add("Part", V3(1.8, 1.6, 2.4), green, CFn(0, 0.6, -4.2));
		add("Part", V3(0.6, 0.6, 0.6), RGB(255, 220, 60), CFn(-0.7, 1.2, -5), { Material: "Neon" });
		add("Part", V3(0.6, 0.6, 0.6), RGB(255, 220, 60), CFn(0.7, 1.2, -5), { Material: "Neon" });
		add("Part", V3(0.3, 0.9, 0.3), dark, CFn(-0.6, 1.8, -3.8).mul(Ang(0.5, 0, 0)));
		add("Part", V3(0.3, 0.9, 0.3), dark, CFn(0.6, 1.8, -3.8).mul(Ang(0.5, 0, 0)));
		for (const side of [-1, 1]) {
			add("Part", V3(6, 0.25, 4), dark, CFn(side * 3.8, 0.8, 0).mul(Ang(0, 0, side * 0.25)));
			add("Part", V3(3, 0.2, 2.5), red, CFn(side * 5.8, 1.3, 1.2).mul(Ang(0, side * 0.3, side * 0.25)));
		}
		add("Part", V3(0.9, 0.9, 4), green, CFn(0, 0.2, 5).mul(Ang(0.15, 0, 0)));
		add("Part", V3(1.8, 0.25, 1.4), red, CFn(0, 0.4, 7.2));
		for (let i = 0; i < 4; i++) add("Part", V3(0.25, 0.7, 0.5), red, CFn(0, 1.2, -2 + i * 1.5));
	};
	SKIN_BUILD.Gold = (add) => {
		const gold = RGB(255, 200, 60), shine = RGB(255, 240, 170);
		add("Part", V3(2, 2, 8), gold, CFn(), { Material: "Metal" });
		add("Part", V3(12, 0.5, 3), gold, CFn(0, 0, -0.5), { Material: "Metal" });
		add("Part", V3(5, 0.4, 1.5), gold, CFn(0, 0, 3.3), { Material: "Metal" });
		add("Part", V3(0.4, 2, 1.5), gold, CFn(0, 1.4, 3.3), { Material: "Metal" });
		add("Part", V3(12.2, 0.15, 0.3), shine, CFn(0, 0.3, -1.9), { Material: "Neon" });
		add("Part", V3(1.2, 0.8, 2), RGB(255, 250, 220), CFn(0, 1.1, -2), { Material: "Neon", Transparency: 0.2 });
	};
	// ---------------- the ones you can only get with real money
	SKIN_BUILD.Phoenix = (add) => {
		const red = RGB(200, 40, 20), orange = RGB(255, 120, 20), yellow = RGB(255, 210, 60);
		add("Part", V3(1.6, 1.6, 7), red, CFn());
		add("Part", V3(1.2, 1.2, 2), orange, CFn(0, 0.3, -4.2), { Material: "Neon" });
		add("Part", V3(0.5, 0.35, 1.4), yellow, CFn(0, 0.2, -5.6), { Material: "Neon" });
		for (const side of [-1, 1]) {
			// three layers of feathers per wing, swept back, burning at the tips
			add("Part", V3(5, 0.25, 3), red, CFn(side * 3, 0.2, -0.2).mul(Ang(0, side * 0.35, side * 0.12)));
			add("Part", V3(4.5, 0.2, 2.2), orange, CFn(side * 6.2, 0.7, 1.2).mul(Ang(0, side * 0.6, side * 0.2)), { Material: "Neon" });
			add("Part", V3(3, 0.15, 1.4), yellow, CFn(side * 8.4, 1.1, 2.8).mul(Ang(0, side * 0.85, side * 0.25)), { Material: "Neon" });
			add("Part", V3(0.25, 0.2, 4), orange, CFn(side * 0.7, 0, 5.6).mul(Ang(0, side * 0.25, 0)), { Material: "Neon" });
		}
		add("Part", V3(0.25, 0.2, 5), yellow, CFn(0, 0, 6), { Material: "Neon" });
		add("Part", V3(0.25, 1.4, 1.6), orange, CFn(0, 1.1, -3.4).mul(Ang(-0.5, 0, 0)), { Material: "Neon" });
	};
	SKIN_BUILD.Galaxy = (add) => {
		const deep = RGB(25, 10, 60), purple = RGB(150, 60, 255), pink = RGB(255, 90, 220), cyan = RGB(90, 220, 255);
		add("Part", V3(2, 1.6, 8.5), deep, CFn());
		add("Part", V3(1.3, 1, 2.4), cyan, CFn(0, 0.9, -2), { Material: "Neon", Transparency: 0.3 });
		add("Part", V3(11, 0.3, 3.2), deep, CFn(0, 0, 0.6));
		for (const side of [-1, 1]) {
			add("Part", V3(10.5, 0.1, 0.35), purple, CFn(side * 0.1, 0.2, -0.9).mul(Ang(0, side * 0.04, 0)), { Material: "Neon" });
			add("Part", V3(0.8, 0.8, 0.8), pink, CFn(side * 5.6, 0, 0.6), { Material: "Neon", Shape: "Ball" });
			add("Part", V3(0.3, 2.2, 1.6), deep, CFn(side * 1.3, 1.1, 3.8).mul(Ang(0, 0, -side * 0.35)));
			add("Part", V3(0.12, 2.2, 0.3), pink, CFn(side * 1.3, 1.1, 3.1).mul(Ang(0, 0, -side * 0.35)), { Material: "Neon" });
		}
		// a ring around the whole thing like a little planet
		add("Part", V3(0.2, 9, 9), purple, CFn(0, 0, 0.6).mul(Ang(0, 0, Math.PI / 2)), { Shape: "Cylinder", Material: "Neon", Transparency: 0.75 });
		add("Part", V3(1.4, 1.4, 0.6), cyan, CFn(0, 0, 4.4), { Material: "Neon" });
	};
	SKIN_BUILD.Razor = (add) => {
		const black = RGB(20, 20, 24), steel = RGB(90, 95, 110), magenta = RGB(255, 30, 140), cyan = RGB(40, 230, 255);
		add("Part", V3(1.4, 1.2, 10), black, CFn(), { Material: "Metal" });
		add("Part", V3(0.6, 0.6, 3), steel, CFn(0, 0, -6), { Material: "Metal" });
		add("Part", V3(0.9, 0.5, 2.4), magenta, CFn(0, 0.7, -2.6), { Material: "Neon", Transparency: 0.15 });
		// four blades in an X
		for (const sx of [-1, 1]) {
			for (const sy of [-1, 1]) {
				const cf = CFn(sx * 2.8, sy * 1.1, 1.5).mul(Ang(0, 0, sx * sy * 0.42));
				add("Part", V3(5.6, 0.2, 3.4), steel, cf, { Material: "Metal" });
				add("Part", V3(5.6, 0.22, 0.25), magenta, cf.mul(CFn(0, 0, -1.7)), { Material: "Neon" });
				add("Part", V3(0.8, 0.8, 2.6), black, CFn(sx * 5.6, sy * 2.2, 1.6), { Material: "Metal" });
				add("Part", V3(0.6, 0.6, 0.3), cyan, CFn(sx * 5.6, sy * 2.2, 2.95), { Material: "Neon" });
			}
		}
		add("Part", V3(1, 1, 0.4), cyan, CFn(0, 0, 5.1), { Material: "Neon" });
	};
	SKIN_BUILD.Royal = (add) => {
		const white = RGB(245, 243, 238), gold = RGB(255, 200, 60), velvet = RGB(110, 30, 150), ruby = RGB(230, 30, 60);
		add("Part", V3(2.2, 2, 8.5), white, CFn(), { Material: "SmoothPlastic" });
		add("Part", V3(1.4, 1.4, 1.6), gold, CFn(0, 0, -4.6), { Material: "Metal" });
		add("Part", V3(1.3, 0.8, 2.2), RGB(170, 220, 255), CFn(0, 1.2, -1.8), { Transparency: 0.3 });
		for (const side of [-1, 1]) {
			add("Part", V3(6, 0.4, 3.4), velvet, CFn(side * 3.8, 0, 0));
			add("Part", V3(6.1, 0.45, 0.35), gold, CFn(side * 3.8, 0, -1.7), { Material: "Metal" });
			add("Part", V3(0.5, 0.9, 3.4), gold, CFn(side * 6.9, 0.2, 0), { Material: "Metal" });
			add("Part", V3(0.5, 0.5, 0.5), ruby, CFn(side * 6.9, 0.8, -0.8), { Material: "Neon", Shape: "Ball" });
			add("Part", V3(2.6, 0.3, 1.6), velvet, CFn(side * 1.8, 0, 4));
		}
		add("Part", V3(0.3, 2.4, 1.8), velvet, CFn(0, 1.5, 3.8));
		add("Part", V3(0.35, 0.3, 1.9), gold, CFn(0, 2.7, 3.8), { Material: "Metal" });
		// the crown on the roof
		add("Part", V3(1.6, 0.4, 1.6), gold, CFn(0, 1.8, -0.4), { Material: "Metal" });
		for (const [x, z] of [[-0.6, -1], [0.6, -1], [-0.6, 0.2], [0.6, 0.2], [0, -0.4]]) {
			add("Part", V3(0.3, 0.7, 0.3), gold, CFn(x, 2.3, z + 0.2), { Material: "Metal" });
		}
		add("Part", V3(0.4, 0.4, 0.4), ruby, CFn(0, 2.2, -1.1), { Material: "Neon", Shape: "Ball" });
	};

	// every skin leaves something behind it
	const FX = {
		Default: (fx) => {
			for (const x of [-6, 6]) fx.trail(V3(x, 0, 0), { Lifetime: 0.7, Width: 0.25, Color: new ColorSequence(new Color3(1, 1, 1)), Transparency: new NumberSequence(0.45, 1) });
		},
		Jet: (fx) => {
			fx.flame(V3(0, 0, 6), RGB(255, 225, 150), RGB(255, 90, 30), 1.5);
			fx.trail(V3(0, 0, 6), { Lifetime: 0.35, Width: 1, Color: new ColorSequence(RGB(255, 170, 90), RGB(255, 80, 30)), Transparency: new NumberSequence(0.4, 1), LightEmission: 1 });
		},
		Biplane: (fx) => {
			fx.emit(V3(0, 0, -3.6), { Texture: "smoke", Color: new ColorSequence(RGB(235, 235, 235), RGB(140, 140, 140)), Size: new NumberSequence(1, 3.5), Transparency: new NumberSequence(0.35, 1), Lifetime: new NumberRange(0.6, 1.1), Rate: 16, Speed: new NumberRange(4, 8), EmissionDirection: "Back", SpreadAngle: V2(15, 15), Rotation: new NumberRange(0, 360), RotSpeed: new NumberRange(-60, 60) });
		},
		Paper: (fx) => {
			for (const c of [RGB(255, 120, 180), RGB(110, 210, 255), RGB(255, 225, 90)]) {
				fx.emit(V3(0, 0, 3), { Texture: "sparkles", Color: new ColorSequence(c), LightEmission: 0.6, Size: new NumberSequence(0.7, 0.2), Lifetime: new NumberRange(0.8, 1.3), Rate: 7, Speed: new NumberRange(2, 6), SpreadAngle: V2(180, 180), Acceleration: V3(0, -12, 0), Rotation: new NumberRange(0, 360), RotSpeed: new NumberRange(-200, 200) });
			}
		},
		UFO: (fx) => {
			fx.emit(V3(0, -1, 0), { Texture: "smoke", Color: new ColorSequence(RGB(120, 255, 150), RGB(40, 200, 90)), LightEmission: 1, Size: new NumberSequence(2, 5), Transparency: new NumberSequence(0.55, 1), Lifetime: new NumberRange(0.5, 0.8), Rate: 26, Speed: new NumberRange(14, 22), EmissionDirection: "Bottom", SpreadAngle: V2(8, 8) });
			fx.emit(V3(0, 0, 0), { Texture: "sparkles", Color: new ColorSequence(RGB(150, 255, 170)), LightEmission: 1, Size: new NumberSequence(0.8, 0), Lifetime: new NumberRange(0.4, 0.8), Rate: 14, Speed: new NumberRange(6, 10), SpreadAngle: V2(180, 180) });
		},
		Rocket: (fx) => {
			fx.flame(V3(0, 0, 6.2), RGB(255, 240, 170), RGB(255, 70, 20), 2.4, 110);
			fx.emit(V3(0, 0, 7), { Texture: "smoke", Color: new ColorSequence(RGB(220, 215, 210), RGB(110, 105, 100)), Size: new NumberSequence(1.5, 6), Transparency: new NumberSequence(0.3, 1), Lifetime: new NumberRange(0.9, 1.5), Rate: 30, Speed: new NumberRange(3, 7), EmissionDirection: "Back", SpreadAngle: V2(12, 12), Rotation: new NumberRange(0, 360), RotSpeed: new NumberRange(-80, 80) });
		},
		TeamJet: (fx) => fx.flame(V3(0, 0, 6.8), RGB(170, 220, 255), RGB(40, 110, 255), 1.4),
		Stealth: (fx) => fx.flame(V3(0, 0, 5.6), RGB(230, 190, 255), RGB(150, 60, 255), 1.5),
		Glider: (fx) => {
			for (const x of [-8, 8]) fx.trail(V3(x, 0.3, 0), { Lifetime: 1, Width: 0.2, Color: new ColorSequence(new Color3(1, 1, 1)), Transparency: new NumberSequence(0.4, 1) });
		},
		Banana: (fx) => {
			fx.emit(V3(0, 0, 4), { Texture: "sparkles", Color: new ColorSequence(RGB(255, 230, 90)), LightEmission: 0.7, Size: new NumberSequence(0.7, 0.1), Lifetime: new NumberRange(0.6, 1), Rate: 16, Speed: new NumberRange(2, 5), SpreadAngle: V2(60, 60), EmissionDirection: "Back" });
		},
		Duck: (fx) => {
			fx.emit(V3(0, 0, 3), { Texture: "sparkles", Color: new ColorSequence(RGB(140, 210, 255)), LightEmission: 0.5, Size: new NumberSequence(0.8, 0.2), Lifetime: new NumberRange(0.6, 1.1), Rate: 18, Speed: new NumberRange(3, 7), SpreadAngle: V2(40, 40), EmissionDirection: "Back", Acceleration: V3(0, -10, 0) });
		},
		Toaster: (fx) => {
			fx.emit(V3(0, 2.5, 0), { Texture: "smoke", Color: new ColorSequence(RGB(140, 120, 100), RGB(90, 80, 70)), Size: new NumberSequence(0.8, 2.4), Transparency: new NumberSequence(0.4, 1), Lifetime: new NumberRange(0.6, 1), Rate: 12, Speed: new NumberRange(2, 4), EmissionDirection: "Top", SpreadAngle: V2(20, 20) });
		},
		Chopper: (fx) => {
			fx.emit(V3(0, 0, 3), { Texture: "smoke", Color: new ColorSequence(RGB(200, 200, 200), RGB(120, 120, 120)), Size: new NumberSequence(1, 3), Transparency: new NumberSequence(0.5, 1), Lifetime: new NumberRange(0.5, 0.9), Rate: 14, Speed: new NumberRange(3, 6), EmissionDirection: "Back", SpreadAngle: V2(15, 15) });
		},
		Blimp: (fx) => {
			fx.emit(V3(0, -2.4, 1.4), { Texture: "smoke", Color: new ColorSequence(RGB(240, 240, 240), RGB(170, 170, 170)), Size: new NumberSequence(1.2, 4), Transparency: new NumberSequence(0.5, 1), Lifetime: new NumberRange(1, 1.6), Rate: 8, Speed: new NumberRange(2, 4), EmissionDirection: "Back", SpreadAngle: V2(10, 10) });
		},
		Shark: (fx) => {
			fx.emit(V3(0, 0, 5), { Texture: "sparkles", Color: new ColorSequence(RGB(120, 200, 255)), LightEmission: 0.6, Size: new NumberSequence(0.9, 0.1), Lifetime: new NumberRange(0.5, 0.9), Rate: 20, Speed: new NumberRange(3, 8), SpreadAngle: V2(30, 30), EmissionDirection: "Back" });
		},
		Neon: (fx) => {
			for (const x of [-5.5, 5.5]) fx.trail(V3(x, 0, 0.5), { Lifetime: 0.6, Width: 0.35, Color: new ColorSequence(RGB(40, 240, 255)), Transparency: new NumberSequence(0.1, 1), LightEmission: 1 });
		},
		Dragon: (fx) => {
			fx.flame(V3(0, 0.4, -5.6), RGB(255, 240, 150), RGB(255, 80, 20), 1.6, 60);
			fx.emit(V3(0, 0, 6), { Texture: "sparkles", Color: new ColorSequence(RGB(255, 140, 40)), LightEmission: 1, Size: new NumberSequence(0.6, 0), Lifetime: new NumberRange(0.5, 0.9), Rate: 18, Speed: new NumberRange(3, 7), SpreadAngle: V2(40, 40), EmissionDirection: "Back" });
		},
		Phoenix: (fx) => {
			fx.flame(V3(0, 0, 4), RGB(255, 240, 150), RGB(255, 60, 10), 2.2, 110);
			for (const x of [-8.4, 8.4]) fx.flame(V3(x, 1.1, 2.8), RGB(255, 230, 120), RGB(255, 80, 20), 0.9, 40);
			fx.trail(V3(0, 0, 4), { Lifetime: 0.6, Width: 2.2, Color: new ColorSequence(RGB(255, 200, 60), RGB(255, 40, 10)), Transparency: new NumberSequence(0.2, 1), LightEmission: 1 });
			fx.emit(V3(0, 0, 3), { Texture: "sparkles", Color: new ColorSequence(RGB(255, 170, 40), RGB(255, 60, 20)), LightEmission: 1, Size: new NumberSequence(0.8, 0), Lifetime: new NumberRange(0.6, 1.2), Rate: 30, Speed: new NumberRange(3, 9), SpreadAngle: V2(50, 50), EmissionDirection: "Back" });
		},
		Galaxy: (fx) => {
			fx.trail(V3(0, 0, 4.4), { Lifetime: 1, Width: 1.6, Color: new ColorSequence(RGB(90, 220, 255), RGB(200, 60, 255)), Transparency: new NumberSequence(0.15, 1), LightEmission: 1 });
			for (const x of [-5.6, 5.6]) fx.trail(V3(x, 0, 0.6), { Lifetime: 0.8, Width: 0.3, Color: new ColorSequence(RGB(255, 90, 220)), Transparency: new NumberSequence(0.2, 1), LightEmission: 1 });
			fx.emit(V3(0, 0, 2), { Texture: "sparkles", Color: new ColorSequence(RGB(255, 255, 255), RGB(160, 120, 255)), LightEmission: 1, Size: new NumberSequence(0.5, 0), Lifetime: new NumberRange(1, 1.8), Rate: 40, Speed: new NumberRange(1, 4), SpreadAngle: V2(180, 180) });
		},
		Razor: (fx) => {
			for (const sx of [-1, 1]) for (const sy of [-1, 1]) fx.trail(V3(sx * 5.6, sy * 2.2, 2.9), { Lifetime: 0.45, Width: 0.5, Color: new ColorSequence(RGB(40, 230, 255), RGB(255, 30, 140)), Transparency: new NumberSequence(0.1, 1), LightEmission: 1 });
			fx.flame(V3(0, 0, 5.3), RGB(200, 250, 255), RGB(40, 200, 255), 1.2, 80);
		},
		Royal: (fx) => {
			fx.trail(V3(0, 0, 4.3), { Lifetime: 0.9, Width: 1.4, Color: new ColorSequence(RGB(160, 60, 220), RGB(90, 20, 130)), Transparency: new NumberSequence(0.25, 1), LightEmission: 0.6 });
			for (const x of [-6.9, 6.9]) fx.trail(V3(x, 0.2, 0), { Lifetime: 0.8, Width: 0.35, Color: new ColorSequence(RGB(255, 215, 90)), Transparency: new NumberSequence(0.15, 1), LightEmission: 1 });
			fx.emit(V3(0, 1, 2), { Texture: "sparkles", Color: new ColorSequence(RGB(255, 230, 120)), LightEmission: 1, Size: new NumberSequence(0.7, 0), Lifetime: new NumberRange(0.6, 1.2), Rate: 24, Speed: new NumberRange(2, 5), SpreadAngle: V2(70, 70) });
		},
		Gold: (fx) => {
			for (const x of [-6, 6]) fx.trail(V3(x, 0, 0), { Lifetime: 0.8, Width: 0.35, Color: new ColorSequence(RGB(255, 220, 90)), Transparency: new NumberSequence(0.2, 1), LightEmission: 1 });
			fx.emit(V3(0, 0, 3), { Texture: "sparkles", Color: new ColorSequence(RGB(255, 230, 120)), LightEmission: 1, Size: new NumberSequence(0.6, 0), Lifetime: new NumberRange(0.5, 1), Rate: 16, Speed: new NumberRange(2, 5), SpreadAngle: V2(60, 60) });
		},
	};
	function addFx(id, main) {
		const f = FX[id];
		if (!f || settings.low) return;
		const fx = {
			emit(at, props) {
				const a = Instance.new("Attachment");
				a.Position = at;
				a.Parent = main;
				const e = Instance.new("ParticleEmitter");
				for (const k in props) e[k] = props[k];
				e.Parent = a;
				return e;
			},
			flame(at, c0, c1, size, rate) {
				return fx.emit(at, { Texture: "fire", Color: new ColorSequence(c0, c1), LightEmission: 1, Size: new NumberSequence(size, 0), Lifetime: new NumberRange(0.12, 0.24), Rate: rate || 70, Speed: new NumberRange(8, 16), EmissionDirection: "Back", SpreadAngle: V2(8, 8) });
			},
			trail(at, props) {
				const t = Instance.new("Trail");
				t.Offset = at;
				for (const k in props) t[k] = props[k];
				t.Parent = main;
				return t;
			},
		};
		f(fx);
	}
	Game.skinFx = addFx;

	buildPlane = (id) => {
		if (planeModel) planeModel.Destroy();
		[planeModel, planeMain, planeParts] = Game.makePlane(id);
		Game.planeSkin = id;
	};

	Game.makePlane = (id, parent, noFx) => {
		const model = Instance.new("Model");
		const main = Instance.new("Part");
		main.Size = Vector3.one;
		main.Transparency = 1;
		main.Anchored = true;
		main.CanCollide = false;
		main.CanQuery = false;
		main.CanTouch = false;
		main.CFrame = CFn();
		main.Parent = model;
		const parts = [];
		function add(cls, size, color, cf, extra) {
			const p = Instance.new(cls);
			p.Anchored = true;
			if (extra) for (const k in extra) p[k] = extra[k];
			p.Size = size;
			p.Color = color;
			p.CFrame = cf;
			p.CanCollide = false;
			p.CanQuery = false;
			p.CanTouch = false;
			p.Massless = true;
			p._uniqueMat = true;
			const w = Instance.new("WeldConstraint");
			w.Part0 = main;
			w.Part1 = p;
			w.Parent = p;
			p.Parent = model;
			parts.push(p);
		}
		(SKIN_BUILD[id] || SKIN_BUILD.Default)(add);
		if (!noFx) addFx(SKIN_BUILD[id] ? id : "Default", main);
		const LIGHT = { Phoenix: RGB(255, 120, 30), Galaxy: RGB(160, 80, 255), Razor: RGB(255, 40, 150) };
		if (LIGHT[id]) {
			const glow = Instance.new("PointLight");
			glow.Range = 18;
			glow.Brightness = 1.6;
			glow.Color = LIGHT[id];
			glow.Parent = main;
		}
		if (id === "Stealth") {
			const glow = Instance.new("PointLight");
			glow.Range = 16;
			glow.Brightness = 1.5;
			glow.Color = RGB(170, 80, 255);
			glow.Parent = main;
		}
		model.PrimaryPart = main;
		model.Parent = parent || workspace;
		return [model, main, parts];
	};
})();

function wreck(vel) {
	for (const d of planeModel.GetDescendants()) if (d.ClassName === "ParticleEmitter" || d.ClassName === "Trail") d.Enabled = false;
	for (const p of planeParts) {
		for (const w of p.GetChildren()) if (w.IsA("WeldConstraint")) w.Destroy();
	}
	for (const p of planeParts) {
		p.Anchored = false;
		p.CanCollide = true;
		p.Massless = false;
		p.LocalTransparencyModifier = 0;
		p._sleep = false;
		p.AssemblyLinearVelocity = V3(vel + random(-30, 30), random(30, 60), 40);
		p.AssemblyAngularVelocity = V3(random(-20, 20), random(-20, 20), random(-20, 20));
	}
	planeModel.Parent = junk;
}

// ------------------------------------------------------------------ ui helpers

const FONT = "Highway";
const BLACK = new Color3(0, 0, 0);
const WHITE = new Color3(1, 1, 1);
const DIM = RGB(150, 150, 150);
const GOOD = RGB(110, 255, 150);
const BAD = RGB(255, 95, 95);
const COIN = RGB(255, 205, 60);
const GEM = RGB(90, 220, 255);
const KEY = RGB(255, 140, 220);
const T = { panel: 0.12, row: 0.5, btn: 0.45, pill: 0.35, hud: 0.5 };
const LEFT = "left";
const RIGHT = "right";

function make(cls, props) {
	const o = Instance.new(cls);
	const parent = props.Parent;
	o._batch = true;
	for (const k in props) if (k !== "Parent") o[k] = props[k];
	o._batch = false;
	if (o._isGui) {
		o.BorderSizePixel = 0;
		if (o._apply) o._apply();
	}
	o.Parent = parent;
	return o;
}

function tw(o, t, props, style, dir) {
	const x = TweenService.Create(o, new TweenInfo(t, style || "Quint", dir || "Out"), props);
	x.Play();
	return x;
}
const tweenDone = (x) => new Promise((res) => x.Completed.Connect(res));

function text(parent, str, size, position, ts, color, align) {
	return make("TextLabel", {
		BackgroundTransparency: 1,
		Size: size,
		Position: position || new UDim2(),
		Font: FONT,
		Text: str,
		TextSize: ts || 20,
		TextColor3: color || WHITE,
		TextXAlignment: align || "center",
		TextWrapped: true,
		Parent: parent,
	});
}

function button(parent, str, size, position, fn, base) {
	base = base === undefined || base === null ? T.btn : base;
	const b = make("TextButton", {
		Size: size,
		Position: position || new UDim2(),
		BackgroundColor3: BLACK,
		BackgroundTransparency: base,
		AutoButtonColor: false,
		Font: FONT,
		Text: str,
		TextSize: 22,
		TextColor3: WHITE,
		Parent: parent,
	});
	b.SetAttribute("Base", base);
	const sc = make("UIScale", { Parent: b });
	b.MouseEnter.Connect(() => {
		sfx("hover");
		tw(b, 0.18, { BackgroundTransparency: Math.max(0, b.GetAttribute("Base") - 0.3) });
		tw(sc, 0.18, { Scale: 1.04 });
	});
	b.MouseLeave.Connect(() => {
		tw(b, 0.25, { BackgroundTransparency: b.GetAttribute("Base") });
		tw(sc, 0.25, { Scale: 1 });
	});
	b.MouseButton1Down.Connect(() => tw(sc, 0.08, { Scale: 0.95 }));
	b.MouseButton1Up.Connect(() => tw(sc, 0.3, { Scale: 1.04 }, "Back"));
	b.MouseButton1Click.Connect(() => {
		sfx("click");
		return fn(b);
	});
	return b;
}

let nextOrder;
(() => {
	let order = 0;
	nextOrder = () => ++order;
})();

function row(parent, h, trans) {
	return make("Frame", {
		Size: U2(1, -10, 0, h),
		BackgroundColor3: BLACK,
		BackgroundTransparency: trans === undefined ? T.row : trans,
		LayoutOrder: nextOrder(),
		Parent: parent,
	});
}

// ------------------------------------------------------------------ icons

const Icons = {};
(() => {
	const GLYPH = { "●": "coin", "◆": "gem", "✦": "key" };
	const SHADE = new ColorSequence(new Color3(1, 1, 1), RGB(160, 160, 160));
	const DRAW = {};

	DRAW.coin = (put, s) => {
		const dark = RGB(200, 125, 15);
		put(0.5, 0.5, 1, 1, dark, { round: true });
		put(0.5, 0.5, 0.8, 0.8, RGB(255, 210, 70), { round: true, grad: SHADE });
		put(0.5, 0.5, 0.4, 0.4, dark, { round: true, stroke: Math.max(1, s * 0.07) });
		put(0.34, 0.3, 0.22, 0.09, WHITE, { round: true, rot: -40, alpha: 0.3 });
	};
	DRAW.gem = (put, s) => {
		put(0.5, 0.5, 0.7, 0.7, RGB(30, 100, 220), { rot: 45 });
		put(0.5, 0.5, 0.58, 0.58, WHITE, { rot: 45, grad: new ColorSequence(RGB(220, 252, 255), RGB(50, 150, 255)), gradRot: 45 });
		put(0.5, 0.5, 0.24, 0.24, WHITE, { rot: 45, alpha: 0.55 });
		put(0.39, 0.36, 0.16, 0.06, WHITE, { rot: -45, round: true, alpha: 0.1 });
	};
	DRAW.key = (put, s) => {
		const c = RGB(255, 140, 220);
		const inner = put(0.5, 0.5, 1, 1, c, { alpha: 1, rot: 0 });
		put(0.27, 0.5, 0.3, 0.3, c, { round: true, stroke: Math.max(1, s * 0.1), parent: inner });
		put(0.68, 0.5, 0.5, 0.13, c, { parent: inner, grad: SHADE });
		put(0.8, 0.62, 0.08, 0.2, c, { parent: inner });
		put(0.9, 0.64, 0.08, 0.26, c, { parent: inner });
	};
	DRAW.play = (put, s) => {
		const d = put(0.27, 0.5, 0.66, 0.66, WHITE, { rot: 45 });
		make("UIGradient", {
			Rotation: -45,
			Transparency: new NumberSequence([NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.5, 1), NumberSequenceKeypoint.new(0.505, 0), NumberSequenceKeypoint.new(1, 0)]),
			Parent: d,
		});
	};
	DRAW.gear = (put, s) => {
		for (let i = 0; i <= 7; i++) {
			const a = (i * Math.PI) / 4;
			put(0.5 + Math.cos(a) * 0.38, 0.5 + Math.sin(a) * 0.38, 0.2, 0.2, WHITE, { rot: deg(a), round: 0.2 });
		}
		put(0.5, 0.5, 0.48, 0.48, WHITE, { round: true, stroke: Math.max(1, s * 0.14) });
	};
	DRAW.skull = (put, s) => {
		const bone = RGB(235, 235, 225);
		const dark = RGB(25, 25, 30);
		put(0.5, 0.42, 0.8, 0.7, bone, { round: true });
		put(0.5, 0.76, 0.5, 0.3, bone, { round: 0.25 });
		put(0.33, 0.45, 0.22, 0.24, dark, { round: true });
		put(0.67, 0.45, 0.22, 0.24, dark, { round: true });
		put(0.5, 0.63, 0.1, 0.1, dark, { rot: 45 });
		for (const x of [0.4, 0.5, 0.6]) put(x, 0.84, 0.05, 0.14, dark);
	};
	DRAW.flag = (put, s) => {
		put(0.2, 0.52, 0.08, 0.92, WHITE, { round: true });
		for (let i = 0; i <= 3; i++) for (let j = 0; j <= 2; j++) put(0.34 + i * 0.15, 0.2 + j * 0.15, 0.15, 0.15, (i + j) % 2 === 0 ? WHITE : RGB(40, 40, 45));
	};
	DRAW.trophy = (put, s) => {
		const gold = RGB(255, 205, 60);
		for (const x of [0.2, 0.8]) put(x, 0.36, 0.22, 0.26, gold, { round: true, stroke: Math.max(1, s * 0.06) });
		put(0.5, 0.36, 0.56, 0.46, WHITE, { round: 0.3, grad: new ColorSequence(RGB(255, 230, 130), RGB(215, 145, 20)) });
		put(0.5, 0.15, 0.64, 0.09, gold);
		put(0.5, 0.7, 0.14, 0.2, RGB(215, 150, 25));
		put(0.5, 0.86, 0.56, 0.12, gold, { round: 0.2 });
		put(0.38, 0.3, 0.07, 0.2, WHITE, { round: true, alpha: 0.45 });
	};
	DRAW.user = (put, s) => {
		put(0.5, 0.3, 0.42, 0.42, WHITE, { round: true });
		put(0.5, 0.8, 0.8, 0.44, WHITE, { round: 0.45 });
	};
	DRAW.help = (put, s) => {
		const f = put(0.5, 0.5, 0.78, 0.78, WHITE, { round: true, stroke: Math.max(1, s * 0.1) });
		make("TextLabel", {
			AnchorPoint: V2(0.5, 0.5),
			Position: US(0.5, 0.52),
			Size: US(0.8, 0.8),
			BackgroundTransparency: 1,
			Font: FONT,
			Text: "?",
			TextSize: Math.floor(s * 0.62),
			TextColor3: WHITE,
			Parent: f,
		});
	};
	DRAW.heart = (put, s) => {
		const c = RGB(255, 80, 110);
		put(0.5, 0.537, 0.5, 0.5, c, { rot: 45 });
		put(0.323, 0.36, 0.5, 0.5, c, { round: true });
		put(0.677, 0.36, 0.5, 0.5, c, { round: true });
		put(0.3, 0.3, 0.14, 0.08, WHITE, { round: true, rot: -40, alpha: 0.3 });
	};
	DRAW.fuel = (put, s) => {
		const c = RGB(255, 70, 55), dark = RGB(150, 25, 20);
		put(0.62, 0.14, 0.2, 0.16, RGB(70, 70, 75), { round: 0.2 });
		put(0.36, 0.2, 0.3, 0.14, c, { round: true, stroke: Math.max(1, s * 0.07) });
		put(0.5, 0.6, 0.72, 0.72, c, { round: 0.14, grad: SHADE });
		put(0.5, 0.6, 0.5, 0.06, dark, { rot: 45, alpha: 0.35 });
		put(0.5, 0.6, 0.5, 0.06, dark, { rot: -45, alpha: 0.35 });
		put(0.3, 0.36, 0.14, 0.07, WHITE, { round: true, alpha: 0.35 });
	};
	DRAW.gift = (put, s) => {
		const box = RGB(255, 95, 95), rib = RGB(255, 205, 60);
		put(0.37, 0.2, 0.24, 0.2, rib, { round: true, rot: -30 });
		put(0.63, 0.2, 0.24, 0.2, rib, { round: true, rot: 30 });
		put(0.5, 0.66, 0.76, 0.52, box, { grad: SHADE });
		put(0.5, 0.36, 0.9, 0.2, RGB(255, 125, 125));
		put(0.5, 0.6, 0.16, 0.66, rib);
	};
	DRAW.bag = (put, s) => {
		put(0.5, 0.36, 0.36, 0.4, WHITE, { round: true, stroke: Math.max(1, s * 0.07) });
		put(0.5, 0.64, 0.74, 0.56, WHITE, { round: 0.12, grad: SHADE });
		put(0.5, 0.56, 0.2, 0.06, RGB(60, 60, 60), { round: true, alpha: 0.4 });
	};

	Icons.make = (kind, parent, s, canvas) => {
		const root = make(canvas ? "CanvasGroup" : "Frame", { Size: UO(s, s), BackgroundTransparency: 1, Parent: parent });
		let z = 0;
		function put(x, y, w, h, color, o) {
			o = o || {};
			z++;
			const f = make("Frame", {
				AnchorPoint: V2(0.5, 0.5),
				Position: US(x, y),
				Size: US(w, h),
				BackgroundColor3: color,
				BackgroundTransparency: o.alpha || 0,
				Rotation: o.rot || 0,
				ZIndex: z,
				Parent: o.parent || root,
			});
			if (o.round) make("UICorner", { CornerRadius: UDim.new(o.round === true ? 0.5 : o.round, 0), Parent: f });
			if (o.stroke) {
				f.BackgroundTransparency = 1;
				make("UIStroke", { Thickness: o.stroke, Color: color, Parent: f });
			}
			if (o.grad) make("UIGradient", { Color: o.grad, Rotation: o.gradRot === undefined ? 90 : o.gradRot, Parent: f });
			return f;
		}
		DRAW[kind](put, s, root);
		return root;
	};

	// a label that draws ● ◆ ✦ as real icons. set .Text like a normal label
	Icons.text = (parent, size, position, ts, color, align) => {
		const holder = make("Frame", { BackgroundTransparency: 1, Size: size, Position: position || new UDim2(), Parent: parent });
		make("UIListLayout", {
			FillDirection: "row",
			HorizontalAlignment: align === LEFT ? "flex-start" : align === RIGHT ? "flex-end" : "center",
			VerticalAlignment: "center",
			SortOrder: "LayoutOrder",
			Padding: UDim.new(0, Math.floor(ts * 0.15)),
			Parent: holder,
		});
		const st = { text: "", color: color || WHITE, stroke: 1, sig: "", labels: {} };

		function render(str) {
			const segs = [];
			let buf = [];
			function flush() {
				const raw = buf.join("");
				buf = [];
				if (/^\s\s/.test(raw) && segs.length > 0) segs.push("gap");
				const t = raw.trim();
				if (t !== "") segs.push(t);
				if (/\S\s\s+$/.test(raw)) segs.push("gap");
			}
			for (const ch of String(str)) {
				if (GLYPH[ch]) {
					flush();
					segs.push([GLYPH[ch]]);
				} else buf.push(ch);
			}
			flush();
			const sig = segs.map((sg) => (Array.isArray(sg) ? sg[0] : sg === "gap" ? "gap" : "t")).join(",");
			if (sig !== st.sig) {
				st.sig = sig;
				for (const c of holder.GetChildren()) if (!c.IsA("UIListLayout")) c.Destroy();
				st.labels = {};
				segs.forEach((sg, i) => {
					if (Array.isArray(sg)) Icons.make(sg[0], holder, Math.floor(ts * 0.9)).LayoutOrder = i + 1;
					else if (sg === "gap") make("Frame", { Size: UO(Math.floor(ts * 0.5), 1), BackgroundTransparency: 1, LayoutOrder: i + 1, Parent: holder });
					else {
						st.labels[i] = make("TextLabel", {
							AutomaticSize: "X",
							Size: U2(0, 0, 1, 0),
							BackgroundTransparency: 1,
							Font: FONT,
							TextSize: ts,
							TextColor3: st.color,
							TextStrokeTransparency: st.stroke,
							LayoutOrder: i + 1,
							Parent: holder,
						});
					}
				});
			}
			for (const i in st.labels) st.labels[i].Text = segs[i];
		}

		return new Proxy({}, {
			get(_, k) {
				if (k === "Text") return st.text;
				if (k === "TextColor3") return st.color;
				if (k === "_holder") return holder;
				const v = holder[k];
				return typeof v === "function" ? v.bind(holder) : v;
			},
			set(_, k, v) {
				if (k === "Text") {
					if (v !== st.text) {
						st.text = v;
						render(v);
					}
				} else if (k === "TextColor3" || k === "TextStrokeTransparency") {
					if (k === "TextColor3") st.color = v;
					else st.stroke = v;
					for (const i in st.labels) st.labels[i][k] = v;
				} else holder[k] = v;
				return true;
			},
		});
	};
})();

Game.screen = guiRootInst;
const gui = make("Frame", { Name: "Root", Size: US(1, 1), BackgroundTransparency: 1, Parent: Game.screen });
(() => {
	const sc = make("UIScale", { Parent: gui });
	function fit() {
		const s = clamp(camera.ViewportSize.Y / 760, 0.45, 1);
		sc.Scale = s;
		setUiScale(s);
		Game._uis = s;
		gui.Size = US(1 / s, 1 / s);
	}
	camera.GetPropertyChangedSignal("ViewportSize").Connect(fit);
	fit();
})();

let flash, fade;
(() => {
	const flashFrame = make("Frame", { Size: US(1, 1), BackgroundColor3: WHITE, BackgroundTransparency: 1, ZIndex: 50, Parent: gui });
	const blackout = make("Frame", { Size: US(1, 1), BackgroundColor3: BLACK, BackgroundTransparency: 1, ZIndex: 60, Parent: gui });
	flashFrame.el.style.pointerEvents = "none";
	blackout.el.style.pointerEvents = "none";

	flash = () => {
		flashFrame.BackgroundTransparency = 0;
		tw(flashFrame, 0.8, { BackgroundTransparency: 1 });
	};

	let fading = false;
	fade = async (fn) => {
		if (fading) return;
		fading = true;
		sfx("whoosh");
		await tweenDone(tw(blackout, 0.25, { BackgroundTransparency: 0 }, "Quad"));
		try {
			await fn();
		} catch (e) {
			console.error(e);
		}
		tw(blackout, 0.5, { BackgroundTransparency: 1 }, "Quad");
		fading = false;
	};
})();

let notify;
(() => {
	const toast = make("CanvasGroup", {
		AnchorPoint: V2(0.5, 1),
		Position: U2(0.5, 0, 1, -40),
		Size: UO(520, 46),
		BackgroundColor3: BLACK,
		BackgroundTransparency: 0.25,
		GroupTransparency: 1,
		ZIndex: 45,
		Parent: gui,
	});
	toast.el.style.pointerEvents = "none";
	const toastL = Icons.text(toast, US(1, 1), null, 22);
	let toastToken = 0;
	notify = (msg, color) => {
		if (!msg) return;
		toastToken++;
		const my = toastToken;
		toastL.Text = msg;
		toastL.TextColor3 = color || WHITE;
		toast.Position = U2(0.5, 0, 1, -20);
		tw(toast, 0.35, { GroupTransparency: 0, Position: U2(0.5, 0, 1, -40) });
		task.delay(2.5, () => {
			if (my !== toastToken) return;
			tw(toast, 0.4, { GroupTransparency: 1 });
		});
	};
})();

// no robux in the browser, so not having enough just says so
Game.topUp = (currency, cost) => {
	const need = cost - (data[currency] || 0);
	if (need <= 0) return false;
	sfx("bad");
	notify("not enough " + currency, BAD);
	return true;
};

let banner;
(() => {
	const bannerL = text(gui, "", U2(1, 0, 0, 90), U2(0, 0, 0.28, 0), 72, WHITE);
	bannerL.TextTransparency = 1;
	bannerL.TextStrokeTransparency = 1;
	bannerL.ZIndex = 30;
	bannerL.el.style.pointerEvents = "none";
	const bannerScale = make("UIScale", { Parent: bannerL });
	let bannerToken = 0;
	banner = (str, color, dur) => {
		bannerToken++;
		const my = bannerToken;
		bannerL.Text = str;
		bannerL.TextColor3 = color || WHITE;
		bannerScale.Scale = 1.35;
		tw(bannerScale, 0.5, { Scale: 1 }, "Back");
		tw(bannerL, 0.25, { TextTransparency: 0, TextStrokeTransparency: 0.4 });
		task.delay(dur || 2, () => {
			if (my !== bannerToken) return;
			tw(bannerL, 0.5, { TextTransparency: 1, TextStrokeTransparency: 1 });
			tw(bannerScale, 0.5, { Scale: 0.9 });
		});
	};
})();

function popup(str, color) {
	const g = make("CanvasGroup", { Size: UO(600, 44), Position: U2(0.5, -300, 0.56, 0), BackgroundTransparency: 1, ZIndex: 35, Parent: gui });
	g.el.style.pointerEvents = "none";
	const l = Icons.text(g, US(1, 1), null, 32, color);
	l.TextStrokeTransparency = 0.3;
	l.Text = str;
	const sc = make("UIScale", { Scale: 0.6, Parent: g });
	tw(sc, 0.3, { Scale: 1 }, "Back");
	tw(g, 1.5, { Position: U2(0.5, -300, 0.46, 0), GroupTransparency: 1 }, "Quad");
	Debris.AddItem(g, 1.6);
}

// ------------------------------------------------------------------ wallet

const wallet = make("CanvasGroup", {
	AnchorPoint: V2(1, 0),
	Position: U2(1, -16, 0, 16),
	Size: UO(420, 40),
	BackgroundTransparency: 1,
	Parent: gui,
});
make("UIListLayout", { FillDirection: "row", HorizontalAlignment: "flex-end", Padding: UDim.new(0, 6), Parent: wallet });

let coinL, gemL, keyL;
Game.pills = {};
(() => {
	function pill(color, kind) {
		const f = make("Frame", { Size: UO(130, 40), BackgroundColor3: BLACK, BackgroundTransparency: T.pill, Parent: wallet });
		Game.pills[kind] = { frame: f, scale: make("UIScale", { Parent: f }) };
		const hit = make("TextButton", { Size: US(1, 1), BackgroundTransparency: 1, Text: "", ZIndex: 2, Parent: f });
		hit.MouseEnter.Connect(() => tw(f, 0.15, { BackgroundTransparency: 0.1 }));
		hit.MouseLeave.Connect(() => tw(f, 0.2, { BackgroundTransparency: T.pill }));
		hit.MouseButton1Click.Connect(() => {
			sfx("click");
			Game.openShop();
		});
		return Icons.text(f, US(1, 1), null, 22, color);
	}
	coinL = pill(COIN, "coins");
	gemL = pill(GEM, "gems");
	keyL = pill(KEY, "keys");
})();
const shown = { coins: data.coins, gems: data.gems, keys: data.keys };

// stuff you just earned flies out of where you got it and into the counters up top. the counters wait for it
const pending = { coins: 0, gems: 0, keys: 0 };
(() => {
	const ICON = { coins: "coin", gems: "gem", keys: "key" };
	Game.holdWallet = (gain) => {
		for (const k in pending) pending[k] += Math.max(0, Math.floor(gain[k] || 0));
	};
	Game.releaseWallet = (gain) => {
		for (const k in pending) pending[k] = Math.max(0, pending[k] - Math.max(0, Math.floor(gain[k] || 0)));
	};
	// from = a gui object, gain = { coins, gems, keys }. held = already on hold
	Game.flyReward = (from, gain, held) => {
		const obj = from._holder || from;
		const ap = obj.AbsolutePosition, as = obj.AbsoluteSize, gp = gui.AbsolutePosition;
		const origin = { X: ap.X + as.X / 2 - gp.X, Y: ap.Y + as.Y / 2 - gp.Y };
		let order = 0, landed = 0;
		for (const kind of ["coins", "gems", "keys"]) {
			const amt = Math.max(0, Math.floor(gain[kind] || 0));
			if (amt <= 0) continue;
			if (!held) pending[kind] += amt;
			const n = clamp(Math.ceil(Math.sqrt(amt) / (kind === "coins" ? 2.5 : 1)), 3, 14);
			let left = amt;
			for (let i = 1; i <= n; i++) {
				const share = i === n ? left : Math.floor(amt / n);
				left -= share;
				order++;
				task.delay(order * 0.04, async () => {
					const ic = Icons.make(ICON[kind], gui, 34);
					ic.AnchorPoint = V2(0.5, 0.5);
					ic.ZIndex = 40;
					ic.Position = UO(origin.X, origin.Y);
					const sc = make("UIScale", { Scale: 0.3, Parent: ic });
					const a = Math.random() * Math.PI * 2, r = random(50, 120);
					tw(sc, 0.22, { Scale: 1.15 }, "Back");
					tw(ic, 0.3, { Position: UO(origin.X + Math.cos(a) * r, origin.Y + Math.sin(a) * r - 40), Rotation: random(-40, 40) }, "Quad", "Out");
					await task.wait(0.3 + Math.random() * 0.15);
					const p = Game.pills[kind];
					const fp = p.frame.AbsolutePosition, g2 = gui.AbsolutePosition;
					const tgt = { X: fp.X + 28 - g2.X, Y: fp.Y + p.frame.AbsoluteSize.Y / 2 - g2.Y };
					const dur = 0.42 + Math.random() * 0.1;
					tw(ic, dur, { Position: UO(tgt.X, tgt.Y), Rotation: 0 }, "Quad", "In");
					tw(sc, dur, { Scale: 0.6 }, "Quad", "In");
					await task.wait(dur);
					ic.Destroy();
					pending[kind] = Math.max(0, pending[kind] - share);
					landed++;
					if (kind === "coins") sfx("coin_land", Math.min(1 + landed * 0.05, 1.7));
					else if (kind === "gems") sfx("pick_gem", 1.1 + Math.min(landed * 0.04, 0.5), 0.5);
					else sfx("pick_key", null, 0.6);
					p.scale.Scale = 1.08;
					tw(p.scale, 0.25, { Scale: 1 }, "Back");
				});
			}
		}
	};
	// claim something and send whatever changed flying
	Game.claim = (from, action, arg) => {
		const before = { coins: data.coins, gems: data.gems, keys: data.keys };
		const res = request(action, arg);
		if (res[0]) Game.flyReward(from, { coins: data.coins - before.coins, gems: data.gems - before.gems, keys: data.keys - before.keys });
		return res;
	};
})();

// ------------------------------------------------------------------ hud

const hud = make("Frame", { Size: US(1, 1), BackgroundTransparency: 1, Visible: false, Parent: gui });
hud.el.style.pointerEvents = "none";
const topBox = make("Frame", {
	AnchorPoint: V2(0.5, 0),
	Position: U2(0.5, 0, 0, 14),
	Size: UO(360, 92),
	BackgroundColor3: BLACK,
	BackgroundTransparency: T.hud,
	Parent: hud,
});
const distL = text(topBox, "", U2(1, 0, 0, 56), UO(0, 4), 54);
const stageL = text(topBox, "", U2(1, 0, 0, 24), UO(0, 60), 20, DIM);
const effectL = text(hud, "", UO(500, 28), U2(0.5, -250, 0, 150), 24, COIN);
effectL.TextStrokeTransparency = 0.5;

const coinBox = make("Frame", { AnchorPoint: V2(1, 0), Position: U2(1, -16, 0, 14), Size: UO(200, 50), BackgroundColor3: BLACK, BackgroundTransparency: T.hud, Parent: hud });
const runCoinL = Icons.text(coinBox, U2(1, -20, 1, 0), UO(14, 0), 32, COIN, LEFT);

const bossBar = make("Frame", {
	AnchorPoint: V2(0.5, 0),
	Size: UO(440, 16),
	Position: U2(0.5, 0, 0, 116),
	BackgroundColor3: BLACK,
	BackgroundTransparency: 0.3,
	Visible: false,
	Parent: hud,
});
const bossFill = make("Frame", { Size: US(1, 1), BackgroundColor3: WHITE, Parent: bossBar });

Game.mapBar = make("Frame", {
	AnchorPoint: V2(0.5, 0),
	Size: UO(440, 10),
	Position: U2(0.5, 0, 0, 116),
	BackgroundColor3: BLACK,
	BackgroundTransparency: 0.4,
	Visible: false,
	Parent: hud,
});
Game.mapFill = make("Frame", { Size: US(0, 1), BackgroundColor3: WHITE, BackgroundTransparency: 0.15, Parent: Game.mapBar });
Game.mapPct = text(Game.mapBar, "", UO(60, 20), U2(1, 8, 0.5, -10), 16, DIM, LEFT);

let setVignette;
(() => {
	const frames = [];
	function edge(size, position, anchor, rot) {
		const f = make("Frame", { Size: size, Position: position, AnchorPoint: anchor, BackgroundColor3: BLACK, ZIndex: 0, Parent: gui });
		f.el.style.pointerEvents = "none";
		make("UIGradient", { Rotation: rot, Transparency: new NumberSequence(0, 1), Parent: f });
		frames.push(f);
	}
	edge(US(1, 0.35), US(0, 0), V2(0, 0), 90);
	edge(US(1, 0.35), US(0, 1), V2(0, 1), 270);
	edge(US(0.3, 1), US(0, 0), V2(0, 0), 0);
	edge(US(0.3, 1), US(1, 0), V2(1, 0), 180);
	setVignette = (a) => {
		for (const f of frames) {
			f.BackgroundTransparency = 1 - a;
			f.Visible = a > 0.01;
		}
	};
	setVignette(0);
})();

let fuelFill;
(() => {
	// a proper tank gauge: rounded pill, colour runs green to red, a white ghost shows what you just burned,
	// it pops when you refuel and pulses red when you're about to run dry
	const bar = make("Frame", {
		AnchorPoint: V2(0.5, 1),
		Position: U2(0.5, 0, 1, -30),
		Size: UO(440, 26),
		BackgroundColor3: RGB(12, 14, 20),
		BackgroundTransparency: 0.25,
		Parent: hud,
	});
	make("UICorner", { CornerRadius: UDim.new(0, 13), Parent: bar });
	const stroke = make("UIStroke", { Color: WHITE, Thickness: 2, Transparency: 0.7, ApplyStrokeMode: "Border", Parent: bar });
	const scale = make("UIScale", { Parent: bar });
	const inner = make("CanvasGroup", { Position: UO(4, 4), Size: U2(1, -8, 1, -8), BackgroundTransparency: 1, Parent: bar });
	make("UICorner", { CornerRadius: UDim.new(0, 9), Parent: inner });
	const ghost = make("Frame", { Size: US(1, 1), BackgroundColor3: WHITE, BackgroundTransparency: 0.6, BorderSizePixel: 0, Parent: inner });
	make("UICorner", { CornerRadius: UDim.new(0, 9), Parent: ghost });
	fuelFill = make("Frame", { Size: US(1, 1), BackgroundColor3: GOOD, BorderSizePixel: 0, Parent: inner });
	make("UICorner", { CornerRadius: UDim.new(0, 9), Parent: fuelFill });
	const grad = make("UIGradient", { Rotation: 90, Parent: fuelFill });
	const gloss = make("Frame", { Position: US(0, 0.08), Size: U2(1, 0, 0.38, 0), BackgroundColor3: WHITE, BackgroundTransparency: 0.72, BorderSizePixel: 0, Parent: fuelFill });
	make("UICorner", { CornerRadius: UDim.new(0, 4), Parent: gloss });
	for (let i = 1; i <= 9; i++) {
		make("Frame", { AnchorPoint: V2(0.5, 0), Position: US(i / 10, 0), Size: U2(0, 2, 1, 0), BackgroundColor3: BLACK, BackgroundTransparency: 0.55, BorderSizePixel: 0, ZIndex: 3, Parent: inner });
	}
	const sweep = make("Frame", { Position: U2(-0.3, 0, 0, 0), Size: US(0.25, 1), BackgroundColor3: WHITE, BorderSizePixel: 0, ZIndex: 4, Parent: inner });
	make("UIGradient", { Transparency: new NumberSequence([NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.5, 0.25), NumberSequenceKeypoint.new(1, 1)]), Parent: sweep });

	const icon = Icons.make("fuel", bar, 40);
	icon.AnchorPoint = V2(1, 0.5);
	icon.Position = U2(0, -8, 0.5, -2);
	const iconScale = make("UIScale", { Parent: icon });
	const pct = text(bar, "100", UO(64, 26), U2(1, 10, 0, 0), 24, WHITE, LEFT);
	pct.TextStrokeTransparency = 0.5;
	Game.nitroHint = text(bar, "HOLD " + Game.keyName("nitro") + " FOR NITRO", UO(240, 22), U2(0.5, -120, 0, -26), 18, DIM);
	Game.fuelBar = bar;

	const RED = RGB(255, 70, 55), YELLOW = RGB(255, 200, 60);
	let ghostK = 1, lastFlash = 0, lastT = clock();
	Game.fuelTick = () => {
		const now = clock();
		const dt = Math.min(now - lastT, 0.1);
		lastT = now;
		const k = clamp(fuel / FUEL.max, 0, 1);
		fuelFill.Size = US(k, 1);
		fuelFill.Visible = k > 0.005;
		if (k > ghostK) ghostK = k;
		else ghostK = Math.max(k, ghostK - dt * 0.35);
		ghost.Size = US(ghostK, 1);
		ghost.Visible = ghostK > 0.005;
		let c = k > 0.5 ? YELLOW.Lerp(GOOD, (k - 0.5) * 2) : RED.Lerp(YELLOW, k * 2);
		if (nitroK > 0.2) c = c.Lerp(GEM, 0.35 + 0.15 * Math.sin(now * 30));
		fuelFill.BackgroundColor3 = c;
		grad.Color = new ColorSequence(c.Lerp(WHITE, 0.25), c.Lerp(BLACK, 0.3));
		pct.Text = String(Math.ceil(k * 100));
		const low = k < 0.25 && mode === "run" && !dead;
		const pulse = low ? 0.5 + 0.5 * Math.sin(now * (k < 0.1 ? 16 : 9)) : 0;
		stroke.Color = low ? RED : nitroK > 0.2 ? GEM : WHITE;
		stroke.Transparency = low ? 0.6 - pulse * 0.6 : nitroK > 0.2 ? 0.3 : 0.7;
		stroke.Thickness = low ? 2 + pulse * 2 : 2;
		pct.TextColor3 = low ? RED.Lerp(WHITE, 1 - pulse) : WHITE;
		iconScale.Scale = 1 + pulse * 0.15;
		const flash = Game.fuelFlash || 0;
		if (flash !== lastFlash) {
			lastFlash = flash;
			scale.Scale = 1.12;
			tw(scale, 0.35, { Scale: 1 }, "Back");
			iconScale.Scale = 1.4;
			sweep.Position = U2(-0.3, 0, 0, 0);
			tw(sweep, 0.45, { Position: U2(1.05, 0, 0, 0) });
		}
	};
})();

// "BlackHole" reads as BLACK HOLE
const niceName = (id) => String(id).replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase();

// ------------------------------------------------------------------ touch controls

(() => {
	const TC = Game.touch;
	TC.on = UIS.TouchEnabled && !UIS.KeyboardEnabled;
	const root = make("Frame", { Size: US(1, 1), BackgroundTransparency: 1, Visible: false, ZIndex: 20, Parent: gui });
	root.el.style.pointerEvents = "none";
	TC.ui = root;
	const held = new Map();

	function pad(size, position, label, key, onTap) {
		const b = make("TextButton", {
			AnchorPoint: V2(0.5, 1),
			Position: position,
			Size: UO(size, size),
			BackgroundColor3: BLACK,
			BackgroundTransparency: 0.5,
			AutoButtonColor: false,
			Font: FONT,
			Text: label || "",
			TextSize: Math.floor(size * 0.24),
			TextColor3: WHITE,
			ZIndex: 21,
			Parent: root,
		});
		b.el.style.pointerEvents = "auto";
		b.el.style.touchAction = "none";
		make("UICorner", { CornerRadius: UDim.new(0.5, 0), Parent: b });
		make("UIStroke", { Color: WHITE, Transparency: 0.7, Thickness: 2, Parent: b });
		const sc = make("UIScale", { Parent: b });
		const down = (id) => {
			held.set(id, { key, b, sc });
			if (key) TC[key] = true;
			if (onTap) onTap();
			tw(b, 0.08, { BackgroundTransparency: 0.15 });
			tw(sc, 0.08, { Scale: 0.9 });
		};
		const up = (id) => {
			const h = held.get(id);
			if (!h) return;
			held.delete(id);
			if (h.key) {
				let still = false;
				for (const o of held.values()) if (o.key === h.key) still = true;
				if (!still) TC[h.key] = false;
			}
			tw(h.b, 0.2, { BackgroundTransparency: 0.5 });
			tw(h.sc, 0.25, { Scale: 1 }, "Back");
		};
		b.el.addEventListener("pointerdown", (e) => {
			e.preventDefault();
			e.stopPropagation();
			try {
				b.el.setPointerCapture(e.pointerId);
			} catch (err) {}
			down(e.pointerId);
		});
		for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) b.el.addEventListener(ev, (e) => up(e.pointerId));
		return b;
	}

	// left thumb steers and dashes, right thumb does nitro and fire. everything sits well inside the edges
	const left = pad(150, U2(0, 150, 1, -60), null, "left");
	const right = pad(150, U2(0, 330, 1, -60), null, "right");
	for (const [b, flip] of [[left, true], [right, false]]) {
		const ic = Icons.make("play", b, 52);
		ic.AnchorPoint = V2(0.5, 0.5);
		ic.Position = US(0.5, 0.5);
		ic.Rotation = flip ? 180 : 0;
		ic.el.style.pointerEvents = "none";
	}
	pad(170, U2(1, -160, 1, -60), "NITRO", "nitro");
	TC.fireBtn = pad(130, U2(1, -350, 1, -70), "FIRE", "shoot");
	pad(96, U2(0, 150, 1, -240), "«", null, () => Game.roll(-1));
	pad(96, U2(0, 330, 1, -240), "»", null, () => Game.roll(1));

	if (TC.on) {
		Game.fuelBar.Position = U2(0.5, 0, 1, -10);
		Game.nitroHint.Visible = false;
	}
})();

// ------------------------------------------------------------------ menu

const menu = make("CanvasGroup", { Size: US(1, 1), BackgroundTransparency: 1, Parent: gui });
let titleL, bestL, rewardsBtn, animateMenu;
const panels = {};
let openPanel, closePanels, startRun, toMenu;
(() => {
	const shade = make("Frame", { Size: U2(0, 460, 1, 0), BackgroundColor3: BLACK, BackgroundTransparency: 0.45, Parent: menu });
	make("UIGradient", {
		Transparency: new NumberSequence([NumberSequenceKeypoint.new(0, 0), NumberSequenceKeypoint.new(0.7, 0.2), NumberSequenceKeypoint.new(1, 1)]),
		Parent: shade,
	});
	titleL = text(menu, CONFIG.title, UO(700, 100), UO(56, 50), 96, WHITE, LEFT);
	bestL = text(menu, "", UO(500, 26), UO(60, 146), 22, DIM, LEFT);

	const col = make("Frame", { Position: UO(56, 200), Size: UO(320, 420), BackgroundTransparency: 1, Parent: menu });
	make("UIListLayout", { Padding: UDim.new(0, 8), SortOrder: "LayoutOrder", Parent: col });

	const menuItems = [];
	const menuIcons = new Map();

	function menuButton(str, icon, fn, base) {
		const holder = make("Frame", { Size: UO(320, 52), BackgroundTransparency: 1, LayoutOrder: nextOrder(), Parent: col });
		const b = button(holder, str, US(1, 1), null, fn, base);
		b.TextXAlignment = LEFT;
		b.TextSize = 26;
		make("UIPadding", { PaddingLeft: UDim.new(0, 64), Parent: b });
		const ic = Icons.make(icon, b, 30, true);
		ic.AnchorPoint = V2(0, 0.5);
		ic.Position = U2(0, -46, 0.5, 0);
		menuItems.push(b);
		menuIcons.set(b, ic);
		b.MouseEnter.Connect(() => tw(ic, 0.25, { Rotation: icon === "gear" ? 45 : 8 }, "Back"));
		b.MouseLeave.Connect(() => tw(ic, 0.3, { Rotation: 0 }));
		return b;
	}

	Game.go = async (id) => {
		if (Game.going) return;
		// no account yet: that comes first
		if (Game.forceAccount && !Online.account() && Online.enabled() && !Game.offlineOk()) {
			Game.forceAccount();
			return;
		}
		Game.race = null;
		if (Game.leaveQueue) Game.leaveQueue();
		Game.going = true;
		const [ok, msg] = request("run_start", id);
		Game.going = false;
		if (!ok) {
			notify(msg, BAD);
			sfx("bad");
			return;
		}
		Game.lastStart = id || "towers";
		fade(() => startRun(id));
	};

	// retry goes back to wherever you started this run, paying for it again
	Game.retryStart = () => {
		const id = Game.lastStart;
		if (!id || id === "towers" || !data.starts[id]) return null;
		return CONFIG.starts.find((st) => st.id === id) || null;
	};
	Game.retry = () => {
		if (Game.race) {
			Game.versusToggle();
			return;
		}
		const st = Game.retryStart();
		if (st && Game.topUp("coins", st.coins)) return;
		Game.go(st ? st.id : "towers");
	};

	const strip = make("ScrollingFrame", {
		Position: UO(56 + 320 + 12, 200),
		Size: U2(1, -(56 + 320 + 12 + 16), 0, 66),
		BackgroundTransparency: 1,
		ScrollingDirection: "X",
		AutomaticCanvasSize: "X",
		CanvasSize: new UDim2(),
		ScrollBarThickness: 4,
		ScrollBarImageColor3: WHITE,
		Visible: false,
		Parent: menu,
	});
	make("UIListLayout", { FillDirection: "row", Padding: UDim.new(0, 8), SortOrder: "LayoutOrder", Parent: strip });
	// wheel scrolls it sideways, there's no horizontal wheel on most mice
	strip.el.addEventListener("wheel", (e) => {
		if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
			strip.el.scrollLeft += e.deltaY;
			e.preventDefault();
		}
	}, { passive: false });

	Game.rebuildStrip = (animate) => {
		for (const c of strip.GetChildren()) if (c.IsA("GuiButton")) c.Destroy();
		CONFIG.starts.forEach((st, idx) => {
			const i = idx + 1;
			const open = data.starts[st.id];
			const prev = CONFIG.starts[idx - 1];
			let blocked = null;
			if (!open) {
				if (prev && !data.starts[prev.id]) blocked = "UNLOCK " + prev.name + " FIRST";
				else if (Math.max(data.farthest || 0, data.best) < (st.at || 0)) blocked = "FLY THERE ONCE FIRST";
			}
			const b = button(strip, "", UO(230, 56), null, () => {
				if (open) {
					if (!Game.topUp("coins", st.coins)) Game.go(st.id);
				} else if (blocked) {
					notify(blocked.toLowerCase(), BAD);
					sfx("bad");
				} else if (Game.topUp("keys", st.keys)) {
					return;
				} else {
					const [ok, msg] = request("unlock_start", st.id);
					notify(msg, ok ? GOOD : BAD);
					sfx(ok ? "good" : "bad");
				}
			}, 0.35);
			b.LayoutOrder = i;
			text(b, "FROM " + st.name, U2(1, -20, 0, 26), UO(12, 5), 22, open ? WHITE : DIM, LEFT);
			const cost = Icons.text(b, U2(1, -20, 0, 20), UO(12, 31), 17, open ? (data.coins >= st.coins ? COIN : DIM) : data.keys >= st.keys ? KEY : DIM, LEFT);
			cost.Text = open ? fmt(st.coins) + " ●  FAST TRAVEL" : blocked || "UNLOCK  " + st.keys + " ✦";
			if (blocked) cost.TextColor3 = DIM;
			if (animate) {
				const sc = b.FindFirstChildOfClass("UIScale");
				sc.Scale = 0.4;
				b.BackgroundTransparency = 1;
				task.delay(0.035 * i, () => {
					tw(sc, 0.4, { Scale: 1 }, "Back");
					tw(b, 0.3, { BackgroundTransparency: 0.35 });
				});
			}
		});
	};

	// once you've flown far enough, the first click on play opens fast travel and the second one starts from the beginning.
	// new players just start
	const canTravel = () => {
		const first = CONFIG.starts[0];
		return !!first && Math.max(data.farthest || 0, data.best) >= (first.at ?? Infinity);
	};
	const playBtn = menuButton("PLAY", "play", () => {
		if (strip.Visible || !canTravel()) Game.go("towers");
		else Game.openStrip();
	}, 0.1);

	Game.openStrip = () => {
		strip.Visible = true;
		strip.CanvasPosition = V2(0, 0);
		playBtn.Text = "START FROM BEGINNING";
		playBtn.TextSize = 21;
		Game.rebuildStrip(true);
	};
	Game.closeStrip = () => {
		strip.Visible = false;
		playBtn.Text = "PLAY";
		playBtn.TextSize = 28;
	};
	Game.stripOpen = () => strip.Visible;

	Game.raceBtn = menuButton("VERSUS", "flag", () => {
		Game.closeStrip();
		Game.raceClick();
	});
	menuButton("SHOP", "bag", () => {
		Game.closeStrip();
		openPanel("shop");
	});
	menuButton("LEADERBOARD", "trophy", () => Game.openLeaderboard());
	menuButton("PROFILE", "user", () => {
		Game.closeStrip();
		Game.showProfile(myProfile(), true);
	});
	rewardsBtn = menuButton("FREE REWARDS", "gift", () => {
		Game.closeStrip();
		openPanel("rewards");
	});
	{
		const small = make("Frame", { Size: UO(320, 46), BackgroundTransparency: 1, LayoutOrder: nextOrder(), Parent: col });
		make("UIListLayout", { FillDirection: "row", Padding: UDim.new(0, 8), Parent: small });
		for (const [icon, label, name] of [["gear", "SETTINGS", "settings"], ["help", "HOW TO PLAY", "howto"]]) {
			const b = button(small, label, UO(156, 46), null, () => {
				Game.closeStrip();
				openPanel(name);
			}, 0.55);
			b.TextSize = 17;
			b.TextColor3 = DIM;
			make("UIPadding", { PaddingLeft: UDim.new(0, 30), Parent: b });
			const ic = Icons.make(icon, b, 20, true);
			ic.AnchorPoint = V2(0, 0.5);
			ic.Position = U2(0, -22, 0.5, 0);
		}
	}

	animateMenu = () => {
		Game.closeStrip();
		titleL.TextTransparency = 1;
		titleL.Position = UO(20, 50);
		tw(titleL, 0.7, { TextTransparency: 0, Position: UO(56, 50) });
		menuItems.forEach((b, idx) => {
			const i = idx + 1;
			b.Position = UO(-70, 0);
			b.TextTransparency = 1;
			b.BackgroundTransparency = 1;
			menuIcons.get(b).GroupTransparency = 1;
			task.delay(0.15 + 0.06 * i, () => {
				tw(b, 0.5, { Position: UO(0, 0), TextTransparency: 0, BackgroundTransparency: b.GetAttribute("Base") });
				tw(menuIcons.get(b), 0.5, { GroupTransparency: 0 });
			});
		});
	};
})();

// ------------------------------------------------------------------ panels

const overlay = make("TextButton", {
	Size: US(1, 1),
	BackgroundColor3: BLACK,
	BackgroundTransparency: 1,
	AutoButtonColor: false,
	Text: "",
	Visible: false,
	ZIndex: 4,
	Parent: gui,
});

function panel(name, title, size) {
	const p = make("CanvasGroup", {
		AnchorPoint: V2(0.5, 0.5),
		Position: U2(0.5, 0, 0.5, 30),
		Size: size || UO(680, 520),
		BackgroundColor3: BLACK,
		BackgroundTransparency: T.panel,
		GroupTransparency: 1,
		Visible: false,
		ZIndex: 5,
		Parent: gui,
	});
	text(p, title, U2(1, -80, 0, 56), UO(22, 6), 40, WHITE, LEFT);
	make("Frame", { Position: UO(22, 60), Size: U2(1, -44, 0, 1), BackgroundColor3: WHITE, BackgroundTransparency: 0.8, Parent: p });
	const xBtn = button(p, "X", UO(44, 44), U2(1, -58, 0, 10), () => closePanels());
	const body = make("ScrollingFrame", {
		Position: UO(18, 72),
		Size: U2(1, -36, 1, -86),
		BackgroundTransparency: 1,
		ScrollBarThickness: 4,
		ScrollBarImageColor3: WHITE,
		AutomaticCanvasSize: "Y",
		CanvasSize: new UDim2(),
		Parent: p,
	});
	make("UIListLayout", { Padding: UDim.new(0, 6), SortOrder: "LayoutOrder", Parent: body });
	// fades out the bottom and says there's more below, until you've scrolled down
	const more = make("Frame", { AnchorPoint: V2(0, 1), Position: U2(0, 0, 1, 0), Size: U2(1, 0, 0, 90), BackgroundColor3: BLACK, BackgroundTransparency: 0, ZIndex: 8, Parent: p });
	make("UIGradient", { Rotation: 90, Transparency: new NumberSequence([NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.55, 0.35), NumberSequenceKeypoint.new(1, 0.05)]), Parent: more });
	const moreL = make("Frame", { AnchorPoint: V2(0.5, 1), Position: U2(0.5, 0, 1, -10), Size: UO(190, 30), BackgroundColor3: WHITE, BackgroundTransparency: 0.1, ZIndex: 9, Parent: more });
	make("UICorner", { CornerRadius: UDim.new(0.5, 0), Parent: moreL });
	text(moreL, "SCROLL FOR MORE  ▼", US(1, 1), UO(0, 1), 16, BLACK).ZIndex = 9;
	panels[name] = { frame: p, body, token: 0, more, moreL, xBtn };
	return panels[name];
}

closePanels = () => {
	let any = false;
	for (const name in panels) {
		const p = panels[name];
		if (p.locked) continue;
		if (p.frame.Visible && p.frame.GroupTransparency < 1 && !p.closing) {
			any = true;
			p.closing = true;
			if (p.onClose) p.onClose();
			p.token++;
			const my = p.token;
			tw(p.frame, 0.25, { GroupTransparency: 1, Position: U2(0.5, 0, 0.5, 30) });
			task.delay(0.25, () => {
				if (p.token === my) {
					p.frame.Visible = false;
					p.closing = false;
				}
			});
		}
	}
	if (any) sfx("close");
	// a locked panel (like the forced sign up) keeps the dark background
	for (const name in panels) if (panels[name].locked && panels[name].frame.Visible) return;
	tw(overlay, 0.25, { BackgroundTransparency: 1 });
	task.delay(0.25, () => {
		let open = false;
		for (const name in panels) {
			const p = panels[name];
			if (p.frame.Visible && !p.closing) open = true;
		}
		if (!open) overlay.Visible = false;
	});
};

openPanel = (name) => {
	closePanels();
	const p = panels[name];
	p.token++;
	p.closing = false;
	p.frame.Visible = true;
	p.frame.GroupTransparency = 1;
	p.frame.Position = U2(0.5, 0, 0.5, 30);
	tw(p.frame, 0.4, { GroupTransparency: 0, Position: US(0.5, 0.5) });
	overlay.Visible = true;
	tw(overlay, 0.3, { BackgroundTransparency: 0.5 });
	sfx("open");
	if (p.onOpen) p.onOpen();
};

overlay.MouseButton1Click.Connect(() => closePanels());

RunService.RenderStepped.Connect(() => {
	for (const name in panels) {
		const p = panels[name];
		if (!p.frame.Visible) continue;
		const el = p.body.el;
		const left = el.scrollHeight - el.clientHeight - el.scrollTop;
		const show = left > 12;
		if (p.more.Visible !== show) p.more.Visible = show;
		if (show) p.moreL.Position = U2(0.5, 0, 1, -10 - Math.abs(Math.sin(clock() * 3.2)) * 6);
	}
});

// ------------------------------------------------------------------ settings

function applySettings() {
	setSfxVolume(settings.sfx ? settings.sfxVol : 0);
	const view = settings.low ? Math.min(settings.view, 4) : settings.view;
	Lighting.FogEnd = view * CHUNK + 200;
	Lighting.FogStart = view * CHUNK * 0.45;
	Lighting.GlobalShadows = !settings.low && curStage !== "city";
	setLowGraphics(!!settings.low);
	if (mode === "menu") camera.FieldOfView = settings.fov;
}

(() => {
	let activeSlider = null;
	UIS.InputChanged.Connect((input) => {
		if (activeSlider && (input.UserInputType === "MouseMovement" || input.UserInputType === "Touch")) activeSlider(input.Position.X);
	});
	UIS.InputEnded.Connect((input) => {
		if (input.UserInputType === "MouseButton1" || input.UserInputType === "Touch") activeSlider = null;
	});
	window.addEventListener("pointermove", (e) => {
		if (activeSlider && e.pointerType !== "mouse") activeSlider(e.clientX);
	});
	window.addEventListener("pointerup", (e) => {
		if (e.pointerType !== "mouse") activeSlider = null;
	});

	const settingsPanel = panel("settings", "SETTINGS");

	function slider(name, min, max, step, key_, show) {
		const r = row(settingsPanel.body, 58);
		const l = text(r, "", U2(0.45, 0, 1, 0), UO(16, 0), 22, WHITE, LEFT);
		const bar = make("Frame", { AnchorPoint: V2(0, 0.5), Position: U2(0.5, 0, 0.5, 0), Size: U2(0.45, 0, 0, 4), BackgroundColor3: WHITE, BackgroundTransparency: 0.8, Parent: r });
		const fill = make("Frame", { Size: US(0, 1), BackgroundColor3: WHITE, Parent: bar });
		const knob = make("Frame", { AnchorPoint: V2(0.5, 0.5), Size: UO(14, 22), BackgroundColor3: WHITE, Parent: bar });
		const hit = make("TextButton", { AnchorPoint: V2(0, 0.5), Position: U2(0.5, -12, 0.5, 0), Size: U2(0.45, 24, 0, 44), BackgroundTransparency: 1, Text: "", ZIndex: 3, Parent: r });
		hit.el.style.touchAction = "none";

		let last;
		function refresh() {
			const v = settings[key_];
			const a = (v - min) / (max - min);
			tw(fill, 0.12, { Size: US(a, 1) });
			tw(knob, 0.12, { Position: US(a, 0.5) });
			l.Text = name + "   " + (show ? show(v) : String(v));
		}
		function set(x) {
			// screen pixels -> ui units
			const r0 = bar.el.getBoundingClientRect();
			const a = clamp((x - r0.left) / Math.max(r0.width, 1), 0, 1);
			let v = min + Math.floor((a * (max - min)) / step + 0.5) * step;
			v = Math.round(v * 1000) / 1000;
			if (v !== last) {
				last = v;
				sfx("tick", 1.2 + a * 0.8);
			}
			settings[key_] = v;
			refresh();
			applySettings();
		}
		hit.MouseEnter.Connect(() => tw(knob, 0.15, { Size: UO(18, 28) }));
		hit.MouseLeave.Connect(() => tw(knob, 0.15, { Size: UO(14, 22) }));
		hit.InputBegan.Connect((input) => {
			if (input.UserInputType === "MouseButton1" || input.UserInputType === "Touch") {
				activeSlider = set;
				set(input.Position.X);
			}
		});
		refresh();
	}

	function toggle(name, key_) {
		const r = row(settingsPanel.body, 58);
		text(r, name, U2(0.5, 0, 1, 0), UO(16, 0), 22, WHITE, LEFT);
		let b;
		function refresh() {
			b.Text = settings[key_] ? "ON" : "OFF";
			b.TextColor3 = settings[key_] ? GOOD : DIM;
		}
		b = button(r, "", UO(110, 40), U2(1, -124, 0.5, -20), () => {
			settings[key_] = !settings[key_];
			refresh();
			applySettings();
		}, 0.3);
		refresh();
	}

	const pct = (v) => Math.floor(v * 100 + 0.5) + "%";
	slider("VIEW DISTANCE", 3, 50, 1, "view", (v) => v * CHUNK + " studs" + (v > 15 ? "  (LAGGY)" : ""));
	toggle("MUSIC", "music");
	slider("MUSIC VOLUME", 0, 1, 0.05, "musicVol", pct);
	toggle("SOUND EFFECTS", "sfx");
	slider("SOUND EFFECT VOLUME", 0, 1, 0.05, "sfxVol", pct);
	slider("FOV", 50, 110, 1, "fov");
	toggle("LOW GRAPHICS (FOR SLOW DEVICES)", "low");
	toggle("SCREEN SHAKE", "shake");

	{
		const head = row(settingsPanel.body, 40, 1);
		text(head, "CONTROLS", U2(1, -20, 1, 0), UO(16, 4), 24, WHITE, LEFT);
		const slots = [];
		function refreshBinds() {
			const b = Game.binds();
			for (const s of slots) {
				if (Game.rebinding && Game.rebinding.btn === s.btn) {
					s.btn.Text = "PRESS A KEY...";
					s.btn.TextColor3 = COIN;
				} else {
					s.btn.Text = Game.niceKey(b[s.action][s.i] || "");
					s.btn.TextColor3 = WHITE;
				}
			}
		}
		for (const action of Game.BIND_ORDER) {
			const r = row(settingsPanel.body, 52);
			text(r, Game.BIND_NAMES[action], U2(0.4, 0, 1, 0), UO(16, 0), 20, WHITE, LEFT);
			for (let i = 0; i < 2; i++) {
				let btn;
				btn = button(r, "", UO(150, 38), U2(1, -324 + i * 160, 0.5, -19), () => {
					Game.rebinding = { action, i, btn };
					refreshBinds();
				}, 0.3);
				btn.TextSize = 18;
				slots.push({ action, i, btn });
			}
		}
		const rr = row(settingsPanel.body, 56, 1);
		button(rr, "RESET CONTROLS", UO(240, 42), U2(0.5, -120, 0.5, -21), () => {
			for (const action in Game.BIND_DEFAULT) settings.binds[action] = [Game.BIND_DEFAULT[action][0], Game.BIND_DEFAULT[action][1]];
			Game.rebinding = null;
			refreshBinds();
		});
		UIS.InputBegan.Connect((input) => {
			const rb = Game.rebinding;
			if (!rb) return;
			const t = input.UserInputType;
			let name;
			if (t === "Keyboard") {
				if (input.KeyCode === "Escape") {
					Game.rebinding = null;
					refreshBinds();
					return;
				}
				name = input.KeyCode === "Backspace" ? "" : input.KeyCode;
			} else if (t === "MouseButton1" || t === "MouseButton2" || t === "MouseButton3") {
				// the click that picked the slot lands here too, skip that one
				if (clock() - (rb.at || 0) < 0.05) return;
				name = t;
			} else return;
			if (name !== "") {
				const all = Game.binds();
				for (const a in all) for (let j = 0; j < 2; j++) if (all[a][j] === name) all[a][j] = "";
			}
			Game.binds()[rb.action][rb.i] = name;
			task.defer(() => {
				Game.rebinding = null;
				refreshBinds();
			});
			sfx("good");
		});
		settingsPanel.onOpen = refreshBinds;
		refreshBinds();
	}

	settingsPanel.onClose = () => {
		Game.rebinding = null;
		request("settings", settings);
		Game.nitroHint.Text = "HOLD " + Game.keyName("nitro") + " FOR NITRO";
	};
})();

// ------------------------------------------------------------------ how to play

(() => {
	const help = panel("howto", "HOW TO PLAY");
	const PAGES = [
		["CONTROLS", KEY, [
			"A / D to steer left and right (change any key in Settings).",
			"W for boost. You're invincible while boosting, so you can fly straight through dead ends. It burns a lot of fuel though.",
			"Q / E or left / right click to do a barrel roll, a quick dash to the side.",
			"W or SPACE for nitro.",
			"SHIFT to shoot, once you're in the team jet after the first boss.",
			"P to pause. From the pause menu you can also end your run early and still keep what you earned.",
			"Crashed? Press R on the results screen to go again right away.",
			"On mobile it's the buttons on the screen: arrows, NITRO, FIRE and the two roll buttons.",
		]],
		["FUEL", RGB(255, 70, 55), [
			"Your tank drains all the time. Grab the red fuel cans to fill it up.",
			"Empty tank means you slowly sink and crash into the ground. In space there's no air, you blow up 3 seconds later.",
			"In the Smash stage there are no fuel cans. Ram the glass towers instead, they fill you up.",
			"Shooting costs a tiny bit of fuel too. During boss fights your tank only drains when you shoot.",
		]],
		["PICKUPS", GEM, [
			"Blue crystals give you 5 gems. Gems buy plane skins in the shop.",
			"Gold keys give you 1 key. Keys unlock fast travel points and death effects.",
			"Red hearts are super rare. Each one is a revive you keep for when you crash.",
			"Coins come from flying: distance, cleared stages, bosses and everything you destroy.",
		]],
		["STAGES", WHITE, [
			"Towers, Walls, Canyon and Smash, then the first boss: an airliner that shoots lasers and missiles at you.",
			"After that you jump over to a jet and fly through Turrets, City and the second boss.",
			"Then out over the sea: land on the carrier with the green beam, taxi to the stealth jet and launch into space.",
			"After space it all starts over, just faster. Your distance keeps counting. How far can you get? ;)",
		]],
		["TIPS", COIN, [
			"Red arrows at the edge of your screen are missiles coming at you. Once they're close they stop tracking, so dodge late.",
			"You can shoot missiles down.",
			"City towers with red lights on top fall over as you get close. Shoot a fallen tower 5 times and it disappears.",
			"Click PLAY once to see the fast travel points, click it again to start from the beginning.",
			"Crashed? If you have a revive you can keep going right where you died.",
		]],
	];
	function block2(title, color, lines) {
		const head = row(help.body, 40, 1);
		make("Frame", { Size: UO(4, 20), Position: UO(6, 12), BackgroundColor3: color, Parent: head });
		text(head, title, U2(1, -30, 1, 0), UO(18, 4), 24, WHITE, LEFT);
		for (const line of lines) {
			const r = row(help.body, 0);
			r.AutomaticSize = "Y";
			make("UIPadding", { PaddingTop: UDim.new(0, 10), PaddingBottom: UDim.new(0, 10), PaddingLeft: UDim.new(0, 16), PaddingRight: UDim.new(0, 16), Parent: r });
			const l = text(r, line, US(1, 0), null, 20, RGB(215, 215, 215), LEFT);
			l.AutomaticSize = "Y";
			l.el.style.position = "relative";
			l.el.style.transform = "none";
		}
	}
	for (const pg of PAGES) block2(pg[0], pg[1], pg[2]);
})();

// ------------------------------------------------------------------ hidden codes
// only the names live here, what they give is up to the server. lower weight = shows up less
(() => {
	const HINTS = {
		COINS: 1, GEMS: 1, KEYS: 1, MOREKEYS: 0.7, REVIVE: 0.8, TURRETS: 1, UNLOCK: 0.5, FABIO: 1, BLASCHEGG: 1, ARTHUR: 1,
		FUCHSI: 1, MATTHEO: 1, NIKLAS: 1, JONAS: 1, SECRET: 0.6, VERYSECRETCODE: 0.3, FREESTUFF: 0.7, PIETROPIZZI: 0.4, HOFFELBOI: 0.25,
	};
	const used = (c) => data.codes && data.codes[c];
	function pick() {
		const list = Object.entries(HINTS).filter(([c]) => !used(c));
		let r = Math.random() * list.reduce((t, e) => t + e[1], 0);
		for (const [c, w] of list) if ((r -= w) <= 0) return c;
		return list.length ? list[list.length - 1][0] : null;
	}
	// every time a spot comes on screen it gets a small chance to show a code
	const spots = [];
	Game.codeSpot = (label, shown, fmtFn, chance) => {
		label.Visible = false;
		spots.push({ label, shown, fmt: fmtFn, chance, was: false });
	};
	setInterval(() => {
		for (const s of spots) {
			const on = !!s.shown();
			if (on && !s.was) {
				s.code = Math.random() < s.chance ? pick() : null;
				s.label.Visible = !!s.code;
				if (s.code) s.label.Text = s.fmt(s.code);
			} else if (!on || (s.code && used(s.code))) s.label.Visible = false;
			s.was = on;
		}
	}, 150);

	const corner = text(menu, "", UO(300, 18), U2(0, 56, 1, -30), 14, WHITE, LEFT);
	corner.TextTransparency = 0.78;
	Game.codeSpot(corner, () => menu.Visible && mode === "menu", (c) => "CODE: " + c, 0.05);

	const sr = row(panels.settings.body, 30, 1);
	sr.LayoutOrder = 1e6;
	const sl = text(sr, "", US(1, 1), null, 14, DIM, RIGHT);
	sl.TextTransparency = 0.5;
	Game.codeSpot(sl, () => panels.settings.frame.Visible, (c) => "SECRET CODE: " + c, 0.05);

	const hr = row(panels.howto.body, 30, 1);
	hr.LayoutOrder = 1e6;
	const hl = text(hr, "", US(1, 1), null, 15, DIM);
	hl.TextTransparency = 0.45;
	Game.codeSpot(hl, () => panels.howto.frame.Visible, (c) => "psst... TRY THE CODE " + c, 0.05);
})();

// ------------------------------------------------------------------ rewards

function result(ok, msg) {
	if (Array.isArray(ok)) [ok, msg] = ok;
	notify(msg, ok ? GOOD : BAD);
	sfx(ok ? "good" : "bad");
}

const rewardRefs = { play: [] };
(() => {
	const rewardsPanel = panel("rewards", "FREE REWARDS");
	function header(body, str) {
		const r = row(body, 34, 1);
		text(r, str, US(1, 1), UO(4, 4), 18, DIM, LEFT);
	}
	function rewardRow(body, title, sub, fn) {
		const r = row(body, 64);
		text(r, title, U2(0.62, 0, 0, 30), UO(16, 6), 24, WHITE, LEFT);
		Icons.text(r, U2(0.62, 0, 0, 22), UO(16, 36), 18, DIM, LEFT).Text = sub;
		return button(r, "", UO(170, 44), U2(1, -184, 0.5, -22), fn, 0.3);
	}
	header(rewardsPanel.body, "CODES");
	{
		const r = row(rewardsPanel.body, 64);
		const box = make("TextBox", {
			Size: U2(1, -210, 0, 44),
			Position: UO(12, 10),
			BackgroundColor3: BLACK,
			BackgroundTransparency: 0.3,
			PlaceholderText: "ENTER CODE",
			Text: "",
			ClearTextOnFocus: false,
			Font: FONT,
			TextSize: 24,
			TextColor3: WHITE,
			Parent: r,
		});
		function redeem() {
			if (box.Text === "") return;
			result(Game.claim(box, "redeem", box.Text));
			box.Text = "";
		}
		box.el.addEventListener("keydown", (e) => {
			if (e.key === "Enter") redeem();
		});
		button(r, "REDEEM", UO(170, 44), U2(1, -184, 0.5, -22), redeem, 0.1);
	}
	header(rewardsPanel.body, "CHESTS");
	// two big chest cards side by side
	{
		const cardsR = make("Frame", { Size: U2(1, -10, 0, 190), BackgroundTransparency: 1, LayoutOrder: nextOrder(), Parent: rewardsPanel.body });
		const chest = (x, title, sub, reward, color, fn) => {
			const c = make("Frame", { Position: U2(x, x > 0 ? 5 : 0, 0, 0), Size: U2(0.5, -5, 1, 0), BackgroundColor3: BLACK, BackgroundTransparency: 0.35, Parent: cardsR });
			make("UICorner", { CornerRadius: UDim.new(0, 12), Parent: c });
			make("UIStroke", { Color: color, Thickness: 2, Transparency: 0.4, ApplyStrokeMode: "Border", Parent: c });
			const glow = make("Frame", { Size: US(1, 1), BackgroundColor3: color, BackgroundTransparency: 0.8, Parent: c });
			make("UICorner", { CornerRadius: UDim.new(0, 12), Parent: glow });
			make("UIGradient", { Transparency: new NumberSequence(0.2, 1), Rotation: 90, Parent: glow });
			const ic = Icons.make("gift", c, 54);
			ic.Position = UO(16, 16);
			text(c, title, U2(1, -90, 0, 28), UO(84, 16), 24, WHITE, LEFT);
			text(c, sub, U2(1, -90, 0, 20), UO(84, 44), 15, DIM, LEFT);
			Icons.text(c, U2(1, -24, 0, 30), UO(16, 86), 22, color, LEFT).Text = reward;
			return button(c, "", U2(1, -24, 0, 50), U2(0, 12, 1, -62), fn, 0.2);
		};
		rewardRefs.daily = chest(0, "DAILY CHEST", "once every 24 hours", describe(CONFIG.daily), COIN, (b) => {
			if (serverNow() - data.lastDaily >= 86400) result(Game.claim(b, "claim_daily"));
			else sfx("bad");
		});
		rewardRefs.hourly = chest(0.5, "HOURLY CHEST", "once every hour", describe(CONFIG.hourly), GEM, (b) => {
			if (serverNow() - data.lastHourly >= 3600) result(Game.claim(b, "claim_hourly"));
			else sfx("bad");
		});
	}
	header(rewardsPanel.body, "PLAYTIME REWARDS  (KEEP THE GAME OPEN)");
	rewardRefs.bars = [];
	CONFIG.playRewards.forEach((r, idx) => {
		const i = idx + 1;
		const label = r.min < 60 ? r.min + " MIN" : idiv(r.min, 60) + "H" + (r.min % 60 > 0 ? " " + (r.min % 60) + "M" : "");
		const rw = row(rewardsPanel.body, 60);
		make("UICorner", { CornerRadius: UDim.new(0, 8), Parent: rw });
		text(rw, label, UO(90, 60), UO(14, -4), 22, WHITE, LEFT);
		Icons.text(rw, U2(1, -300, 0, 60), UO(104, -4), 19, RGB(215, 215, 215), LEFT).Text = describe(r);
		const barBg = make("Frame", { Position: U2(0, 14, 1, -10), Size: U2(1, -210, 0, 4), BackgroundColor3: WHITE, BackgroundTransparency: 0.85, Parent: rw });
		const bar = make("Frame", { Size: US(0, 1), BackgroundColor3: GOOD, Parent: barBg });
		rewardRefs.bars[idx] = bar;
		rewardRefs.play[idx] = button(rw, "", UO(160, 42), U2(1, -172, 0.5, -21), (b) => {
			if (!claimed["p" + i] && sessionTime() >= r.min * 60) result(Game.claim(b, "claim_play", i));
			else sfx("bad");
		}, 0.3);
	});
})();

function setState(b, state, label) {
	b.Text = label;
	b.TextColor3 = state === "ready" ? GOOD : DIM;
}

function updateRewards() {
	const now = serverNow();
	let ready = 0;
	let left = 86400 - (now - data.lastDaily);
	if (left <= 0) {
		ready++;
		setState(rewardRefs.daily, "ready", "CLAIM");
	} else setState(rewardRefs.daily, "wait", fmtTime(left));
	left = 3600 - (now - data.lastHourly);
	if (left <= 0) {
		ready++;
		setState(rewardRefs.hourly, "ready", "CLAIM");
	} else setState(rewardRefs.hourly, "wait", fmtTime(left));
	const t = sessionTime();
	CONFIG.playRewards.forEach((r, idx) => {
		const b = rewardRefs.play[idx];
		if (rewardRefs.bars[idx]) rewardRefs.bars[idx].Size = US(clamp(t / (r.min * 60), 0, 1), 1);
		if (claimed["p" + (idx + 1)]) setState(b, "done", "CLAIMED");
		else if (t >= r.min * 60) {
			ready++;
			setState(b, "ready", "CLAIM");
		} else setState(b, "wait", fmtTime(r.min * 60 - t));
	});
	rewardsBtn.Text = ready > 0 ? "FREE REWARDS  (" + ready + ")" : "FREE REWARDS";
	rewardsBtn.TextColor3 = ready > 0 ? GOOD : WHITE;
}

// ------------------------------------------------------------------ shop

let shopTab = "SKINS";
let rebuildShop;
Game.spinning = [];
// a little 3d window with a plane in it that slowly turns
function planeView(parent, id, size, pos, opts) {
	opts = opts || {};
	const vp = make("ViewportFrame", {
		Size: size,
		Position: pos || new UDim2(),
		BackgroundColor3: opts.bg || RGB(24, 26, 36),
		BackgroundTransparency: opts.bgT === undefined ? 0.1 : opts.bgT,
		LightDirection: V3(-1, -1.5, -0.6),
		Parent: parent,
	});
	if (opts.round) make("UICorner", { CornerRadius: UDim.new(0, opts.round), Parent: vp });
	const cam = Instance.new("Camera");
	cam.FieldOfView = opts.fov || 35;
	cam.CFrame = opts.cam || CFrame.lookAt(V3(0, 6, 24), V3(0, -0.5, 0));
	cam.Parent = vp;
	vp.CurrentCamera = cam;
	if (opts.wind) vp.p.Wind = opts.wind;
	if (id) {
		const [model] = Game.makePlane(id, vp, opts.noFx);
		Game.spinning.push({ model, speed: opts.spin || 0.9, off: Math.random() * 6 });
		vp._model = model;
	}
	return vp;
}

// the death effect playing on a loop in a window: plane pops, effect, plane comes back
function deathView(vp, kind) {
	const cam = vp.CurrentCamera;
	cam.FieldOfView = 40;
	cam.CFrame = CFrame.lookAt(V3(0, 20, 72), V3(0, 4, 0));
	const [plane, , parts] = Game.makePlane(data.skin, vp, true);
	plane.PivotTo(CFn(0, 0, 0).mul(Ang(0, rad(35), 0)));
	const fxFolder = Instance.new("Folder");
	fxFolder.Parent = vp;
	let t = 0;
	let bits = [];
	const boom = () => {
		const at = V3(0, 0, 0);
		const bl = (size, color, time) => {
			const p = Instance.new("Part");
			p.Shape = "Ball";
			p.Material = "Neon";
			p.Color = color;
			p.Size = Vector3.one.mul(2);
			p.CFrame = CFrame.fromPos(at);
			p.Parent = fxFolder;
			TweenService.Create(p, new TweenInfo(time, "Quint"), { Size: Vector3.one.mul(size * 0.6), Transparency: 1 }).Play();
			task.delay(time, () => p.Destroy());
		};
		const sp = (n, size, colorFn, speed) => {
			for (let i = 0; i < n; i++) {
				const p = Instance.new("Part");
				p.Size = Vector3.one.mul((size * random(6, 14)) / 10);
				p.Material = "Neon";
				p.Color = colorFn();
				p.CFrame = CFrame.fromPos(at);
				p.Parent = fxFolder;
				const s = speed * 0.5;
				bits.push({ p, v: V3(random(-s, s), random(idiv(s, 4), s), random(-s, s)), w: V3(Math.random() * 8, Math.random() * 8, Math.random() * 8), life: 1.8 });
			}
		};
		const sm = (n, spread, size, time) => {
			for (let i = 0; i < n; i++) {
				const p = Instance.new("Part");
				p.Shape = "Ball";
				p.Color = RGB(50, 50, 50);
				p.Size = Vector3.one.mul(2);
				p.CFrame = CFrame.fromPos(at.add(V3(random(-spread, spread), random(idiv(-spread, 2), spread), random(-spread, spread)).mul(0.6)));
				p.Parent = fxFolder;
				const tt = random(time * 10, time * 18) / 10;
				TweenService.Create(p, new TweenInfo(tt, "Quint"), { Size: Vector3.one.mul(random(size, size * 2) * 0.6), Transparency: 1 }).Play();
				task.delay(tt, () => p.Destroy());
			}
		};
		const ringP = (size, color, time) => {
			const p = Instance.new("Part");
			p.Shape = "Cylinder";
			p.Material = "Neon";
			p.Color = color;
			p.Size = V3(0.6, 4, 4);
			p.CFrame = CFrame.fromPos(at).mul(Ang(0, 0, Math.PI / 2));
			p.Transparency = 0.2;
			p._uniqueMat = true;
			p.Parent = fxFolder;
			TweenService.Create(p, new TweenInfo(time, "Quint"), { Size: V3(0.3, size * 0.6, size * 0.6), Transparency: 1 }).Play();
			task.delay(time, () => p.Destroy());
		};
		const smc = (n, spread, size, time, color) => {
			for (let i = 0; i < n; i++) {
				const p = Instance.new("Part");
				p.Shape = "Ball";
				p.Color = color || RGB(50, 50, 50);
				p.Size = Vector3.one.mul(2);
				p.CFrame = CFrame.fromPos(at.add(V3(random(-spread, spread), random(idiv(-spread, 2), spread), random(-spread, spread)).mul(0.6)));
				p.Parent = fxFolder;
				const tt = random(time * 10, time * 18) / 10;
				TweenService.Create(p, new TweenInfo(tt, "Quint"), { Size: Vector3.one.mul(random(size, size * 2) * 0.6), Transparency: 1 }).Play();
				task.delay(tt, () => p.Destroy());
			}
		};
		(Game.DEATHS[kind] || Game.DEATHS.Default).run({ ball: bl, sparks: sp, smoke: smc, ring: ringP, later: (t, fn) => task.delay(t, fn) });
	};
	const conn = RunService.RenderStepped.Connect((dt) => {
		if (vp._destroyed || !vp.Parent) {
			conn.Disconnect();
			return;
		}
		const was = t;
		t = (t + dt) % 3.4;
		if (was < 0.7 && t >= 0.7) {
			for (const p of parts) p.LocalTransparencyModifier = 1;
			boom();
		}
		if (was < 2.9 && t >= 2.9) for (const p of parts) p.LocalTransparencyModifier = 0;
		// the plane bobs a bit while it waits
		if (t < 0.7 || t > 2.9) plane.PivotTo(CFn(0, Math.sin(clock() * 2) * 0.6, 0).mul(Ang(0, rad(35), Math.sin(clock() * 1.3) * 0.1)));
		for (let i = bits.length - 1; i >= 0; i--) {
			const b = bits[i];
			b.life -= dt;
			b.v = b.v.add(V3(0, -80 * dt, 0));
			const cf = b.p.CFrame;
			b.p.CFrame = CFrame.fromPos(cf.Position.add(b.v.mul(dt))).mul(cf.Rotation).mul(Ang(b.w.X * dt, b.w.Y * dt, b.w.Z * dt));
			if (b.life <= 0) {
				b.p.Destroy();
				bits.splice(i, 1);
			} else if (b.life < 0.4) b.p.Transparency = 1 - b.life / 0.4;
		}
	});
}

(() => {
	const shopPanel = panel("shop", "SHOP", UO(760, 580));
	const tabButtons = {};
	{
		const tabs = make("Frame", { Size: U2(1, -10, 0, 48), BackgroundTransparency: 1, LayoutOrder: -1, Parent: shopPanel.body });
		make("UIListLayout", { FillDirection: "row", Padding: UDim.new(0, 6), Parent: tabs });
		[["SKINS", "user"], ["DEATH EFFECTS", "skull"], ["UPGRADES", "coin"], ["GEMS", "gem"]].forEach(([name, icon], idx) => {
			const b = button(tabs, name, U2(name === "DEATH EFFECTS" ? 0.31 : 0.23, -5, 1, 0), null, () => {
				if (shopTab === name) return;
				shopTab = name;
				rebuildShop();
			});
			b.LayoutOrder = idx + 1;
			make("UIPadding", { PaddingLeft: UDim.new(0, 34), Parent: b });
			const ic = Icons.make(icon, b, 22);
			ic.AnchorPoint = V2(0, 0.5);
			ic.Position = U2(0, -26, 0.5, 0);
			tabButtons[name] = b;
		});
	}

	const shopItems = make("Frame", { Size: U2(1, -10, 0, 0), AutomaticSize: "Y", BackgroundTransparency: 1, LayoutOrder: 1, Parent: shopPanel.body });
	make("UIListLayout", { Padding: UDim.new(0, 8), SortOrder: "LayoutOrder", Parent: shopItems });

	const DESC = {
		skin: {
			Default: ["the classic red one", "white wingtip contrails"],
			Jet: ["sleek, pointy, fast looking", "afterburner flame"],
			Biplane: ["old school, two wings", "smoky old engine"],
			Paper: ["folded out of homework", "confetti trail"],
			UFO: ["not from around here", "green tractor beam"],
			Rocket: ["basically a missile with a seat", "fire and smoke, flies higher"],
			Glider: ["huge wings, zero engine", "long white contrails"],
			Banana: ["potassium powered", "yellow sparkles"],
			Duck: ["quack", "splashing water drops"],
			Toaster: ["breakfast at 300 km/h", "burnt toast smoke"],
			Chopper: ["get to the chopper", "rotor exhaust"],
			Blimp: ["big, slow looking, not slow", "lazy smoke puffs"],
			Shark: ["the sky is the ocean now", "bubbles behind you"],
			Neon: ["straight out of the grid", "glowing cyan light trails"],
			Dragon: ["breathes fire, obviously", "flames and embers"],
			Gold: ["for people with too many gems", "golden trails and sparkles"],
			Phoenix: ["rises from every crash. well, not really", "burning wings, embers, a trail of fire"],
			Galaxy: ["a tiny planet with wings", "starfield sparkles and a nebula trail"],
			Razor: ["four blades, zero chill", "cyan and magenta blade trails"],
			Royal: ["only in the special pack", "golden sparkles, royal purple trail"],
		},
		death: {
			Default: ["a normal explosion", "fire, smoke, debris"],
			Confetti: ["party time", "70 bits of confetti"],
			Pixel: ["retro blocks everywhere", "cyan and pink pixels"],
			Nuke: ["way too much", "you'll see"],
			Firework: ["happy new year", "three bursts of colour"],
			Freeze: ["ice cold", "shards and frost"],
			BlackHole: ["gone, just gone", "a purple void swallows you"],
			Lightning: ["zap", "a crack of electricity"],
			Coins: ["cha-ching", "a shower of gold coins"],
			Hearts: ["died of love", "pink hearts everywhere"],
			Glitch: ["err0r", "rgb pixels and flicker"],
			Bubbles: ["blub", "a cloud of bubbles"],
			SmokeBomb: ["ninja vanish", "a thick cloud of smoke"],
			Supernova: ["a star is gone", "white and gold shockwaves"],
		},
	};
	const DEATH_COLOR = {
		Default: RGB(255, 130, 40), Confetti: RGB(255, 90, 200), Pixel: RGB(60, 240, 255), Nuke: RGB(255, 230, 120),
		Firework: RGB(255, 120, 60), Freeze: RGB(150, 220, 255), BlackHole: RGB(150, 60, 255), Lightning: RGB(255, 245, 120), Coins: RGB(255, 200, 50),
		Hearts: RGB(255, 100, 150), Glitch: RGB(60, 255, 140), Bubbles: RGB(140, 210, 255), SmokeBomb: RGB(130, 130, 140), Supernova: RGB(255, 235, 170),
	};

	// the rarer, the more it glows
	function rarity(price, isSkin) {
		const p = isSkin ? price : price * 25;
		if (isSkin && p >= 1000) return ["EXCLUSIVE", RGB(255, 70, 170)];
		if (p >= 350) return ["LEGENDARY", RGB(255, 190, 60)];
		if (p >= 200) return ["EPIC", RGB(200, 110, 255)];
		if (p >= 100) return ["RARE", RGB(90, 180, 255)];
		if (p > 0) return ["UNCOMMON", RGB(110, 230, 140)];
		return ["FREE", DIM];
	}

	function actionButton(parent, item, isSkin, owned, equipped, size, pos) {
		const money = isSkin ? data.gems : data.keys;
		let label, c, base = 0.1;
		if (equipped === item.id) [label, c] = ["EQUIPPED", GOOD];
		else if (owned[item.id]) [label, c] = ["EQUIP", WHITE];
		else if (item.eur) [label, c] = [item.eur === "SPECIAL PACK" ? "IN THE SPECIAL PACK" : item.eur + "  BUY", RGB(255, 70, 170)];
		else [label, c] = [fmt(item.price) + (isSkin ? " ◆" : " ✦") + "  BUY", money >= item.price ? (isSkin ? GEM : KEY) : DIM];
		const b = button(parent, "", size, pos, async () => {
			if (equipped === item.id) return;
			if (item.eur && !owned[item.id]) {
				if (item.pack === "special") {
					shopTab = "GEMS";
					rebuildShop();
				} else Game.buyPack(item.pack);
				return;
			}
			if (!owned[item.id] && Game.topUp(isSkin ? "gems" : "keys", item.price)) return;
			const [ok, msg] = request(isSkin ? "skin" : "death", item.id);
			result(ok, msg);
			if (ok) {
				Game.pushProfile();
				if (!owned[item.id]) sfx("record");
			}
		}, base);
		b.TextSize = 24;
		const l = Icons.text(b, US(1, 1), null, 24, c);
		l.Text = label;
		if (equipped !== item.id && !owned[item.id] && !item.eur && money >= item.price) {
			// pulse so you know you can afford it
			const glow = make("UIStroke", { Color: c, Thickness: 2, Transparency: 0.2, ApplyStrokeMode: "Border", Parent: b });
			const conn = RunService.RenderStepped.Connect(() => {
				if (b._destroyed) return conn.Disconnect();
				glow.Transparency = 0.25 + Math.sin(clock() * 4) * 0.2;
			});
		}
		return b;
	}

	function showcase(list, isSkin, owned, equipped, viewId) {
		const it = list.find((x) => x.id === viewId) || list[0];
		const r = row(shopItems, 260, 1);
		r.Size = U2(1, 0, 0, 260);
		const [rn, rc] = rarity(it.price, isSkin);
		// coloured glow behind the preview in the rarity colour
		const vp = planeView(r, isSkin ? it.id : null, U2(0.58, 0, 1, 0), null, { bg: RGB(20, 22, 32), bgT: 0.05, round: 10, wind: V3(-28, 0, -12) });
		make("UIGradient", { Color: new ColorSequence(RGB(255, 255, 255), rc.Lerp(WHITE, 0.4)), Rotation: 90, Parent: vp });
		if (!isSkin) deathView(vp, it.id);
		const tag = make("Frame", { Position: UO(12, 12), Size: UO(0, 24), AutomaticSize: "X", BackgroundColor3: rc, Parent: vp });
		make("UICorner", { CornerRadius: UDim.new(0, 12), Parent: tag });
		make("UIPadding", { PaddingLeft: UDim.new(0, 10), PaddingRight: UDim.new(0, 10), Parent: tag });
		const tl = text(tag, rn, U2(0, 0, 1, 0), null, 15, BLACK);
		tl.AutomaticSize = "X";
		tl.TextWrapped = false;
		const side = make("Frame", { Position: U2(0.58, 14, 0, 0), Size: U2(0.42, -14, 1, 0), BackgroundTransparency: 1, Parent: r });
		text(side, niceName(it.id), U2(1, 0, 0, 44), UO(0, 4), 40, WHITE, LEFT);
		const d = DESC[isSkin ? "skin" : "death"][it.id] || ["", ""];
		text(side, d[0], U2(1, 0, 0, 24), UO(0, 50), 20, RGB(210, 210, 210), LEFT);
		const fxRow = make("Frame", { Position: UO(0, 82), Size: U2(1, 0, 0, 30), BackgroundColor3: BLACK, BackgroundTransparency: 0.5, Parent: side });
		make("UICorner", { CornerRadius: UDim.new(0, 6), Parent: fxRow });
		text(fxRow, (isSkin ? "EFFECT: " : "") + d[1].toUpperCase(), U2(1, -20, 1, 0), UO(10, 1), 16, rc.Lerp(WHITE, 0.3), LEFT);
		const status = equipped === it.id ? ["EQUIPPED", GOOD] : owned[it.id] ? ["OWNED", WHITE] : ["NOT OWNED", DIM];
		text(side, status[0], U2(1, 0, 0, 22), UO(0, 124), 18, status[1], LEFT);
		actionButton(side, it, isSkin, owned, equipped, U2(1, 0, 0, 64), U2(0, 0, 1, -70));
	}

	function cards(list, isSkin, owned, equipped, viewId, onPick) {
		const grid = make("Frame", { Size: U2(1, 0, 0, 0), AutomaticSize: "Y", BackgroundTransparency: 1, LayoutOrder: nextOrder(), Parent: shopItems });
		make("UIGridLayout", { CellSize: UO(172, 176), CellPadding: UO(8, 8), SortOrder: "LayoutOrder", Parent: grid });
		list.forEach((it, idx) => {
			const [, rc] = rarity(it.price, isSkin);
			const sel = it.id === viewId;
			const c = button(grid, "", new UDim2(), null, () => {
				if (sel) return;
				onPick(it.id);
			}, sel ? 0.15 : 0.45);
			c.LayoutOrder = idx;
			c.ClipsDescendants = true;
			const glow = make("Frame", { Size: US(1, 0.7), BackgroundColor3: rc, BackgroundTransparency: 0.55, ZIndex: 0, Parent: c });
			make("UIGradient", { Rotation: 90, Transparency: new NumberSequence(0, 1), Parent: glow });
			if (isSkin) {
				const v = planeView(c, it.id, UO(150, 104), UO(11, 8), { bgT: 1, noFx: true, fov: 30, cam: CFrame.lookAt(V3(0, 6, 26), V3(0, -0.3, 0)), spin: 0.6 });
				v.el.style.pointerEvents = "none";
			} else {
				const ic = make("Frame", { AnchorPoint: V2(0.5, 0.5), Position: U2(0.5, 0, 0, 58), Size: UO(70, 70), BackgroundColor3: DEATH_COLOR[it.id] || WHITE, Parent: c });
				make("UICorner", { CornerRadius: UDim.new(0.5, 0), Parent: ic });
				make("UIGradient", { Color: new ColorSequence(WHITE, RGB(120, 120, 120)), Rotation: 45, Parent: ic });
				const sk = Icons.make("skull", ic, 40);
				sk.AnchorPoint = V2(0.5, 0.5);
				sk.Position = US(0.5, 0.5);
			}
			text(c, niceName(it.id), U2(1, -10, 0, 24), UO(5, 114), 21, WHITE);
			const st = Icons.text(c, U2(1, -10, 0, 22), UO(5, 142), 17, DIM);
			if (equipped === it.id) {
				st.Text = "EQUIPPED";
				st.TextColor3 = GOOD;
			} else if (owned[it.id]) st.Text = "OWNED";
			else if (it.eur) {
				st.Text = it.eur === "SPECIAL PACK" ? "SPECIAL PACK" : it.eur;
				st.TextColor3 = RGB(255, 70, 170);
			} else {
				st.Text = fmt(it.price) + (isSkin ? " ◆" : " ✦");
				st.TextColor3 = (isSkin ? data.gems : data.keys) >= it.price ? (isSkin ? GEM : KEY) : DIM;
			}
			if (sel) make("UIStroke", { Color: WHITE, Thickness: 2, Transparency: 0.1, ApplyStrokeMode: "Border", Parent: c });
			const sc = c.FindFirstChildOfClass("UIScale");
			sc.Scale = 0.85;
			task.delay(0.02 * idx, () => tw(sc, 0.35, { Scale: 1 }, "Back"));
		});
	}

	function upgrades() {
		for (const p of CONFIG.powers) {
			const lvl = data.power[p.id] || 0;
			const price = p.base * (lvl + 1) ** 2;
			const maxed = lvl >= p.max;
			const r = row(shopItems, 190, 0.35);
			r.Size = U2(1, 0, 0, 190);
			make("UICorner", { CornerRadius: UDim.new(0, 10), Parent: r });
			const bg = make("Frame", { Size: US(1, 1), BackgroundColor3: COIN, BackgroundTransparency: 0.75, ZIndex: 0, Parent: r });
			make("UICorner", { CornerRadius: UDim.new(0, 10), Parent: bg });
			make("UIGradient", { Transparency: new NumberSequence(0, 1), Parent: bg });
			const ic = Icons.make("coin", r, 90);
			ic.AnchorPoint = V2(0, 0.5);
			ic.Position = U2(0, 26, 0.5, 0);
			text(r, p.name.toUpperCase(), UO(400, 34), UO(140, 20), 30, WHITE, LEFT);
			text(r, p.desc.toUpperCase(), UO(400, 22), UO(140, 54), 17, DIM, LEFT);
			const now = (1 + 0.25 * lvl).toFixed(2).replace(/\.?0+$/, "");
			const next = (1 + 0.25 * (lvl + 1)).toFixed(2).replace(/\.?0+$/, "");
			text(r, maxed ? "x" + now + "  MAXED" : "x" + now + "   →   x" + next, UO(400, 44), UO(140, 80), 38, COIN, LEFT);
			const pips = make("Frame", { Position: UO(140, 132), Size: UO(360, 14), BackgroundTransparency: 1, Parent: r });
			make("UIListLayout", { FillDirection: "row", Padding: UDim.new(0, 4), Parent: pips });
			for (let i = 0; i < p.max; i++) {
				const f = make("Frame", { Size: UO(32, 14), BackgroundColor3: i < lvl ? COIN : WHITE, BackgroundTransparency: i < lvl ? 0 : 0.85, LayoutOrder: i, Parent: pips });
				make("UICorner", { CornerRadius: UDim.new(0, 4), Parent: f });
			}
			const b = button(r, "", UO(190, 60), U2(1, -210, 0.5, -30), () => {
				if (maxed) sfx("bad");
				else if (!Game.topUp("coins", price)) {
					const [ok, msg] = request("buy_power", p.id);
					result(ok, msg);
				}
			}, 0.1);
			Icons.text(b, US(1, 1), null, 24, maxed ? DIM : data.coins >= price ? COIN : DIM).Text = maxed ? "MAX" : fmt(price) + " ●";
		}
		// revives: find them as rare hearts, or buy them for gems
		const r = row(shopItems, 96, 0.45);
		make("UICorner", { CornerRadius: UDim.new(0, 10), Parent: r });
		const hi = Icons.make("heart", r, 56);
		hi.AnchorPoint = V2(0, 0.5);
		hi.Position = U2(0, 30, 0.5, 0);
		text(r, "REVIVES  " + (data.revives || 0), UO(400, 32), UO(110, 16), 28, RGB(255, 100, 130), LEFT);
		text(r, "USE ONE WHEN YOU CRASH TO KEEP GOING RIGHT WHERE YOU WERE. RARE HEARTS GIVE YOU ONE TOO.", U2(1, -130, 0, 40), UO(110, 50), 16, DIM, LEFT);
		for (const [n, price] of [[1, 200], [5, 500]]) {
			const pr = row(shopItems, 66);
			text(pr, n === 1 ? "1 REVIVE" : n + " REVIVES", U2(0.6, 0, 0, 30), UO(16, 7), 24, WHITE, LEFT);
			text(pr, n === 1 ? "back in the air right where you crashed" : "save 500 gems", U2(0.6, 0, 0, 22), UO(16, 37), 18, DIM, LEFT);
			const pb = button(pr, "", UO(180, 44), U2(1, -194, 0.5, -22), () => {
				if (Game.topUp("gems", price)) return;
				const [ok, msg] = request("buy_revive", n);
				notify(msg, ok ? GOOD : BAD);
				sfx(ok ? "buy" : "bad");
				rebuildShop();
			}, 0.3);
			Icons.text(pb, US(1, 1), null, 22, data.gems >= price ? GEM : DIM).Text = fmt(price) + " ◆";
			const ic = Icons.make("heart", pr, 30);
			ic.AnchorPoint = V2(1, 0.5);
			ic.Position = U2(1, -206, 0.5, 0);
		}
		// a random secret code for a key, only 5 times
		const bought = data.bought || [];
		const left = 5 - bought.length;
		const cr = row(shopItems, 66);
		text(cr, "MYSTERY CODE", U2(0.6, 0, 0, 30), UO(16, 7), 24, WHITE, LEFT);
		text(cr, left > 0 ? "one of the hidden codes, " + left + " of 5 left" : "sold out", U2(0.6, 0, 0, 22), UO(16, 37), 18, DIM, LEFT);
		const cb = button(cr, "", UO(180, 44), U2(1, -194, 0.5, -22), () => {
			if (left <= 0) sfx("bad");
			else if (!Game.topUp("keys", 1)) {
				const [ok, msg] = request("buy_code");
				notify(msg, ok ? KEY : BAD);
				sfx(ok ? "buy" : "bad");
				rebuildShop();
			}
		}, 0.3);
		Icons.text(cb, US(1, 1), null, 22, left > 0 && data.keys >= 1 ? KEY : DIM).Text = left > 0 ? "1 ✦" : "SOLD OUT";
		const unused = bought.filter((c) => !data.codes[c]);
		if (unused.length) {
			const ur = row(shopItems, 40, 0.6);
			text(ur, "YOUR CODES:  " + unused.join("   "), U2(1, -32, 1, 0), UO(16, 0), 20, KEY, LEFT);
		}
		// what leveling up gives you
		const lr = row(shopItems, 96, 0.45);
		make("UICorner", { CornerRadius: UDim.new(0, 10), Parent: lr });
		const badge = make("Frame", { AnchorPoint: V2(0, 0.5), Position: U2(0, 30, 0.5, 0), Size: UO(56, 56), BackgroundColor3: RGB(120, 90, 255), Parent: lr });
		make("UICorner", { CornerRadius: UDim.new(0.5, 0), Parent: badge });
		text(badge, String(data.level || 1), US(1, 1), null, 26, WHITE);
		text(lr, "LEVEL " + (data.level || 1), UO(400, 32), UO(110, 16), 28, RGB(170, 150, 255), LEFT);
		text(lr, "EVERY LEVEL UP GIVES COINS. EVERY 5TH LEVEL +15 GEMS, EVERY 10TH +2 KEYS.", U2(1, -130, 0, 40), UO(110, 50), 16, DIM, LEFT);
	}

	rebuildShop = () => {
		for (const name in tabButtons) {
			const b = tabButtons[name];
			const sel = name === shopTab;
			b.SetAttribute("Base", sel ? 0.05 : 0.55);
			b.BackgroundTransparency = sel ? 0.05 : 0.55;
			b.TextColor3 = sel ? WHITE : DIM;
		}
		for (const c of shopItems.GetChildren()) if (!c.IsA("UIListLayout")) c.Destroy();
		Game.spinning = Game.spinning.filter((s) => s.model.Parent && !s.model._destroyed);
		if (shopTab === "UPGRADES") upgrades();
		else if (shopTab === "GEMS") Game.gemShop(shopItems);
		else if (shopTab === "SKINS") {
			Game.skinView = Game.skinView || data.skin;
			showcase(CONFIG.skins, true, data.skins, data.skin, Game.skinView);
			cards(CONFIG.skins, true, data.skins, data.skin, Game.skinView, (id) => {
				Game.skinView = id;
				sfx("click");
				rebuildShop();
			});
		} else {
			Game.deathView = Game.deathView || data.death;
			showcase(CONFIG.deaths, false, data.deaths, data.death, Game.deathView);
			cards(CONFIG.deaths, false, data.deaths, data.death, Game.deathView, (id) => {
				Game.deathView = id;
				sfx("click");
				rebuildShop();
			});
		}
	};

	shopPanel.onOpen = () => {
		Game.skinView = null;
		Game.deathView = null;
		rebuildShop();
	};
	Game.openShop = () => {
		shopTab = "SKINS";
		if (Game.closeStrip) Game.closeStrip();
		openPanel("shop");
	};
})();
panels.rewards.onOpen = () => updateRewards();

// ------------------------------------------------------------------ results

const results = make("CanvasGroup", {
	AnchorPoint: V2(0.5, 0.5),
	Position: US(0.5, 0.55),
	Size: UO(580, 610),
	BackgroundColor3: BLACK,
	BackgroundTransparency: T.panel,
	GroupTransparency: 1,
	Visible: false,
	ZIndex: 5,
	Parent: gui,
});
let showResults;
(() => {
	const title = text(results, "", U2(1, 0, 0, 64), UO(0, 16), 60, BAD);
	const titleScale = make("UIScale", { Parent: title });
	Game.resultsTitle = (str, col) => {
		title.Text = str;
		title.TextColor3 = col;
		titleScale.Scale = 1.4;
		tw(titleScale, 0.6, { Scale: 1 }, "Back");
	};
	const distL2 = text(results, "", U2(1, 0, 0, 90), UO(0, 82), 96, WHITE);
	const unitL = text(results, "STUDS", U2(1, 0, 0, 22), UO(0, 168), 20, DIM);
	const stageL2 = text(results, "", U2(1, 0, 0, 30), UO(0, 198), 26, WHITE);
	make("Frame", { Position: UO(40, 240), Size: U2(1, -80, 0, 1), BackgroundColor3: WHITE, BackgroundTransparency: 0.8, Parent: results });

	const statRows = [];
	for (let i = 1; i <= 6; i++) {
		const col = (i - 1) % 2;
		const rowI = idiv(i - 1, 2);
		const f = make("Frame", { Position: U2(col * 0.5, col === 0 ? 40 : 10, 0, 256 + rowI * 40), Size: U2(0.5, -50, 0, 36), BackgroundTransparency: 1, Parent: results });
		const k = text(f, "", U2(0.6, 0, 1, 0), null, 20, DIM, LEFT);
		const v = text(f, "", U2(0.4, 0, 1, 0), US(0.6, 0), 24, WHITE, RIGHT);
		statRows.push({ frame: f, k, v, base: f.Position });
	}
	make("Frame", { Position: UO(40, 382), Size: U2(1, -80, 0, 1), BackgroundColor3: WHITE, BackgroundTransparency: 0.8, Parent: results });

	const rewardL = Icons.text(results, U2(1, -40, 0, 36), UO(20, 394), 32, COIN);
	const noteL = text(results, "", U2(1, -40, 0, 22), UO(20, 432), 18, DIM);
	Game.xpRow = make("Frame", { Position: UO(40, 466), Size: U2(1, -80, 0, 40), BackgroundTransparency: 1, Visible: false, Parent: results });
	const codeL = text(results, "", U2(1, -40, 0, 18), UO(20, 509), 15, KEY);
	codeL.TextTransparency = 0.35;
	Game.codeSpot(codeL, () => results.Visible, (c) => 'USE CODE "' + c + '"', 0.05);

	const rb0 = () => Game.retryBtn;
	Game.retryBtn = button(results, "RETRY", UO(300, 58), U2(0, 30, 1, -80), () => Game.retry(), 0.1);
	const retryL = Icons.text(Game.retryBtn, U2(1, -16, 1, 0), UO(8, 0), 18, WHITE);
	button(results, "MENU", UO(210, 58), U2(1, -240, 1, -80), () => fade(toMenu));
	RunService.RenderStepped.Connect(() => {
		if (!results.Visible) return;
		if (Game.race) {
			const t = Game.queueText() || "PLAY AGAIN";
			if (rb0().Text !== t) rb0().Text = t;
			if (retryL.Text !== "") retryL.Text = "";
			return;
		}
		const st = Game.retryStart();
		const rb = Game.retryBtn;
		if (st) {
			if (rb.Text !== "") rb.Text = "";
			const t = "RETRY FROM " + st.name + "  ● " + fmt(st.coins);
			if (retryL.Text !== t) retryL.Text = t;
			const c = data.coins >= st.coins ? WHITE : DIM;
			if (retryL.TextColor3 !== c) retryL.TextColor3 = c;
		} else {
			const t = Game.touch.on ? "RETRY" : "RETRY  (R)";
			if (rb.Text !== t) rb.Text = t;
			if (retryL.Text !== "") retryL.Text = "";
		}
	});

	let token = 0;
	function countUp(label, target, dur, fmtFn, my) {
		task.spawn(async () => {
			const t0 = clock();
			let lastTick = 0;
			while (token === my) {
				const k = Math.min((clock() - t0) / dur, 1);
				const e = 1 - (1 - k) ** 3;
				label.Text = fmtFn(target * e);
				if (clock() - lastTick > 0.05 && k < 1) {
					lastTick = clock();
					sfx("tick", 1.4 + e * 0.8);
				}
				if (k >= 1) break;
				await task.wait();
			}
		});
	}
	function confetti(my) {
		for (let i = 0; i < 60; i++) {
			const c = make("Frame", {
				AnchorPoint: V2(0.5, 0.5),
				Position: U2(Math.random(), 0, 0, -20),
				Size: UO(random(6, 12), random(10, 18)),
				BackgroundColor3: Color3.fromHSV(Math.random(), 0.7, 1),
				Rotation: random(0, 360),
				ZIndex: 6,
				Parent: gui,
			});
			const dur = random(18, 32) / 10;
			tw(c, dur, { Position: U2(c.Position.xs + (Math.random() - 0.5) * 0.2, 0, 1, 40), Rotation: c.Rotation + random(-540, 540) }, "Quad", "In");
			Debris.AddItem(c, dur);
		}
	}
	const fmtTimeShort = (sec) => {
		sec = Math.floor(sec);
		return idiv(sec, 60) + ":" + String(sec % 60).padStart(2, "0");
	};

	showResults = (award, info) => {
		Game.lastAward = award;
		token++;
		const my = token;
		hud.Visible = false;
		wallet.Visible = true;
		results.Visible = true;
		results.GroupTransparency = 1;
		results.Position = US(0.5, 0.6);
		tw(results, 0.5, { GroupTransparency: 0, Position: US(0.5, 0.53) });

		const record = award && info.prevBest != null && award.dist > info.prevBest && award.dist > 0;
		title.Text = record ? "NEW RECORD" : info.stopped ? "STOPPED" : "CRASHED";
		title.TextColor3 = record ? COIN : info.stopped ? WHITE : BAD;
		titleScale.Scale = 1.4;
		tw(titleScale, 0.6, { Scale: 1 }, "Back");
		if (record) {
			confetti(my);
			sfx("record");
		}
		stageL2.Text = "REACHED  " + info.stage;
		unitL.Text = record ? "STUDS, YOUR BEST EVER" : "STUDS, BEST " + fmt(award ? award.best : data.best);

		const st = [["TIME", fmtTimeShort(info.time)]];
		for (const e of [["MAPS CLEARED", info.maps], ["BOSSES", info.bosses], ["DESTROYED", info.kills], ["GLASS SMASHED", info.glass], ["BONUS PADS", info.pads]]) {
			if ((e[1] || 0) > 0) st.push([e[0], String(e[1])]);
		}
		statRows.forEach((r, idx) => {
			const i = idx + 1;
			r.frame.Visible = st[idx] !== undefined;
			if (!st[idx]) return;
			r.k.Text = st[idx][0];
			r.v.Text = st[idx][1];
			r.frame.Position = r.base.add(UO(0, 12));
			r.k.TextTransparency = 1;
			r.v.TextTransparency = 1;
			task.delay(0.5 + i * 0.07, () => {
				if (token !== my) return;
				tw(r.frame, 0.4, { Position: r.base });
				tw(r.k, 0.4, { TextTransparency: 0 });
				tw(r.v, 0.4, { TextTransparency: 0 });
			});
		});

		if (award) {
			countUp(distL2, award.dist, 1.2, fmt, my);
			rewardL.Text = "";
			const gain = { coins: award.coins || 0, gems: award.gems || 0, keys: award.keys || 0 };
			Game.holdWallet(gain);
			task.delay(2.15, () => {
				if (token !== my) return Game.releaseWallet(gain);
				Game.flyReward(rewardL, gain, true);
			});
			task.delay(1.2, () => {
				if (token !== my) return;
				const coins = award.coins || 0, gems = award.gems || 0, keys = award.keys || 0;
				countUp(rewardL, 1, 0.8, (k) => {
					const parts = ["+" + fmt(coins * k) + " ●"];
					if (gems > 0) parts.push("+" + fmt(gems * k) + " ◆");
					if (keys > 0) parts.push("+" + fmt(keys * k) + " ✦");
					if ((award.revives || 0) > 0) parts.push("+" + award.revives + " REVIVE");
					return parts.join("     ");
				}, my);
			});
			Game.showXp(award, my, () => token === my);
			noteL.Text = award.mult > 1 ? award.mult.toFixed(2).replace(/\.?0+$/, "") + "X COIN MULTIPLIER" : "";
		} else {
			Game.xpRow.Visible = false;
			distL2.Text = fmt(info.dist);
			rewardL.Text = "";
			noteL.Text = "COULDN'T SAVE THIS RUN";
		}
	};
})();

// ------------------------------------------------------------------ revive (only with revives you collected)

(() => {
	const ORDER = ["towers", "moving", "canyon", "smash", "boss", "turrets", "city", "boss2", "sea", "beyond"];
	Game.STAGE_ORDER = ORDER;
	const WAIT = 6;
	// gems for a revive in each stage, dying again in the same stage makes it pricier
	const PRICE = [100, 120, 150, 180, 220, 260, 300, 320, 350, 400];
	const box = make("CanvasGroup", {
		AnchorPoint: V2(0.5, 0.5),
		Position: US(0.5, 0.5),
		Size: UO(500, 340),
		BackgroundColor3: BLACK,
		BackgroundTransparency: T.panel,
		GroupTransparency: 1,
		Visible: false,
		ZIndex: 6,
		Parent: gui,
	});
	text(box, "REVIVE?", U2(1, 0, 0, 60), UO(0, 16), 58, WHITE);
	const subL = text(box, "", U2(1, -40, 0, 24), UO(20, 80), 20, DIM);
	const barBg = make("Frame", { Position: UO(40, 120), Size: U2(1, -80, 0, 6), BackgroundColor3: WHITE, BackgroundTransparency: 0.85, Parent: box });
	const bar = make("Frame", { Size: US(1, 1), BackgroundColor3: GOOD, Parent: barBg });
	let cur = null;

	const buy = button(box, "", UO(270, 64), U2(0, 24, 1, -88), () => {
		if (!cur || cur.waiting || cur.done) return;
		if (Game.topUp("gems", cur.price)) return;
		const [ok, msg] = request("revive_gems", cur.price);
		if (ok) {
			sfx("buy");
			cur.done = true;
			cur.revived = true;
		} else notify(msg, BAD);
	}, 0.05);
	const buyL = Icons.text(buy, US(1, 1), null, 24, GEM);
	const use = button(box, "", U2(1, -48, 0, 64), U2(0, 24, 1, -166), async () => {
		if (!cur || cur.waiting || cur.done || (data.revives || 0) < 1) return;
		cur.waiting = clock();
		const [ok, msg] = request("use_revive");
		if (ok) {
			cur.done = true;
			cur.revived = true;
		} else {
			cur.waiting = null;
			notify(msg, BAD);
		}
	}, 0.05);
	use.TextColor3 = RGB(255, 90, 110);
	use.TextSize = 24;
	make("UIPadding", { PaddingLeft: UDim.new(0, 40), Parent: use });
	const useIcon = Icons.make("heart", use, 30);
	useIcon.AnchorPoint = V2(0, 0.5);
	useIcon.Position = U2(0, -26, 0.5, 0);
	button(box, "NO THANKS", UO(170, 64), U2(1, -194, 1, -88), () => {
		if (cur && !cur.waiting) cur.done = true;
	});

	Game.offerRevive = async (my) => {
		const owned = data.revives || 0;
		const idx = Math.max(0, ORDER.indexOf(curStage));
		const here = (Game.loop || 0) + ":" + idx;
		Game.deaths = Game.deaths || {};
		Game.deaths[here] = (Game.deaths[here] || 0) + 1;
		const price = Math.round((PRICE[Math.min(idx, PRICE.length - 1)] * Math.min(1 + 0.5 * (Game.deaths[here] - 1), 3)) / 10) * 10;
		const c = { left: WAIT, price };
		cur = c;
		buyL.Text = "REVIVE FOR " + fmt(price) + " ◆";
		buyL.TextColor3 = data.gems >= price ? GEM : DIM;
		use.Visible = owned > 0;
		use.Text = "USE A REVIVE  (" + owned + " LEFT)";
		box.Size = UO(500, owned > 0 ? 340 : 260);
		subL.Text = "KEEP GOING RIGHT WHERE YOU CRASHED";
		box.Visible = true;
		box.GroupTransparency = 1;
		box.Position = US(0.5, 0.56);
		tw(box, 0.4, { GroupTransparency: 0, Position: US(0.5, 0.5) });
		sfx("open");
		while (!c.done && runId === my) {
			const dt = await task.wait();
			if (!c.waiting) {
				c.left -= dt;
				if (c.left <= 0) c.done = true;
			}
			bar.Size = US(Math.max(c.left, 0) / WAIT, 1);
		}
		cur = null;
		tw(box, 0.25, { GroupTransparency: 1 });
		task.delay(0.25, () => {
			if (!cur) box.Visible = false;
		});
		return c.revived === true && runId === my;
	};
})();

// ------------------------------------------------------------------ refresh

refreshUI = () => {
	bestL.Text = "BEST  " + fmt(data.best);
	if (saveState === false) {
		bestL.Text += "     PROGRESS ISN'T SAVING (BROWSER STORAGE IS BLOCKED)";
		bestL.TextColor3 = BAD;
	} else bestL.TextColor3 = DIM;
	if (panels.shop.frame.Visible) rebuildShop();
	if (Game.stripOpen()) Game.rebuildStrip();
	updateRewards();
	if (Game.refreshLevel) Game.refreshLevel();
};

// ------------------------------------------------------------------ levels, leaderboard, profiles

const LEVEL_C = RGB(140, 110, 255);
const xpNeed = (level) => Math.floor(100 * Math.pow(level, 1.5)) + 50;

// what goes online about you
function myProfile() {
	return {
		name: data.name,
		best: data.best,
		level: data.level,
		xp: data.xp,
		skin: data.skin,
		death: data.death,
		stats: data.stats,
		created: data.created,
		updated: Date.now(),
		seen: Online.SERVER_TIME,
		ach: Object.keys(data.ach || {}).length,
	};
}
let pushing = false;
Game.pushProfile = async () => {
	if (!Online.account() || !Online.enabled() || pushing) return;
	pushing = true;
	try {
		await Online.push(myProfile());
	} catch (e) {
		console.warn(e);
	}
	pushing = false;
};

// the level badge: a round purple thing with the number in it
function levelBadge(parent, level, size, pos) {
	const b = make("Frame", { Size: UO(size, size), Position: pos || new UDim2(), BackgroundColor3: LEVEL_C, Parent: parent });
	make("UICorner", { CornerRadius: UDim.new(0.5, 0), Parent: b });
	make("UIGradient", { Color: new ColorSequence(RGB(190, 170, 255), RGB(90, 60, 220)), Rotation: 90, Parent: b });
	make("UIStroke", { Color: WHITE, Thickness: Math.max(1, Math.floor(size / 16)), Transparency: 0.3, ApplyStrokeMode: "Border", Parent: b });
	const l = text(b, String(level), US(1, 1), UO(0, 1), Math.floor(size * (level >= 100 ? 0.36 : 0.46)), WHITE);
	l.TextStrokeTransparency = 0.6;
	return b;
}
function xpBar(parent, size, pos, k, color) {
	const bar = make("Frame", { Size: size, Position: pos, BackgroundColor3: WHITE, BackgroundTransparency: 0.85, Parent: parent });
	make("UICorner", { CornerRadius: UDim.new(0.5, 0), Parent: bar });
	const fill = make("Frame", { Size: US(clamp(k, 0, 1), 1), BackgroundColor3: color || LEVEL_C, Parent: bar });
	make("UICorner", { CornerRadius: UDim.new(0.5, 0), Parent: fill });
	make("UIGradient", { Color: new ColorSequence(RGB(200, 180, 255), RGB(120, 90, 255)), Parent: fill });
	return [bar, fill];
}

// ---------------- your level on the home screen, click it for your profile
(() => {
	const holder = make("TextButton", { Position: UO(56, 138), Size: UO(250, 40), BackgroundTransparency: 1, Text: "", Parent: menu });
	let built = null;
	Game.refreshLevel = () => {
		if (built) built.Destroy();
		built = make("Frame", { Size: US(1, 1), BackgroundTransparency: 1, Parent: holder });
		built.el.style.pointerEvents = "none";
		levelBadge(built, data.level, 36, UO(0, 2));
		text(built, "LEVEL " + data.level, UO(200, 20), UO(46, 1), 18, RGB(190, 175, 255), LEFT);
		xpBar(built, UO(170, 8), UO(46, 25), data.xp / xpNeed(data.level));
		bestL.Position = UO(250 + 60, 146);
	};
	holder.MouseEnter.Connect(() => sfx("hover"));
	holder.MouseButton1Click.Connect(() => {
		sfx("click");
		Game.closeStrip();
		Game.showProfile(myProfile(), true);
	});
})();

// ---------------- accounts: a name and a password, your progress and leaderboard spot come with you
(() => {
	const ap = panel("name", "ACCOUNT", UO(560, 470));
	let makeNew = true;
	const info = row(ap.body, 64, 1);
	const infoL = text(info, "", U2(1, -20, 1, 0), UO(8, 0), 18, RGB(210, 210, 210), LEFT);
	infoL.TextWrapped = true;

	// the two tabs: new account or log in
	const tabs = make("Frame", { Size: U2(1, -10, 0, 46), BackgroundTransparency: 1, LayoutOrder: nextOrder(), Parent: ap.body });
	const tabNew = button(tabs, "CREATE ACCOUNT", U2(0.5, -4, 1, 0), null, () => setTab(true), 0.3);
	const tabLog = button(tabs, "LOG IN", U2(0.5, -4, 1, 0), U2(0.5, 4, 0, 0), () => setTab(false), 0.3);
	tabNew.TextSize = 20;
	tabLog.TextSize = 20;

	function field(ph) {
		const r = row(ap.body, 62, 1);
		const box = make("TextBox", {
			Size: U2(1, -10, 0, 54),
			Position: UO(0, 4),
			BackgroundColor3: BLACK,
			BackgroundTransparency: 0.2,
			PlaceholderText: ph,
			Text: "",
			Font: FONT,
			TextSize: 26,
			TextColor3: WHITE,
			Parent: r,
		});
		make("UIStroke", { Color: LEVEL_C, Thickness: 2, Transparency: 0.3, ApplyStrokeMode: "Border", Parent: box });
		return [r, box];
	}
	const [nameR, nameBox] = field("NAME");
	nameBox.el.maxLength = 16;
	nameBox.el.autocomplete = "username";
	const [pwR, pwBox] = field("PASSWORD");
	pwBox.el.type = "password";
	pwBox.el.maxLength = 64;
	const noteR = row(ap.body, 26, 1);
	const noteL = text(noteR, "", U2(1, -20, 1, 0), UO(8, 0), 15, DIM, LEFT);

	const br = row(ap.body, 70, 1);
	let busy = false;
	const goBtn = button(br, "", U2(1, -10, 0, 60), UO(0, 5), () => go(), 0.05);
	goBtn.TextColor3 = GOOD;

	// logged in: who you are and a way out
	const offR = row(ap.body, 50, 1);
	const offBtn = button(offR, "NO INTERNET? PLAY OFFLINE", U2(1, -10, 0, 42), UO(0, 4), () => {
		ap.offlineOk = true;
		unlock();
		closePanels();
	}, 0.5);
	offBtn.TextSize = 17;
	offBtn.TextColor3 = DIM;
	offR.Visible = false;
	const outR = row(ap.body, 196, 1);
	// dangerous buttons want a second click within 3 seconds
	function confirmBtn(label, y, color, fn) {
		let armed = 0;
		const b = button(outR, label, U2(1, -10, 0, 58), UO(0, y), async () => {
			if (clock() - armed > 3) {
				armed = clock();
				b.Text = "SURE? CLICK AGAIN";
				sfx("bad");
				task.delay(3, () => {
					if (clock() - armed >= 2.9) b.Text = label;
				});
				return;
			}
			armed = 0;
			b.Text = label;
			await fn();
		}, 0.3);
		b.TextColor3 = color;
		return b;
	}
	const outBtn = button(outR, "LOG OUT", U2(1, -10, 0, 58), UO(0, 2), () => {
		Online.logout();
		notify("logged out", WHITE);
		sfx("click");
		closePanels();
		task.delay(0.35, () => Game.forceAccount());
	}, 0.3);
	outBtn.TextColor3 = WHITE;
	confirmBtn("RESET MY PROGRESS", 66, RGB(255, 170, 60), async () => {
		const name = Online.account();
		Server.resetData();
		request("get");
		if (name) request("set_name", name);
		if (Game.refreshLevel) Game.refreshLevel();
		await Game.pushProfile();
		Game.cloudSave(true);
		notify("progress reset, fresh start", WHITE);
		sfx("good");
	});
	confirmBtn("DELETE ACCOUNT", 130, BAD, async () => {
		try {
			await Online.deleteAccount();
			notify("account deleted", WHITE);
			sfx("good");
			closePanels();
			task.delay(0.35, () => Game.forceAccount());
		} catch (e) {
			notify(e.message || "couldn't delete it", BAD);
			sfx("bad");
		}
		refresh();
	});

	function setTab(n) {
		makeNew = n;
		sfx("click");
		refresh();
	}
	// first time here: no account, no playing. the panel can't be closed until you're in
	Game.forceAccount = () => {
		if (Online.account() || ap.offlineOk || mode !== "menu") return;
		ap.locked = true;
		ap.then = null;
		makeNew = !data.name || !data.best;
		openPanel("name");
	};
	Game.offlineOk = () => !!ap.offlineOk;
	function unlock() {
		ap.locked = false;
		ap.xBtn.Visible = true;
	}
	function refresh() {
		const acc = Online.account();
		ap.xBtn.Visible = !ap.locked;
		offR.Visible = !!ap.offline && ap.locked;
		const inForm = !acc;
		tabs.Visible = inForm;
		nameR.Visible = inForm;
		pwR.Visible = inForm;
		noteR.Visible = inForm;
		br.Visible = inForm;
		outR.Visible = !inForm;
		if (acc) {
			infoL.Text = "LOGGED IN AS " + acc.toUpperCase() + ". YOUR PROGRESS IS SAVED TO THIS ACCOUNT.";
			return;
		}
		infoL.Text = ap.locked
			? makeNew
				? "WELCOME! PICK A NAME AND A PASSWORD TO START PLAYING. YOUR PROGRESS IS SAVED TO IT."
				: "LOG IN TO KEEP PLAYING. YOUR PROGRESS LOADS FROM YOUR ACCOUNT."
			: makeNew
				? "MAKE AN ACCOUNT TO GET ON THE LEADERBOARD, PLAY VERSUS AND KEEP YOUR PROGRESS ON EVERY DEVICE."
				: "LOG IN AND YOUR PROGRESS FROM THAT ACCOUNT LOADS ON THIS DEVICE.";
		noteL.Text = makeNew ? "3 TO 16 LETTERS, NUMBERS OR _. THERE'S NO PASSWORD RESET, DON'T FORGET IT." : "";
		goBtn.Text = makeNew ? "CREATE ACCOUNT" : "LOG IN";
		tabNew.SetAttribute("Base", makeNew ? 0.05 : 0.55);
		tabNew.BackgroundTransparency = makeNew ? 0.05 : 0.55;
		tabLog.SetAttribute("Base", makeNew ? 0.55 : 0.05);
		tabLog.BackgroundTransparency = makeNew ? 0.55 : 0.05;
		tabNew.TextColor3 = makeNew ? WHITE : DIM;
		tabLog.TextColor3 = makeNew ? DIM : WHITE;
	}

	async function go() {
		if (busy) return;
		busy = true;
		goBtn.Text = "...";
		try {
			if (makeNew) {
				await Online.register(nameBox.Text, pwBox.Text);
				request("set_name", Online.account());
				await Game.pushProfile();
				Game.cloudSave(true);
				notify("account created, hi " + Online.account() + "!", GOOD);
			} else {
				await Online.login(nameBox.Text, pwBox.Text);
				await Game.cloudLoad(true);
				notify("welcome back " + Online.account() + "!", GOOD);
			}
			sfx("good");
			pwBox.Text = "";
			busy = false;
			unlock();
			refresh();
			const then = ap.then;
			ap.then = null;
			if (then) then();
			else closePanels();
			return;
		} catch (e) {
			notify(e.message || "something went wrong", BAD);
			sfx("bad");
			// firebase unreachable: don't lock people out of the game
			if (e.message === "no connection") ap.offline = true;
		}
		busy = false;
		refresh();
	}
	for (const b of [nameBox, pwBox]) {
		b.el.addEventListener("keydown", (e) => {
			if (e.key === "Enter") go();
		});
	}
	ap.onOpen = () => {
		if (!Online.account()) makeNew = !data.name ? true : makeNew;
		nameBox.Text = Online.account() || data.name || "";
		refresh();
		if (!Online.account()) task.delay(0.1, () => (nameBox.Text ? pwBox : nameBox).CaptureFocus());
	};
	// kept the old name so everything that asked for a name now asks for an account
	Game.askName = (then) => {
		ap.then = then;
		openPanel("name");
	};
	Game.openAccount = () => {
		ap.then = null;
		openPanel("name");
	};

	// every save goes to your account a few seconds later, and a newer one from the account wins when you open the game
	let saveT = null;
	Game.cloudSave = (now) => {
		if (!Online.account()) return;
		clearTimeout(saveT);
		saveT = setTimeout(() => {
			Online.storeSave(Server.exportData()).catch((e) => console.warn(e));
		}, now ? 0 : 4000);
	};
	Server.setOnSave(() => Game.cloudSave());
	Game.cloudLoad = async (force) => {
		if (!Online.account()) return false;
		const d = await Online.loadSave();
		if (!d) {
			// first time on this account: what's on this device becomes the account's save
			request("set_name", Online.account());
			Game.cloudSave(true);
			return false;
		}
		if (!force && (d.savedAt || 0) <= (data.savedAt || 0)) return false;
		Server.importData(d);
		request("get");
		if (Game.refreshLevel) Game.refreshLevel();
		return true;
	};
	task.delay(1, () => Game.cloudLoad(false).catch((e) => console.warn(e)));
	task.delay(1.4, () => {
		if (mode === "menu") Game.forceAccount();
	});
	// logged in some other way (another tab, dev tools): let go of the lock
	setInterval(() => {
		if (ap.locked && Online.account()) {
			unlock();
			refresh();
			closePanels();
		}
	}, 500);
})();

// ---------------- leaderboard: the top 3 on a podium, everyone else in a clean list
(() => {
	const lb = panel("leaderboard", "LEADERBOARD", UO(720, 600));
	const MEDAL = [COIN, RGB(210, 215, 225), RGB(215, 140, 80)];
	const AV = [RGB(255, 90, 90), RGB(255, 170, 60), RGB(90, 200, 120), RGB(80, 170, 255), RGB(170, 110, 255), RGB(255, 100, 200)];
	let token = 0;
	let list = [];

	function avatar(parent, name, size, pos, ring) {
		let h = 0;
		for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
		const a = make("Frame", { AnchorPoint: V2(0.5, 0.5), Position: pos, Size: UO(size, size), BackgroundColor3: AV[h % AV.length], Parent: parent });
		make("UICorner", { CornerRadius: UDim.new(0.5, 0), Parent: a });
		make("UIGradient", { Color: new ColorSequence(WHITE, RGB(150, 150, 150)), Rotation: 90, Parent: a });
		make("UIStroke", { Color: ring || WHITE, Thickness: 3, Transparency: ring ? 0 : 0.5, ApplyStrokeMode: "Border", Parent: a });
		text(a, String(name).slice(0, 1).toUpperCase(), US(1, 1), UO(0, 2), Math.floor(size * 0.48), WHITE).TextStrokeTransparency = 0.6;
		return a;
	}
	function onlineDot(parent, pos) {
		const d = make("Frame", { AnchorPoint: V2(0.5, 0.5), Position: pos, Size: UO(14, 14), BackgroundColor3: GOOD, ZIndex: 4, Parent: parent });
		make("UICorner", { CornerRadius: UDim.new(0.5, 0), Parent: d });
		make("UIStroke", { Color: BLACK, Thickness: 2, Transparency: 0.1, Parent: d });
	}

	// the podium: 2nd, 1st, 3rd
	function podium(top, me) {
		const holder = make("Frame", { Size: U2(1, -10, 0, 210), BackgroundTransparency: 1, LayoutOrder: nextOrder(), Parent: lb.body });
		const slots = [1, 0, 2];
		const H = [120, 92, 76];
		slots.forEach((i, k) => {
			const e = top[i];
			if (!e) return;
			const isMe = e.id === me;
			const col = make("TextButton", { Position: U2(k / 3, 4, 0, 0), Size: U2(1 / 3, -8, 1, 0), BackgroundTransparency: 1, Text: "", Parent: holder });
			col.MouseButton1Click.Connect(() => {
				sfx("click");
				Game.showProfile(e, isMe, i + 1);
			});
			const block = make("Frame", { AnchorPoint: V2(0.5, 1), Position: U2(0.5, 0, 1, 0), Size: U2(1, 0, 0, H[i]), BackgroundColor3: MEDAL[i], BackgroundTransparency: 0.15, Parent: col });
			make("UICorner", { CornerRadius: UDim.new(0, 12), Parent: block });
			make("UIGradient", { Color: new ColorSequence(WHITE, RGB(90, 90, 90)), Rotation: 90, Parent: block });
			if (isMe) make("UIStroke", { Color: GOOD, Thickness: 3, Transparency: 0.1, ApplyStrokeMode: "Border", Parent: block });
			text(block, fmt(e.best || 0), U2(1, 0, 0, 30), UO(0, 10), i === 0 ? 30 : 26, BLACK);
			text(block, "#" + (i + 1), U2(1, 0, 0, 24), UO(0, H[i] - 32), 20, BLACK).TextTransparency = 0.45;
			const top2 = H[i] + 8;
			const av = avatar(col, e.name || "?", i === 0 ? 64 : 54, U2(0.5, 0, 1, -top2 - 60), MEDAL[i]);
			if (isMe || Game.isOnline(e)) onlineDot(av, U2(1, -6, 1, -6));
			const nm = text(col, String(e.name || "?").toUpperCase(), U2(1, 0, 0, 24), U2(0, 0, 1, -top2 - 24), 20, isMe ? GOOD : WHITE);
			nm.TextTruncate = "AtEnd";
			const sc = make("UIScale", { Scale: 0.6, Parent: col });
			task.delay(0.08 * (2 - i), () => tw(sc, 0.4, { Scale: 1 }, "Back"));
		});
	}

	function entryRow(e, rank, me) {
		const r = button(lb.body, "", U2(1, -10, 0, 46), null, () => Game.showProfile(e, me, rank), me ? 0.2 : rank % 2 ? 0.55 : 0.7);
		r.LayoutOrder = nextOrder();
		if (me) make("UIStroke", { Color: GOOD, Thickness: 2, Transparency: 0.3, ApplyStrokeMode: "Border", Parent: r });
		text(r, String(rank), UO(52, 46), UO(4, 0), 20, DIM);
		const av = avatar(r, e.name || "?", 30, UO(74, 23));
		if (me || Game.isOnline(e)) onlineDot(av, U2(1, -3, 1, -3));
		text(r, String(e.name || "?").toUpperCase(), U2(1, -320, 1, 0), UO(100, 0), 20, me ? GOOD : WHITE, LEFT);
		text(r, "LVL " + (e.level || 1), UO(70, 46), U2(1, -250, 0, 0), 15, RGB(180, 165, 255), RIGHT);
		text(r, fmt(e.best || 0), UO(160, 46), U2(1, -176, 0, 0), 22, WHITE, RIGHT);
		const sc = r.FindFirstChildOfClass("UIScale");
		sc.Scale = 0.95;
		task.delay(Math.min(rank, 20) * 0.02, () => tw(sc, 0.3, { Scale: 1 }, "Back"));
		return r;
	}

	async function load() {
		token++;
		const my = token;
		for (const c of lb.body.GetChildren()) if (!c.IsA("UIListLayout")) c.Destroy();
		const head = row(lb.body, 34, 1);
		const status = text(head, Online.enabled() ? "LOADING..." : "", U2(1, -130, 1, 0), UO(6, 0), 16, DIM, LEFT);
		const rb = button(head, "REFRESH", UO(110, 30), U2(1, -116, 0.5, -15), () => load(), 0.4);
		rb.TextSize = 15;
		if (!Online.enabled()) {
			status.Text = "THE ONLINE LEADERBOARD ISN'T CONNECTED";
			status.TextColor3 = BAD;
			return;
		}
		try {
			await Game.pushProfile();
			list = await Online.top(100);
		} catch (e) {
			if (my !== token) return;
			status.Text = "COULDN'T LOAD, CHECK YOUR INTERNET";
			status.TextColor3 = BAD;
			return;
		}
		if (my !== token) return;
		const online = list.filter((e) => Game.isOnline(e)).length;
		status.Text = list.length === 0 ? "NOBODY'S ON IT YET. GO FLY." : "BEST DISTANCE   " + list.length + " PLAYERS   " + online + " ONLINE";
		const me = Online.myId();
		podium(list.slice(0, 3), me);
		if (list.length > 3) {
			const cols = row(lb.body, 22, 1);
			text(cols, "#", UO(52, 22), UO(4, 0), 13, DIM);
			text(cols, "PLAYER", UO(200, 22), UO(100, 0), 13, DIM, LEFT);
			text(cols, "BEST", UO(160, 22), U2(1, -176, 0, 0), 13, DIM, RIGHT);
		}
		let found = list.slice(0, 3).some((e) => e.id === me);
		list.slice(3).forEach((e, i) => {
			const isMe = e.id === me;
			if (isMe) found = true;
			entryRow(e, i + 4, isMe);
		});
		if (Online.account() && !found) {
			const gap = row(lb.body, 16, 1);
			text(gap, "...", US(1, 1), null, 16, DIM);
			entryRow(myProfile(), list.length + 1, true);
		}
	}

	lb.onOpen = load;
	Game.openLeaderboard = () => {
		Game.closeStrip();
		openPanel("leaderboard");
	};
	Game.rankOf = (id) => {
		const i = list.findIndex((e) => e.id === id);
		return i >= 0 ? i + 1 : null;
	};
})();

// ---------------- profile: everything about a player
(() => {
	const pp = panel("profile", "PROFILE", UO(720, 580));
	const ago = (ms) => {
		if (!ms) return "?";
		const d = Math.floor((Date.now() - ms) / 86400000);
		return d <= 0 ? "TODAY" : d === 1 ? "YESTERDAY" : d + " DAYS AGO";
	};
	const hours = (s) => {
		s = Math.floor(s || 0);
		const h = idiv(s, 3600), m = idiv(s % 3600, 60);
		return h > 0 ? h + "H " + m + "M" : m + "M";
	};

	Game.showProfile = (p, me, rank) => {
		for (const c of pp.body.GetChildren()) if (!c.IsA("UIListLayout")) c.Destroy();
		Game.spinning = Game.spinning.filter((s) => s.model.Parent && !s.model._destroyed);
		const st = p.stats || {};
		const lvl = p.level || 1;
		// header: their plane, name, level and xp
		const h = row(pp.body, 170, 0.35);
		make("UICorner", { CornerRadius: UDim.new(0, 12), Parent: h });
		const hb = make("Frame", { Size: US(1, 1), BackgroundColor3: LEVEL_C, BackgroundTransparency: 0.65, ZIndex: 0, Parent: h });
		make("UICorner", { CornerRadius: UDim.new(0, 12), Parent: hb });
		make("UIGradient", { Transparency: new NumberSequence(0.1, 1), Parent: hb });
		planeView(h, p.skin || "Default", UO(210, 150), UO(10, 10), { bgT: 1, wind: V3(-28, 0, -12), fov: 32 });
		levelBadge(h, lvl, 64, UO(232, 22));
		text(h, String(p.name || "YOU").toUpperCase(), U2(1, -330, 0, 44), UO(308, 16), 40, me ? GOOD : WHITE, LEFT);
		const r0 = rank || (!me && p.id ? Game.rankOf(p.id) : me ? Game.rankOf(Online.myId()) : null);
		text(h, r0 ? "#" + r0 + " ON THE LEADERBOARD" : me ? "YOUR PROFILE" : "", U2(1, -330, 0, 22), UO(308, 60), 17, r0 && r0 <= 3 ? COIN : DIM, LEFT);
		const on = me || Game.isOnline(p);
		const dot = make("Frame", { Position: UO(310, 84), Size: UO(10, 10), BackgroundColor3: on ? GOOD : RGB(120, 120, 130), Parent: h });
		make("UICorner", { CornerRadius: UDim.new(0.5, 0), Parent: dot });
		text(h, on ? "ONLINE" : "LAST ONLINE " + Game.lastOnline(p), U2(1, -350, 0, 18), UO(326, 80), 15, on ? GOOD : DIM, LEFT);
		const need = xpNeed(lvl);
		text(h, "LEVEL " + lvl, UO(200, 24), UO(232, 100), 22, RGB(200, 185, 255), LEFT);
		text(h, fmt(p.xp || 0) + " / " + fmt(need) + " XP", U2(1, -440, 0, 24), UO(430, 100), 18, DIM, RIGHT);
		const [, fill] = xpBar(h, U2(1, -252, 0, 14), UO(232, 132), 0);
		tw(fill, 0.9, { Size: US(clamp((p.xp || 0) / need, 0, 1), 1) }, "Quint");

		// stat tiles
		const grid = make("Frame", { Size: U2(1, -10, 0, 0), AutomaticSize: "Y", BackgroundTransparency: 1, LayoutOrder: nextOrder(), Parent: pp.body });
		make("UIGridLayout", { CellSize: UO(214, 84), CellPadding: UO(8, 8), SortOrder: "LayoutOrder", Parent: grid });
		const tiles = [
			["BEST DISTANCE", fmt(p.best || 0), COIN],
			["TOTAL POINTS", fmt(st.coins || 0) + " ●", COIN],
			["TOTAL DISTANCE", fmt(st.dist || 0), WHITE],
			["RUNS", fmt(st.runs || 0), WHITE],
			["BOSSES DEFEATED", fmt(st.bosses || 0), BAD],
			["DESTROYED", fmt(st.kills || 0), RGB(255, 150, 70)],
			["GLASS SMASHED", fmt(st.glass || 0), GEM],
			["MAPS CLEARED", fmt(st.maps || 0), GOOD],
			["PICKUPS", fmt(st.pickups || 0) + " ◆", GEM],
			["HEARTS FOUND", fmt(st.hearts || 0), RGB(255, 100, 130)],
			["FARTHEST LOOP", fmt((st.loops || 0) + 1), RGB(200, 185, 255)],
			["TIME FLOWN", hours(st.time), WHITE],
			["SKIN", niceName(p.skin || "Default"), GEM],
			["DEATH EFFECT", niceName(p.death || "Default"), KEY],
			["ACHIEVEMENTS", (p.ach || 0) + " / " + (Game.ACH_TOTAL || 0), COIN],
			["PLAYING SINCE", ago(p.created), DIM],
		];
		tiles.forEach(([k, v, c], i) => {
			const t = make("Frame", { BackgroundColor3: BLACK, BackgroundTransparency: 0.45, LayoutOrder: i, Parent: grid });
			make("UICorner", { CornerRadius: UDim.new(0, 10), Parent: t });
			const accent = make("Frame", { Position: UO(0, 14), Size: UO(4, 56), BackgroundColor3: c, Parent: t });
			make("UICorner", { CornerRadius: UDim.new(0.5, 0), Parent: accent });
			text(t, k, U2(1, -24, 0, 20), UO(16, 12), 15, DIM, LEFT);
			Icons.text(t, U2(1, -24, 0, 36), UO(16, 36), 30, c, LEFT).Text = v;
			const sc = make("UIScale", { Scale: 0.85, Parent: t });
			t.BackgroundTransparency = 1;
			task.delay(0.03 * i, () => {
				tw(sc, 0.35, { Scale: 1 }, "Back");
				tw(t, 0.3, { BackgroundTransparency: 0.45 });
			});
		});
		if (me) {
			const ar = row(pp.body, 64, 1);
			button(ar, "ACHIEVEMENTS  " + Object.keys(data.ach || {}).length + " / " + (Game.ACH_TOTAL || 0), U2(1, -10, 0, 54), UO(0, 5), () => openPanel("achievements"), 0.1).TextColor3 = COIN;
			const r = row(pp.body, 64, 1);
			button(r, Online.account() ? "ACCOUNT" : "MAKE AN ACCOUNT", UO(260, 50), UO(0, 7), () => Game.openAccount(), 0.3);
		}
		if (!pp.frame.Visible || pp.closing) openPanel("profile");
		else pp.body.CanvasPosition = V2(0, 0);
	};
})();

// ---------------- xp on the results screen, with level ups
Game.showXp = (award, my, alive) => {
	if (!award || award.xp == null) return;
	const holder = Game.xpRow;
	holder.ClearAllChildren();
	holder.Visible = true;
	let lvl = award.levelFrom, xp = award.xpFrom;
	const badgeHost = make("Frame", { Size: UO(40, 40), Position: UO(0, 0), BackgroundTransparency: 1, Parent: holder });
	let badge = levelBadge(badgeHost, lvl, 40);
	const [, fill] = xpBar(holder, U2(1, -170, 0, 12), UO(52, 14), xp / xpNeed(lvl));
	const gain = text(holder, "+0 XP", UO(110, 40), U2(1, -110, 0, 0), 22, RGB(200, 185, 255), RIGHT);
	let left = award.xp;
	task.spawn(async () => {
		await task.wait(1.4);
		const t0 = clock();
		while (left > 0 && alive()) {
			const need = xpNeed(lvl);
			const step = Math.min(left, need - xp);
			const from = xp;
			const dur = clamp(step / need, 0.15, 1) * 0.9;
			const s0 = clock();
			while (clock() - s0 < dur && alive()) {
				const k = (clock() - s0) / dur;
				fill.Size = US((from + step * k) / need, 1);
				gain.Text = "+" + fmt(award.xp - left + step * k) + " XP";
				await task.wait();
			}
			xp += step;
			left -= step;
			if (xp >= need) {
				// level up!
				lvl++;
				xp = 0;
				fill.Size = US(0, 1);
				badge.Destroy();
				badge = levelBadge(badgeHost, lvl, 40);
				const sc = make("UIScale", { Scale: 1.8, Parent: badge });
				tw(sc, 0.5, { Scale: 1 }, "Back");
				const up = (award.levelUps || []).find((u) => u.level === lvl) || {};
				banner("LEVEL " + lvl + "!", RGB(190, 170, 255), 2.2);
				popup(describe(up) || "LEVEL UP", COIN);
				sfx("record");
				flash();
			}
		}
		fill.Size = US(xp / xpNeed(lvl), 1);
		gain.Text = "+" + fmt(award.xp) + " XP";
		void t0;
	});
};

// ------------------------------------------------------------------ boss

let startBoss, updateBoss, resetSky;
(() => {
	const HOLD = 15;
	const MISSILE_TIME = 16;
	const FIRE = 0.35;
	const HULL = RGB(242, 244, 248);
	const BELLY = RGB(175, 180, 190);
	const LIVERY = RGB(25, 45, 120);
	const DARK = RGB(20, 25, 35);
	const ALONG = Ang(0, Math.PI / 2, 0);
	const skyObj = Lighting._sky;
	const bloom = Lighting._bloom;
	const sky = {
		clock: Lighting.ClockTime,
		fog: RGB(190, 205, 225),
		outdoor: Lighting.OutdoorAmbient,
		exposure: Lighting.ExposureCompensation,
		lat: Lighting.GeographicLatitude,
		moonSize: skyObj.MoonAngularSize,
		stars: skyObj.StarCount,
	};
	Game.sky = sky;
	Game.mood = (clk, fog, dur, outdoor, exposure) => {
		TweenService.Create(Lighting, new TweenInfo(dur || 3), {
			ClockTime: clk,
			FogColor: fog,
			OutdoorAmbient: outdoor || sky.outdoor,
			ExposureCompensation: exposure === undefined ? sky.exposure : exposure,
		}).Play();
	};
	Game.space = () => {
		Game.mood(0, RGB(8, 8, 18), 3, RGB(185, 185, 215), 0.75);
		skyObj.StarCount = 6000;
		TweenService.Create(bloom, new TweenInfo(3), { Intensity: settings.low ? 0 : 0.35 }).Play();
		workspace.Gravity = 0;
	};
	Game.daySky = (dur) => {
		TweenService.Create(Lighting, new TweenInfo(dur), { ClockTime: sky.clock, FogColor: sky.fog, OutdoorAmbient: sky.outdoor, ExposureCompensation: sky.exposure }).Play();
		TweenService.Create(bloom, new TweenInfo(dur), { Intensity: 0 }).Play();
		skyObj.StarCount = sky.stars;
		workspace.Gravity = Game.gravity;
	};
	// the moon hangs straight ahead, a bit up, right behind the airliner
	const MOON_DIR = V3(0, 0.26, -1).Unit;

	resetSky = () => {
		Lighting.ClockTime = sky.clock;
		Lighting.FogColor = sky.fog;
		Lighting.OutdoorAmbient = sky.outdoor;
		Lighting.ExposureCompensation = sky.exposure;
		Lighting.GeographicLatitude = sky.lat;
		Lighting._moonDir = null;
		skyObj.MoonAngularSize = sky.moonSize;
		skyObj.StarCount = sky.stars;
		bloom.Intensity = 0;
		workspace.Gravity = Game.gravity;
		Lighting.GlobalShadows = !settings.low;
	};

	function part(model, size, color, cf, props) {
		const p = Instance.new("Part");
		if (props) for (const k in props) p[k] = props[k];
		p.Anchored = true;
		p.CanCollide = false;
		p.CanQuery = false;
		p.Size = size;
		p.Color = color;
		p.CFrame = cf;
		p.Parent = model;
		return p;
	}
	function ellipsoid(model, size, color, cf) {
		const p = part(model, size, color, cf);
		p.makeEllipsoid();
		return p;
	}
	// long exhaust that widens and fades out slowly, so it doesn't end in a hard edge
	function exhaust(p, width, life) {
		const t = Instance.new("Trail");
		t.Width = width;
		t.Lifetime = life;
		t.MaxPoints = 260;
		t.WidthScale = new NumberSequence([NumberSequenceKeypoint.new(0, 0.6), NumberSequenceKeypoint.new(0.15, 1), NumberSequenceKeypoint.new(1, 2.6)]);
		t.Color = new ColorSequence([ColorSequenceKeypoint.new(0, RGB(255, 190, 140)), ColorSequenceKeypoint.new(0.12, RGB(235, 232, 228)), ColorSequenceKeypoint.new(1, RGB(170, 172, 180))]);
		t.Transparency = new NumberSequence([NumberSequenceKeypoint.new(0, 0.35), NumberSequenceKeypoint.new(0.35, 0.6), NumberSequenceKeypoint.new(0.75, 0.85), NumberSequenceKeypoint.new(1, 1)]);
		t.LightEmission = 0.25;
		t.Parent = p;
	}
	function contrail(p, color, width, life) {
		const t = Instance.new("Trail");
		t.Width = width;
		t.Lifetime = life;
		t.Color = new ColorSequence(color);
		t.Transparency = new NumberSequence([NumberSequenceKeypoint.new(0, 0.2), NumberSequenceKeypoint.new(1, 1)]);
		t.LightEmission = 0.5;
		t.Parent = p;
	}

	function airliner() {
		const m = Instance.new("Model");
		const cyl = { Shape: "Cylinder" };
		const body = part(m, V3(96, 14, 14), HULL, ALONG, cyl);
		part(m, V3(90, 12.6, 12.6), BELLY, CFn(0, -1.3, 0).mul(ALONG), cyl);
		ellipsoid(m, V3(14, 14, 30), HULL, CFn(0, 0, -48));
		ellipsoid(m, V3(11, 11, 36), HULL, CFn(0, 1.5, 50));
		part(m, V3(6, 1.4, 3), DARK, CFn(0, 4.4, -57).mul(Ang(0.5, 0, 0)));
		for (const side of [-1, 1]) {
			for (let i = 0; i <= 17; i++) part(m, V3(0.3, 1.2, 1.2), DARK, CFn(side * 7, 2.2, -38 + i * 4.5));
			part(m, V3(0.3, 1, 92), LIVERY, CFn(side * 7, 0.2, 0));
			part(m, V3(72, 2, 18), HULL, CFn(side * 40, -4, 8).mul(Ang(0, -side * 0.4, 0)));
			const tip = part(m, V3(1, 8, 5), LIVERY, CFn(side * 75, 0, 22).mul(Ang(0, 0, side * 0.3)));
			contrail(tip, new Color3(1, 1, 1), 1, 0.8);
			part(m, V3(26, 1.2, 9), HULL, CFn(side * 15, 2, 56).mul(Ang(0, -side * 0.45, 0)));
		}
		part(m, V3(1.6, 24, 14), LIVERY, CFn(0, 15, 54).mul(Ang(0.45, 0, 0)));
		const beacon = part(m, Vector3.one.mul(2), RGB(255, 30, 30), CFn(0, -8, 0), { Shape: "Ball", Material: "Neon", _uniqueMat: true });
		const engines = [];
		for (const x of [-46, -24, 24, 46]) {
			const wz = -6 + (Math.abs(x) - 7) * 0.424;
			const ez = wz - 4;
			part(m, V3(1.5, 5, 8), BELLY, CFn(x, -6.5, wz - 1));
			part(m, V3(16, 7.5, 7.5), RGB(215, 218, 225), CFn(x, -10, ez).mul(ALONG), cyl);
			part(m, V3(0.4, 6.4, 6.4), DARK, CFn(x, -10, ez - 8.1).mul(ALONG), cyl);
			const glow = part(m, V3(0.5, 5.5, 5.5), RGB(255, 120, 40), CFn(x, -10, ez + 8.2).mul(ALONG), { Shape: "Cylinder", Material: "Neon", _uniqueMat: true });
			exhaust(glow, 4, 3.5);
			const light = Instance.new("PointLight");
			light.Color = RGB(255, 120, 40);
			light.Range = 30;
			light.Brightness = 3;
			light.Parent = glow;
			engines.push({ rear: V3(x, -10, ez + 9), glow, light });
		}
		m.WorldPivot = CFn();
		m.Parent = junk;
		return [m, body, engines, beacon];
	}

	function beamPart(color, trans) {
		const p = Instance.new("Part");
		p.Anchored = true;
		p.CanCollide = false;
		p.CanQuery = false;
		p.CastShadow = false;
		p.Material = "Neon";
		p._uniqueMat = true;
		p.Color = color;
		p.Transparency = trans;
		p.Parent = junk;
		return p;
	}
	function place(p, e, pt, w) {
		p.Size = V3(w, w, pt.sub(e).Magnitude);
		p.CFrame = CFrame.lookAt(e.add(pt).div(2), pt);
	}

	function aim(bm, cf) {
		const e = cf.mul(bm.from);
		const q = V3(bm.x, pos.Y, pos.Z);
		const pt = q.add(q.sub(e).Unit.mul(160));
		if (bm.live) {
			const w = 4 * (1 + Math.sin(clock() * 50) * 0.12);
			place(bm.core, e, pt, w);
			// what actually kills you is a thinner line in the middle of the beam
			if (bm.hit) place(bm.hit, e, pt, 2);
			place(bm.glow, e, pt, w * 2.6);
			bm.sparkT = (bm.sparkT || 0) + 1;
			if (bm.sparkT % 4 === 0) {
				const sp = Instance.new("Part");
				sp.Size = Vector3.one.mul(random(6, 14) / 10);
				sp.Material = "Neon";
				sp.Color = RGB(255, 200, 150);
				sp.CanQuery = false;
				sp.CanCollide = false;
				sp.Position = pt;
				sp.AssemblyLinearVelocity = V3(random(-40, 40), random(20, 60), random(-40, 40));
				sp.Parent = junk;
				Debris.AddItem(sp, 0.8);
			}
		} else {
			const k = bm.t / bm.warn;
			place(bm.glow, e, pt, 0.4 + k * 0.8);
			bm.glow.Transparency = Math.floor(clock() * (6 + k * 20)) % 2 === 0 ? 0.2 : 0.7;
		}
	}

	function shoot(x, warn) {
		const b = boss;
		const e = b.engines[random(1, b.engines.length) - 1];
		const bm = { glow: beamPart(RGB(255, 50, 50), 0.4), from: e.rear, x, t: 0, warn: warn || 0.75, engine: e };
		b.beams.push(bm);
		e.glow.Color = RGB(255, 30, 30);
		e.light.Color = RGB(255, 30, 30);
		e.light.Brightness = 8;
		task.delay(bm.warn + FIRE, () => {
			e.glow.Color = RGB(255, 120, 40);
			e.light.Color = RGB(255, 120, 40);
			e.light.Brightness = 3;
		});
	}

	function lead(warn) {
		const x = pos.X + vx * (warn + 0.1);
		const c = Game.arenaX || 0, b = 312;
		return clamp(x, c - b, c + b);
	}

	const clampX = (x) => clamp(x, (Game.arenaX || 0) - 312, (Game.arenaX || 0) + 312);

	// returns how long until the next attack, so nothing new starts while a big one is still charging
	function volley() {
		const b = boss;
		const t = b.t;
		b.volleys++;
		const n = b.volleys;
		if (t > 9 && n % 5 === 0) {
			// wall with one gap, later ones get a second wall right after
			const mid = lead(1.2);
			const gap = mid + random(-40, 40);
			for (let x = mid - 220; x <= mid + 220; x += 26) if (Math.abs(x - gap) > 26) shoot(x, 1.2);
			sfx("laser_charge", 0.8);
			if (t > 14) {
				task.delay(1.2 + FIRE + 0.25, () => {
					if (boss !== b || b.finale) return;
					const gap2 = clampX(pos.X + (Math.random() < 0.5 ? -1 : 1) * random(70, 110));
					for (let x = pos.X - 220; x <= pos.X + 220; x += 26) if (Math.abs(x - gap2) > 26) shoot(x, 1);
					sfx("laser_charge", 0.8);
				});
				return 1.2 + FIRE + 0.25 + 1 + FIRE + 0.6;
			}
			return 1.2 + FIRE + 0.6;
		}
		if (t > 5 && n % 5 === 3) {
			// sweep: beams march across toward you, get out of the way or outrun it
			const dir = Math.random() < 0.5 ? -1 : 1;
			const start = pos.X - dir * 100;
			for (let i = 0; i <= 8; i++) {
				task.delay(i * 0.14, () => {
					if (boss !== b || b.finale) return;
					shoot(clampX(start + dir * i * 30), 1.05);
				});
			}
			sfx("laser_charge", 0.9);
			return 1.05 + 8 * 0.14 + FIRE + 0.4;
		}
		const moving = Math.abs(vx) > 15;
		if (moving) {
			shoot(lead(0.75));
			if (t > 4) shoot(pos.X);
		} else {
			shoot(pos.X);
			if (t > 8 && Math.random() < 0.5) shoot(pos.X + (Math.random() < 0.5 ? -1 : 1) * random(22, 34));
		}
		sfx("laser_charge", 1.05);
		// later on it follows up with a quick second shot where you dodged to
		if (t > 13 && Math.random() < 0.5) {
			task.delay(0.45, () => {
				if (boss !== b || b.finale) return;
				shoot(lead(0.6), 0.6);
			});
		}
		return t < 8 ? 1.2 : t < 14 ? 0.95 : 0.85;
	}

	function boom() {
		const b = boss;
		boss = null;
		bossDone = true;
		stats.bosses++;
		bossBar.Visible = false;
		const at = b.p;
		flash();
		sfx("boss_down");
		ball(at, 320, new Color3(1, 1, 0.9), 1.2);
		ball(at, 220, RGB(255, 120, 30), 2);
		ball(at.add(V3(0, 60, 0)), 160, RGB(255, 80, 20), 2.4);
		smoke(at, 18, 70, 55, 3.5);
		sparks(at, 60, 3, () => RGB(255, 150, 40), 170);
		for (const p of b.model.GetChildren()) {
			if (p.IsA("BasePart")) {
				p.Anchored = false;
				p.CanCollide = true;
				p.AssemblyLinearVelocity = b.look.mul(120).add(V3(random(-80, 80), random(20, 120), random(-80, 80)));
				p.AssemblyAngularVelocity = V3(random(-6, 6), random(-6, 6), random(-6, 6));
			}
		}
		Debris.AddItem(b.model, 12);
		for (const band of b.bands) band.Destroy();
		shatter(b.building, at, 2.5, true, 12);
		shake = 0.9;
		buff.immortal = Math.max(buff.immortal, 3);
		for (const r of b.rings) tw(r, 2, { Transparency: 1 });
		Debris.AddItem(b.halo, 2.2);
		task.delay(3, () => {
			if (boss || !bossDone) return;
			TweenService.Create(Lighting, new TweenInfo(4), { ClockTime: sky.clock, FogColor: sky.fog, OutdoorAmbient: sky.outdoor, ExposureCompensation: sky.exposure }).Play();
			TweenService.Create(skyObj, new TweenInfo(4), { MoonAngularSize: sky.moonSize }).Play();
			TweenService.Create(bloom, new TweenInfo(4), { Intensity: 0 }).Play();
			task.delay(4, () => {
				if (bossDone) {
					Lighting.GeographicLatitude = sky.lat;
					Lighting._moonDir = null;
				}
			});
		});
		banner("BOSS DOWN", COIN, 3);
		popup("+" + CONFIG.bossBonus + " ●", COIN);
		const my = runId;
		task.delay(2.8, () => {
			if (runId === my && !dead) Game.flow.startTransfer();
		});
	}

	function finale() {
		const b = boss;
		b.finale = true;
		b.ft = 0;
		for (const bm of b.beams) {
			bm.glow.Destroy();
			if (bm.core) bm.core.Destroy();
				if (bm.hit) bm.hit.Destroy();
		}
		b.beams = [];
		Missiles.clear();
		for (const e of b.engines) e.glow.Color = RGB(40, 40, 40);
		smoke(b.p, 3, 10, 10, 1);
		// the tower it crashes into has been standing out there the whole fight, now it stops drifting with you
		b.buildingPinned = true;
	}

	// the skyscraper on the horizon. it rides along with you during the fight so it's always in view
	function makeBuilding(b) {
		const bx = (Game.arenaX || 0) + 150, bz = pos.Z - 1100;
		const bld = Instance.new("Part");
		bld.Anchored = true;
		bld.CanQuery = false;
		bld.Size = V3(80, 280, 80);
		bld.Color = RGB(40, 50, 65);
		bld.Position = V3(bx, 140, bz);
		bld.Parent = junk;
		b.building = bld;
		b.bands = [];
		for (let y = 20; y <= 260; y += 20) {
			const band = Instance.new("Part");
			band.Anchored = true;
			band.CanCollide = false;
			band.CanQuery = false;
			band.Material = "Neon";
			band.Color = RGB(150, 210, 255);
			band.Transparency = 0.3;
			band.Size = V3(80.6, 1.5, 80.6);
			band.Position = V3(bx, y, bz);
			band.Parent = junk;
			b.bands.push(band);
		}
	}
	function driftBuilding(b) {
		if (b.buildingPinned || !b.building) return;
		const at = V3((Game.arenaX || 0) + 150, 140, pos.Z - 1100);
		const d = at.sub(b.building.Position);
		b.building.Position = at;
		for (const band of b.bands) band.Position = band.Position.add(d);
	}

	// soft glow rings around the moon
	function makeHalo() {
		const anchor = Instance.new("Part");
		anchor.Anchored = true;
		anchor.CanCollide = false;
		anchor.CanQuery = false;
		anchor.Transparency = 1;
		anchor.Size = Vector3.one;
		anchor.Parent = junk;
		const rings = [];
		[0.94, 0.9, 0.85, 0.78].forEach((t, idx) => {
			const g = Instance.new("Glow");
			g.Size = 1400 * (1 - idx * 0.22);
			g.Color = RGB(190, 210, 255);
			g.Transparency = 1;
			g.Parent = anchor;
			tw(g, 3, { Transparency: t });
			rings.push(g);
		});
		return [anchor, rings];
	}

	function launch(side, k) {
		Missiles.fire(boss.cf.mul(V3(side * 30, -12, 10)), 170 + k * 50);
	}

	const bez = (a, c, d, t) => a.Lerp(c, t).Lerp(c.Lerp(d, t), t);

	Game.skipBoss = () => {
		if (!boss) return;
		if (!boss.finale) finale();
		boom();
	};

	startBoss = () => {
		if (boss || bossDone) return;
		flash();
		pos = V3(0, ALT, pos.Z);
		vx = 0;
		Game.arenaX = 0;
		banner("BOSS", BAD, 2.5);
		fuel = FUEL.max;
		sfx("boss_in");
		task.delay(1.2, () => sfx("boss_flyover"));
		Lighting.ClockTime = sky.clock;
		Lighting._moonDir = MOON_DIR;
		TweenService.Create(Lighting, new TweenInfo(3), { ClockTime: 0, FogColor: RGB(15, 20, 40), OutdoorAmbient: RGB(45, 50, 85), ExposureCompensation: -0.6 }).Play();
		TweenService.Create(skyObj, new TweenInfo(3), { MoonAngularSize: 32 }).Play();
		skyObj.StarCount = 5000;
		TweenService.Create(bloom, new TweenInfo(3), { Intensity: 0.5 }).Play();
		const [m, body, engines, beacon] = airliner();
		const [halo, rings] = makeHalo();
		const start0 = V3(-450, 120, pos.Z + 260);
		boss = { model: m, body, engines, beacon, t: 0, p: start0, x: 0, look: V3(0.6, -0.2, -1).Unit, roll: 0, beams: [], nextShot: 5, volleys: 0, finale: false };
		makeBuilding(boss);
		m.PivotTo(CFrame.lookAt(start0, start0.add(boss.look)));
		bossFill.Size = US(0, 1);
		boss.halo = halo;
		boss.rings = rings;
		bossBar.Visible = true;
	};

	updateBoss = (dt) => {
		const b = boss;
		b.t += dt;
		const t = b.t;
		const prev = b.p;
		driftBuilding(b);
		if (b.finale) {
			b.ft += dt;
			const target = b.building.Position.sub(V3(0, 50, 0));
			b.p = b.p.add(target.sub(b.p).Unit.mul((speedNow + 150 + b.ft * 220) * dt));
			if (b.p.sub(target).Magnitude < 60) {
				boom();
				return;
			}
		} else if (t < 4.5) {
			const k = t / 4.5;
			const e = 1 - (1 - k) ** 2;
			const rel = bez(V3(-450, 140, 260), V3(-60, 90, -60), V3(0, 105, -260), e);
			b.x = pos.X + rel.X;
			b.p = V3(b.x, rel.Y, pos.Z + rel.Z);
			if (Math.abs(rel.Z) < 80) shake = Math.max(shake, 0.5);
		} else {
			b.x += (pos.X + Math.sin(t * 0.5) * 70 - b.x) * Math.min(1, dt * 1.5);
			b.p = V3(b.x, 105 + Math.sin(t * 1.3) * 3, pos.Z - 260 + Math.sin(t * 0.7) * 25);
		}
		const vel = b.p.sub(prev).div(Math.max(dt, 1e-3));
		if (vel.Magnitude > 1) b.look = b.look.Lerp(vel.Unit, Math.min(1, dt * 4)).Unit;
		const rollT = clamp(-b.look.X * 1.2, -0.7, 0.7);
		b.roll += (rollT - b.roll) * Math.min(1, dt * 3);
		const cf = CFrame.lookAt(b.p, b.p.add(b.look)).mul(Ang(0, 0, b.roll));
		b.model.PivotTo(cf);
		b.cf = cf;
		b.beacon.Transparency = Math.floor(clock() * 2) % 2 === 0 ? 0 : 1;
		b.halo.Position = camera.CFrame.Position.add(Lighting.GetMoonDirection().mul(2000));

		if (b.finale) return;

		const laserEnd = HOLD + 4.5;
		const missileEnd = laserEnd + MISSILE_TIME;
		if (t < laserEnd) {
			if (t >= b.nextShot) {
				b.nextShot = t + volley();
			}
		} else if (t < missileEnd) {
			if (!b.phase2) {
				b.phase2 = true;
				b.nextMissile = t + 1.5;
				shake = Math.max(shake, 0.4);
				sfx("boss_phase");
				for (const e of b.engines) e.glow.Color = RGB(255, 200, 80);
			}
			if (t >= b.nextMissile) {
				const k = (t - laserEnd) / MISSILE_TIME;
				if (k > 0.5 && Math.random() < 0.4) {
					launch(-1, k);
					launch(1, k);
				} else launch(Math.random() < 0.5 ? -1 : 1, k);
				b.nextMissile = t + 1.3 - k * 0.5;
			}
			// lasers don't stop completely while the missiles fly
			if (b.nextSnipe == null) b.nextSnipe = t + 2.5;
			if (t >= b.nextSnipe) {
				shoot(lead(0.9), 0.9);
				sfx("laser_charge", 1.05);
				b.nextSnipe = t + 2.8 - (t - laserEnd) / MISSILE_TIME;
			}
		}

		for (let i = b.beams.length - 1; i >= 0; i--) {
			const bm = b.beams[i];
			bm.t += dt;
			if (bm.t >= bm.warn + FIRE) {
				bm.glow.Destroy();
				if (bm.core) bm.core.Destroy();
				if (bm.hit) bm.hit.Destroy();
				b.beams.splice(i, 1);
			} else {
				if (bm.t >= bm.warn && !bm.live) {
					bm.live = true;
					bm.glow.Transparency = 0.55;
					bm.glow.Color = RGB(255, 40, 40);
					bm.core = beamPart(RGB(255, 235, 235), 0);
					bm.hit = beamPart(RGB(255, 235, 235), 1);
					bm.hit.CanQuery = true;
					bm.hit.Parent = world;
					if (Math.abs(bm.x - pos.X) < 40) shake = Math.max(shake, 0.3);
					sfx("laser_fire", 1, Math.abs(bm.x - pos.X) < 60 ? 1 : 0.5, clamp((bm.x - pos.X) / 150, -0.7, 0.7));
				}
				aim(bm, cf);
			}
		}

		bossFill.Size = US(Math.min(t / missileEnd, 1), 1);
		if (t >= missileEnd && Missiles.count() === 0) finale();
	};
})();

// ------------------------------------------------------------------ missiles

(() => {
	let list = [];
	const turrets = new Map();
	const layer = make("Frame", { Size: US(1, 1), BackgroundTransparency: 1, ZIndex: 25, Parent: Game.screen });
	layer.el.style.pointerEvents = "none";

	function emitter(parent, props) {
		const e = Instance.new("ParticleEmitter");
		for (const k in props) e[k] = props[k];
		e.Parent = parent;
		return e;
	}

	function exhaust(att) {
		emitter(att, {
			Texture: "fire",
			Color: new ColorSequence(RGB(255, 235, 160), RGB(255, 70, 20)),
			LightEmission: 1,
			Size: new NumberSequence(1.8, 0),
			Lifetime: new NumberRange(0.12, 0.22),
			Rate: 80,
			Speed: new NumberRange(6, 12),
			EmissionDirection: "Back",
			LockedToPart: true,
		});
		emitter(att, {
			Texture: "smoke",
			Color: new ColorSequence(RGB(215, 215, 220), RGB(90, 90, 95)),
			Size: new NumberSequence([NumberSequenceKeypoint.new(0, 1.2), NumberSequenceKeypoint.new(1, 7)]),
			Transparency: new NumberSequence([NumberSequenceKeypoint.new(0, 0.3), NumberSequenceKeypoint.new(1, 1)]),
			Lifetime: new NumberRange(0.9, 1.6),
			Rate: 45,
			Speed: new NumberRange(1, 3),
			SpreadAngle: V2(18, 18),
			Rotation: new NumberRange(0, 360),
			RotSpeed: new NumberRange(-80, 80),
			EmissionDirection: "Back",
		});
		emitter(att, {
			Texture: "sparkles",
			Color: new ColorSequence(RGB(255, 200, 90)),
			LightEmission: 1,
			Size: new NumberSequence(0.5, 0),
			Lifetime: new NumberRange(0.2, 0.45),
			Rate: 30,
			Speed: new NumberRange(10, 24),
			SpreadAngle: V2(35, 35),
			EmissionDirection: "Back",
		});
	}

	function dropTrail(m) {
		if (!m.att) return;
		const holder = Instance.new("Part");
		holder.Anchored = true;
		holder.CanCollide = false;
		holder.CanQuery = false;
		holder.Transparency = 1;
		holder.Size = Vector3.one;
		holder.CFrame = m.part.CFrame;
		holder.Parent = junk;
		m.att.Parent = holder;
		for (const e of m.att.GetChildren()) if (e.IsA("ParticleEmitter")) e.Enabled = false;
		Debris.AddItem(holder, 1.8);
		m.att = null;
	}

	function blast(at, big) {
		sfxAt("blast", at, 520, big ? 0.9 : 1.1);
		ball(at, big ? 30 : 18, RGB(255, 170, 70), 0.45);
		ball(at, big ? 12 : 8, new Color3(1, 1, 0.9), 0.18);
		const h = Instance.new("Part");
		h.Anchored = true;
		h.CanCollide = false;
		h.CanQuery = false;
		h.Transparency = 1;
		h.Size = Vector3.one;
		h.CFrame = CFrame.fromPos(at);
		h.Parent = junk;
		const a = Instance.new("Attachment");
		a.Parent = h;
		emitter(a, {
			Texture: "fire",
			Color: new ColorSequence(RGB(255, 230, 150), RGB(255, 60, 20)),
			LightEmission: 1,
			Size: new NumberSequence(4, 0),
			Lifetime: new NumberRange(0.3, 0.6),
			Rate: 0,
			Speed: new NumberRange(15, 40),
			SpreadAngle: V2(180, 180),
		}).Emit(big ? 30 : 16);
		emitter(a, {
			Texture: "smoke",
			Color: new ColorSequence(RGB(120, 115, 110), RGB(50, 50, 50)),
			Size: new NumberSequence(3, 11),
			Transparency: new NumberSequence(0.3, 1),
			Lifetime: new NumberRange(1, 2),
			Rate: 0,
			Speed: new NumberRange(4, 12),
			SpreadAngle: V2(180, 180),
			Rotation: new NumberRange(0, 360),
			RotSpeed: new NumberRange(-50, 50),
		}).Emit(big ? 14 : 8);
		emitter(a, {
			Texture: "sparkles",
			Color: new ColorSequence(RGB(255, 210, 110)),
			LightEmission: 1,
			Size: new NumberSequence(0.7, 0),
			Lifetime: new NumberRange(0.3, 0.7),
			Rate: 0,
			Speed: new NumberRange(30, 75),
			SpreadAngle: V2(180, 180),
		}).Emit(big ? 40 : 22);
		const ring = Instance.new("Part");
		ring.Shape = "Cylinder";
		ring.Material = "Neon";
		ring.Color = RGB(255, 205, 130);
		ring.Transparency = 0.25;
		ring.Anchored = true;
		ring.CanCollide = false;
		ring.CanQuery = false;
		ring.CastShadow = false;
		ring.Size = V3(0.3, 2, 2);
		ring.CFrame = CFrame.lookAt(at, camera.CFrame.Position).mul(Ang(0, Math.PI / 2, 0));
		ring.Parent = junk;
		TweenService.Create(ring, new TweenInfo(0.35, "Quad"), { Size: V3(0.3, big ? 46 : 30, big ? 46 : 30), Transparency: 1 }).Play();
		Debris.AddItem(ring, 0.4);
		Debris.AddItem(h, 2.2);
	}

	Missiles.addTurret = (tower) => turrets.set(tower, { next: 0 });
	Missiles.count = () => list.length;
	Missiles.hide = () => {
		layer.Visible = false;
	};
	function drop(m) {
		m.hb.Destroy();
		m.part.Destroy();
		m.arrow.Destroy();
		m.ring.Destroy();
	}
	Missiles.kill = (part) => {
		for (let i = 0; i < list.length; i++) {
			const m = list[i];
			if (m.part === part || m.hb === part) {
				dropTrail(m);
				blast(m.part.Position, true);
				drop(m);
				list.splice(i, 1);
				return;
			}
		}
	};
	Missiles.clear = () => {
		for (const m of list) drop(m);
		list = [];
	};

	Missiles.fire = (from, speed) => {
		const rz = from.Z - pos.Z;
		const p = Instance.new("Part");
		p.Anchored = true;
		p.CanCollide = false;
		p.CastShadow = false;
		p.Size = V3(1.8, 1.8, 8);
		p.Color = RGB(230, 230, 235);
		p.Material = "Metal";
		p.CFrame = CFrame.fromPos(from);
		p.Parent = world;

		const nose = Instance.new("Part");
		nose.Shape = "Ball";
		nose.Anchored = true;
		nose.CanCollide = false;
		nose.CanQuery = false;
		nose.Size = Vector3.one.mul(2.2);
		nose.Material = "Neon";
		nose._uniqueMat = true;
		nose.Color = RGB(255, 40, 40);
		nose.Parent = p;
		const light = Instance.new("PointLight");
		light.Color = RGB(255, 40, 40);
		light.Range = 20;
		light.Brightness = 4;
		light.Parent = nose;

		const trail = Instance.new("Trail");
		trail.Width = 1.4;
		trail.Offset = V3(0, 0, 4);
		trail.Lifetime = 0.9;
		trail.Color = new ColorSequence(RGB(255, 170, 90), RGB(120, 120, 120));
		trail.Transparency = new NumberSequence(0.1, 1);
		trail.WidthScale = new NumberSequence(1, 4);
		trail.Parent = p;
		const att = Instance.new("Attachment");
		att.Position = V3(0, 0, 4.2);
		att.Parent = p;
		exhaust(att);

		const arrow = make("TextLabel", {
			AnchorPoint: V2(0.5, 0.5),
			Size: UO(44, 44),
			BackgroundTransparency: 1,
			Font: FONT,
			Text: "▲",
			TextSize: 40,
			TextColor3: BAD,
			TextStrokeTransparency: 0.3,
			Visible: false,
			Parent: layer,
		});
		const ring = make("Frame", { AnchorPoint: V2(0.5, 0.5), BackgroundTransparency: 1, Visible: false, Parent: layer });
		make("UIStroke", { Color: BAD, Thickness: 1, Transparency: 0.4, Parent: ring });

		p.SetAttribute("Missile", true);
		const hb = Instance.new("Part");
		hb.Anchored = true;
		hb.CanCollide = false;
		hb.Transparency = 1;
		hb.Size = V3(14, 14, 16);
		hb.CFrame = p.CFrame;
		hb.SetAttribute("Missile", true);
		hb.Parent = Game.guns.targets;
		list.push({ part: p, hb, nose, att, x: from.X, y: from.Y, rz, vx: 0, dir: rz < 0 ? 1 : -1, speed, arrow, ring });
		sfxAt("missile_launch", from, 700);
	};

	let lastLaunch = -Infinity;
	function turretsFire() {
		// turrets map: at most 2 in the air and a breather between launches
		const turretsMap = curStage === "turrets";
		if (list.length >= (turretsMap ? 2 : 4)) return;
		if (turretsMap && runTime - lastLaunch < 2.2) return;
		for (const [tower, st] of turrets) {
			if (!tower.Parent) turrets.delete(tower);
			else if (runTime >= st.next) {
				const rel = tower.Position.Z - pos.Z;
				const ahead = rel < -180 && rel > -480;
				const behind = rel > 80 && rel < 260;
				if (Math.abs(tower.Position.X - pos.X) < 300 && (ahead || behind)) {
					st.next = runTime + random(turretsMap ? 55 : 35, turretsMap ? 80 : 55) / 10;
					lastLaunch = runTime;
					Missiles.fire(tower.Position.add(V3(0, tower.Size.Y / 2 + 4, 0)), (ahead ? 150 : 110) * (turretsMap ? 0.85 : 1));
					return;
				}
			}
		}
	}

	Missiles.update = (dt) => {
		if ((curStage === "turrets" || curStage === "sea") && runTime >= (Game.fireAfter || 0) && !Game.flow.cine && !Game.flow.approach) turretsFire();
		layer.Visible = true;
		const vp = camera.ViewportSize;
		const cx = vp.X / 2, cy = vp.Y / 2;
		for (let i = list.length - 1; i >= 0; i--) {
			const m = list[i];
			if (!m.part.Parent) {
				m.hb.Destroy();
				m.arrow.Destroy();
				m.ring.Destroy();
				list.splice(i, 1);
				continue;
			}
			m.rz += m.dir * m.speed * dt;
			if (Math.abs(m.rz) > 70) {
				const want = clamp((pos.X - m.x) * 2, -55, 55);
				m.vx += (want - m.vx) * Math.min(1, dt * 3);
			}
			m.x += m.vx * dt;
			m.y += (pos.Y - m.y) * Math.min(1, dt * 2.5);
			const p = V3(m.x, m.y, pos.Z + m.rz);
			const cf = CFrame.lookAt(p, p.add(V3(m.vx / m.speed, 0, m.dir)));
			m.part.CFrame = cf;
			m.hb.CFrame = cf;
			m.nose.CFrame = cf.mul(CFn(0, 0, -4.5));

			const close = 1 - clamp((Math.abs(m.rz) - 60) / 400, 0, 1);
			const blink = Math.floor(clock() * (4 + close * 14)) % 2 === 0;
			m.nose.Transparency = blink ? 0 : 0.6;

			const passed = (m.dir === 1 && m.rz > 60) || (m.dir === -1 && m.rz < -60);
			if (passed) {
				if (Math.abs(m.x - pos.X) < 30) {
					shake = Math.max(shake, 0.25);
					sfx("missile_pass", 1, 1, clamp((m.x - pos.X) / 40, -0.8, 0.8));
				}
				dropTrail(m);
				blast(p, false);
				drop(m);
				list.splice(i, 1);
			} else {
				const [v, onScreen] = camera.WorldToViewportPoint(p);
				if (onScreen) {
					m.arrow.Visible = false;
					m.ring.Visible = true;
					const size = 10 + close * 8;
					m.ring.Size = UO(size, size);
					m.ring.Position = UO(v.X, v.Y);
				} else {
					m.ring.Visible = false;
					m.arrow.Visible = true;
					let dx = v.X - cx, dy = v.Y - cy;
					if (v.Z < 0) {
						dx = -dx;
						dy = -dy;
					}
					if (Math.abs(dx) + Math.abs(dy) < 1) dy = 1;
					const ang = Math.atan2(dy, dx);
					const c = Math.cos(ang), s = Math.sin(ang);
					const reach = Math.min((cx - 50) / Math.max(Math.abs(c), 1e-3), (cy - 50) / Math.max(Math.abs(s), 1e-3));
					m.arrow.Position = UO(cx + c * reach, cy + s * reach);
					m.arrow.Rotation = deg(ang) + 90;
					m.arrow.TextTransparency = blink ? 0 : 0.5;
					m.arrow.TextSize = 32 + close * 20;
				}
			}
		}
	};
})();

// ------------------------------------------------------------------ guns

(() => {
	const G = Game.guns;
	const targets = Instance.new("Folder");
	targets.Name = "Targets";
	targets.Parent = workspace;
	markQueryRoot(targets);
	G.targets = targets;
	const rayParams = OverlapParams.new();
	rayParams.FilterType = "Include";
	rayParams.FilterDescendantsInstances = [world, targets];
	let bullets = [];
	let cool = 0;

	G.clear = () => {
		for (const b of bullets) b.part.Destroy();
		bullets = [];
	};

	function hitPart(h, at) {
		const dmg = Game.flow.tier >= 3 ? 1.5 : 1;
		if (h.GetAttribute("Missile")) Missiles.kill(h);
		else if (h.GetAttribute("Orb")) {
			// orbs just soak up shots, holding fire won't clear the way
			ball(at, 4, RGB(190, 110, 255), 0.12);
		} else if (h.GetAttribute("Boss2")) Game.boss2.hit(dmg, h);
		else if (h.GetAttribute("Toppled") != null) Game.hitToppled(h, at);
		else if (h.GetAttribute("Glass")) {
			shatter(h, at, 0.6, true, 4);
			fuel = Math.min(FUEL.max, fuel + 12);
			stats.glass++;
			sfx("glass");
		} else if (h.GetAttribute("Break")) {
			const hp = (h.GetAttribute("HP") || 5) - dmg;
			if (hp <= 0) {
				shatter(h, at, 0.8, true, 4);
				stats.kills++;
				sfx("shatter");
			} else {
				h.SetAttribute("HP", hp);
				sfx("hit");
				ball(at, 4, RGB(255, 220, 120), 0.15);
			}
		}
	}

	G.update = (dt, firing) => {
		cool -= dt;
		if (firing && cool <= 0 && fuel > 0) {
			fuel = Math.max(0, fuel - 0.3);
			const big = Game.flow.tier >= 3;
			cool = big ? 0.07 : 0.12;
			for (const ox of big ? [-3.5, 3.5] : [0]) {
				const p = Instance.new("Part");
				p.Anchored = true;
				p.CanCollide = false;
				p.CanQuery = false;
				p.CastShadow = false;
				p.Material = "Neon";
				p.Color = big ? RGB(200, 120, 255) : RGB(255, 230, 120);
				p.Size = V3(0.5, 0.5, 7);
				p.Parent = junk;
				const from = pos.add(V3(ox, 0, -8));
				let target = Game.boss2.aim && Game.boss2.aim();
				if (target && Math.abs(target.X - from.X) > 40) target = null;
				const dir = target ? target.sub(from).Unit : V3(0, 0, -1);
				bullets.push({ part: p, pos: from, dir, life: 1.2 });
			}
			sfx(big ? "gun_plasma" : "gun");
		}
		for (let i = bullets.length - 1; i >= 0; i--) {
			const b = bullets[i];
			b.life -= dt;
			const stepV = b.dir.mul(900 * dt).add(V3(0, 0, -speedNow * dt));
			const hit = workspace.Raycast(b.pos, stepV, rayParams);
			if (hit || b.life <= 0) {
				if (hit) hitPart(hit.Instance, hit.Position);
				b.part.Destroy();
				bullets.splice(i, 1);
			} else {
				b.pos = b.pos.add(stepV);
				b.part.CFrame = CFrame.lookAt(b.pos, b.pos.add(b.dir));
			}
		}
	};
})();

// ------------------------------------------------------------------ boss 2: the gunship

(() => {
	const B = Game.boss2;
	B.active = false;
	let orbs = [];
	let model = null, core = null, shield = null, light = null, hb = null;
	const HP = 60;
	const OPEN_TIME = 3.2;
	const PATTERN_TIME = 5.5;
	const PATTERNS = ["fan", "walls", "aimed"];
	const DARK = RGB(38, 40, 48), MID = RGB(70, 74, 86), HOT = RGB(255, 150, 40);
	const ORB = RGB(190, 90, 255);

	function part(size, color, cf, props) {
		const p = Instance.new("Part");
		if (props) for (const k in props) p[k] = props[k];
		p.Anchored = true;
		p.CanCollide = false;
		p.CanQuery = false;
		p.Size = size;
		p.Color = color;
		p.CFrame = cf;
		p.Parent = model;
		return p;
	}

	function build() {
		model = Instance.new("Model");
		part(V3(34, 12, 70), MID, CFn());
		part(V3(24, 6, 30), DARK, CFn(0, 8, -8));
		part(V3(18, 4, 4), RGB(255, 60, 60), CFn(0, 2, 35.2), { Material: "Neon" });
		for (const side of [-1, 1]) {
			part(V3(58, 3, 26), DARK, CFn(side * 45, 0, 4));
			part(V3(10, 10, 30), MID, CFn(side * 62, -4, 6));
			part(V3(3, 14, 12), DARK, CFn(side * 72, 6, -2));
			part(Vector3.one.mul(2), RGB(255, 40, 40), CFn(side * 74, 0, 16), { Shape: "Ball", Material: "Neon" });
		}
		core = part(Vector3.one.mul(12), HOT, CFn(0, -9, 30), { Shape: "Ball", Material: "Neon", _uniqueMat: true });
		light = Instance.new("PointLight");
		light.Color = HOT;
		light.Range = 40;
		light.Brightness = 2;
		light.Parent = core;
		shield = part(Vector3.one.mul(24), RGB(120, 200, 255), CFn(0, -9, 30), { Shape: "Ball", Material: "ForceField", _uniqueMat: true });
		model.WorldPivot = CFn();
		model.Parent = junk;
	}

	B.reset = () => {
		B.active = false;
		B.done = false;
		for (const o of orbs) o.part.Destroy();
		orbs = [];
		if (model) model.Destroy();
		if (hb) hb.Destroy();
		model = null;
		hb = null;
	};

	B.aim = () => (B.active && core ? core.Position : null);

	function orb(x, rz, ovx, speed) {
		const p = Instance.new("Part");
		p.Shape = "Ball";
		p.Size = Vector3.one.mul(8);
		p.Material = "Neon";
		p.Color = ORB;
		p.Anchored = true;
		p.CanCollide = false;
		p.CastShadow = false;
		p.SetAttribute("Orb", true);
		p.Parent = world;
		orbs.push({ part: p, x, rz, vx: ovx || 0, speed: speed || 150 });
	}

	function setOpen(on) {
		B.open = on;
		TweenService.Create(shield, new TweenInfo(0.3), { Transparency: on ? 1 : 0 }).Play();
		TweenService.Create(core, new TweenInfo(0.3, "Back"), { Size: Vector3.one.mul(on ? 16 : 12) }).Play();
		light.Brightness = on ? 7 : 2;
		if (on) {
			popup("SHOOT!", HOT);
			sfx("shield_down");
		} else sfx("shield", 0.7);
	}

	function startPattern() {
		B.pattern = (B.pattern % PATTERNS.length) + 1;
		B.state = "pattern";
		B.stateT = 0;
		B.emit = 0.4;
		B.phase = Math.random() * 6;
		B.gap = 0;
	}

	B.start = () => {
		if (B.active || B.done) return;
		B.active = true;
		fuel = FUEL.max;
		B.t = 0;
		B.x = pos.X;
		B.hp = HP;
		B.state = "enter";
		B.stateT = 0;
		B.pattern = 0;
		B.open = false;
		Game.arenaX = pos.X;
		Game.mood(17.6, RGB(255, 150, 100), 3);
		build();
		hb = Instance.new("Part");
		hb.Shape = "Ball";
		hb.Size = Vector3.one.mul(30);
		hb.Transparency = 1;
		hb.Anchored = true;
		hb.CanCollide = false;
		hb.SetAttribute("Boss2", true);
		hb.Parent = Game.guns.targets;
		bossFill.Size = US(1, 1);
		bossBar.Visible = true;
		banner("DODGE, THEN SHOOT WHEN THE SHIELD DROPS", HOT, 3);
		sfx("boss2_in");
	};

	function die() {
		B.active = false;
		B.done = true;
		stats.bosses++;
		const at = core.Position;
		flash();
		sfx("boss_down");
		ball(at, 240, new Color3(1, 1, 0.9), 1);
		ball(at, 160, HOT, 1.8);
		smoke(at, 14, 50, 45, 3);
		sparks(at, 50, 2.5, () => RGB(255, 170, 60), 150);
		for (const p of model.GetChildren()) {
			if (p.IsA("BasePart")) {
				p.Anchored = false;
				p.CanCollide = true;
				p.AssemblyLinearVelocity = V3(random(-70, 70), random(10, 90), random(-120, -20));
				p.AssemblyAngularVelocity = V3(random(-8, 8), random(-8, 8), random(-8, 8));
			}
		}
		Debris.AddItem(model, 12);
		model = null;
		hb.Destroy();
		hb = null;
		for (const o of orbs) o.part.Destroy();
		orbs = [];
		bossBar.Visible = false;
		shake = 0.8;
		banner("BOSS DOWN", COIN, 3);
		popup("+" + CONFIG.bossBonus + " ●", COIN);
		Game.marks.sea = (maxRow + 1) * CHUNK + 1200;
		Game.mood(Game.sky.clock, RGB(170, 200, 230), 4);
	}

	B.hit = (dmg, h) => {
		if (!B.active) return;
		if (h == null) B.hp = 0;
		else if (!B.open) {
			ball(core.Position.add(V3(0, 0, 12)), 5, RGB(150, 220, 255), 0.15);
			sfx("shield", 1.4, 0.35);
			return;
		} else {
			B.hp -= dmg;
			sfx("hit", 1.3, 0.7);
			core.Color = new Color3(1, 1, 1);
			task.delay(0.05, () => {
				if (core) core.Color = HOT;
			});
		}
		bossFill.Size = US(Math.max(B.hp, 0) / HP, 1);
		if (B.hp <= 0) die();
	};

	function runPattern(dt, rage) {
		B.emit -= dt;
		if (B.emit > 0) return;
		const kind = PATTERNS[B.pattern - 1];
		const rz = B.zOff + 30;
		if (kind === "fan") {
			B.emit = rage ? 0.3 : 0.38;
			B.phase += 0.16;
			for (let i = -2; i <= 1; i++) {
				const ang = Math.sin(B.phase) * 0.5 + (i + 0.5) * 0.44;
				orb(B.x, rz, Math.sin(ang) * 150, Math.cos(ang) * 150);
			}
			sfx("orb", 1.25);
		} else if (kind === "walls") {
			B.emit = rage ? 0.8 : 1;
			B.gap = clamp(B.gap + random(-70, 70), -160, 160);
			const mid = pos.X + vx * (Math.abs(rz) / 165) * 0.8;
			const gx = mid + B.gap;
			for (let x = mid - 300; x <= mid + 300; x += 26) if (Math.abs(x - gx) > 46) orb(x, rz, 0, 165);
			sfx("orb", 0.8, 1.4);
		} else {
			B.emit = rage ? 0.5 : 0.7;
			const time = Math.abs(rz) / 210;
			const ahead = pos.X + vx * time;
			for (const x of [pos.X, ahead, ahead + vx * time * 0.5]) orb(B.x, rz, (x - B.x) / time, 210);
			sfx("orb", 1.05, 1.2);
		}
	}

	B.update = (dt) => {
		B.t += dt;
		const t = B.t;
		const rage = B.hp <= HP / 3;
		B.zOff = t < 3 ? -900 + 660 * (1 - (1 - t / 3) ** 3) : -240;
		B.x += (pos.X + vx * 0.6 + Math.sin(t * 0.5) * 25 - B.x) * Math.min(1, dt * 2.2);
		const cf = CFn(B.x, 42 + Math.sin(t * 1.4) * 3, pos.Z + B.zOff).mul(Ang(0, 0, Math.sin(t * 0.8) * 0.05));
		model.PivotTo(cf);
		hb.CFrame = CFrame.fromPos(core.Position);
		if (t >= 3) {
			B.stateT += dt;
			if (B.state === "enter") startPattern();
			else if (B.state === "pattern") {
				runPattern(dt, rage);
				if (B.stateT >= PATTERN_TIME) {
					B.state = "open";
					B.stateT = 0;
					setOpen(true);
				}
			} else if (B.state === "open" && B.stateT >= OPEN_TIME) {
				setOpen(false);
				startPattern();
			}
		}
		for (let i = orbs.length - 1; i >= 0; i--) {
			const o = orbs[i];
			o.x += o.vx * dt;
			o.rz += o.speed * dt;
			if (o.rz > 60 || Math.abs(o.x - pos.X) > 450 || !o.part.Parent) {
				if (o.part.Parent) o.part.Destroy();
				orbs.splice(i, 1);
			} else o.part.Position = V3(o.x, pos.Y, pos.Z + o.rz);
		}
	};
})();

// ------------------------------------------------------------------ flow: jet swap after boss 1, carrier landing, launch into space
// in the browser there's no character, so the jump over and the walk on deck happen on their own

(() => {
	const F = Game.flow;
	const DECK = 31;
	const SEA_ALT = 70;

	const ease = (k) => {
		k = clamp(k, 0, 1);
		return k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
	};

	const barTop = make("Frame", { Size: U2(1, 0, 0, 0), BackgroundColor3: BLACK, ZIndex: 40, Parent: gui });
	const barBot = make("Frame", { AnchorPoint: V2(0, 1), Position: US(0, 1), Size: U2(1, 0, 0, 0), BackgroundColor3: BLACK, ZIndex: 40, Parent: gui });
	F.bars = (on) => {
		const h = on ? US(1, 0.11) : US(1, 0);
		tw(barTop, 0.6, { Size: h });
		tw(barBot, 0.6, { Size: h });
	};

	const hint = text(gui, "", UO(700, 30), U2(0.5, -350, 0.86, 0), 26, WHITE);
	hint.TextTransparency = 1;
	hint.TextStrokeTransparency = 1;
	hint.ZIndex = 41;
	function showHint(str) {
		if (str) hint.Text = str;
		tw(hint, 0.4, { TextTransparency: str ? 0 : 1, TextStrokeTransparency: str ? 0.4 : 1 });
	}

	function swap(c) {
		planeModel.Parent = junk;
		c.old = planeModel;
		c.oldMain = planeMain;
		c.oldParts = planeParts;
		c.jet.Parent = workspace;
		planeModel = c.jet;
		planeMain = c.jmain;
		planeParts = c.jparts;
		fuel = FUEL.max;
		Game.fuelFlash = clock();
	}

	function neonPart(size, color, cf, trans) {
		const p = Instance.new("Part");
		p.Anchored = true;
		p.CanCollide = false;
		p.CanQuery = false;
		p.CastShadow = false;
		p.Material = "Neon";
		p._uniqueMat = true;
		p.Size = size;
		p.Color = color;
		p.CFrame = cf;
		p.Transparency = trans || 0;
		p.Parent = junk;
		return p;
	}

	F.reset = () => {
		if (F.cine && F.cine.shell) F.cine.shell.Destroy();
		F.holdCam = false;
		F.approach = false;
		F.bars(false);
		showHint(null);
		F.tier = 1;
		F.cine = null;
		F.cam = null;
		if (F.carrier) F.carrier.model.Destroy();
		F.carrier = null;
		if (F.marker) F.marker.Destroy();
		F.marker = null;
	};

	const chase = (x, p) => CFrame.lookAt(V3(x, p.Y + 10, p.Z + 28), V3(x, p.Y + 2, p.Z - 60));

	F.startTransfer = () => {
		if (F.cine || dead) return;
		Missiles.clear();
		vx = 0;
		const [jet, jmain, jparts] = Game.makePlane("TeamJet", junk);
		jmain.CFrame = CFrame.fromPos(pos.add(V3(60, 14, 140)));
		sfx("jet_arrive");
		F.holdCam = true;
		F.cine = { kind: "transfer", t: 0, jet, jmain, jparts, speed: speedNow, off: V3(19, 0, 0), camX: pos.X };
	};

	function oldPlaneDown(c, k) {
		if (!c.old) return;
		const at = pos.add(V3(-19 - k * 16, -12 * k * k, 8 * k));
		c.oldMain.CFrame = CFrame.fromPos(at).mul(Ang(-0.6 * k, 0, k * 2.4));
		if (Math.random() < 0.6) smoke(at, 1, 2, 4, 0.8);
		if (at.Y <= 5) {
			ball(at, 60, RGB(255, 240, 180), 0.4);
			ball(at, 45, RGB(255, 120, 30), 0.9);
			smoke(at, 6, 12, 16, 1.6);
			sparks(at, 18, 1, () => (Math.random() < 0.5 ? RGB(255, 140, 40) : RGB(40, 40, 40)), 80);
			sfx("plane_down");
			shake = Math.max(shake, 0.4);
			c.old.Destroy();
			c.old = null;
		}
	}

	function doSwap(c) {
		c.swapped = true;
		c.swapT = c.t;
		swap(c);
		pos = pos.add(c.off);
		beyondStart = Game.nextStart();
		shake = Math.max(shake, 0.3);
		sfx("swap");
	}

	function transfer(c, dt) {
		const t = c.t;
		const slow = c.swapped ? 0.4 : 1 - 0.6 * ease(Math.min(t / 2.4, 1));
		speedNow = c.speed * slow;
		const move = V3(0, 0, -speedNow * dt);
		pos = V3(pos.X, pos.Y + (ALT - pos.Y) * Math.min(1, dt * 2), pos.Z).add(move);
		Game.from = (Game.from || 0) + speedNow * dt;

		if (t < 2.4) {
			const e = ease(t / 2.4);
			const off = V3(60, 14, 140).Lerp(c.off, e);
			planeMain.CFrame = CFrame.fromPos(pos);
			c.jmain.CFrame = CFrame.fromPos(pos.add(off)).mul(Ang(0, 0, (1 - e) * 0.5));
			c.camX = pos.X;
			F.cam = chase(c.camX, pos);
			return;
		}

		if (!c.swapped) {
			// side by side for a moment, the camera pans over, then you're in
			const jetCF = CFrame.fromPos(pos.add(c.off).add(V3(0, Math.sin(t * 2 + 1) * 0.3, 0))).mul(Ang(0, 0, Math.sin(t * 1.1 + 2) * 0.02));
			planeMain.CFrame = CFrame.fromPos(pos.add(V3(0, Math.sin(t * 2) * 0.3, 0))).mul(Ang(0, 0, Math.sin(t * 1.3) * 0.02));
			c.jmain.CFrame = jetCF;
			if (!c.ready) {
				c.ready = true;
				showHint("SWITCHING TO THE JET");
			}
			if (t >= 2.9) c.camX += (pos.X + c.off.X - c.camX) * Math.min(1, dt * 4);
			F.cam = chase(c.camX, pos);
			if (t >= 3.6) {
				showHint(null);
				smoke(jetCF.mul(CFn(0, 1.2, -2.5)).Position, 3, 2, 3, 0.6);
				doSwap(c);
			}
			return;
		}

		planeMain.CFrame = CFrame.fromPos(pos);
		c.camX += (pos.X - c.camX) * Math.min(1, dt * 4);
		F.cam = chase(c.camX, pos);
		oldPlaneDown(c, t - c.swapT);
		if (t - c.swapT >= 2) {
			if (c.old) c.old.Destroy();
			F.cine = null;
			F.cam = null;
			F.holdCam = false;
			F.tier = 2;
			Game.spd = 0;
			banner(Game.touch.on ? "FIRE = SHOOT" : Game.keyName("shoot") + " = SHOOT", WHITE, 2.5);
		}
	}

	function boom(at, big) {
		ball(at, big ? 70 : 40, RGB(255, 240, 180), 0.4);
		ball(at, big ? 50 : 30, RGB(255, 120, 30), 0.9);
		smoke(at, 6, 12, 16, 1.6);
		sparks(at, 22, 1, () => (Math.random() < 0.5 ? RGB(255, 140, 40) : RGB(40, 40, 40)), 90);
	}

	// ---------------- end of the sea: a missile takes you out and the camera hands over to the stealth jet climbing next to you

	F.carrierRect = () => null;

	F.startApproach = () => {
		if (F.cine || dead) return;
		Missiles.clear();
		vx = 0;
		F.holdCam = true;
		F.bars(true);
		const c = { kind: "shot", t: 0, speed: Math.max(speedNow, 160) };
		// the stealth jet is already up ahead on the right
		const [jet, jmain, jparts] = Game.makePlane("Stealth", junk);
		c.jet = jet;
		c.jmain = jmain;
		c.jparts = jparts;
		c.jetPos = pos.add(V3(70, 22, -150));
		jmain.CFrame = CFrame.fromPos(c.jetPos);
		// fired from a ship out in front, coming straight at you
		c.mPos = pos.add(V3(-170, -45, -760));
		c.missile = neonPart(V3(1.6, 1.6, 8), RGB(255, 80, 60), CFrame.fromPos(c.mPos), 0);
		F.cine = c;
		sfx("missile_launch", 0.9);
	};

	// kept so nothing else breaks, the whole ending is scripted now
	F.approachUpdate = () => [SEA_ALT, 1];

	// the camera never looks back: behind you the map is already gone
	const chaseCF = (p) => CFrame.lookAt(p.add(V3(-10, 9, 34)), p.add(V3(0, 0, -90)));

	function shot(c, dt) {
		const t = c.t;
		const slow = c.hit ? 0.45 : 1 - 0.45 * ease(t / 1.2);
		const v = c.speed * slow;
		speedNow = v;
		c.jetPos = c.jetPos.add(V3(0, (SEA_ALT + 22 - c.jetPos.Y) * Math.min(1, dt), -v * dt));
		c.jmain.CFrame = CFrame.fromPos(c.jetPos).mul(Ang(0, 0, Math.sin(t * 1.4) * 0.04));
		Game.from = (Game.from || 0) + v * dt;

		if (!c.hit) {
			pos = V3(pos.X, pos.Y + (SEA_ALT - pos.Y) * Math.min(1, dt * 2), pos.Z - v * dt);
			planeMain.CFrame = CFrame.fromPos(pos).mul(Ang(0, 0, Math.sin(t * 1.3) * 0.03));
			const to = pos.sub(c.mPos);
			c.mPos = c.mPos.add(to.Unit.mul(Math.min(to.Magnitude, (v + 420) * dt)));
			c.missile.CFrame = CFrame.lookAt(c.mPos, pos);
			if (Math.random() < 0.9) smoke(c.mPos, 1, 1.5, 2, 0.5);
			F.cam = CFrame.lookAt(pos.add(V3(-22, 7, 30)), pos.add(c.mPos).mul(0.5).add(V3(0, 4, 0)));
			if (!c.warned && to.Magnitude < 260) {
				c.warned = true;
				sfx("missile_pass");
				showHint("INCOMING!");
			}
			if (to.Magnitude < 5 || t > 3) {
				c.hit = true;
				c.hitT = t;
				showHint(null);
				c.missile.Destroy();
				c.missile = null;
				boom(pos, true);
				flash();
				sfx("crash");
				shake = Math.max(shake, 0.9);
				c.old = planeModel;
				c.oldMain = planeMain;
				c.fallPos = pos;
				c.fallV = V3(-12, 14, -v * 0.9);
				c.spin = 0;
				c.camFrom = F.cam;
			}
			return;
		}

		const since = t - c.hitT;
		if (c.old) {
			c.fallV = c.fallV.add(V3(0, -55 * dt, 0));
			c.fallPos = c.fallPos.add(c.fallV.mul(dt));
			c.spin += dt * 5;
			c.oldMain.CFrame = CFrame.fromPos(c.fallPos).mul(Ang(-0.3 - since * 0.35, 0, c.spin));
			if (Math.random() < 0.9) smoke(c.fallPos, 1, 3, 5, 1);
			if (c.fallPos.Y <= 4) {
				boom(c.fallPos);
				sfx("plane_down");
				c.old.Destroy();
				c.old = null;
			}
		}
		pos = since < 1.4 ? V3(c.fallPos.X, pos.Y, c.fallPos.Z) : V3(c.jetPos.X, pos.Y, c.jetPos.Z);

		// high above the wreck so no ship gets in the way, still facing forward
		const fallCam = CFrame.lookAt(V3(c.fallPos.X + 30, Math.max(c.fallPos.Y + 60, 150), c.fallPos.Z + 55), c.fallPos.add(V3(0, 0, -20)));
		const jetCam = chaseCF(c.jetPos);
		if (since < 1.4) F.cam = c.camFrom.Lerp(fallCam, ease(since / 0.5));
		else if (since < 2.8) F.cam = fallCam.Lerp(jetCam, ease((since - 1.4) / 1.4));
		else {
			if (c.old) c.old.Destroy();
			c.old = null;
			c.jet.Parent = workspace;
			planeModel = c.jet;
			planeMain = c.jmain;
			planeParts = c.jparts;
			fuel = FUEL.max;
			Game.fuelFlash = clock();
			pos = c.jetPos;
			sfx("launch", 0.8);
			F.cine = { kind: "launch", t: 2.2, v, pitch: 0 };
			F.cam = jetCam;
		}
	}

	function launch(c, dt) {
		const t = c.t;
		if (t < 2.2) {
			c.v = Math.min(c.v + 150 * dt, 300);
			pos = pos.add(V3(0, 0, -c.v * dt));
			planeMain.CFrame = CFrame.fromPos(pos);
			c.camA = c.camA || V3(pos.X - 24, DECK + 4, pos.Z - 280);
			F.cam = CFrame.lookAt(c.camA, pos).mul(Ang(0, 0, 0.05));
			shake = Math.max(shake, 0.1);
			if (Math.random() < 0.4) smoke(pos.add(V3(0, 0, 6)), 1, 2, 3, 0.6);
		} else {
			if (!c.climbing) {
				c.climbing = true;
				sfx("missile_launch", 0.7);
				sfx("jet_arrive", 0.85);
				task.delay(0.9, () => sfx("launch", 0.8));
			}
			if (t >= 3.4 && !c.boomed) {
				c.boomed = true;
				sfx("reentry_hit", 0.9);
				shake = Math.max(shake, 0.5);
			}
			c.pitch = Math.min((c.pitch || 0) + dt * 0.8, 1.25);
			c.v = Math.min(c.v + 160 * dt, 700);
			const dir = V3(0, Math.sin(c.pitch), -Math.cos(c.pitch));
			pos = pos.add(dir.mul(c.v * dt));
			planeMain.CFrame = CFrame.lookAt(pos, pos.add(dir));
			if (t < 4.8) F.cam = CFrame.lookAt(pos.sub(dir.mul(36)).add(V3(7, -5, 0)), pos.add(dir.mul(40)));
			else {
				c.camC = c.camC || pos.add(V3(-60, -90, 90));
				F.cam = CFrame.lookAt(c.camC, pos);
			}
			if (t >= 3 && !c.spaced) {
				c.spaced = true;
				Game.space();
			}
			if (t >= 7.2 && !c.fading) {
				c.fading = true;
				fade(() => {
					Game.marks.final = (maxRow + 1) * CHUNK;
					pos = V3(pos.X, ALT, -(Game.marks.final + 60));
					planeMain.CFrame = CFrame.fromPos(pos);
					Game.cam.last = null;
					F.cine = null;
					F.cam = null;
					F.tier = 3;
					F.bars(false);
					fuel = FUEL.max;
				});
			}
		}
		speedNow = c.v;
	}

	F.startDescent = () => {
		if (F.cine || dead) return;
		Missiles.clear();
		F.bars(true);
		sfx("reentry_hit");
		banner("RE-ENTRY", COIN, 2);
		F.cine = { kind: "descent", t: 0, v: Math.max(speedNow, 200), pitch: 0 };
	};

	function descent(c, dt) {
		const t = c.t;
		c.pitch = Math.min(c.pitch + dt * 0.6, 1.15);
		c.v = Math.min(c.v + 140 * dt, 650);
		const dir = V3(0, -Math.sin(c.pitch), -Math.cos(c.pitch));
		pos = pos.add(dir.mul(c.v * dt));
		speedNow = c.v;
		planeMain.CFrame = CFrame.lookAt(pos, pos.add(dir)).mul(Ang(0, 0, Math.sin(t * 9) * 0.04 * Math.min(t, 2)));
		if (!c.shell) {
			c.shell = neonPart(Vector3.one.mul(6), RGB(255, 140, 50), CFrame.fromPos(pos), 1);
			c.shell.Shape = "Ball";
			const att = Instance.new("Attachment");
			att.Parent = c.shell;
			const fire = Instance.new("ParticleEmitter");
			fire.Texture = "fire";
			fire.Color = new ColorSequence(RGB(255, 240, 180), RGB(255, 70, 20));
			fire.LightEmission = 1;
			fire.Size = new NumberSequence(5, 0);
			fire.Lifetime = new NumberRange(0.25, 0.45);
			fire.Speed = new NumberRange(20, 40);
			fire.SpreadAngle = V2(25, 25);
			fire.EmissionDirection = "Back";
			fire.Rate = 0;
			fire.Parent = att;
			c.fire = fire;
		}
		const heat = clamp((t - 0.8) / 1.5, 0, 1) * (1 - clamp((t - 4.2) / 1, 0, 1));
		c.shell.CFrame = CFrame.lookAt(pos.add(dir.mul(3)), pos.add(dir.mul(10)));
		c.shell.Size = Vector3.one.mul(8 * (0.6 + heat * 0.8));
		c.shell.Transparency = 1 - heat * 0.55;
		c.fire.Rate = heat * 120;
		shake = Math.max(shake, heat * 0.35);
		if (t >= 1.5 && !c.sky) {
			c.sky = true;
			Game.daySky(3);
		}
		if (t > 2.6 && Math.random() < 0.6) {
			const cl = neonPart(Vector3.one.mul(random(30, 70)), new Color3(1, 1, 1), CFrame.fromPos(pos.add(dir.mul(500)).add(V3(random(-160, 160), random(-100, 100), random(-100, 100)))), 0.55);
			cl.Shape = "Ball";
			cl.Material = "SmoothPlastic";
			Debris.AddItem(cl, 2);
		}
		F.cam = CFrame.lookAt(pos.sub(dir.mul(36)).add(V3(0, 10, 0)), pos.add(dir.mul(30)));
		if (t >= 5.2 && !c.fading) {
			c.fading = true;
			fade(() => {
				if (c.shell) c.shell.Destroy();
				Game.loopAround();
			});
		}
	}

	F.update = (dt) => {
		const c = F.cine;
		c.t += dt;
		if (c.kind === "transfer") transfer(c, dt);
		else if (c.kind === "shot") shot(c, dt);
		else if (c.kind === "launch") launch(c, dt);
		else if (c.kind === "descent") descent(c, dt);
	};
})();

// ------------------------------------------------------------------ first run tips

(() => {
	const box = make("CanvasGroup", {
		AnchorPoint: V2(0.5, 0),
		Position: U2(0.5, 0, 0.26, 0),
		Size: UO(900, 150),
		BackgroundTransparency: 1,
		GroupTransparency: 1,
		Visible: false,
		ZIndex: 30,
		Parent: gui,
	});
	box.el.style.pointerEvents = "none";
	const head = text(box, "", U2(1, 0, 0, 50), null, 44, WHITE);
	head.TextStrokeTransparency = 0.4;
	const row_ = make("Frame", { Position: UO(0, 64), Size: U2(1, 0, 0, 72), BackgroundTransparency: 1, Parent: box });
	make("UIListLayout", { FillDirection: "row", HorizontalAlignment: "center", Padding: UDim.new(0, 14), Parent: row_ });

	const STEPS = [
		{ text: () => Game.keyName("left") + " AND " + Game.keyName("right") + " TO STEER", touch: "LEFT AND RIGHT TO STEER", keys: ["A", "D"] },
		{ text: () => Game.keyName("dashL") + " AND " + Game.keyName("dashR") + " TO ROLL", touch: "« AND » TO ROLL", keys: ["Q", "E"] },
		{ text: () => Game.keyName("nitro") + " FOR BOOST", touch: "NITRO FOR BOOST", keys: ["W"] },
		{ text: "YOU'RE INVINCIBLE WHILE BOOSTING!", hold: 2.6 },
		{ text: "YOU CAN USE IT TO FLY THROUGH DEAD ENDS", hold: 3.2 },
		{ text: "IT USES A LOT OF FUEL!", hold: 2.6 },
	];
	const TOUCH = { A: "LEFT", D: "RIGHT", Q: "«", E: "»", W: "NITRO" };
	const ACT = { A: "left", D: "right", Q: "dashL", E: "dashR", W: "nitro" };

	let show;
	async function nextStep(tut) {
		if (Game.tut !== tut) return;
		tw(box, 0.25, { GroupTransparency: 1 });
		await task.wait(0.3);
		if (Game.tut !== tut) return;
		tut.step++;
		if (tut.step > STEPS.length) {
			Game.tut = null;
			box.Visible = false;
			data.tutDone = true;
			request("tut_done");
			Game.endIntro();
			return;
		}
		show(tut);
	}

	show = (tut) => {
		const st = STEPS[tut.step - 1];
		for (const c of row_.GetChildren()) if (c.IsA("Frame")) c.Destroy();
		tut.caps = {};
		tut.left = 0;
		tut.busy = false;
		let tx = st.text;
		if (typeof tx === "function") tx = tx();
		head.Text = Game.touch.on && st.touch ? st.touch : tx;
		for (const k of st.keys || []) {
			const label = Game.touch.on ? TOUCH[k] : Game.keyName(ACT[k]);
			const cap = make("Frame", { Size: UO(Math.max(72, [...label].length * 24 + 32), 72), BackgroundColor3: BLACK, BackgroundTransparency: 0.35, Parent: row_ });
			const stroke = make("UIStroke", { Color: WHITE, Thickness: 2, Transparency: 0.3, Parent: cap });
			const l = text(cap, label, US(1, 1), null, 40, WHITE);
			tut.caps[k] = { f: cap, stroke, l, sc: make("UIScale", { Parent: cap }) };
			tut.left++;
		}
		box.Visible = true;
		box.GroupTransparency = 1;
		box.Position = U2(0.5, 0, 0.26, 16);
		tw(box, 0.35, { GroupTransparency: 0, Position: U2(0.5, 0, 0.26, 0) });
		sfx("open");
		if (st.hold) {
			const my = tut.step;
			task.delay(st.hold, () => {
				if (Game.tut === tut && tut.step === my) nextStep(tut);
			});
		}
	};

	Game.startTut = () => {
		const tut = { step: 1 };
		Game.tut = tut;
		task.delay(0.8, () => {
			if (Game.tut === tut) show(tut);
		});
	};
	Game.stopTut = () => {
		Game.tut = null;
		box.Visible = false;
	};
	Game.tutPress = (k) => {
		const tut = Game.tut;
		if (!tut || tut.busy || !tut.caps) return;
		const c = tut.caps[k];
		if (!c || c.done) return;
		c.done = true;
		tut.left--;
		tw(c.f, 0.2, { BackgroundColor3: GOOD, BackgroundTransparency: 0.05 });
		c.stroke.Color = GOOD;
		c.l.TextColor3 = BLACK;
		c.sc.Scale = 1.25;
		tw(c.sc, 0.35, { Scale: 1 }, "Back");
		sfx("good", 1.3 + tut.left * 0.15);
		if (tut.left <= 0) {
			tut.busy = true;
			task.delay(0.7, () => nextStep(tut));
		}
	};
})();

// ------------------------------------------------------------------ run

function runCoins() {
	const c = idiv(stats.dist, 10) + stats.maps * CONFIG.mapBonus + stats.bosses * CONFIG.bossBonus + stats.glass * 10 + stats.kills * 5 + (stats.close || 0) * (CONFIG.closeBonus || 15);
	return Math.floor(c * boostMult() * (1 + 0.25 * (data.power.coins || 0)));
}

function collect(p) {
	const m = p.FindFirstAncestorOfClass("Model");
	const kind = m && m.GetAttribute("Kind");
	if (!kind || !m.Parent || m.GetAttribute("Taken")) return;
	Game.pickupFx(m, kind);
	if (kind === "fuel") {
		sfx("pick_fuel");
		const wasEmpty = fuel <= 0;
		fuel = Math.min(FUEL.max, fuel + FUEL.pad);
		Game.fuelFlash = clock();
		if (wasEmpty) popup("SAVED", GOOD);
	} else if (kind === "gem") {
		sfx("pick_gem");
		stats.gems++;
		popup(PAD.gem[1], PAD.gem[0]);
	} else if (kind === "key") {
		sfx("pick_key");
		stats.keys++;
		popup(PAD.key[1], PAD.key[0]);
	} else if (kind === "heart") {
		sfx("pick_heart");
		stats.hearts = (stats.hearts || 0) + 1;
		popup(PAD.heart[1], PAD.heart[0]);
		shake = Math.max(shake, 0.2);
		Game.heartFx();
	}
}

// picking up a heart: gold washes over the screen and a big heart pops out of the middle
Game.heartFx = () => {
	const wash = make("Frame", { Size: US(1, 1), BackgroundColor3: RGB(255, 200, 60), BackgroundTransparency: 0.45, ZIndex: 30, Parent: gui });
	wash.el.style.pointerEvents = "none";
	make("UIGradient", { Transparency: new NumberSequence([NumberSequenceKeypoint.new(0, 0), NumberSequenceKeypoint.new(0.5, 0.85), NumberSequenceKeypoint.new(1, 0)]), Rotation: 90, Parent: wash });
	tw(wash, 0.9, { BackgroundTransparency: 1 });
	Debris.AddItem(wash, 1);
	const h = Icons.make("heart", gui, 120);
	h.AnchorPoint = V2(0.5, 0.5);
	h.Position = US(0.5, 0.45);
	h.ZIndex = 31;
	const sc = make("UIScale", { Scale: 0.2, Parent: h });
	tw(sc, 0.35, { Scale: 1.3 }, "Back");
	task.delay(0.45, () => {
		tw(sc, 0.5, { Scale: 2.2 });
		tw(h, 0.5, { Position: US(0.5, 0.35) });
		for (const d of h.GetDescendants()) if (d.BackgroundTransparency !== undefined) tw(d, 0.5, { BackgroundTransparency: 1 });
	});
	Debris.AddItem(h, 1.1);
	flash();
};

Game.pickupFx = (m, kind) => {
	m.SetAttribute("Taken", true);
	m.Parent = junk;
	pads.delete(m);
	const color = PAD[kind][0];
	const start0 = m.GetPivot().Position;
	const info = new TweenInfo(0.35, "Quad", "Out");
	for (const d of m.GetDescendants()) {
		if (d.IsA("BasePart")) {
			d.CanQuery = false;
			TweenService.Create(d, info, { Size: d.Size.mul(1.7), Transparency: 1 }).Play();
		} else if (d.IsA("PointLight")) {
			d.Brightness = 8;
			TweenService.Create(d, info, { Brightness: 0 }).Play();
		} else if (d.IsA("ParticleEmitter")) d.Enabled = false;
	}
	const t0 = clock();
	const conn = RunService.Heartbeat.Connect(() => {
		const k = Math.min((clock() - t0) / 0.35, 1);
		if (!m.Parent || k >= 1) {
			conn.Disconnect();
			m.Destroy();
			return;
		}
		const e = 1 - (1 - k) ** 3;
		m.PivotTo(CFrame.fromPos(start0.Lerp(pos.add(V3(0, 4, -3)), e).add(V3(0, Math.sin(k * Math.PI) * 5, 0))).mul(Ang(0, k * 12, 0)));
	});

	const ring = Instance.new("Part");
	ring.Shape = "Cylinder";
	ring.Material = "Neon";
	ring.Color = color;
	ring.Transparency = 0.2;
	ring.Anchored = true;
	ring.CanCollide = false;
	ring.CanQuery = false;
	ring.CastShadow = false;
	ring.Size = V3(0.3, 4, 4);
	ring.CFrame = CFrame.fromPos(pos).mul(Ang(0, 0, Math.PI / 2));
	ring.Parent = junk;
	TweenService.Create(ring, new TweenInfo(0.4, "Quint"), { Size: V3(0.3, 26, 26), Transparency: 1 }).Play();
	Debris.AddItem(ring, 0.45);

	const h = Instance.new("Part");
	h.Anchored = true;
	h.CanCollide = false;
	h.CanQuery = false;
	h.Transparency = 1;
	h.Size = Vector3.one;
	h.CFrame = CFrame.fromPos(pos);
	h.Parent = junk;
	const burst = Instance.new("ParticleEmitter");
	burst.Texture = "sparkles";
	burst.Color = new ColorSequence(new Color3(1, 1, 1), color);
	burst.LightEmission = 1;
	burst.Size = new NumberSequence(1.2, 0);
	burst.Lifetime = new NumberRange(0.3, 0.6);
	burst.Speed = new NumberRange(25, 50);
	burst.SpreadAngle = V2(180, 180);
	burst.Drag = 4;
	burst.Rate = 0;
	burst.Parent = h;
	burst.Emit(26);
	Debris.AddItem(h, 1);
	ball(pos, 9, color, 0.25);
};

Game.shiftStages = (at) => {
	Game.shift = at;
	let acc = at;
	for (const st of CONFIG.stages) {
		st.start = acc;
		acc += st.len;
		st.finish = acc;
	}
	BOSS_START = acc;
};

Game.endIntro = () => {
	if (Game.introEnd !== Infinity) return;
	Game.introEnd = Game.nextStart();
	Game.shiftStages(Game.introEnd);
};

function onStage(nw, old) {
	Lighting.GlobalShadows = !settings.low && nw !== "city";
	if (old && Game.achStage) Game.achStage(old, nw);
	if (old && MAP_STAGES[old]) {
		stats.maps++;
		popup("MAP CLEAR  +" + CONFIG.mapBonus + " ●", COIN);
		sfx("map_clear");
	}
	if (nw === "boss") startBoss();
	else if (nw === "boss2" && CONFIG.boss2 === false) {
		// boss 2 is switched off: straight to the runway before the sea
		Game.mood(Game.sky.clock, RGB(170, 200, 230), 4);
	} else if (nw === "boss2") {
		banner(stageName(nw), BAD, 2.5);
		Game.boss2.start();
	} else if (nw === "beyond") {
		banner(stageName(nw), GEM, 2.5);
		Game.space();
	} else {
		if (!Game.tut) {
			banner(stageName(nw), WHITE, 2);
		}
		if (nw === "smash") {
			task.delay(2.2, () => {
				if (curStage === "smash" && !dead) banner("HIT THE GLASS TOWERS!", RGB(255, 90, 70), 3);
			});
		}
		if (nw === "city") Game.mood(0.3, RGB(30, 30, 70), 4, RGB(150, 150, 195), 0.25);
		if (nw === "sea") Game.mood(Game.sky.clock, RGB(170, 200, 230), 3);
	}
}

Game.cityTick = (dt) => {
	for (const [b, f] of Game.fallers) {
		if (!b.Parent) Game.fallers.delete(b);
		else if (f.t == null) {
			f.warn.Transparency = Math.floor(clock() * 4) % 2 === 0 ? 0 : 0.7;
			const ahead = pos.Z - b.Position.Z;
			if (ahead > 500 && ahead < 700 && Math.abs(b.Position.X - pos.X) < 260) {
				f.t = 0;
				f.dir = pos.X >= b.Position.X ? 1 : -1;
				f.base = b.CFrame;
				f.pivot = CFn(b.Position.X + (f.dir * b.Size.X) / 2, 0, b.Position.Z);
				f.offs = new Map();
				for (const c of b.GetChildren()) if (c.IsA("BasePart")) f.offs.set(c, b.CFrame.ToObjectSpace(c.CFrame));
				sfxAt("tower_fall", b.Position, 1500);
				smoke(V3(b.Position.X, 4, b.Position.Z), 5, 20, 20, 2);
			}
		} else if (f.t < 1) {
			f.t = Math.min(f.t + dt / 1.7, 1);
			const a = f.t * f.t * (Math.PI / 2) * -f.dir;
			const rel = f.pivot.ToObjectSpace(f.base);
			const cf = f.pivot.mul(Ang(0, 0, a)).mul(rel);
			b.CFrame = cf;
			for (const [c, off] of f.offs) if (c.Parent) c.CFrame = cf.mul(off);
			if (f.t >= 1) {
				const hit = b.Position;
				shake = Math.max(shake, clamp(1 - hit.sub(pos).Magnitude / 900, 0, 1) * 0.8);
				sfxAt("tower_land", hit, 1800);
				smoke(V3(hit.X, 6, hit.Z), 10, 60, 30, 2.5);
				sparks(V3(hit.X, 6, hit.Z), 12, 2, () => RGB(120, 115, 110), 60);
				Game.fallers.delete(b);
				b.SetAttribute("Toppled", 0);
			}
		}
	}
};

Game.hitToppled = (b, at) => {
	const n = (b.GetAttribute("Toppled") || 0) + 1;
	b.SetAttribute("Toppled", n);
	ball(at, 5, RGB(255, 220, 120), 0.15);
	if (n < 5) {
		sfx("hit", 0.8 + n * 0.1);
		return;
	}
	b.SetAttribute("Toppled", null);
	b.SetAttribute("Break", null);
	b.CanQuery = false;
	stats.kills++;
	const cen = b.CFrame;
	const info = new TweenInfo(0.6, "Back", "In");
	for (const c of b.GetDescendants()) {
		if (c.IsA("BasePart")) {
			c.CanQuery = false;
			TweenService.Create(c, info, { Size: Vector3.one.mul(0.05), CFrame: cen }).Play();
		}
	}
	TweenService.Create(b, info, { Size: Vector3.one.mul(0.05) }).Play();
	sfx("shatter", 0.8);
	task.delay(0.6, () => {
		ball(cen.Position, 36, RGB(0, 220, 255), 0.35);
		ball(cen.Position, 14, new Color3(1, 1, 1), 0.2);
		b.Destroy();
	});
};

Game.alt = () => {
	if (curStage === "sea" || (curStage === "boss2" && Game.boss2.done)) return 70;
	// the rocket just flies a bit higher than everything else
	if (Game.flow.tier === 1 && data.skin === "Rocket") return ALT + 5;
	return ALT;
};

Game.tierPlane = () => {
	const t = Game.flow.tier;
	return t >= 3 ? "Stealth" : t === 2 ? "TeamJet" : data.skin;
};

Game.roll = (dir) => {
	if (roll.cd > 0 || dead || mode !== "run" || Game.flow.cine || Game.hold) return;
	roll.dir = dir;
	roll.t = 0;
	roll.cd = 0.7;
	roll.kick = 1;
	sfx("roll", 1, 1, dir * 0.4);
	if (Game.tut) Game.tutPress(dir < 0 ? "Q" : "E");
};

Game.startAt = (id) => {
	let st = null;
	for (const x of CONFIG.starts) if (x.id === id) st = x;
	if (!st) return;
	const at = st.at;
	Game.safeRow = Math.floor(at / CHUNK);
	if (["turrets", "city", "boss2", "sea", "space"].includes(id)) {
		bossDone = true;
		beyondStart = CONFIG.beyondAt;
		Game.flow.tier = id === "space" ? 3 : 2;
	}
	if (id === "sea" || id === "space") {
		Game.boss2.done = true;
		Game.marks.sea = CONFIG.seaAt;
	}
	if (id === "space") Game.marks.final = at;
	pos = V3(0, id === "sea" ? 70 : ALT, -(at + (id === "space" ? 60 : 5)));
	Game.from = Math.floor(-pos.Z);
	buff.immortal = 3;
};

async function crash(hits) {
	if (dead) return;
	dead = true;
	const inTut = Game.introEnd === Infinity;
	if (!inTut) Game.stopTut();
	setVignette(0);
	Missiles.clear();
	const my = runId;
	const at = pos;
	sfx((Game.DEATHS[data.death] || Game.DEATHS.Default).sfx);
	wreck(vx);
	const blastK = deathEffect(at);
	for (const h of hits) if (h.GetAttribute("Break") && h.Parent) shatter(h, at, blastK);
	for (const t of workspace.GetPartBoundsInRadius(at, BLAST_RADIUS * 0.5 * blastK, params)) {
		if (t.GetAttribute("Break") && t.Parent) shatter(t, at, blastK);
	}
	crater(at);
	bossBar.Visible = false;
	tw(topBox, 0.4, { BackgroundTransparency: 1 });

	await task.wait(inTut ? 1.2 : 2);
	if (runId !== my) return;
	if (inTut) {
		Game.revive(true);
		return;
	}
	if (!Game.race && (await Game.offerRevive(my))) {
		Game.revive();
		return;
	}
	if (runId !== my) return;
	stats.loop = Game.loop;
	stats.raceMult = Game.race ? Game.raceMult || 1 : 1;
	const [ok, award] = request("run_end", stats);
	if (ok) Game.pushProfile();
	if (runId !== my) return;
	showResults(ok && typeof award === "object" ? award : null, {
		stage: stageName(curStage || "towers"),
		time: runTime,
		prevBest: stats.prevBest,
		dist: stats.dist,
		maps: stats.maps,
		bosses: stats.bosses,
		kills: stats.kills,
		glass: stats.glass,
		pads: stats.gems + stats.keys,
	});
}

// ends the run without a crash and hands back what you earned, quitting and winning versus both use it
Game.finishRun = () => {
	dead = true;
	Game.stopTut();
	setVignette(0);
	Missiles.clear();
	if (planeModel) planeModel.Parent = null;
	bossBar.Visible = false;
	tw(topBox, 0.4, { BackgroundTransparency: 1 });
	const my = runId;
	stats.loop = Game.loop;
	stats.raceMult = Game.race ? Game.raceMult || 1 : 1;
	const [ok, award] = request("run_end", stats);
	if (ok) Game.pushProfile();
	return [runId === my, ok && typeof award === "object" ? award : null];
};
Game.quitRun = () => {
	if (mode !== "run" || dead) return;
	const [still, award] = Game.finishRun();
	if (!still) return;
	showResults(award, {
		stage: stageName(curStage || "towers"),
		time: runTime,
		prevBest: stats.prevBest,
		dist: stats.dist,
		maps: stats.maps,
		bosses: stats.bosses,
		kills: stats.kills,
		glass: stats.glass,
		pads: stats.gems + stats.keys,
		stopped: true,
	});
};

Game.revive = (quiet) => {
	dead = false;
	Missiles.clear();
	buildPlane(Game.tierPlane());
	pos = V3(pos.X, Game.alt(), pos.Z);
	vx = 0;
	fuel = FUEL.max;
	nitroK = 0;
	Game.voidT = 0;
	buff.immortal = 4;
	ghost = true;
	stats.revives++;
	Game.fireAfter = runTime + 3;
	topBox.BackgroundTransparency = T.hud;
	bossBar.Visible = boss != null || Game.boss2.active;
	Game.cam.last = null;
	flash();
	sfx("revive");
	if (!quiet) {
		// a 3 2 1 so you're ready before it goes on
		Game.hold = true;
		const my = runId;
		task.spawn(async () => {
			for (let i = 3; i >= 1; i--) {
				if (runId !== my) return;
				banner(String(i), WHITE, 0.8);
				sfx("count", i === 1 ? 1.26 : 1);
				await task.wait(1);
			}
			if (runId !== my) return;
			Game.hold = false;
			buff.immortal = Math.max(buff.immortal, 3);
			banner("GO!", GOOD, 1);
			sfx("go");
		});
	}
};

Game.loopAround = () => {
	if (Game.achLoop) Game.achLoop();
	Game.loop++;
	Game.loopBase += Math.floor(-pos.Z);
	Game.fireAfter = runTime + 5;
	Missiles.clear();
	const tier = Game.flow.tier;
	Game.flow.reset();
	Game.flow.tier = tier;
	Game.boss2.reset();
	Game.guns.clear();
	for (const k in Game.marks) delete Game.marks[k];
	resetSky();
	Game.safeRow = null;
	Game.introEnd = null;
	Game.shiftStages(0);
	boss = null;
	bossDone = false;
	beyondStart = null;
	curStage = null;
	pos = V3(0, ALT, 0);
	vx = 0;
	fuel = FUEL.max;
	nitroK = 0;
	Game.voidT = 0;
	buff.immortal = 3;
	Game.cam.last = null;
	Game.cam.blend = null;
	regenerate(0, 0);
	buildPlane(Game.tierPlane());
	banner("LOOP " + (Game.loop + 1) + ", FASTER", COIN, 3);
	sfx("loop_banner");
};

startRun = (startId) => {
	Game.deaths = {};
	runId++;
	Game.cam.last = null;
	Game.cam.blend = null;
	resetSky();
	Game.flow.reset();
	Game.boss2.reset();
	Game.guns.clear();
	for (const k in Game.marks) delete Game.marks[k];
	closePanels();
	mode = "run";
	dead = false;
	boss = null;
	bossDone = false;
	beyondStart = null;
	curStage = null;
	Game.loop = 0;
	Game.loopBase = 0;
	Game.voidT = 0;
	Game.safeRow = null;
	Game.hold = false;
	Game.spd = null;
	Game.from = 0;
	ghost = false;
	fuel = FUEL.max;
	nitroK = 0;
	roll.t = null;
	roll.cd = 0;
	roll.kick = 0;
	setVignette(0);
	Missiles.clear();
	devK = 0;
	menu.Visible = false;
	results.Visible = false;
	results.GroupTransparency = 1;
	wallet.Visible = false;
	hud.Visible = true;
	topBox.BackgroundTransparency = T.hud;
	bossBar.Visible = false;
	pos = V3(0, ALT, 0);
	vx = 0;
	runTime = 0;
	shake = 0;
	stats = { dist: 0, from: 0, maps: 0, bosses: 0, revives: 0, gems: 0, keys: 0, hearts: 0, glass: 0, kills: 0, close: 0, prevBest: data.best };
	buff.immortal = 0;
	Game.stopTut();
	Game.introEnd = null;
	Game.shiftStages(0);
	if ((startId == null || startId === "towers") && !data.tutDone && !Game.race) {
		Game.introEnd = Infinity;
		Game.startTut();
	}
	Game.startAt(startId);
	Game.fireAfter = 5;
	regenerate(pos.X, pos.Z);
	buildPlane(Game.tierPlane());
	camera.FieldOfView = settings.fov;
};

toMenu = () => {
	runId++;
	Game.race = null;
	Game.cam.last = null;
	Game.cam.blend = null;
	setVignette(0);
	Missiles.clear();
	Game.flow.reset();
	Game.boss2.reset();
	Game.guns.clear();
	for (const k in Game.marks) delete Game.marks[k];
	resetSky();
	closePanels();
	mode = "menu";
	dead = false;
	boss = null;
	bossDone = false;
	beyondStart = null;
	Game.safeRow = null;
	Game.hold = false;
	Game.stopTut();
	Game.introEnd = null;
	Game.shiftStages(0);
	hud.Visible = false;
	results.Visible = false;
	results.GroupTransparency = 1;
	bossBar.Visible = false;
	menu.Visible = true;
	wallet.Visible = true;
	if (planeModel) {
		planeModel.Destroy();
		planeModel = null;
	}
	menuX = 0;
	menuZ = 0;
	Game.menuCam = null;
	runTime = 0;
	regenerate(0);
	updateWalls(false);
	camera.FieldOfView = settings.fov;
	refreshUI();
	animateMenu();
};

function step(dt) {
	if (Game.hold) return;
	runTime += dt;
	for (const k in buff) buff[k] = Math.max(0, buff[k] - dt);
	const dist = -pos.Z;

	const [stage] = stageFor(dist);
	if (stage !== curStage) {
		const old = curStage;
		curStage = stage;
		onStage(stage, old);
	}

	if (Game.flow.cine) {
		Game.flow.update(dt);
		trackChunks(pos.X, pos.Z);
		updateMovers();
		updatePads(pos.Y, pos.Z);
		Game.guns.update(dt, false);
		Missiles.hide();
		setVignette(0);
		stats.dist = Math.max(0, Math.floor(Game.loopBase + Math.floor(-pos.Z) - (Game.from || 0)));
		distL.Text = fmt(stats.dist);
		return;
	}

	if (stage === "sea" && Game.marks.final == null) {
		const F = Game.flow;
		if (!F.cine && dist - Game.marks.sea > Game.SEA_LEN - 500) F.startApproach();
	}

	if (stage === "beyond" && Game.marks.final != null && dist - Game.marks.final > Game.SPACE_LEN) {
		Game.flow.startDescent();
		return;
	}

	let diff = 1;
	if (mode === "run") {
		const shift = Game.shift || 0;
		diff = 1 + clamp((dist - shift) / (BOSS_START - shift), 0, 1) * 0.55;
		if (beyondStart != null) diff += Math.min(Math.max(0, dist - beyondStart) / 40000, 0.3);
		if (Game.marks.final != null) diff += Math.max(0, dist - Game.marks.final) / 40000;
		diff += Game.loop * 0.25;
	}

	const typing = UIS.GetFocusedTextBox() != null;
	const cheat = false;
	const nitro = ((!typing && Game.down("nitro")) || Game.touch.nitro) && fuel > 0 && !boss && !Game.boss2.active && !Game.flow.approach && !typing;
	devK += ((cheat ? 1 : 0) - devK) * Math.min(1, dt * 3);
	nitroK += ((nitro ? 1 : 0) - nitroK) * Math.min(1, dt * (nitro ? 4 : 2));
	speedNow = BASE_SPEED * diff * (Game.flow.tier >= 3 ? 0.75 : 1) * (1 + (FUEL.mult - 1) * nitroK) * (1 + 19 * devK);
	if (Game.spd != null && Game.spd < 1) {
		Game.spd = Math.min(1, Game.spd + dt / 1.6);
		speedNow *= 0.4 + 0.6 * Game.spd;
	}
	const strafe = STRAFE * (0.75 + 0.25 * diff) * (1 + 0.6 * nitroK);

	if (!boss && !Game.boss2.active && !cheat) {
		const before = fuel;
		fuel = Math.max(0, fuel - (FUEL.drain + (nitro ? FUEL.nitro : 0)) * dt * (Game.race && Game.behind ? 2 : 1));
		if (before > 0 && fuel <= 0) {
			sfx("fuel_out");
			popup("OUT OF FUEL", BAD);
		}
	}

	let y = pos.Y;
	let approachY = null, approachK = null;
	if (Game.flow.approach) {
		[approachY, approachK] = Game.flow.approachUpdate();
		if (Game.flow.cine) return;
	}
	if (approachY != null) {
		fuel = Math.max(fuel, 20);
		y += (approachY - y) * Math.min(1, dt * 3);
		speedNow *= approachK;
	} else if (fuel <= 0 && stage !== "beyond") y -= FUEL.sink * dt;
	else y += (Game.alt() - y) * Math.min(1, dt * 2);

	if (stage === "beyond" && fuel <= 0 && !Game.god) {
		const before = Game.voidT;
		Game.voidT += dt;
		if (Math.floor(before * 2) !== Math.floor(Game.voidT * 2)) sfx("alarm", 1.1 + Game.voidT * 0.15, 1.6);
		if (Game.voidT >= 3) {
			task.spawn(crash, []);
			return;
		}
	} else Game.voidT = 0;

	let input = 0;
	if (Game.down("left")) input -= 1;
	if (Game.down("right")) input += 1;
	if (Game.touch.left) input -= 1;
	if (Game.touch.right) input += 1;
	input = clamp(input, -1, 1);
	if (Game.tut) {
		if (input < 0) Game.tutPress("A");
		else if (input > 0) Game.tutPress("D");
		if (nitro) Game.tutPress("W");
	}

	roll.cd = Math.max(0, roll.cd - dt);
	roll.kick = Math.max(0, roll.kick - dt * 2.5);
	let target = input * strafe, spin = 0;
	if (roll.t != null) {
		roll.t += dt;
		const k = Math.min(roll.t / 0.45, 1);
		const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
		spin = -roll.dir * Math.PI * 2 * e;
		if (roll.t < 0.35) target = roll.dir * strafe * 2.3;
		if (k >= 1) roll.t = null;
	}
	vx += (target - vx) * Math.min(1, STEER * dt * (roll.t != null ? 2 : 1));
	pos = V3(pos.X + vx * dt, y, pos.Z - speedNow * dt);
	if (stage === "intro") Game.from = (Game.from || 0) + speedNow * dt;
	const b = bound() - 8;
	const c = center();
	if (Math.abs(pos.X - c) > b) {
		pos = V3(clamp(pos.X, c - b, c + b), pos.Y, pos.Z);
		vx = 0;
	}

	if (stage === "canyon") {
		const [hg, funnel] = canyonHalfGap(-pos.Z);
		if (funnel) {
			const cc = canyonPath(-pos.Z);
			const x = clamp(pos.X, cc - hg + 8, cc + hg - 8);
			if (x !== pos.X) {
				pos = V3(x, pos.Y, pos.Z);
				vx = 0;
			}
		}
	}

	trackChunks(pos.X, pos.Z);
	updateMovers();
	updatePads(pos.Y, pos.Z);
	if (boss) updateBoss(dt);
	if (stage === "city") Game.cityTick(dt);
	if (Game.boss2.active) Game.boss2.update(dt);
	Missiles.update(dt);
	Game.guns.update(dt, Game.flow.tier >= 2 && !typing && (Game.down("shoot") || Game.touch.shoot));
	updateWalls(true);

	planeMain.CFrame = CFrame.fromPos(pos).mul(Ang(fuel <= 0 ? -0.15 : 0, 0, -clamp(vx / strafe, -1, 1) * 0.6 + spin));
	if (nitroK > 0.1) shake = Math.max(shake, 0.1 * nitroK);
	setVignette(Math.max(nitroK, devK) * 0.8);

	for (const p of workspace.GetPartBoundsInBox(CFrame.fromPos(pos), PICKBOX, pickParams)) collect(p);

	const phasing = nitroK > 0.2 || cheat || Game.flow.approach || Game.god;
	if (buff.immortal > 0 || phasing) ghost = true;
	const hits = [];
	// every skin gets the rocket's hitbox: a thin body plus its little fins. same for everyone, big skins aren't worse off
	if (!Game.hitParts) {
		Game.hitParts = [
			[CFn(0, 0, -0.5), V3(2, 2, 11)],
			[CFn(0, 0, 4), V3(5, 0.3, 2)],
			[CFn(0, 0, 4), V3(0.3, 5, 2)],
		].map(([off, size]) => ({ off, size }));
	}
	const touched = new Set();
	for (const e of Game.hitParts) {
		if (e.part && !e.part.Parent) continue;
		const cf = e.part ? e.part.CFrame : planeMain.CFrame.mul(e.off);
		for (const h of workspace.GetPartBoundsInBox(cf, e.size, params)) touched.add(h);
	}
	for (const h of touched) {
		if (h.GetAttribute("Glass")) {
			if (h.Parent) {
				const wasEmpty = fuel <= 0;
				shatter(h, pos.add(V3(0, 0, 8)), 0.8, true, 4);
				fuel = Math.min(FUEL.max, fuel + 12);
				stats.glass++;
				shake = Math.max(shake, 0.35);
				sfx("glass");
				popup(wasEmpty ? "SAVED" : "+FUEL   +10 ●", wasEmpty ? GOOD : RGB(255, 90, 70));
				if (wasEmpty && Game.ach) Game.ach("saved");
				Game.fuelFlash = clock();
			}
		} else if (!(h.GetAttribute("Floor") && fuel > 0)) hits.push(h);
	}

	if (hits.length === 0 && !phasing && buff.immortal <= 0 && curStage !== "canyon" && clock() > (Game.nearT || 0)) {
		for (const h of workspace.GetPartBoundsInBox(CFrame.fromPos(pos), V3(24, 8, 6), params)) {
			if (!h.GetAttribute("Floor") && !h.GetAttribute("Glass")) {
				Game.nearT = clock() + 1.2;
				stats.close = (stats.close || 0) + 1;
				popup("CLOSE!  +" + (CONFIG.closeBonus || 15) + " ●", WHITE);
				sfx("near", 1, 1, clamp((h.Position.X - pos.X) / 20, -0.7, 0.7));
				shake = Math.max(shake, 0.12);
				break;
			}
		}
	}

	if (fuel <= 0 && pos.Y <= 4 && !Game.god) {
		task.spawn(crash, hits);
		return;
	}

	if (hits.length > 0) {
		if (phasing) {
			// nitro just phases through
		} else if (ghost) {
			for (const h of hits) {
				if (h.GetAttribute("Break") && h.Parent) {
					sfx("shatter");
					shatter(h, pos.add(V3(0, 0, 6)), 0.6);
					shake = Math.max(shake, 0.25);
				}
			}
		} else {
			task.spawn(crash, hits);
			return;
		}
	} else if (buff.immortal <= 0 && !phasing) ghost = false;

	const flick = ghost && !phasing && Math.floor(clock() * 12) % 2 === 0 ? 0.6 : 0;
	for (const p of planeParts) if (p.LocalTransparencyModifier !== flick) p.LocalTransparencyModifier = flick;

	stats.dist = Math.max(0, Math.floor(Game.loopBase + Math.floor(-pos.Z) - (Game.from || 0)));

	distL.Text = fmt(stats.dist);
	stageL.Text = stageName(stage);
	let [, prog] = stageFor(dist);
	const inSpace = stage === "beyond" && Game.marks.final != null;
	if (inSpace) prog = (dist - Game.marks.final) / Game.SPACE_LEN;
	const onMap = (MAP_STAGES[stage] || inSpace) && !boss && !Game.boss2.active && !Game.flow.cine;
	Game.mapBar.Visible = !!onMap;
	if (onMap) {
		prog = clamp(prog || 0, 0, 1);
		Game.mapFill.Size = US(prog, 1);
		Game.mapPct.Text = Math.floor(prog * 100) + "%";
	}
	coinBox.Visible = mode === "run";
	runCoinL.Text = "● " + fmt(runCoins());
	Game.fuelTick();

	const fx = [];
	if (nitroK > 0.2) fx.push("NITRO");
	if (fuel <= 0) fx.push(stage === "beyond" ? "NO FUEL, BOOM IN " + Math.max(0, 3 - Game.voidT).toFixed(1) : "OUT OF FUEL");
	if (buff.immortal > 0) fx.push("IMMORTAL " + buff.immortal.toFixed(1));
	effectL.Text = fx.join("     ");
	effectL.TextColor3 = fuel <= 0 || (Game.race && Game.behind) ? BAD : COIN;
}

// dev only (?dev in the url): L skips ahead, O toggles god mode
Game.skip = () => {
	const F = Game.flow;
	if (F.cine) return;
	if (boss) {
		Game.skipBoss();
		return;
	}
	if (Game.boss2.active) {
		Game.boss2.hit(1e6);
		return;
	}
	const [stage] = stageFor(-pos.Z);
	let nextD = null;
	if (stage === "intro") {
		Game.stopTut();
		Game.endIntro();
		nextD = Game.introEnd;
	} else if (STAGE_BY_ID[stage]) nextD = STAGE_BY_ID[stage].finish;
	else if (stage === "turrets") nextD = beyondStart + (CONFIG.turretsLen || 4000);
	else if (stage === "city") nextD = beyondStart + (CONFIG.turretsLen || 4000) + (CONFIG.cityLen || 4000);
	else if (stage === "sea") {
		flash();
		Missiles.clear();
		Game.cam.last = null;
		pos = V3(pos.X, 70, -(Game.marks.sea + Game.SEA_LEN - 520));
		return;
	} else if (stage === "boss2" && Game.boss2.done && Game.marks.sea != null) nextD = Game.marks.sea;
	else if (stage === "beyond") {
		F.startDescent();
		return;
	}
	if (nextD == null) return;
	flash();
	Missiles.clear();
	Game.cam.last = null;
	pos = V3(pos.X, Game.alt(), -(nextD + 5));
	buff.immortal = Math.max(buff.immortal, 2);
	fuel = FUEL.max;
};
const DEV = /[?&]dev\b/.test(location.search);

UIS.InputBegan.Connect((input, gp) => {
	if (gp || dead || mode !== "run" || UIS.GetFocusedTextBox()) return;
	if (Game.isBind("dashL", input)) Game.roll(-1);
	else if (Game.isBind("dashR", input)) Game.roll(1);
	if (DEV && input.KeyCode === "O") {
		Game.god = !Game.god;
		popup(Game.god ? "GOD ON" : "GOD OFF", COIN);
	}
	if (DEV && input.KeyCode === "L") Game.skip();
});

RunService.RenderStepped.Connect((dt) => {
	dt = Math.min(dt, 0.05);
	const TC = Game.touch;
	TC.ui.Visible = TC.on && mode === "run" && !dead && !Game.flow.cine;
	TC.fireBtn.Visible = Game.flow.tier >= 2;

	if (wallet.Visible) {
		const k = Math.min(1, dt * 8);
		for (const [name, label] of [["coins", coinL], ["gems", gemL], ["keys", keyL]]) {
			const want = data[name] - pending[name];
			shown[name] += (want - shown[name]) * k;
			if (Math.abs(want - shown[name]) < 0.5) shown[name] = want;
		}
		coinL.Text = "● " + fmt(shown.coins + 0.5);
		gemL.Text = "◆ " + fmt(shown.gems + 0.5);
		keyL.Text = "✦ " + fmt(shown.keys + 0.5);
	}

	if (mode === "menu") {
		runTime += dt;
		menuZ -= 45 * dt;
		let mc = Game.menuCam;
		if (!mc) {
			mc = { x: menuX, tx: menuX, y: 75, ty: 75, scan: 0, vx: 0, vy: 0, lookX: menuX };
			Game.menuCam = mc;
		}
		mc.scan -= dt;
		if (mc.scan <= 0) {
			mc.scan = 0.5;
			let found = null;
			outer: for (let i = 0; i <= 14; i++) {
				for (const sgn of i === 0 ? [1] : [1, -1]) {
					let x = mc.tx + sgn * i * 18;
					x -= sign(x) * Math.min(Math.abs(x), 6);
					if (Math.abs(x) < 520 && workspace.GetPartBoundsInBox(CFn(x, 78, menuZ - 70), V3(34, 40, 260), params).length === 0) {
						found = x;
						break outer;
					}
				}
			}
			if (found != null) {
				mc.tx = found;
				mc.ty = 75;
			} else mc.ty = 150;
		}
		mc.vx += ((mc.tx - mc.x) * 1.2 - mc.vx * 2.2) * dt;
		mc.vy += ((mc.ty - mc.y) * 1.0 - mc.vy * 2.0) * dt;
		mc.vx = clamp(mc.vx, -20, 20);
		mc.vy = clamp(mc.vy, -16, 16);
		mc.x += mc.vx * dt;
		mc.y += mc.vy * dt;
		mc.lookX += (mc.x - mc.lookX) * Math.min(1, dt * 0.6);
		menuX = mc.x;
		updateMovers();
		updatePads(ALT, menuZ);
		trackChunks(menuX, menuZ);
		if (-menuZ > BOSS_START - 400) {
			menuZ = 0;
			regenerate(menuX);
		}
		camera.CFrame = CFrame.lookAt(V3(menuX, mc.y, menuZ + 40), V3(mc.lookX + Math.sin(clock() * 0.25) * 25, 25, menuZ - 250));
		return;
	}

	if (!dead) step(dt);

	let cam;
	if (dead) cam = (Game.specCam && Game.specCam()) || CFrame.lookAt(pos.add(V3(0, 35, 80)), pos.add(V3(0, 15, -20)));
	else if (Game.flow.cam) {
		cam = Game.flow.cam;
		camera.FieldOfView += (settings.fov - camera.FieldOfView) * Math.min(1, dt * 3);
	} else {
		cam = CFrame.lookAt(pos.add(V3(0, 10, 28)), pos.add(V3(0, 2, -60)));
		const target = Math.min(120, settings.fov + clamp((speedNow / BASE_SPEED - 1) * 14, -10, 12) + nitroK * 30 + devK * 20 + Math.sin(roll.kick * Math.PI) * 14);
		camera.FieldOfView += (target - camera.FieldOfView) * Math.min(1, dt * 4);
	}
	const C = Game.cam;
	if (C.last && cam.Position.sub(C.last.Position).Magnitude > 8 + speedNow * dt * 3) {
		C.blend = { rel: CFrame.fromPos(pos).ToObjectSpace(camera.CFrame), t: 0 };
	}
	C.last = cam;
	if (C.blend) {
		C.blend.t += dt / 0.8;
		let k = Math.min(C.blend.t, 1);
		k = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
		cam = CFrame.fromPos(pos).mul(C.blend.rel).Lerp(cam, k);
		if (C.blend.t >= 1) C.blend = null;
	}
	if (shake > 0) {
		shake -= dt;
		const m = settings.shake === false ? 0 : shake * 0.1;
		cam = cam.mul(Ang((random(-100, 100) / 100) * m, (random(-100, 100) / 100) * m, 0));
	}
	camera.CFrame = cam;
});

task.spawn(async () => {
	while (true) {
		await task.wait(1);
		if (mode === "menu") updateRewards();
	}
});

// ------------------------------------------------------------------ pause

(() => {
	const pp = make("CanvasGroup", {
		AnchorPoint: V2(0.5, 0.5),
		Position: US(0.5, 0.5),
		Size: UO(420, 300),
		BackgroundColor3: BLACK,
		BackgroundTransparency: T.panel,
		Visible: false,
		ZIndex: 30,
		Parent: gui,
	});
	text(pp, "PAUSED", U2(1, 0, 0, 70), UO(0, 16), 56, WHITE);
	button(pp, "RESUME", UO(320, 58), U2(0.5, -160, 0, 104), () => Game.setPause(false), 0.1);
	const pauseCode = text(pp, "", U2(1, 0, 0, 18), U2(0, 0, 1, -26), 14, DIM);
	pauseCode.TextTransparency = 0.5;
	Game.codeSpot(pauseCode, () => pp.Visible, (c) => "CODE: " + c, 0.05);
	button(pp, "END RUN", UO(320, 58), U2(0.5, -160, 0, 172), () => {
		Game.setPause(false);
		Game.quitRun();
	});
	const pHint = text(pp, "P TO RESUME, YOU KEEP WHAT YOU EARNED IF YOU END IT", U2(1, -20, 0, 24), UO(10, 250), 16, DIM);

	const pauseBtn = button(hud, "II", UO(50, 50), U2(1, -66, 0, 74), () => Game.setPause(true));
	pauseBtn.TextSize = 24;
	pauseBtn.el.style.pointerEvents = "auto";

	const canPause = () => mode === "run" && !dead && !Game.flow.cine && !Game.hold && !Game.race;

	Game.setPause = (on) => {
		if (on) {
			if (Game.paused || !canPause()) return;
			Game.paused = true;
			Game.hold = true;
			pp.Visible = true;
			pp.GroupTransparency = 1;
			tw(pp, 0.2, { GroupTransparency: 0 });
			pHint.Text = Game.keyName("pause") + " TO RESUME, YOU KEEP WHAT YOU EARNED IF YOU END IT";
			pHint.Visible = !Game.touch.on;
			sfx("open");
		} else {
			if (!Game.paused) return;
			Game.paused = false;
			Game.hold = false;
			pp.Visible = false;
			sfx("close");
		}
	};

	UIS.InputBegan.Connect((input, gp) => {
		if (gp || UIS.GetFocusedTextBox()) return;
		if (Game.rebinding) return;
		if (Game.isBind("pause", input)) {
			if (Game.paused) Game.setPause(false);
			else Game.setPause(true);
		} else if (input.KeyCode === "Escape" && Game.paused) {
			Game.setPause(false);
		} else if (input.KeyCode === "Return" && mode === "menu" && !overlay.Visible) {
			Game.go("towers");
		} else if (input.KeyCode === "R" && mode === "run" && dead && results.Visible) {
			Game.retry();
		}
	});

	UIS.WindowFocusReleased.Connect(() => Game.setPause(true));
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) Game.setPause(true);
	});

	RunService.Heartbeat.Connect(() => {
		pauseBtn.Visible = canPause() || Game.paused === true;
		if (Game.paused && (mode !== "run" || dead)) {
			Game.paused = false;
			Game.hold = false;
			pp.Visible = false;
		}
	});
})();

// ------------------------------------------------------------------ engine, wind, nitro and all the other layers

(() => {
	const L = {};
	for (const n of LOOPS) L[n] = loopSound(n);
	let nitroOn = false, alarmT = 0;
	RunService.RenderStepped.Connect((dt) => {
		const run = mode === "run" && !dead;
		const pause = Game.paused ? 0.2 : 1;
		const F = Game.flow;
		const c = F.cine;
		const spd = clamp(speedNow / BASE_SPEED, 0, 8);
		const jet = F.tier >= 2 || (c && c.kind === "launch");
		// the engine coughs when the tank is empty
		const eng = run ? (fuel > 0 || curStage === "beyond" ? 0.16 : 0.06 + 0.06 * Math.abs(Math.sin(clock() * 9))) : 0;
		const rate = 0.85 + Math.min(spd, 3) * 0.12 + nitroK * 0.25;
		L.loop_prop.set(!jet ? eng * pause : 0, rate, fuel > 0 ? 14000 : 2200);
		L.loop_jet.set(jet ? eng * pause * 0.9 : 0, rate * 0.95, fuel > 0 ? 16000 : 2500);
		L.loop_wind.set(run ? (0.04 + Math.min(spd, 4) * 0.02 + nitroK * 0.14) * pause : 0, 0.9 + nitroK * 0.35, 2500 + nitroK * 10000);
		L.loop_nitro.set(run ? nitroK * 0.2 * pause : 0, 0.9 + nitroK * 0.2);
		L.loop_space.set(mode === "run" && curStage === "beyond" && !(c && c.kind === "descent") ? 0.18 * pause : 0, 1, 20000, 1.2);
		const heat = c && c.kind === "descent" && c.shell ? clamp((1 - c.shell.Transparency) / 0.55, 0, 1) : 0;
		L.loop_reentry.set(run ? heat * 0.35 : 0, 0.85 + heat * 0.25);
		let bv = 0;
		if (run && boss && !boss.finale) bv = clamp(1 - boss.p.sub(pos).Magnitude / 800, 0, 1) * 0.22;
		if (run && boss && boss.finale) bv = 0.22;
		if (run && Game.boss2.active) bv = 0.12;
		L.loop_boss.set(bv * pause, Game.boss2.active ? 1.3 : boss && boss.finale ? 1.25 : 1);
		// kicking in the nitro
		if (!nitroOn && run && nitroK > 0.3) {
			nitroOn = true;
			sfx("nitro_on");
		} else if (nitroOn && (!run || nitroK < 0.1)) nitroOn = false;
		// low fuel beeps, faster the emptier
		if (run && !c && !Game.hold && fuel > 0 && fuel < 15 && !boss && !Game.boss2.active) {
			alarmT -= dt;
			if (alarmT <= 0) {
				alarmT = fuel < 7 ? 1.2 : 2.2;
				sfx("alarm", fuel < 7 ? 1.12 : 1);
			}
		} else alarmT = 0;
	});
})();

// the skin showcase turns slowly
RunService.RenderStepped.Connect(() => {
	const t = clock();
	for (const s of Game.spinning) {
		if (!s.model.Parent) continue;
		const k = t * s.speed + s.off;
		s.model.PivotTo(Ang(0, k, 0).mul(Ang(Math.sin(k * 1.4) * 0.08, 0, Math.sin(k) * 0.15)));
	}
});

Lighting.FogColor = RGB(190, 205, 225);
// sea waves: three layers of swells rolling toward you at different speeds, near ones fast and bright, far ones slow and dark
(() => {
	const folder = Instance.new("Folder");
	folder.Name = "Waves";
	folder.Parent = workspace;
	const LAYERS = [
		{ n: 55, len: [18, 46], w: [1, 2.2], y: 3.3, bob: 0.35, speed: 38, alpha: 0.3, color: RGB(235, 248, 255), spread: 260, near: 40, far: 650 },
		{ n: 34, len: [6, 11], w: [70, 150], y: 2.9, bob: 0.5, speed: 16, alpha: 0.72, color: RGB(110, 185, 235), spread: 520, near: 120, far: 1100 },
		{ n: 22, len: [16, 30], w: [260, 480], y: 2.7, bob: 0.7, speed: 6, alpha: 0.78, color: RGB(35, 95, 165), spread: 950, near: 450, far: 1900 },
	];
	const rnd = (a, b) => a + Math.random() * (b - a);
	const waves = [];
	for (const L of LAYERS) {
		for (let i = 0; i < L.n; i++) {
			const p = Instance.new("Part");
			p.Anchored = true;
			p.CanCollide = false;
			p.CanQuery = false;
			p.CastShadow = false;
			p.Material = "SmoothPlastic";
			p.Color = L.color;
			p.Transparency = 1;
			p._uniqueMat = true;
			p.Size = V3(rnd(L.w[0], L.w[1]), 0.3, rnd(L.len[0], L.len[1]));
			p.Parent = folder;
			waves.push({ p, L, x: 0, z: 0, phase: Math.random() * 6.28, life: 0, span: 1 });
		}
	}
	let shown = false;
	const place = (w, fresh) => {
		const L = w.L;
		w.x = pos.X + (Math.random() * 2 - 1) * L.spread;
		w.z = pos.Z - (fresh ? L.near + Math.random() * (L.far - L.near) : L.far + Math.random() * 150);
		w.life = 0;
		w.span = 3 + Math.random() * 5;
	};
	RunService.RenderStepped.Connect((dt) => {
		const c = Game.flow.cine;
		const want = mode === "run" && (curStage === "sea" || (c && (c.kind === "shot" || (c.kind === "launch" && c.t < 4))));
		if (!want) {
			if (shown) {
				shown = false;
				for (const w of waves) w.p.Transparency = 1;
			}
			return;
		}
		const fresh = !shown;
		shown = true;
		const t = clock();
		for (const w of waves) {
			const L = w.L;
			if (fresh) place(w, true);
			w.z += L.speed * dt;
			w.life += dt;
			if (w.z > pos.Z + 60 || w.z < pos.Z - L.far - 300 || Math.abs(w.x - pos.X) > L.spread * 1.3 || w.life > w.span) place(w, false);
			const k = clamp(Math.min(w.life / 0.8, (w.span - w.life) / 0.8), 0, 1);
			w.p.Transparency = 1 - (1 - L.alpha) * k;
			w.p.CFrame = CFn(w.x, L.y + Math.sin(t * 1.6 + w.phase) * L.bob, w.z).mul(CFrame.Angles(0, Math.sin(t * 0.3 + w.phase) * 0.06, 0));
		}
	});
})();

applySettings();
toMenu();
start();
document.getElementById("boot").remove();
if (DEV) window.__dev = { crash: () => task.spawn(crash, []), data: () => data, stats: () => stats, vs: () => Game.versusToggle(), heart: () => Game.heartFx(), pad: (k) => Game.makePad(k, pos.X, pos.Z - 45, pickups), reg: async (n, p) => { await Online.register(n, p); request("set_name", n); return Online.account(); }, win: () => Game._vsWin(), vsd: () => Game._vsDebug(), dbg: () => [mode, dead, !!stats, !!planeMain, planeMain && !!planeMain.Parent, Game.raceState.mid], race: () => [Game.race, Game.raceState.inQueue, Game.queueText(), JSON.stringify(Game.raceState.final)], shot: () => Game.flow.startApproach(), uid: () => Online.myId(), gems: () => { Game.openShop(); shopTab = "GEMS"; rebuildShop(); }, run: (id) => startRun(id || "towers"), skip: () => Game.skip(), ahead: () => { const r = Math.floor(-pos.Z / CHUNK); return [r, beyondStart, stageFor(-pos.Z)[0], stageFor((r + 5) * CHUNK + 1)[0], stageFor((r + 40) * CHUNK + 1)[0]]; }, state: () => [mode, curStage, Game.flow.cine && Game.flow.cine.kind, Math.round(-pos.Z)] };

// ------------------------------------------------------------------ versus
// same idea as roblox: queue up, everyone starts on the same map, farthest wins.
// no game server here, so firebase is the go-between: the queue, the match and everyone's live position
// all sit in the database and every player streams them

(() => {
	const RACE_WAIT = 10000;
	const STALE = 10000;
	const R = { lobby: {}, matches: {}, inQueue: false, live: {}, crashed: {}, won: {}, runners: null, final: null, lead: 0 };
	Game.raceState = R;
	Game.raceMult = 1;
	let stopLobby = null, stopMatches = null, stopLive = null, beatT = null;
	let joined = 0;

	const me = () => Online.myId();
	const fresh = () => {
		const now = Online.serverNow();
		const list = [];
		for (const id in R.lobby) {
			const e = R.lobby[id];
			if (e && typeof e.at === "number" && now - e.at < STALE) list.push({ id, name: String(e.name || "?"), joined: e.joined || e.at });
		}
		list.sort((a, b) => a.joined - b.joined || (a.id < b.id ? -1 : 1));
		return list;
	};
	// the match you're in that hasn't started yet
	function pending() {
		const now = Online.serverNow();
		let best = null;
		for (const mid in R.matches) {
			const m = R.matches[mid];
			if (!m || !m.runners || !m.runners[me()] || typeof m.startAt !== "number") continue;
			if (m.startAt < now - 3000) continue;
			if (!best || m.startAt < best.m.startAt) best = { mid, m };
		}
		return best;
	}

	// ---------------- other planes
	const ghosts = new Map();
	const tags = make("Frame", { Size: US(1, 1), BackgroundTransparency: 1, ZIndex: 2, Parent: gui });
	tags.el.style.pointerEvents = "none";
	function dropGhost(id) {
		const g = ghosts.get(id);
		if (!g) return;
		g.model.Destroy();
		g.tag.Destroy();
		ghosts.delete(id);
	}
	function makeGhost(id, skin) {
		dropGhost(id);
		const [model, main, parts] = Game.makePlane(skin, null, true);
		for (const p of parts) {
			p.Transparency = Math.max(p.Transparency, 0.55);
			p.CastShadow = false;
		}
		model.Parent = null;
		const name = (R.runners && R.runners[id]) || "?";
		const tag = text(tags, String(name).toUpperCase(), UO(220, 26), UO(0, 0), 18, WHITE);
		tag.AnchorPoint = V2(0.5, 1);
		tag.TextStrokeTransparency = 0.4;
		tag.Visible = false;
		const g = { model, main, skin, at: 0, vel: Vector3.zero, pos: null, tag };
		ghosts.set(id, g);
		return g;
	}
	function ghostBoom(at) {
		const b = Instance.new("Part");
		b.Shape = "Ball";
		b.Material = "Neon";
		b.Color = RGB(255, 130, 40);
		b.Size = Vector3.one.mul(4);
		b.Anchored = true;
		b.CanCollide = false;
		b.CanQuery = false;
		b.CastShadow = false;
		b.Position = at;
		b._uniqueMat = true;
		b.Parent = junk;
		tw(b, 0.7, { Size: Vector3.one.mul(45), Transparency: 1 });
		Debris.AddItem(b, 0.8);
	}

	// ---------------- live positions of the match
	function onLive(all) {
		if (!Game.race || !all) return;
		const now = clock();
		for (const id in all) {
			if (id === me()) continue;
			const v = all[id];
			if (!v) continue;
			if (v.dead) {
				if (v.won) R.won[id] = true;
				if (R.crashed[id] == null) {
					R.crashed[id] = v.d || R.live[id] || 0;
					const g = ghosts.get(id);
					if (g && g.model.Parent) ghostBoom(g.main.Position);
					const name = R.runners && R.runners[id];

					dropGhost(id);
					checkOver();
				}
				continue;
			}
			let g = ghosts.get(id);
			if (!g || g.skin !== v.s) g = makeGhost(id, v.s || "Default");
			const p = V3(v.x, v.y, v.z);
			if (g.pos && g.loop === v.l && now - g.at < 0.6) g.vel = p.sub(g.pos).mul(1 / Math.max(now - g.at, 0.03));
			else g.vel = Vector3.zero;
			g.pos = p;
			g.rot = CFrame.fromEulerAnglesXYZ(v.rx || 0, v.ry || 0, v.rz || 0);
			g.at = now;
			g.seen = Online.serverNow();
			g.loop = v.l || 0;
			R.live[id] = v.d || 0;
		}
	}

	// ---------------- start, finish
	function go(mid, m) {
		leaveQueue(true);
		R.runners = m.runners;
		R.mid = mid;
		R.final = null;
		R.crashed = {};
		R.live = {};
		R.lead = 0;
		R.started = Online.serverNow();
		R.prized = false;
		R.winning = false;
		R.won = {};
		hideBoard();
		Game.raceMult = 1;
		for (const id of [...ghosts.keys()]) dropGhost(id);
		spec.id = null;
		specBar.Visible = false;
		Game.closeStrip();
		closePanels();
		request("run_start", "towers");
		Game.race = { seed: m.seed, mid };
		fade(() => {
			Game.lastStart = "towers";
			startRun("towers");
			Game.hold = true;
			const my = runId;
			vsSplash(m.runners);
			(async () => {
				for (let i = 3; i >= 1; i--) {
					if (runId !== my) return;
					banner(String(i), WHITE, 0.8);
					sfx("hover", 0.7 + (3 - i) * 0.2);
					await task.wait(1);
				}
				if (runId !== my) return;
				Game.hold = false;
				banner("GO!", GOOD, 1);
				sfx("good");
				hideSplash();
			})();
		});
		if (stopLive) stopLive();
		stopLive = Online.listen(`matches/${mid}/live`, onLive);
	}

	// ---------------- the splash before the start: everyone's name, big VS in between
	const splash = make("CanvasGroup", { AnchorPoint: V2(0.5, 0.5), Position: US(0.5, 0.62), Size: UO(900, 170), BackgroundTransparency: 1, GroupTransparency: 1, Visible: false, ZIndex: 35, Parent: gui });
	function vsSplash(runners) {
		for (const c of splash.GetChildren()) c.Destroy();
		const ids = Object.keys(runners || {});
		const lay = make("Frame", { Size: US(1, 1), BackgroundTransparency: 1, Parent: splash });
		make("UIListLayout", { FillDirection: "row", HorizontalAlignment: "Center", VerticalAlignment: "Center", Padding: UDim.new(0, 14), SortOrder: "LayoutOrder", Parent: lay });
		ids.forEach((id, i) => {
			if (i > 0) {
				const v = text(lay, "VS", UO(60, 60), null, 40, BAD);
				v.LayoutOrder = i * 2 - 1;
				v.TextStrokeTransparency = 0.3;
			}
			const card = make("Frame", { Size: UO(150, 150), BackgroundColor3: BLACK, BackgroundTransparency: 0.35, LayoutOrder: i * 2, Parent: lay });
			make("UICorner", { CornerRadius: UDim.new(0, 14), Parent: card });
			const mine = id === me();
			make("UIStroke", { Color: mine ? COIN : WHITE, Thickness: 2, Transparency: mine ? 0.1 : 0.6, Parent: card });
			let h = 0;
			for (const ch of String(runners[id])) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
			const av = make("Frame", { AnchorPoint: V2(0.5, 0), Position: U2(0.5, 0, 0, 12), Size: UO(80, 80), BackgroundColor3: AVATAR[h % AVATAR.length], Parent: card });
			make("UICorner", { CornerRadius: UDim.new(0.5, 0), Parent: av });
			make("UIGradient", { Color: new ColorSequence(WHITE, RGB(150, 150, 150)), Rotation: 90, Parent: av });
			text(av, String(runners[id]).slice(0, 1).toUpperCase(), US(1, 1), UO(0, 2), 40, WHITE).TextStrokeTransparency = 0.6;
			text(card, String(runners[id]).toUpperCase(), U2(1, -10, 0, 24), UO(5, 104), 18, mine ? COIN : WHITE);
			const sc = make("UIScale", { Scale: 0.3, Parent: card });
			task.delay(0.15 * i, () => tw(sc, 0.45, { Scale: 1 }, "Back"));
		});
		splash.Visible = true;
		splash.GroupTransparency = 0;
	}
	function hideSplash() {
		tw(splash, 0.4, { GroupTransparency: 1 });
		task.delay(0.4, () => (splash.Visible = false));
	}

	// ---------------- where you stand while racing: one clear line under the distance
	const status = make("Frame", { AnchorPoint: V2(0.5, 0), Position: U2(0.5, 0, 0, 128), Size: UO(560, 40), BackgroundColor3: BLACK, BackgroundTransparency: 0.35, Visible: false, ZIndex: 20, Parent: gui });
	make("UICorner", { CornerRadius: UDim.new(0, 10), Parent: status });
	const statusStroke = make("UIStroke", { Color: WHITE, Thickness: 2, Transparency: 0.7, ApplyStrokeMode: "Border", Parent: status });
	const raceL = text(status, "", US(1, 1), null, 21, WHITE);
	raceL.ZIndex = 21;
	// the fuel bar gets a red 2X tag while it burns double
	let drainTag = null;
	let lastPlace = 0;
	function placeNow() {
		const mine = (stats && stats.dist) || 0;
		let place = 1;
		for (const id in R.runners) {
			if (id === me() || R.crashed[id] != null) continue;
			if ((R.live[id] || 0) > mine) place++;
		}
		return place;
	}
	RunService.RenderStepped.Connect(() => {
		const on = !!Game.race && !!R.runners && mode === "run" && !dead && !R.final && !Game.hold;
		// no text bar while racing, the standings on the right say enough. only the 2x tag when it matters
		status.Visible = false;
		if (!drainTag && Game.fuelBar) {
			drainTag = text(Game.fuelBar, "2X", UO(60, 26), U2(1, 58, 0, 0), 24, BAD, LEFT);
			drainTag.TextStrokeTransparency = 0.4;
		}
		if (drainTag) {
			drainTag.Visible = on && Game.behind;
			drainTag.TextTransparency = 0.5 - 0.5 * Math.sin(clock() * 10);
		}
		if (!on) return;
		const mine = (stats && stats.dist) || 0;
		let best = 0, bestName = "";
		for (const id in R.runners) {
			if (id === me() || R.crashed[id] != null) continue;
			if ((R.live[id] || 0) > best) {
				best = R.live[id] || 0;
				bestName = String(R.runners[id]).toUpperCase();
			}
		}
		const gap = Math.floor(best - mine);
		const place = placeNow();
		const pulse = 0.5 + 0.5 * Math.sin(clock() * 10);
		const alive = Object.keys(R.runners).filter((id) => id === me() || R.crashed[id] == null).length;
		const aliveTxt = "   " + alive + " STILL FLYING";
		if (place === 1) {
			raceL.Text = "YOU'RE IN 1ST   COINS X" + (Game.raceMult || 1).toFixed(2).replace(/\.?0+$/, "") + aliveTxt;
			raceL.TextColor3 = COIN;
			statusStroke.Color = COIN;
			statusStroke.Transparency = 0.3;
			status.BackgroundColor3 = BLACK;
		} else if (gap > 600) {
			raceL.Text = "FALLING BEHIND! FUEL BURNS 2X   " + bestName + " +" + fmt(gap);
			raceL.TextColor3 = WHITE;
			status.BackgroundColor3 = RGB(170 + 60 * pulse, 30, 30);
			statusStroke.Color = BAD;
			statusStroke.Transparency = 0;
		} else if (gap > 400) {
			raceL.Text = placeName(place) + "   " + bestName + " +" + fmt(gap) + "   STAY WITHIN 600!";
			raceL.TextColor3 = RGB(255, 210, 80);
			status.BackgroundColor3 = BLACK;
			statusStroke.Color = RGB(255, 210, 80);
			statusStroke.Transparency = 0.2;
		} else {
			raceL.Text = placeName(place) + "   " + bestName + " +" + fmt(gap) + aliveTxt;
			raceL.TextColor3 = WHITE;
			status.BackgroundColor3 = BLACK;
			statusStroke.Color = WHITE;
			statusStroke.Transparency = 0.7;
		}
		// overtakes get called out
		if (lastPlace && place !== lastPlace) {
			if (place === 1) sfx("map_clear");
			else if (lastPlace === 1) sfx("bad");
		}
		lastPlace = place;
	});

	// everyone who isn't flying anymore counts, the match is over when that's everyone
	function checkOver() {
		if (!R.runners || R.final || !Game.race || R.winning) return;
		const now = Online.serverNow();
		let others = 0;
		for (const id in R.runners) {
			if (id === me()) continue;
			others++;
			if (R.crashed[id] != null) continue;
			const g = ghosts.get(id);
			const quiet = g ? now - (g.seen || 0) > STALE : now - R.started > 15000;
			if (!quiet) return;
			R.crashed[id] = R.live[id] || 0;
			dropGhost(id);
		}
		// everyone else is down: if you're still flying, you win on the spot
		if (mode === "run" && !dead && others > 0) win();
		else if (mode === "run" && dead) finish();
	}

	// ---------------- the win moment: freeze, orbit around your plane, big YOU WON!
	const winL = text(gui, "YOU WON!", UO(1200, 170), U2(0.5, 0, 0.3, 0), 130, COIN);
	winL.AnchorPoint = V2(0.5, 0.5);
	winL.ZIndex = 40;
	winL.TextStrokeTransparency = 0.2;
	winL.Visible = false;
	winL.el.style.pointerEvents = "none";
	function party(n) {
		for (let i = 0; i < n; i++) {
			const c = make("Frame", {
				AnchorPoint: V2(0.5, 0.5),
				Position: U2(Math.random(), 0, 0, -20 - Math.random() * 200),
				Size: UO(random(6, 14), random(10, 20)),
				BackgroundColor3: Color3.fromHSV(Math.random(), 0.75, 1),
				Rotation: random(0, 360),
				ZIndex: 45,
				Parent: gui,
			});
			const dur = random(22, 40) / 10;
			tw(c, dur, { Position: U2(c.Position.xs + (Math.random() - 0.5) * 0.25, 0, 1, 40), Rotation: c.Rotation + random(-720, 720) }, "Quad", "In");
			Debris.AddItem(c, dur);
		}
	}
	let orbit = null;
	const orbitCam = () => {
		if (!orbit) return null;
		const t = clock() - orbit.t0;
		const a = 0.6 + t * 0.35;
		const r = 26 + Math.min(t, 3) * 4;
		const at = orbit.at;
		return CFrame.lookAt(at.add(V3(Math.sin(a) * r, 7 + Math.min(t, 3) * 2, Math.cos(a) * r)), at);
	};
	function win() {
		R.winning = true;
		R.won[me()] = true;
		Game.hold = true;
		orbit = { t0: clock(), at: pos };
		flash();
		shake = Math.max(shake, 0.3);
		sfx("record");
		sfx("map_clear");
		winL.Visible = true;
		winL.TextTransparency = 0;
		winL.TextSize = 330;
		tw(winL, 0.6, { TextSize: 130 }, "Back");
		party(90);
		task.delay(0.9, () => party(60));
		const my = runId;
		task.delay(3, () => {
			if (runId !== my) return;
			const [, award] = Game.finishRun();
			if (planeModel) planeModel.Parent = workspace;
			Game.lastAward = award;
			tw(winL, 0.4, { TextTransparency: 1 });
			task.delay(0.4, () => (winL.Visible = false));
			finish();
		});
	}

	function finish() {
		if (R.final) return;
		const list = Object.keys(R.runners).map((id) => ({
			id,
			name: R.runners[id],
			dist: id === me() ? (stats && stats.dist) || 0 : R.crashed[id] || 0,
			won: !!R.won[id],
		}));
		// the last one flying wins, everyone else by distance
		list.sort((a, b) => (b.won ? 1 : 0) - (a.won ? 1 : 0) || b.dist - a.dist);
		R.final = list;
		const place = list.findIndex((e) => e.id === me()) + 1;
		let prize = 0;
		if (!R.prized) {
			R.prized = true;
			const before = data.coins;
			request("race_prize", { n: list.length, place });
			prize = data.coins - before;
		}
		stopSpec();
		if (mode === "run") showBoard(list, place, prize);
		else notify("versus over, you got " + placeName(place).toLowerCase(), place === 1 ? COIN : WHITE);
	}
	const placeName = (p) => ["1ST", "2ND", "3RD"][p - 1] || p + "TH";

	// ---------------- the versus results: a podium instead of the normal screen
	const MEDAL = [COIN, RGB(215, 220, 230), RGB(220, 140, 80)];
	const vr = make("CanvasGroup", {
		AnchorPoint: V2(0.5, 0.5),
		Position: US(0.5, 0.53),
		Size: UO(720, 640),
		BackgroundColor3: BLACK,
		BackgroundTransparency: T.panel,
		GroupTransparency: 1,
		Visible: false,
		ZIndex: 30,
		Parent: gui,
	});
	make("UICorner", { CornerRadius: UDim.new(0, 14), Parent: vr });
	const vrTitle = text(vr, "", U2(1, 0, 0, 70), UO(0, 14), 64, COIN);
	const vrTitleScale = make("UIScale", { Parent: vrTitle });
	const vrSub = text(vr, "", U2(1, 0, 0, 24), UO(0, 84), 20, DIM);
	const stage = make("Frame", { Position: UO(40, 116), Size: U2(1, -80, 0, 300), BackgroundTransparency: 1, Parent: vr });
	const rest = make("Frame", { Position: UO(60, 424), Size: U2(1, -120, 0, 60), BackgroundTransparency: 1, Parent: vr });
	const vrCoins = Icons.text(vr, U2(1, -40, 0, 40), UO(20, 488), 36, COIN);
	const vrNote = text(vr, "", U2(1, -40, 0, 22), UO(20, 528), 18, DIM);
	const againBtn = button(vr, "PLAY AGAIN", UO(330, 58), U2(0, 30, 1, -80), () => Game.versusToggle(), 0.1);
	againBtn.TextColor3 = GOOD;
	button(vr, "MENU", UO(300, 58), U2(1, -330, 1, -80), () => {
		hideBoard();
		fade(toMenu);
	});
	let boardToken = 0;
	function hideBoard() {
		boardToken++;
		vr.Visible = false;
		orbit = null;
		winL.Visible = false;
		if (Game.flow.cam && Game.flow._vs) Game.flow.cam = null;
	}
	Game.hideVersusBoard = hideBoard;
	Game._vsDebug = () => [!!orbit, dead, !!Game.flow.cam, mode];
	Game._vsWin = () => { Game.race = Game.race || { seed: 1 }; R.runners = { [me() || "x"]: "ME" }; win(); };

	function avatar(parent, name, size, pos) {
		let h = 0;
		for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
		const av = make("Frame", { AnchorPoint: V2(0.5, 1), Position: pos, Size: UO(size, size), BackgroundColor3: AVATAR[h % AVATAR.length], Parent: parent });
		make("UICorner", { CornerRadius: UDim.new(0.5, 0), Parent: av });
		make("UIGradient", { Color: new ColorSequence(WHITE, RGB(150, 150, 150)), Rotation: 90, Parent: av });
		make("UIStroke", { Color: WHITE, Thickness: 2, Transparency: 0.4, ApplyStrokeMode: "Border", Parent: av });
		text(av, name.slice(0, 1).toUpperCase(), US(1, 1), UO(0, 2), Math.floor(size * 0.5), WHITE).TextStrokeTransparency = 0.6;
		return av;
	}

	function showBoard(list, place, prize) {
		boardToken++;
		const my = boardToken;
		results.Visible = false;
		specBar.Visible = false;
		board.Visible = false;
		hud.Visible = false;
		wallet.Visible = true;
		place = Math.max(1, place);
		for (const c of stage.GetChildren()) c.Destroy();
		for (const c of rest.GetChildren()) c.Destroy();
		vr.Visible = true;
		vr.GroupTransparency = 1;
		vr.Position = US(0.5, 0.6);
		tw(vr, 0.5, { GroupTransparency: 0, Position: US(0.5, 0.53) });
		const won = place === 1;
		vrTitle.Text = won ? "YOU WON!" : placeName(place) + " PLACE";
		vrTitle.TextColor3 = won ? COIN : place <= 3 ? MEDAL[place - 1] : WHITE;
		vrTitleScale.Scale = 1.6;
		tw(vrTitleScale, 0.6, { Scale: 1 }, "Back");
		vrSub.Text = "VERSUS WITH " + list.length + " PLAYERS";
		if (won) {
			sfx("record");
			party(70);
		}

		// podium: 2nd left, 1st middle, 3rd right, blocks grow up one after another
		const H = [190, 140, 100];
		const slot = [1, 0, 2];
		const colW = 190;
		const order = [2, 1, 0];
		order.forEach((i, k) => {
			const e = list[i];
			if (!e) return;
			const x = slot[i];
			const col = make("Frame", { Position: U2(0, x * (colW + 20) + 10, 0, 0), Size: UO(colW, 300), BackgroundTransparency: 1, Parent: stage });
			const block = make("Frame", { AnchorPoint: V2(0, 1), Position: U2(0, 0, 1, 0), Size: UO(colW, 0), BackgroundColor3: MEDAL[i], BorderSizePixel: 0, Parent: col });
			make("UICorner", { CornerRadius: UDim.new(0, 10), Parent: block });
			make("UIGradient", { Color: new ColorSequence(WHITE, RGB(120, 120, 120)), Rotation: 90, Transparency: new NumberSequence(0.1, 0.35), Parent: block });
			const num = text(block, String(i + 1), US(1, 1), UO(0, 0), 64, BLACK);
			num.TextTransparency = 0.35;
			const top = make("Frame", { AnchorPoint: V2(0, 1), Position: U2(0, 0, 1, -H[i] - 6), Size: UO(colW, 120), BackgroundTransparency: 1, Parent: col });
			avatar(top, e.name, i === 0 ? 70 : 58, U2(0.5, 0, 1, -48));
			const nm = text(top, e.name.toUpperCase(), U2(1, 0, 0, 24), U2(0, 0, 1, -44), 21, e.id === me() ? GOOD : WHITE);
			nm.TextStrokeTransparency = 0.6;
			text(top, e.won ? "LAST ONE FLYING" : fmt(e.dist) + " STUDS", U2(1, 0, 0, 18), U2(0, 0, 1, -20), 15, e.won ? COIN : DIM);
			const sc = make("UIScale", { Scale: 0, Parent: top });
			const d = 0.35 + k * 0.45;
			task.delay(d, () => {
				if (boardToken !== my) return;
				tw(block, 0.5, { Size: UO(colW, H[i]) }, "Back");
				sfx("coin_land", 0.9 + (2 - i) * 0.12);
			});
			task.delay(d + 0.25, () => {
				if (boardToken !== my) return;
				tw(sc, 0.4, { Scale: 1 }, "Back");
				if (i === 0) {
					sfx("map_clear");
					if (won) party(40);
				}
			});
		});
		// 4th and down in a row underneath
		const others = list.slice(3).map((e, j) => j + 4 + ". " + e.name.toUpperCase() + "  " + fmt(e.dist));
		if (others.length) text(rest, others.join("     "), US(1, 1), null, 18, DIM).TextWrapped = true;

		const award = Game.lastAward;
		const coins = (award && award.coins) || 0;
		vrCoins.Text = "+0 ●";
		vrNote.Text = prize > 0 ? "INCLUDES +" + fmt(prize) + " FOR YOUR PLACE" : "WIN TO GET THE PRIZE: 100 COINS PER PLAYER";
		task.delay(1.9, async () => {
			const total = coins + prize;
			const t0 = clock();
			while (boardToken === my) {
				const k = Math.min((clock() - t0) / 1.1, 1);
				vrCoins.Text = "+" + fmt(Math.floor(total * (1 - (1 - k) ** 3))) + " ●";
				if (k >= 1) break;
				await task.wait();
			}
		});
	}

	RunService.RenderStepped.Connect(() => {
		// the camera circles your plane while you celebrate, and keeps circling behind the podium
		if (orbit && mode === "run") {
			const c = orbitCam();
			if (!dead) {
				Game.flow.cam = c;
				Game.flow._vs = true;
			}
		}
		if (vr.Visible) {
			const t = Game.queueText();
			const want = t || "PLAY AGAIN";
			if (againBtn.Text !== want) againBtn.Text = want;
		}
	});

	// ---------------- queue
	async function beat() {
		if (!R.inQueue) return;
		try {
			await Online.put(`queue/${me()}`, { name: Online.account(), at: Online.SERVER_TIME, joined });
		} catch (e) {
			console.warn(e);
		}
	}
	async function joinQueue() {
		try {
			await Online.token();
			await Online.syncClock();
			joined = Math.round(Online.serverNow());
			R.inQueue = true;
			await beat();
		} catch (e) {
			R.inQueue = false;
			notify("couldn't connect to versus", BAD);
			sfx("bad");
			return false;
		}
		clearInterval(beatT);
		beatT = setInterval(beat, 3000);
		return true;
	}
	function leaveQueue(quiet) {
		if (!R.inQueue) return;
		R.inQueue = false;
		clearInterval(beatT);
		if (me()) Online.del(`queue/${me()}`).catch(() => {});
		if (!quiet) Game.raceButton();
	}
	Game.leaveQueue = () => leaveQueue(false);

	// the oldest one in the queue sets the match up and keeps the list current until it locks
	let hosting = null;
	async function host() {
		const list = fresh();
		if (!R.inQueue || list.length < 2 || list[0].id !== me()) return;
		const now = Online.serverNow();
		const runners = {};
		for (const e of list) runners[e.id] = e.name;
		if (hosting && R.matches[hosting] && R.matches[hosting].startAt > now) {
			const m = R.matches[hosting];
			if (m.startAt - now > 2500 && Object.keys(m.runners || {}).sort().join() !== Object.keys(runners).sort().join()) {
				Online.put(`matches/${hosting}/runners`, runners).catch(() => {});
			}
			return;
		}
		if (pending()) return;
		const mid = me() + "_" + Math.round(now);
		hosting = mid;
		const m = { host: me(), created: Online.SERVER_TIME, startAt: Math.round(now + RACE_WAIT), seed: random(1, 1e6), runners };
		R.matches[mid] = { ...m, created: now };
		try {
			await Online.put(`matches/${mid}`, m);
		} catch (e) {
			console.warn(e);
		}
	}

	// streams run while the versus panel or the queue needs them
	function watch(on) {
		if (on && !stopLobby) {
			stopLobby = Online.listen("queue", (v) => (R.lobby = v || {}));
			stopMatches = Online.listen("matches", (v) => (R.matches = v || {}), 'orderBy="created"&limitToLast=8');
			Online.syncClock().catch(() => {});
		} else if (!on && stopLobby) {
			stopLobby();
			stopMatches();
			stopLobby = stopMatches = null;
		}
	}

	// versus unlocks once you've made it through the canyon
	const unlocked = () => {
		const c = STAGE_BY_ID.canyon;
		return data.best >= c.start + c.len;
	};
	Game.raceClick = () => {
		if (!unlocked()) {
			notify("Complete Canyon to be able to race others!", BAD);
			sfx("bad");
			return;
		}
		if (!Online.account()) {
			Game.askName(() => openPanel("versus"));
			return;
		}
		openPanel("versus");
	};
	Game.versusToggle = async () => {
		if (R.inQueue) {
			leaveQueue(false);
			return;
		}
		if (!Online.account()) {
			Game.askName(() => openPanel("versus"));
			return;
		}
		watch(true);
		if (await joinQueue()) sfx("good");
		Game.raceButton();
	};

	Game.queueText = () => {
		if (!R.inQueue) return null;
		const p = pending();
		if (p) return "STARTS IN " + Math.max(0, Math.ceil((p.m.startAt - Online.serverNow()) / 1000));
		return "QUEUED.. (" + Math.max(1, fresh().length) + " WAITING)";
	};
	Game.raceButton = () => {
		const b = Game.raceBtn;
		if (!b) return;
		const open = unlocked();
		const n = fresh().length;
		let t;
		if (!open) t = "VERSUS (LOCKED)";
		else if (R.inQueue) t = Game.queueText();
		else if (n > 0 && stopLobby) t = "VERSUS (" + n + " WAITING)";
		else t = "VERSUS";
		if (b.Text !== t) b.Text = t;
		b.TextColor3 = open ? WHITE : DIM;
		b.TextSize = t.length > 12 ? 21 : 28;
	};

	// ---------------- the versus window
	const vp = panel("versus", "VERSUS");
	const statusR = row(vp.body, 92, 1);
	const statusL = text(statusR, "", U2(1, -20, 0, 46), UO(10, 6), 38, WHITE);
	const subL = text(statusR, "", U2(1, -20, 0, 26), UO(10, 56), 20, DIM);
	const joinR = row(vp.body, 66, 1);
	const joinBtn = button(joinR, "JOIN", UO(320, 58), U2(0.5, -160, 0, 4), () => Game.versusToggle(), 0.1);
	const waitHead = row(vp.body, 34, 1);
	text(waitHead, "WAITING", U2(1, -20, 1, 0), UO(12, 4), 18, DIM, LEFT);
	const waitR = row(vp.body, 0);
	waitR.AutomaticSize = "Y";
	make("UIPadding", { PaddingTop: UDim.new(0, 10), PaddingBottom: UDim.new(0, 10), PaddingLeft: UDim.new(0, 16), PaddingRight: UDim.new(0, 16), Parent: waitR });
	const waitL = text(waitR, "nobody yet", U2(1, 0, 0, 26), null, 22, DIM, LEFT);
	const cards = make("Frame", { Size: US(1, 0), AutomaticSize: "Y", BackgroundTransparency: 1, Parent: waitR });
	make("UIGridLayout", { CellSize: UO(112, 136), CellPadding: UO(10, 10), SortOrder: "LayoutOrder", Parent: cards });
	let shownKey = "";
	const AVATAR = [RGB(255, 90, 90), RGB(255, 170, 60), RGB(90, 200, 120), RGB(80, 170, 255), RGB(170, 110, 255), RGB(255, 100, 200)];
	function drawCards(list) {
		const key = list.map((e) => e.id).join(",");
		if (key === shownKey) return;
		shownKey = key;
		for (const c of cards.GetChildren()) if (c.ClassName === "Frame") c.Destroy();
		list.forEach((e, i) => {
			const mine = e.id === me();
			const card = make("Frame", { BackgroundColor3: BLACK, BackgroundTransparency: 0.35, LayoutOrder: mine ? 0 : i + 1, Parent: cards });
			make("UIStroke", { Color: mine ? COIN : WHITE, Thickness: 2, Transparency: mine ? 0.2 : 0.7, Parent: card });
			// no avatars on the web, so a coloured circle with your first letter
			let h = 0;
			for (const ch of e.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
			const av = make("Frame", { AnchorPoint: V2(0.5, 0), Position: U2(0.5, 0, 0, 8), Size: UO(88, 88), BackgroundColor3: AVATAR[h % AVATAR.length], Parent: card });
			make("UICorner", { CornerRadius: UDim.new(0.5, 0), Parent: av });
			make("UIGradient", { Color: new ColorSequence(WHITE, RGB(150, 150, 150)), Rotation: 90, Parent: av });
			text(av, e.name.slice(0, 1).toUpperCase(), US(1, 1), UO(0, 2), 46, WHITE).TextStrokeTransparency = 0.6;
			text(card, e.name.toUpperCase(), U2(1, -8, 0, 22), UO(4, 102), 17, mine ? COIN : WHITE);
			const sc = make("UIScale", { Scale: 0.5, Parent: card });
			tw(sc, 0.35, { Scale: 1 }, "Back");
		});
	}
	const rulesHead = row(vp.body, 34, 1);
	text(rulesHead, "HOW IT WORKS", U2(1, -20, 1, 0), UO(12, 4), 18, DIM, LEFT);
	const rules = make("Frame", { Size: U2(1, -10, 0, 0), AutomaticSize: "Y", BackgroundTransparency: 1, LayoutOrder: nextOrder(), Parent: vp.body });
	make("UIGridLayout", { CellSize: UO(308, 96), CellPadding: UO(8, 8), SortOrder: "LayoutOrder", Parent: rules });
	[
		["flag", WHITE, "SAME MAP, SAME START", "everyone starts together on the same seed. no revives"],
		["skull", BAD, "LAST ONE FLYING WINS", "crash and you're out. the winner gets 100 coins per player"],
		["coin", COIN, "LEAD = MORE COINS", "every second in 1st adds to your coin multiplier, up to x3"],
		["fuel", RGB(255, 80, 60), "DON'T FALL BEHIND", "more than 600 studs behind the leader and your fuel burns 2x as fast"],
	].forEach(([icon, col, head, body], i) => {
		const t = make("Frame", { BackgroundColor3: BLACK, BackgroundTransparency: 0.4, LayoutOrder: i, Parent: rules });
		make("UICorner", { CornerRadius: UDim.new(0, 10), Parent: t });
		make("Frame", { Position: UO(0, 16), Size: UO(4, 64), BackgroundColor3: col, Parent: t });
		const ic = Icons.make(icon, t, 34);
		ic.Position = UO(18, 14);
		text(t, head, U2(1, -70, 0, 24), UO(60, 12), 19, col === WHITE ? WHITE : col, LEFT);
		const l = text(t, body.toUpperCase(), U2(1, -70, 0, 48), UO(60, 38), 14, RGB(200, 200, 200), LEFT);
		l.TextWrapped = true;
	});
	vp.onOpen = () => watch(true);
	vp.onClose = () => {
		if (!R.inQueue) watch(false);
	};

	let foundMid = null, lastTick = -1;
	function lobbyFx() {
		const p = R.inQueue && pending();
		if (p && p.mid !== foundMid) {
			foundMid = p.mid;
			sfx("map_clear");
			notify("match found! starting soon", GOOD);
			statusScale.Scale = 1.4;
			tw(statusScale, 0.5, { Scale: 1 }, "Back");
		}
		if (p) {
			const left = Math.ceil((p.m.startAt - Online.serverNow()) / 1000);
			if (left !== lastTick && left <= 5 && left >= 1) sfx("hover", 0.8 + (5 - left) * 0.12);
			lastTick = left;
		}
	}
	const statusScale = make("UIScale", { Parent: statusL });
	function refreshPanel() {
		const q = Game.queueText();
		statusL.Text = q || "VERSUS";
		statusL.TextColor3 = q ? COIN : WHITE;
		const list = fresh();
		const others = list.filter((e) => e.id !== me()).length;
		if (R.inQueue) subL.Text = pending() ? "others can still join" : "starts as soon as someone else joins";
		else subL.Text = others > 0 ? (others === 1 ? "1 player is" : others + " players are") + " waiting, join them!" : "nobody's waiting yet, be the first";
		joinBtn.Text = R.inQueue ? "LEAVE QUEUE" : "JOIN";
		waitL.Visible = list.length === 0;
		drawCards(list);
	}

	// ---------------- live standings while you race
	const board = make("Frame", {
		AnchorPoint: V2(1, 0.5),
		Position: U2(1, -16, 0.5, 0),
		Size: UO(300, 44),
		BackgroundColor3: BLACK,
		BackgroundTransparency: T.hud,
		Visible: false,
		ZIndex: 20,
		Parent: gui,
	});
	const boardTitle = text(board, "VERSUS", U2(1, -24, 0, 34), UO(12, 4), 24, COIN, LEFT);
	const boardRows = [];
	function refreshBoard() {
		const rows = [];
		for (const id in R.runners) {
			const mine = id === me();
			let d, gone;
			if (R.final) {
				const f = R.final.find((e) => e.id === id);
				d = f ? f.dist : 0;
				gone = true;
			} else if (mine) {
				d = (stats && stats.dist) || 0;
				gone = dead;
			} else {
				d = R.crashed[id] != null ? R.crashed[id] : R.live[id] || 0;
				gone = R.crashed[id] != null;
			}
			rows.push({ name: R.runners[id], dist: d || 0, gone, mine });
		}
		rows.sort((a, b) => b.dist - a.dist);
		boardTitle.Text = R.final ? "MATCH OVER" : "VERSUS";
		rows.forEach((r, i) => {
			let br = boardRows[i];
			if (!br) {
				br = {
					name: text(board, "", U2(1, -156, 0, 28), UO(40, 40 + i * 30), 20, WHITE, LEFT),
					dist: text(board, "", UO(110, 28), U2(1, -122, 0, 40 + i * 30), 20, WHITE, RIGHT),
					skull: Icons.make("skull", board, 20),
				};
				br.skull.AnchorPoint = V2(0, 0.5);
				br.skull.Position = UO(12, 40 + i * 30 + 14);
				boardRows[i] = br;
			}
			const col = r.mine ? COIN : r.gone && !R.final ? DIM : WHITE;
			br.name.Text = i + 1 + "  " + String(r.name).toUpperCase();
			br.dist.Text = fmt(r.dist);
			br.name.TextColor3 = col;
			br.dist.TextColor3 = col;
			br.name.Visible = br.dist.Visible = true;
			br.skull.Visible = r.gone;
		});
		for (let i = rows.length; i < boardRows.length; i++) {
			boardRows[i].name.Visible = boardRows[i].dist.Visible = boardRows[i].skull.Visible = false;
		}
		board.Size = UO(300, 48 + rows.length * 30);
	}

	// ---------------- spectating after you crash
	const spec = { id: null };
	const specBar = make("Frame", {
		AnchorPoint: V2(0.5, 1),
		Position: U2(0.5, 0, 1, -20),
		Size: UO(560, 64),
		BackgroundColor3: BLACK,
		BackgroundTransparency: T.hud,
		Visible: false,
		ZIndex: 25,
		Parent: gui,
	});
	const specL = text(specBar, "", U2(1, -250, 1, 0), UO(66, 0), 24, WHITE);
	const aliveOthers = () => Object.keys(R.runners || {}).filter((id) => id !== me() && R.crashed[id] == null && ghosts.has(id));
	function stopSpec() {
		if (!spec.id) return;
		spec.id = null;
		specBar.Visible = false;
		if (mode === "run" && dead) results.Visible = true;
	}
	function cycle(dir) {
		const list = aliveOthers();
		if (!list.length) return stopSpec();
		const at = list.indexOf(spec.id);
		spec.id = list[(((at < 0 ? 0 : at) + dir) % list.length + list.length) % list.length];
		specL.Text = "SPECTATING  " + String(R.runners[spec.id]).toUpperCase();
	}
	button(specBar, "<", UO(50, 48), UO(8, 8), () => cycle(-1));
	button(specBar, ">", UO(50, 48), U2(1, -178, 0, 8), () => cycle(1));
	button(specBar, "BACK", UO(110, 48), U2(1, -118, 0, 8), stopSpec);
	const specBtn = button(gui, "SPECTATE", UO(250, 52), U2(0.5, -125, 1, -66), () => {
		results.Visible = false;
		specBar.Visible = true;
		spec.id = null;
		cycle(1);
	});
	specBtn.Visible = false;
	specBtn.ZIndex = 25;
	Game.specCam = () => {
		if (orbit) return orbitCam();
		if (!spec.id) return null;
		let g = ghosts.get(spec.id);
		if (!g || R.crashed[spec.id] != null) {
			cycle(1);
			g = spec.id && ghosts.get(spec.id);
			if (!g) return null;
		}
		const at = g.pos.add(g.vel.mul(Math.min(clock() - g.at, 0.3)));
		trackChunks(at.X, at.Z);
		return CFrame.lookAt(at.add(V3(0, 10, 28)), at.add(V3(0, 2, -60)));
	};

	// ---------------- every frame: draw the others, send yourself
	let sendT = 0, sending = false;
	RunService.RenderStepped.Connect((dt) => {
		const now = clock();
		const sg = spec.id && ghosts.get(spec.id);
		const viewZ = sg && sg.pos ? sg.pos.Z : pos.Z;
		const viewLoop = sg ? sg.loop : Game.loop || 0;
		for (const [id, g] of ghosts) {
			const age = now - g.at;
			if (!g.pos || age > 3) {
				g.model.Parent = null;
				g.tag.Visible = false;
				continue;
			}
			if (mode === "run" && Game.race && g.loop === viewLoop && Math.abs(g.pos.Z - viewZ) < 900) {
				const p = g.pos.add(g.vel.mul(Math.min(age, 0.3)));
				g.main.CFrame = CFrame.new(p).mul(g.rot);
				g.model.Parent = workspace;
				const [v, on] = camera.WorldToViewportPoint(p.add(V3(0, 5, 0)));
				g.tag.Visible = on && v.Z < 700;
				if (on) g.tag.Position = UO(v.X / uiScaleNow(), v.Y / uiScaleNow());
			} else {
				g.model.Parent = null;
				g.tag.Visible = false;
			}
		}

		if (!Game.race || !R.mid) return;
		sendT -= dt;
		if (sendT > 0) return;
		sendT = 0.12;
		const flying = mode === "run" && !dead && stats && planeMain && planeMain.Parent;
		if (flying) {
			const cf = planeMain.CFrame;
			const [rx, ry, rz] = cf.ToEulerAnglesXYZ();
			const r2 = (v) => Math.round(v * 100) / 100;
			Online.put(`matches/${R.mid}/live/${me()}`, { x: r2(cf.X), y: r2(cf.Y), z: r2(cf.Z), rx: r2(rx), ry: r2(ry), rz: r2(rz), d: Math.floor(stats.dist || 0), s: Game.tierPlane(), l: Game.loop || 0 }).catch(() => {});
			sending = true;
		} else if (sending) {
			sending = false;
			Online.put(`matches/${R.mid}/live/${me()}`, { dead: true, won: !!R.winning, d: Math.floor((stats && stats.dist) || 0) }).catch(() => {});
		}
	});
	const uiScaleNow = () => Game._uis || 1;

	// ---------------- slow loop: host duty, countdown, lead and falling behind
	let leadT = 0;
	setInterval(() => {
		if (mode === "menu") Game.raceButton();
		if (vp.frame.Visible) refreshPanel();
		lobbyFx();
		if (R.inQueue) {
			host();
			const p = pending();
			if (p && Online.serverNow() >= p.m.startAt && !Game.race) go(p.mid, p.m);
		}
		specBtn.Visible = !!Game.race && mode === "run" && dead && results.Visible && !R.final && !R.winning && aliveOthers().length > 0;
		if (spec.id && !(Game.race && mode === "run" && dead)) stopSpec();
		const show = !!Game.race && !!R.runners && mode === "run";
		board.Visible = show && !vr.Visible;
		if (show) refreshBoard();
		if (show && !R.final) checkOver();
		// whoever's furthest builds up the coin multiplier, 600 behind them and your fuel burns double
		let best = 0;
		if (show && !R.final) {
			for (const id in R.runners) if (id !== me() && R.crashed[id] == null) best = Math.max(best, R.live[id] || 0);
		}
		const mine = (stats && stats.dist) || 0;
		Game.behind = show && !dead && !R.final && best - mine > 600;
		Game.leading = show && !dead && !R.final && mine > best && mine > 0;
		if (Game.leading && clock() - leadT >= 1) {
			leadT = clock();
			R.lead++;
			Game.raceMult = 1 + Math.min(R.lead * 0.05, 2);
		}
		if (!Game.race && (vr.Visible || orbit)) hideBoard();
		if (!Game.race && stopLive) {
			stopLive();
			stopLive = null;
			R.mid = null;
			for (const id of [...ghosts.keys()]) dropGhost(id);
		}
	}, 250);
	window.addEventListener("beforeunload", () => leaveQueue(true));
})();

// ------------------------------------------------------------------ who's online + messages from the dev

(() => {
	const ONLINE_FOR = 150000;
	const seenOf = (p) => (p && typeof p.seen === "number" ? p.seen : 0);
	Game.isOnline = (p) => Online.serverNow() - seenOf(p) < ONLINE_FOR;
	Game.lastOnline = (p) => {
		const t = seenOf(p) || (p && p.updated) || 0;
		if (!t) return "A WHILE AGO";
		const m = Math.floor((Online.serverNow() - t) / 60000);
		if (m < 1) return "JUST NOW";
		if (m < 60) return m + " MIN AGO";
		const h = Math.floor(m / 60);
		if (h < 24) return h + (h === 1 ? " HOUR AGO" : " HOURS AGO");
		const d = Math.floor(h / 24);
		return d === 1 ? "YESTERDAY" : d + " DAYS AGO";
	};

	// while the page is open you count as online
	async function beat() {
		if (!Online.account() || !Online.enabled()) return;
		try {
			await Online.put(`players/${Online.myId()}/seen`, Online.SERVER_TIME);
		} catch (e) {
			// no profile up yet, the next push brings it
		}
	}
	Online.syncClock().catch(() => {});
	task.delay(3, beat);
	setInterval(beat, 60000);

	// ---------------- global messages: slides in at the top for everyone who's on the site
	const bar = make("Frame", {
		AnchorPoint: V2(0.5, 0),
		Position: U2(0.5, 0, 0, -120),
		Size: UO(760, 84),
		BackgroundColor3: RGB(20, 22, 34),
		BackgroundTransparency: 0.05,
		ZIndex: 60,
		Visible: false,
		Parent: gui,
	});
	make("UICorner", { CornerRadius: UDim.new(0, 14), Parent: bar });
	make("UIStroke", { Color: COIN, Thickness: 2, Transparency: 0.2, ApplyStrokeMode: "Border", Parent: bar });
	const from = text(bar, "", U2(1, -40, 0, 20), UO(20, 10), 15, COIN, LEFT);
	const msgL = text(bar, "", U2(1, -40, 0, 42), UO(20, 32), 26, WHITE, LEFT);
	msgL.TextWrapped = true;
	msgL.TextTruncate = "AtEnd";
	for (const l of [from, msgL]) l.ZIndex = 61;
	let shownId = null;
	try {
		shownId = localStorage.getItem("dontcrash_msg_seen");
	} catch (e) {}
	let hideT = null;
	function show(m) {
		from.Text = "MESSAGE FROM " + String(m.by || "THE DEV").toUpperCase();
		msgL.Text = String(m.msg).slice(0, 200);
		bar.Visible = true;
		bar.Position = U2(0.5, 0, 0, -120);
		tw(bar, 0.5, { Position: U2(0.5, 0, 0, 16) }, "Back");
		sfx("map_clear");
		clearTimeout(hideT);
		hideT = setTimeout(() => {
			tw(bar, 0.4, { Position: U2(0.5, 0, 0, -120) }, "Quad", "In");
			setTimeout(() => (bar.Visible = false), 450);
		}, 9000);
	}
	const loadedAt = Date.now();
	Online.listen("broadcast", (m) => {
		if (!m || typeof m.msg !== "string" || !m.id || m.id === shownId) return;
		// only fresh ones, an old message shouldn't pop up for everyone who opens the game later
		const age = Online.serverNow() - (typeof m.at === "number" ? m.at : 0);
		if (age > 120000 && typeof m.at === "number" && m.at < loadedAt - 5000) return;
		shownId = m.id;
		try {
			localStorage.setItem("dontcrash_msg_seen", m.id);
		} catch (e) {}
		show(m);
	});

	// ---------------- the sender, only in ?dev. the database only lets the dev account through anyway
	if (!DEV) return;
	const bp = panel("broadcast", "MESSAGE TO EVERYONE", UO(620, 300));
	const r = row(bp.body, 70, 1);
	const box = make("TextBox", {
		Size: U2(1, -10, 0, 60),
		Position: UO(0, 5),
		BackgroundColor3: BLACK,
		BackgroundTransparency: 0.2,
		PlaceholderText: "WHAT DO YOU WANT TO SAY",
		Text: "",
		Font: FONT,
		TextSize: 24,
		TextColor3: WHITE,
		Parent: r,
	});
	box.el.maxLength = 200;
	const info = row(bp.body, 30, 1);
	text(info, "SHOWS UP AT THE TOP FOR EVERYONE WHO'S ON THE SITE RIGHT NOW", U2(1, -10, 1, 0), UO(4, 0), 15, DIM, LEFT);
	const sr = row(bp.body, 70, 1);
	const send = async () => {
		const msg = box.Text.trim();
		if (!msg) return;
		try {
			await Online.put("broadcast", { msg, at: Online.SERVER_TIME, id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), by: Online.account() || "the dev" });
			box.Text = "";
			notify("sent to everyone", GOOD);
			sfx("good");
			closePanels();
		} catch (e) {
			notify("not allowed, log in with the dev account", BAD);
			sfx("bad");
		}
	};
	button(sr, "SEND", U2(1, -10, 0, 60), UO(0, 5), send, 0.05).TextColor3 = GOOD;
	box.el.addEventListener("keydown", (e) => {
		if (e.key === "Enter") send();
	});
	bp.onOpen = () => task.delay(0.1, () => box.CaptureFocus());
	const b = button(menu, "SEND MESSAGE", UO(200, 40), U2(1, -216, 1, -56), () => openPanel("broadcast"), 0.3);
	b.TextSize = 18;
	b.TextColor3 = COIN;
})();

// ------------------------------------------------------------------ old version warning
// every build has its own number, the page checks now and then whether a newer one is online
(() => {
	const BUILD = "1790759340";
	if (BUILD.startsWith("__")) return;
	const bar = make("TextButton", {
		AnchorPoint: V2(0.5, 0),
		Position: U2(0.5, 0, 0, 12),
		Size: UO(640, 50),
		BackgroundColor3: RGB(200, 40, 40),
		BackgroundTransparency: 0.05,
		Text: "Veraltete Version! Bitte lade die Website neu!",
		Font: FONT,
		TextSize: 24,
		TextColor3: WHITE,
		ZIndex: 70,
		Visible: false,
		Parent: gui,
	});
	make("UICorner", { CornerRadius: UDim.new(0, 12), Parent: bar });
	make("UIStroke", { Color: WHITE, Thickness: 2, Transparency: 0.4, ApplyStrokeMode: "Border", Parent: bar });
	bar.MouseButton1Click.Connect(() => location.reload());
	async function check() {
		try {
			const r = await fetch("./index.html?check=" + Date.now(), { cache: "no-store" });
			const m = (await r.text()).match(/game\.js\?v=(\d+)/);
			if (m && m[1] !== BUILD && Number(m[1]) > Number(BUILD)) {
				if (!bar.Visible) sfx("bad");
				bar.Visible = true;
			}
		} catch (e) {}
	}
	setTimeout(check, 20000);
	setInterval(check, 90000);
})();

// ------------------------------------------------------------------ achievements
// the roblox badges plus a bunch of extra ones. unlocked ones live in your save

(() => {
	const LIST = [
		// the roblox badges
		{ id: "towers", name: "SKYLINE", desc: "Finish Towers", color: WHITE },
		{ id: "moving", name: "WALL RUNNER", desc: "Finish Walls", color: RGB(230, 140, 70) },
		{ id: "canyon", name: "CANYON CRAWLER", desc: "Finish Canyon", color: RGB(210, 110, 70) },
		{ id: "smash", name: "BULL IN A CHINA SHOP", desc: "Finish Smash", color: GEM },
		{ id: "boss", name: "AIRLINER DOWN", desc: "Beat the first boss", color: BAD },
		{ id: "turrets", name: "DODGEBALL", desc: "Finish Turrets", color: RGB(255, 90, 90) },
		{ id: "city", name: "NIGHT SHIFT", desc: "Finish the City", color: RGB(150, 150, 255) },
		{ id: "sea", name: "SEA LEGS", desc: "Get through the Sea", color: RGB(80, 170, 255) },
		{ id: "space", name: "HOUSTON", desc: "Make it through Space and fall back to earth", color: RGB(170, 110, 255) },
		// the big one
		{ id: "fullcircle", name: "FULL CIRCLE", desc: "Towers to Space and back to Towers in one run. No dying, no fast travel", color: COIN },
		// runs
		{ id: "run5k", name: "WARMED UP", desc: "Fly 5,000 studs in one run", color: WHITE },
		{ id: "run25k", name: "LONG HAUL", desc: "Fly 25,000 studs in one run", color: COIN },
		{ id: "glass50", name: "GLASS HALF FULL", desc: "Smash 50 glass towers in one run", color: GEM },
		{ id: "close10", name: "TOO CLOSE", desc: "Get 10 CLOSE! in one run", color: WHITE },
		{ id: "kills50", name: "DEMOLITION CREW", desc: "Destroy 50 things in one run", color: RGB(255, 150, 70) },
		{ id: "saved", name: "SAVED BY THE GLASS", desc: "Smash a glass tower with an empty tank", color: GOOD },
		{ id: "nodamage", name: "SPEEDRUN", desc: "Finish Towers in under 30 seconds", color: COIN },
		// collecting
		{ id: "heart", name: "HEARTBREAKER", desc: "Find a heart", color: RGB(255, 100, 130) },
		{ id: "revive", name: "PHOENIX", desc: "Come back with a revive", color: RGB(255, 100, 130) },
		{ id: "pickups100", name: "HOARDER", desc: "Pick up 100 gems and keys", color: GEM },
		{ id: "rich", name: "MONEY BAGS", desc: "Have 10,000 coins at once", color: COIN },
		{ id: "skins3", name: "FASHION WEEK", desc: "Own 3 skins", color: KEY },
		{ id: "codes5", name: "HACKERMAN", desc: "Redeem 5 codes", color: GOOD },
		// long term
		{ id: "dist100k", name: "FREQUENT FLYER", desc: "Fly 100,000 studs in total", color: WHITE },
		{ id: "runs100", name: "CRASH TEST DUMMY", desc: "Crash 100 times", color: BAD },
		{ id: "level10", name: "DOUBLE DIGITS", desc: "Reach level 10", color: RGB(170, 150, 255) },
		// versus
		{ id: "vswin", name: "WINNER WINNER", desc: "Win a versus match", color: COIN },
		{ id: "vs10", name: "RIVALRY", desc: "Play 10 versus matches", color: KEY },
	];
	const BY_ID = {};
	for (const a of LIST) BY_ID[a.id] = a;
	Game.ACH_TOTAL = LIST.length;
	const has = (id) => !!(data.ach && data.ach[id]);

	// ---------------- the toast that slides in from the right
	const toast = make("Frame", {
		AnchorPoint: V2(1, 0),
		Position: U2(1, 420, 0, 128),
		Size: UO(380, 84),
		BackgroundColor3: RGB(18, 20, 30),
		BackgroundTransparency: 0.05,
		ZIndex: 55,
		Visible: false,
		Parent: gui,
	});
	make("UICorner", { CornerRadius: UDim.new(0, 12), Parent: toast });
	const tStroke = make("UIStroke", { Color: COIN, Thickness: 2, Transparency: 0.1, ApplyStrokeMode: "Border", Parent: toast });
	const tIcon = make("Frame", { AnchorPoint: V2(0, 0.5), Position: U2(0, 14, 0.5, 0), Size: UO(52, 52), BackgroundColor3: COIN, ZIndex: 56, Parent: toast });
	make("UICorner", { CornerRadius: UDim.new(0.5, 0), Parent: tIcon });
	make("UIGradient", { Color: new ColorSequence(WHITE, RGB(140, 140, 140)), Rotation: 90, Parent: tIcon });
	const tStar = text(tIcon, "★", US(1, 1), UO(0, 1), 30, BLACK);
	tStar.ZIndex = 57;
	const tHead = text(toast, "ACHIEVEMENT UNLOCKED", U2(1, -90, 0, 18), UO(78, 12), 14, COIN, LEFT);
	const tName = text(toast, "", U2(1, -90, 0, 30), UO(78, 30), 26, WHITE, LEFT);
	const tDesc = text(toast, "", U2(1, -90, 0, 16), UO(78, 60), 13, DIM, LEFT);
	for (const l of [tHead, tName, tDesc]) l.ZIndex = 56;
	const queue = [];
	let showing = false;
	async function next() {
		if (showing || !queue.length) return;
		showing = true;
		const a = queue.shift();
		tName.Text = a.name;
		tDesc.Text = a.desc.toUpperCase();
		tIcon.BackgroundColor3 = a.color;
		tStroke.Color = a.color;
		toast.Visible = true;
		toast.Position = U2(1, 420, 0, 128);
		tw(toast, 0.5, { Position: U2(1, -16, 0, 128) }, "Back");
		sfx("levelup");
		await task.wait(4);
		tw(toast, 0.4, { Position: U2(1, 420, 0, 128) }, "Quad", "In");
		await task.wait(0.45);
		toast.Visible = false;
		showing = false;
		next();
	}

	Game.ach = (id) => {
		if (!BY_ID[id] || has(id)) return;
		const [ok] = request("ach", id);
		if (!ok) return;
		queue.push(BY_ID[id]);
		next();
		Game.pushProfile();
		if (panels.achievements && panels.achievements.frame.Visible) draw();
	};

	// ---------------- hooks from the run
	Game.achStage = (old, nw) => {
		if (["towers", "moving", "canyon", "smash", "turrets", "city", "sea"].includes(old)) Game.ach(old);
		if (old === "towers" && runTime < 30 && (Game.lastStart || "towers") === "towers" && Game.loop === 0) Game.ach("nodamage");
	};
	Game.achLoop = () => {
		Game.ach("space");
		// all the way round from the very start, without a revive or a fast travel
		if ((Game.lastStart || "towers") === "towers" && Game.loop === 0 && stats && (stats.revives || 0) === 0) Game.ach("fullcircle");
	};

	// ---------------- everything that's just a number to check
	setInterval(() => {
		if (!data || !data.stats) return;
		if (mode === "run" && stats) {
			if (stats.dist >= 5000) Game.ach("run5k");
			if (stats.dist >= 25000) Game.ach("run25k");
			if (stats.glass >= 50) Game.ach("glass50");
			if ((stats.close || 0) >= 10) Game.ach("close10");
			if (stats.kills >= 50) Game.ach("kills50");
			if (stats.bosses >= 1) Game.ach("boss");
			if (stats.hearts >= 1) Game.ach("heart");
			if (stats.revives >= 1) Game.ach("revive");
		}
		const st = data.stats;
		if ((st.pickups || 0) >= 100) Game.ach("pickups100");
		if (data.coins >= 10000) Game.ach("rich");
		if (Object.keys(data.skins || {}).length >= 3) Game.ach("skins3");
		if (Object.keys(data.codes || {}).length >= 5) Game.ach("codes5");
		if ((st.dist || 0) >= 100000) Game.ach("dist100k");
		if ((st.runs || 0) >= 100) Game.ach("runs100");
		if ((data.level || 1) >= 10) Game.ach("level10");
		if ((st.hearts || 0) >= 1) Game.ach("heart");
		if ((st.revives || 0) >= 1) Game.ach("revive");
		const R = Game.raceState;
		if (R && R.final && R.final !== Game._achFinal) {
			Game._achFinal = R.final;
			if (R.final[0] && R.final[0].id === Online.myId()) Game.ach("vswin");
			request("vs_played");
		}
		if ((data.vsGames || 0) >= 10) Game.ach("vs10");
	}, 500);

	// ---------------- the list
	const ap = panel("achievements", "ACHIEVEMENTS", UO(700, 580));
	function draw() {
		for (const c of ap.body.GetChildren()) if (!c.IsA("UIListLayout")) c.Destroy();
		const got = LIST.filter((a) => has(a.id)).length;
		const head = row(ap.body, 50, 1);
		text(head, got + " / " + LIST.length + " UNLOCKED", U2(0.5, 0, 1, 0), UO(8, 0), 22, COIN, LEFT);
		const [, fill] = xpBar(head, U2(0.5, -20, 0, 12), U2(0.5, 0, 0.5, -6), got / LIST.length, COIN);
		fill.BackgroundColor3 = COIN;
		const grid = make("Frame", { Size: U2(1, -10, 0, 0), AutomaticSize: "Y", BackgroundTransparency: 1, LayoutOrder: nextOrder(), Parent: ap.body });
		make("UIGridLayout", { CellSize: UO(318, 78), CellPadding: UO(8, 8), SortOrder: "LayoutOrder", Parent: grid });
		// unlocked first, newest on top
		const sorted = [...LIST].sort((a, b) => (data.ach[b.id] || 0) - (data.ach[a.id] || 0));
		sorted.forEach((a, i) => {
			const on = has(a.id);
			const c = make("Frame", { BackgroundColor3: BLACK, BackgroundTransparency: on ? 0.3 : 0.6, LayoutOrder: i, Parent: grid });
			make("UICorner", { CornerRadius: UDim.new(0, 10), Parent: c });
			if (on) make("UIStroke", { Color: a.color, Thickness: 2, Transparency: 0.35, ApplyStrokeMode: "Border", Parent: c });
			const ic = make("Frame", { AnchorPoint: V2(0, 0.5), Position: U2(0, 12, 0.5, 0), Size: UO(46, 46), BackgroundColor3: on ? a.color : RGB(60, 62, 72), Parent: c });
			make("UICorner", { CornerRadius: UDim.new(0.5, 0), Parent: ic });
			if (on) make("UIGradient", { Color: new ColorSequence(WHITE, RGB(140, 140, 140)), Rotation: 90, Parent: ic });
			text(ic, on ? "★" : "?", US(1, 1), UO(0, 1), 26, on ? BLACK : DIM);
			text(c, a.name, U2(1, -76, 0, 26), UO(68, 10), 20, on ? WHITE : DIM, LEFT);
			const d = text(c, a.desc.toUpperCase(), U2(1, -76, 0, 34), UO(68, 36), 13, on ? RGB(200, 200, 200) : RGB(110, 110, 120), LEFT);
			d.TextWrapped = true;
		});
	}
	ap.onOpen = draw;
})();

// ------------------------------------------------------------------ real money
// you pay on a stripe page, stripe tells the worker, the worker drops a grant into firebase and we pick it up here.
// links come from the stripe dashboard (payment links). empty link = the button says SOON.
// what you get is decided by the worker, this list is just what the shop shows

const PACKS = {
	special: { price: "9,99 €", gems: 1000, coins: 50000, revives: 10, keys: 15, skin: "Royal", link: "https://buy.stripe.com/test_dRm4gy83RdDZaGO7jA7Re00" },
	gems500: { price: "2,99 €", gems: 500, link: "https://buy.stripe.com/test_14A5kC2JxfM74iq47o7Re01" },
	gems1000: { price: "4,99 €", gems: 1000, tag: "POPULAR", link: "https://buy.stripe.com/test_14A8wO83RczV2ai7jA7Re02" },
	gems2500: { price: "9,99 €", gems: 2500, tag: "BEST VALUE", link: "https://buy.stripe.com/test_fZueVcfwj8jF4iq8nE7Re03" },
	phoenix: { price: "1,99 €", skin: "Phoenix", link: "https://buy.stripe.com/test_cNi6oGck7arN5mu9rI7Re04" },
	galaxy: { price: "1,99 €", skin: "Galaxy", link: "https://buy.stripe.com/test_dRm3cu2Jx43pcOW6fw7Re05" },
	razor: { price: "1,99 €", skin: "Razor", link: "https://buy.stripe.com/test_8x2aEWdobczV8yGgUa7Re06" },
};
const PINK = RGB(255, 70, 170);
// test links (fake card 4242...) only work with ?dev, so nobody gets free stuff while we're testing
for (const id in PACKS) if (PACKS[id].link.includes("/test_") && !DEV) PACKS[id].link = "";

(() => {
	Game.buyPack = (id) => {
		const p = PACKS[id];
		if (!p || !p.link) {
			notify("coming soon", DIM);
			sfx("bad");
			return;
		}
		if (!Online.account()) {
			notify("make an account first, it all goes to your account", BAD);
			sfx("bad");
			Game.openAccount();
			return;
		}
		const ref = Online.myId() + "__" + id;
		window.open(p.link + (p.link.includes("?") ? "&" : "?") + "client_reference_id=" + encodeURIComponent(ref), "_blank");
		notify("finish paying in the new tab, it shows up here by itself", GEM);
		sfx("click");
	};

	function priceButton(parent, id, pos, size) {
		const p = PACKS[id];
		const b = button(parent, p.link ? p.price : "SOON", size || UO(180, 50), pos, () => Game.buyPack(id), 0.1);
		b.TextSize = 26;
		b.TextColor3 = p.link ? GOOD : DIM;
		return b;
	}

	Game.gemShop = (parent) => {
		// ---------------- the special pack, big and loud
		const sp = PACKS.special;
		const box = row(parent, 250, 0.2);
		make("UICorner", { CornerRadius: UDim.new(0, 12), Parent: box });
		make("UIStroke", { Color: COIN, Thickness: 2, Transparency: 0.2, ApplyStrokeMode: "Border", Parent: box });
		make("UIGradient", { Color: new ColorSequence(RGB(255, 225, 150), RGB(200, 130, 255)), Rotation: 20, Parent: box });
		const vp = planeView(box, "Royal", UO(250, 210), UO(14, 20), { bg: RGB(30, 20, 45), bgT: 0.1, round: 10, wind: V3(-28, 0, -12) });
		vp.el.style.pointerEvents = "none";
		text(box, "SPECIAL PACK", UO(420, 40), UO(284, 16), 38, COIN, LEFT);
		const owns = data.skins && data.skins.Royal;
		text(box, owns ? "YOU ALREADY HAVE THE ROYAL SKIN, THE REST STILL COUNTS" : "INCLUDES THE ROYAL SKIN, ONLY IN HERE", UO(420, 20), UO(284, 56), 15, owns ? DIM : PINK, LEFT);
		const lines = [
			[fmt(sp.gems) + " GEMS", GEM, "gem"],
			[fmt(sp.coins) + " COINS", COIN, "coin"],
			[sp.revives + " REVIVES", RGB(255, 100, 130), "heart"],
			[sp.keys + " KEYS", KEY, "key"],
			["ROYAL SKIN", PINK, "user"],
		];
		lines.forEach(([t, c, ic], i) => {
			const x = 284 + (i % 2) * 210, y = 86 + Math.floor(i / 2) * 34;
			const icon = Icons.make(ic, box, 24);
			icon.Position = UO(x, y + 3);
			text(box, t, UO(180, 30), UO(x + 32, y), 22, c, LEFT);
		});
		priceButton(box, "special", U2(1, -214, 1, -66), UO(200, 54));

		// ---------------- gems
		for (const id of ["gems500", "gems1000", "gems2500"]) {
			const p = PACKS[id];
			const r = row(parent, 76);
			const ic = Icons.make("gem", r, id === "gems2500" ? 44 : id === "gems1000" ? 38 : 32);
			ic.AnchorPoint = V2(0.5, 0.5);
			ic.Position = U2(0, 44, 0.5, 0);
			text(r, fmt(p.gems) + " GEMS", U2(0.5, 0, 0, 34), UO(84, 10), 30, WHITE, LEFT);
			if (p.tag) text(r, p.tag, U2(0.5, 0, 0, 20), UO(84, 44), 16, id === "gems2500" ? COIN : GOOD, LEFT);
			priceButton(r, id, U2(1, -194, 0.5, -25));
		}

		// ---------------- the exclusive skins
		text(row(parent, 34, 1), "EXCLUSIVE SKINS", US(1, 1), UO(4, 4), 18, DIM, LEFT);
		const grid = make("Frame", { Size: U2(1, 0, 0, 0), AutomaticSize: "Y", BackgroundTransparency: 1, LayoutOrder: nextOrder(), Parent: parent });
		make("UIGridLayout", { CellSize: UO(234, 230), CellPadding: UO(8, 8), SortOrder: "LayoutOrder", Parent: grid });
		["phoenix", "galaxy", "razor"].forEach((id, i) => {
			const p = PACKS[id];
			const c = make("Frame", { BackgroundColor3: BLACK, BackgroundTransparency: 0.45, LayoutOrder: i, Parent: grid });
			make("UICorner", { CornerRadius: UDim.new(0, 10), Parent: c });
			make("UIStroke", { Color: PINK, Thickness: 2, Transparency: 0.45, ApplyStrokeMode: "Border", Parent: c });
			const v = planeView(c, p.skin, UO(214, 130), UO(10, 8), { bgT: 1, fov: 30, cam: CFrame.lookAt(V3(0, 6, 26), V3(0, -0.3, 0)), spin: 0.6 });
			v.el.style.pointerEvents = "none";
			text(c, niceName(p.skin), U2(1, -10, 0, 28), UO(5, 140), 26, WHITE);
			if (data.skins && data.skins[p.skin]) {
				const l = text(c, "OWNED", U2(1, -10, 0, 40), UO(5, 178), 22, GOOD);
				l.TextColor3 = GOOD;
			} else priceButton(c, id, UO(17, 176), UO(200, 44));
		});

		const fine = row(parent, 44, 1);
		const t = text(fine, "PAYMENTS BY STRIPE: CARD, BANKOMAT, APPLE PAY, GOOGLE PAY. EVERYTHING IS DELIVERED RIGHT AWAY, SO THERE'S NO RIGHT OF WITHDRAWAL ONCE IT'S IN. YOU CAN STILL GET GEMS FOR FREE BY PLAYING.", U2(1, -20, 1, 0), UO(10, 0), 13, DIM, LEFT);
		t.TextWrapped = true;
	};

	// ---------------- picking up what you paid for
	function thanks(g) {
		const wash = make("Frame", { Size: US(1, 1), BackgroundColor3: g.skin ? PINK : GEM, BackgroundTransparency: 0.5, ZIndex: 30, Parent: gui });
		wash.el.style.pointerEvents = "none";
		tw(wash, 1.2, { BackgroundTransparency: 1 });
		Debris.AddItem(wash, 1.3);
		const bits = [];
		if (g.skin) bits.push(niceName(g.skin) + " SKIN");
		if (g.gems) bits.push("+" + fmt(g.gems) + " GEMS");
		if (g.coins) bits.push("+" + fmt(g.coins) + " COINS");
		banner(bits.slice(0, 2).join("  "), g.skin ? PINK : GEM, 3.5);
		notify("thanks for supporting the game!", GOOD);
		sfx("levelup");
		if (g.skin && mode === "menu") buildPlane(g.skin);
		Game.pushProfile();
		if (panels.shop && panels.shop.frame.Visible) rebuildShop();
	}

	const busy = new Set();
	async function claim(uid, id, g) {
		if (busy.has(id)) return;
		busy.add(id);
		const [ok] = request("paid", { id, gems: g.gems, coins: g.coins, keys: g.keys, revives: g.revives, skin: g.skin });
		try {
			await Online.put(`grants/${uid}/${id}/claimed`, true);
		} catch (e) {
			// the save remembers it anyway
		}
		if (ok) {
			Game.cloudSave(true);
			thanks(g);
		}
	}

	let stop = null, who = null;
	function watch() {
		if (!Online.enabled()) return;
		const uid = Online.account() ? Online.myId() : null;
		if (uid === who) return;
		if (stop) stop();
		stop = null;
		who = uid;
		if (!uid) return;
		stop = Online.listen(`grants/${uid}`, (all) => {
			if (!all || typeof all !== "object" || who !== uid) return;
			for (const [id, g] of Object.entries(all)) {
				if (!g || g.claimed) continue;
				if (data.paid && data.paid[id]) Online.put(`grants/${uid}/${id}/claimed`, true).catch(() => {});
				else claim(uid, id, g);
			}
		});
	}
	task.delay(2, watch);
	setInterval(watch, 3000);

	// back from the stripe page
	if (/[?&]paid\b/.test(location.search)) {
		task.delay(2.5, () => notify("payment done, it shows up in a few seconds", GOOD));
		try {
			history.replaceState(null, "", location.pathname);
		} catch (e) {}
	}
})();
