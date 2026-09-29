// a tiny roblox-like runtime on top of three.js, so the game can be ported almost line by line
import * as THREE from "three";
import { EffectComposer } from "./addons/postprocessing/EffectComposer.js";
import { RenderPass } from "./addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "./addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "./addons/postprocessing/OutputPass.js";

export { THREE };

// ------------------------------------------------------------------ math

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
export const rad = (d) => (d * Math.PI) / 180;
export const floor = Math.floor;

// math.random like lua: random() -> [0,1), random(n) -> 1..n, random(a,b) -> a..b integers
export function random(a, b) {
	if (a === undefined) return Math.random();
	if (b === undefined) return 1 + Math.floor(Math.random() * a);
	a = Math.ceil(a);
	b = Math.floor(b);
	if (b < a) return a;
	return a + Math.floor(Math.random() * (b - a + 1));
}

export class Vector3 {
	constructor(x = 0, y = 0, z = 0) {
		this.X = x;
		this.Y = y;
		this.Z = z;
	}
	add(v) { return new Vector3(this.X + v.X, this.Y + v.Y, this.Z + v.Z); }
	sub(v) { return new Vector3(this.X - v.X, this.Y - v.Y, this.Z - v.Z); }
	mul(s) {
		if (typeof s === "number") return new Vector3(this.X * s, this.Y * s, this.Z * s);
		return new Vector3(this.X * s.X, this.Y * s.Y, this.Z * s.Z);
	}
	div(s) {
		if (typeof s === "number") return new Vector3(this.X / s, this.Y / s, this.Z / s);
		return new Vector3(this.X / s.X, this.Y / s.Y, this.Z / s.Z);
	}
	neg() { return new Vector3(-this.X, -this.Y, -this.Z); }
	get Magnitude() { return Math.hypot(this.X, this.Y, this.Z); }
	get Unit() {
		const m = this.Magnitude;
		return m > 1e-9 ? this.div(m) : new Vector3(0, 0, 0);
	}
	Dot(v) { return this.X * v.X + this.Y * v.Y + this.Z * v.Z; }
	Cross(v) { return new Vector3(this.Y * v.Z - this.Z * v.Y, this.Z * v.X - this.X * v.Z, this.X * v.Y - this.Y * v.X); }
	Lerp(v, t) { return new Vector3(lerp(this.X, v.X, t), lerp(this.Y, v.Y, t), lerp(this.Z, v.Z, t)); }
	abs() { return new Vector3(Math.abs(this.X), Math.abs(this.Y), Math.abs(this.Z)); }
}
export const V3 = (x, y, z) => new Vector3(x, y, z);
Vector3.zero = new Vector3(0, 0, 0);
Vector3.one = new Vector3(1, 1, 1);
Vector3.xAxis = new Vector3(1, 0, 0);
Vector3.yAxis = new Vector3(0, 1, 0);
Vector3.zAxis = new Vector3(0, 0, 1);

export class Vector2 {
	constructor(x = 0, y = 0) {
		this.X = x;
		this.Y = y;
	}
}

export class Color3 {
	constructor(r = 0, g = 0, b = 0) {
		this.R = r;
		this.G = g;
		this.B = b;
	}
	static fromRGB(r, g, b) { return new Color3(clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255); }
	static fromHSV(h, s, v) {
		h = ((h % 1) + 1) % 1;
		const i = Math.floor(h * 6), f = h * 6 - i;
		const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
		const m = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
		return new Color3(m[0], m[1], m[2]);
	}
	Lerp(c, t) { return new Color3(lerp(this.R, c.R, t), lerp(this.G, c.G, t), lerp(this.B, c.B, t)); }
	css(a = 1) { return `rgba(${Math.round(this.R * 255)},${Math.round(this.G * 255)},${Math.round(this.B * 255)},${a})`; }
	hex() { return (Math.round(this.R * 255) << 16) | (Math.round(this.G * 255) << 8) | Math.round(this.B * 255); }
	key() { return this.hex(); }
}
export const RGB = Color3.fromRGB;
export const WHITE3 = new Color3(1, 1, 1);

// roblox CFrame: position + rotation matrix, columns are right, up, back
export class CFrame {
	constructor(x = 0, y = 0, z = 0, r = null) {
		this.p = new Vector3(x, y, z);
		// row-major 3x3
		this.r = r || [1, 0, 0, 0, 1, 0, 0, 0, 1];
	}
	static new(x, y, z) {
		if (x instanceof Vector3) return new CFrame(x.X, x.Y, x.Z);
		return new CFrame(x || 0, y || 0, z || 0);
	}
	static fromPos(v) { return new CFrame(v.X, v.Y, v.Z); }
	static Angles(rx, ry, rz) {
		// roblox: Rx * Ry * Rz
		const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
		const Rx = [1, 0, 0, 0, cx, -sx, 0, sx, cx];
		const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
		const Rz = [cz, -sz, 0, sz, cz, 0, 0, 0, 1];
		return new CFrame(0, 0, 0, mm(mm(Rx, Ry), Rz));
	}
	static fromEulerAnglesXYZ(rx, ry, rz) { return CFrame.Angles(rx, ry, rz); }
	static lookAt(at, target, up = Vector3.yAxis) {
		let look = target.sub(at);
		if (look.Magnitude < 1e-9) return new CFrame(at.X, at.Y, at.Z);
		look = look.Unit;
		let right = look.Cross(up);
		if (right.Magnitude < 1e-6) right = look.Cross(new Vector3(0, 0, 1));
		right = right.Unit;
		const u = right.Cross(look).Unit;
		const back = look.neg();
		// columns right, up, back
		return new CFrame(at.X, at.Y, at.Z, [right.X, u.X, back.X, right.Y, u.Y, back.Y, right.Z, u.Z, back.Z]);
	}
	static fromMatrix(pos, rx, ry, rz) {
		return new CFrame(pos.X, pos.Y, pos.Z, [rx.X, ry.X, rz.X, rx.Y, ry.Y, rz.Y, rx.Z, ry.Z, rz.Z]);
	}
	get Position() { return this.p; }
	get X() { return this.p.X; }
	get Y() { return this.p.Y; }
	get Z() { return this.p.Z; }
	get Rotation() { return new CFrame(0, 0, 0, this.r.slice()); }
	get LookVector() { return new Vector3(-this.r[2], -this.r[5], -this.r[8]); }
	get RightVector() { return new Vector3(this.r[0], this.r[3], this.r[6]); }
	get UpVector() { return new Vector3(this.r[1], this.r[4], this.r[7]); }
	// cf * cf
	mul(o) {
		if (o instanceof Vector3) return this.pointToWorld(o);
		const r = mm(this.r, o.r);
		const p = this.pointToWorld(o.p);
		return new CFrame(p.X, p.Y, p.Z, r);
	}
	pointToWorld(v) {
		const r = this.r;
		return new Vector3(
			r[0] * v.X + r[1] * v.Y + r[2] * v.Z + this.p.X,
			r[3] * v.X + r[4] * v.Y + r[5] * v.Z + this.p.Y,
			r[6] * v.X + r[7] * v.Y + r[8] * v.Z + this.p.Z,
		);
	}
	VectorToWorldSpace(v) {
		const r = this.r;
		return new Vector3(r[0] * v.X + r[1] * v.Y + r[2] * v.Z, r[3] * v.X + r[4] * v.Y + r[5] * v.Z, r[6] * v.X + r[7] * v.Y + r[8] * v.Z);
	}
	VectorToObjectSpace(v) {
		const r = this.r;
		return new Vector3(r[0] * v.X + r[3] * v.Y + r[6] * v.Z, r[1] * v.X + r[4] * v.Y + r[7] * v.Z, r[2] * v.X + r[5] * v.Y + r[8] * v.Z);
	}
	Inverse() {
		const r = this.r;
		const t = [r[0], r[3], r[6], r[1], r[4], r[7], r[2], r[5], r[8]];
		const p = this.p;
		const nx = -(t[0] * p.X + t[1] * p.Y + t[2] * p.Z);
		const ny = -(t[3] * p.X + t[4] * p.Y + t[5] * p.Z);
		const nz = -(t[6] * p.X + t[7] * p.Y + t[8] * p.Z);
		return new CFrame(nx, ny, nz, t);
	}
	ToObjectSpace(o) { return this.Inverse().mul(o); }
	PointToObjectSpace(v) { return this.Inverse().pointToWorld(v); }
	add(v) { return new CFrame(this.p.X + v.X, this.p.Y + v.Y, this.p.Z + v.Z, this.r.slice()); }
	sub(v) { return new CFrame(this.p.X - v.X, this.p.Y - v.Y, this.p.Z - v.Z, this.r.slice()); }
	ToEulerAnglesXYZ() {
		const r = this.r;
		// R = Rx Ry Rz
		const sy = clamp(r[2], -1, 1);
		const ry = Math.asin(sy);
		let rx, rz;
		if (Math.abs(sy) < 0.99999) {
			rx = Math.atan2(-r[5], r[8]);
			rz = Math.atan2(-r[1], r[0]);
		} else {
			rx = Math.atan2(r[7], r[4]);
			rz = 0;
		}
		return [rx, ry, rz];
	}
	quat() {
		const m = new THREE.Matrix4();
		const r = this.r;
		m.set(r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0, 0, 0, 0, 1);
		return new THREE.Quaternion().setFromRotationMatrix(m);
	}
	static fromQuat(p, q) {
		const m = new THREE.Matrix4().makeRotationFromQuaternion(q);
		const e = m.elements; // column-major
		return new CFrame(p.X, p.Y, p.Z, [e[0], e[4], e[8], e[1], e[5], e[9], e[2], e[6], e[10]]);
	}
	Lerp(o, t) {
		const q = this.quat().slerp(o.quat(), t);
		return CFrame.fromQuat(this.p.Lerp(o.p, t), q);
	}
}
function mm(a, b) {
	return [
		a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
		a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
		a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
	];
}
export const CF = (x, y, z) => CFrame.new(x, y, z);
export const Angles = CFrame.Angles;

export class UDim2 {
	constructor(xs = 0, xo = 0, ys = 0, yo = 0) {
		this.xs = xs;
		this.xo = xo;
		this.ys = ys;
		this.yo = yo;
	}
	static fromScale(x, y) { return new UDim2(x, 0, y, 0); }
	static fromOffset(x, y) { return new UDim2(0, x, 0, y); }
	add(o) { return new UDim2(this.xs + o.xs, this.xo + o.xo, this.ys + o.ys, this.yo + o.yo); }
	Lerp(o, t) { return new UDim2(lerp(this.xs, o.xs, t), lerp(this.xo, o.xo, t), lerp(this.ys, o.ys, t), lerp(this.yo, o.yo, t)); }
}
export const U2 = (a, b, c, d) => new UDim2(a, b, c, d);
export const UDim = { new: (s, o) => ({ Scale: s || 0, Offset: o || 0 }) };
export const US = UDim2.fromScale;
export const UO = UDim2.fromOffset;

// seeded rng like roblox's Random
export class Random {
	constructor(seed) {
		this.s = (Math.floor(Math.abs(seed)) % 2147483647) || 1;
		for (let i = 0; i < 4; i++) this.next();
	}
	next() {
		// mulberry32
		let t = (this.s += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}
	NextNumber(a, b) {
		if (a === undefined) return this.next();
		return a + (b - a) * this.next();
	}
	NextInteger(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
}

// ------------------------------------------------------------------ time + scheduler

export const clock = () => performance.now() / 1000;
export const osTime = () => Math.floor(Date.now() / 1000);
let timers = [];
export const task = {
	wait(t = 0) {
		return new Promise((res) => timers.push({ at: clock() + t, fn: () => res(frameDt) }));
	},
	delay(t, fn) {
		timers.push({ at: clock() + t, fn });
	},
	spawn(fn, ...args) {
		try {
			const r = fn(...args);
			if (r && r.catch) r.catch((e) => console.error(e));
		} catch (e) {
			console.error(e);
		}
	},
	defer(fn) {
		timers.push({ at: 0, fn });
	},
};
function runTimers() {
	const now = clock();
	const due = [];
	timers = timers.filter((t) => {
		if (t.at <= now) {
			due.push(t);
			return false;
		}
		return true;
	});
	for (const t of due) {
		try {
			const r = t.fn();
			if (r && r.catch) r.catch((e) => console.error(e));
		} catch (e) {
			console.error(e);
		}
	}
}

export class Signal {
	constructor() { this.list = []; }
	Connect(fn) {
		const c = { fn, Connected: true, Disconnect: () => { c.Connected = false; this.list = this.list.filter((x) => x !== c); } };
		this.list.push(c);
		return c;
	}
	Fire(...a) {
		for (const c of this.list.slice()) {
			if (!c.Connected) continue;
			try {
				const r = c.fn(...a);
				if (r && r.catch) r.catch((e) => console.error(e));
			} catch (e) {
				console.error(e);
			}
		}
	}
}

export const RunService = { RenderStepped: new Signal(), Heartbeat: new Signal() };
let frameDt = 1 / 60;

// ------------------------------------------------------------------ renderer + scene

const container = document.getElementById("view");
export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

export const scene = new THREE.Scene();
const cam3 = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.5, 20000);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, cam3));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.45, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

window.addEventListener("resize", () => {
	renderer.setSize(window.innerWidth, window.innerHeight);
	composer.setSize(window.innerWidth, window.innerHeight);
	cam3.aspect = window.innerWidth / window.innerHeight;
	cam3.updateProjectionMatrix();
	camera.ViewportSize = new Vector2(window.innerWidth, window.innerHeight);
	camera._vpSignal.Fire();
});

export const camera = {
	CFrame: new CFrame(0, 50, 50),
	FieldOfView: 70,
	CameraType: "Scriptable",
	ViewportSize: new Vector2(window.innerWidth, window.innerHeight),
	_vpSignal: new Signal(),
	GetPropertyChangedSignal() { return this._vpSignal; },
	// screen pixels plus depth, like roblox: behind the camera comes back mirrored with a negative z
	WorldToViewportPoint(p) {
		const rel = this.CFrame.PointToObjectSpace(p);
		const z = -rel.Z;
		const zz = Math.abs(z) < 1e-3 ? (z < 0 ? -1e-3 : 1e-3) : z;
		const W = window.innerWidth, H = window.innerHeight;
		const tv = Math.tan(rad(this.FieldOfView) / 2), th = (tv * W) / H;
		const x = W / 2 + (rel.X / zz / th) * (W / 2);
		const y = H / 2 - (rel.Y / zz / tv) * (H / 2);
		return [new Vector3(x, y, z), z > 0 && x >= 0 && x <= W && y >= 0 && y <= H];
	},
	FindFirstChildOfClass() { return null; },
};

// ------------------------------------------------------------------ lighting

const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -260;
sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260;
sun.shadow.camera.bottom = -260;
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 1600;
sun.shadow.bias = -0.0008;
scene.add(sun);
scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xcfe0ff, 0x7a7466, 0.9);
scene.add(hemi);
const amb = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(amb);
scene.fog = new THREE.Fog(0xbecde1, 500, 1400);

// sky dome with day/night gradient, sun + moon discs and stars
const skyGeo = new THREE.SphereGeometry(9000, 32, 16);
const skyMat = new THREE.ShaderMaterial({
	side: THREE.BackSide,
	depthWrite: false,
	fog: false,
	uniforms: { top: { value: new THREE.Color(0x4f86d6) }, mid: { value: new THREE.Color(0xa9c8ee) }, bottom: { value: new THREE.Color(0xd8e4f2) } },
	vertexShader: `varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
	fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vp;
	void main(){ float h = vp.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h,0.0,1.0), 0.6)) : mix(mid, bottom, clamp(-h*4.0,0.0,1.0)); gl_FragColor = vec4(c,1.0); }`,
});
const sky = new THREE.Mesh(skyGeo, skyMat);
sky.renderOrder = -10;
scene.add(sky);

function discTexture(soft) {
	const c = document.createElement("canvas");
	c.width = c.height = 128;
	const g = c.getContext("2d");
	const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
	if (soft) {
		gr.addColorStop(0, "rgba(255,255,255,1)");
		gr.addColorStop(0.35, "rgba(255,255,255,0.6)");
		gr.addColorStop(1, "rgba(255,255,255,0)");
	} else {
		gr.addColorStop(0, "rgba(255,255,255,1)");
		gr.addColorStop(0.92, "rgba(255,255,255,1)");
		gr.addColorStop(1, "rgba(255,255,255,0)");
	}
	g.fillStyle = gr;
	g.fillRect(0, 0, 128, 128);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}
function moonTexture() {
	const c = document.createElement("canvas");
	c.width = c.height = 256;
	const g = c.getContext("2d");
	g.beginPath();
	g.arc(128, 128, 124, 0, Math.PI * 2);
	g.fillStyle = "#dcdcd6";
	g.fill();
	g.save();
	g.clip();
	let s = 7;
	const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
	for (let i = 0; i < 70; i++) {
		const x = rnd() * 256, y = rnd() * 256, r = 4 + rnd() * 22;
		g.beginPath();
		g.arc(x, y, r, 0, Math.PI * 2);
		g.fillStyle = `rgba(120,120,115,${0.12 + rnd() * 0.25})`;
		g.fill();
	}
	g.restore();
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}
export const SOFT_TEX = discTexture(true);
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTexture(true), color: 0xfff4d8, fog: false, depthWrite: false, transparent: true }));
sunSprite.scale.set(900, 900, 1);
scene.add(sunSprite);
const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(), color: 0xffffff, fog: false, depthWrite: false, transparent: true }));
scene.add(moonSprite);
const starGeo = new THREE.BufferGeometry();
{
	const n = 5000;
	const arr = new Float32Array(n * 3);
	for (let i = 0; i < n; i++) {
		const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
		const r = Math.sqrt(1 - u * u);
		arr[i * 3] = r * Math.cos(th) * 8500;
		arr[i * 3 + 1] = Math.abs(u) * 8500;
		arr[i * 3 + 2] = r * Math.sin(th) * 8500;
	}
	starGeo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
}
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 });
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

export const Lighting = {
	ClockTime: 14,
	GeographicLatitude: 20,
	FogColor: RGB(190, 205, 225),
	FogStart: 500,
	FogEnd: 1400,
	OutdoorAmbient: RGB(128, 128, 128),
	Ambient: RGB(70, 70, 70),
	Brightness: 2,
	ExposureCompensation: 0,
	GlobalShadows: true,
	_sky: { MoonAngularSize: 11, StarCount: 3000, SunAngularSize: 21 },
	_bloom: { Intensity: 0, Size: 40, Threshold: 0.95 },
	FindFirstChildOfClass(c) {
		if (c === "Sky") return this._sky;
		return null;
	},
};

Lighting._moonDir = null;
Lighting.GetSunDirection = () => {
	const d = sunDir(Lighting.ClockTime, Lighting.GeographicLatitude);
	return new Vector3(d.x, d.y, d.z);
};
Lighting.GetMoonDirection = () => {
	if (Lighting._moonDir) return Lighting._moonDir;
	const d = sunDir(Lighting.ClockTime, Lighting.GeographicLatitude).multiplyScalar(-1);
	if (d.y < 0.08) d.y = 0.08 + (0.08 - d.y) * 0.2;
	d.normalize();
	return new Vector3(d.x, d.y, d.z);
};

function sunDir(clockTime, lat) {
	// the sun goes around once a day, tilted by latitude
	const a = ((clockTime - 6) / 24) * Math.PI * 2;
	const tilt = rad(clamp(lat, -80, 80));
	const x = Math.cos(a);
	const y = Math.sin(a) * Math.cos(tilt);
	const z = Math.sin(a) * Math.sin(tilt) + 0.6;
	return new THREE.Vector3(x, y, z).normalize();
}

const tmpC = new THREE.Color();
function updateLighting(camPos) {
	const L = Lighting;
	const dir = sunDir(L.ClockTime, L.GeographicLatitude);
	const day = clamp(dir.y * 3 + 0.2, 0, 1);
	sun.position.set(camPos.x + dir.x * 800, camPos.y + Math.max(dir.y, 0.05) * 800, camPos.z + dir.z * 800);
	sun.target.position.set(camPos.x, 0, camPos.z);
	sun.intensity = 2.6 * day * (L.Brightness / 2);
	sun.color.setRGB(1, 0.92 + 0.08 * day, 0.82 + 0.18 * day);
	sun.castShadow = !!L.GlobalShadows && day > 0.15 && !lowGfx;
	const oa = L.OutdoorAmbient;
	hemi.color.setRGB(oa.R * 1.2 + 0.25 * day, oa.G * 1.2 + 0.3 * day, oa.B * 1.2 + 0.4 * day);
	hemi.groundColor.setRGB(oa.R * 0.7, oa.G * 0.65, oa.B * 0.6);
	hemi.intensity = 0.7 + 0.5 * day;
	amb.color.setRGB(L.Ambient.R, L.Ambient.G, L.Ambient.B);
	amb.intensity = 0.9 + 0.4 * day;
	renderer.toneMappingExposure = Math.pow(2, L.ExposureCompensation) * (0.95 + 0.3 * day);
	scene.fog.color.setRGB(L.FogColor.R, L.FogColor.G, L.FogColor.B, THREE.SRGBColorSpace);
	scene.fog.near = L.FogStart;
	scene.fog.far = L.FogEnd;
	// sky colors: day blue, sunset orange, night navy, all tinted toward the fog color at the horizon
	const fc = scene.fog.color;
	const night = new THREE.Color(0x05070f), dayTop = new THREE.Color(0x3d78cf);
	const dusk = clamp(1 - Math.abs(dir.y) * 5, 0, 1) * (dir.y > -0.25 ? 1 : 0);
	skyMat.uniforms.top.value.copy(night).lerp(dayTop, day);
	skyMat.uniforms.mid.value.copy(skyMat.uniforms.top.value).lerp(fc, 0.55).lerp(new THREE.Color(0xff9a55), dusk * 0.45);
	skyMat.uniforms.bottom.value.copy(fc);
	// everything in the sky sits just inside the far plane
	const far = cam3.far * 0.85, ks = far / 8000;
	sky.position.copy(camPos);
	sky.scale.setScalar(far / 9000 * 1.05);
	sunSprite.position.set(camPos.x + dir.x * far, camPos.y + dir.y * far, camPos.z + dir.z * far);
	sunSprite.scale.set(900 * ks, 900 * ks, 1);
	sunSprite.visible = dir.y > -0.1;
	const mv = Lighting.GetMoonDirection();
	const md = new THREE.Vector3(mv.X, mv.Y, mv.Z);
	moonSprite.position.set(camPos.x + md.x * far * 0.98, camPos.y + md.y * far * 0.98, camPos.z + md.z * far * 0.98);
	const ms = (L._sky.MoonAngularSize / 11) * 380 * ks;
	moonSprite.scale.set(ms, ms, 1);
	moonSprite.visible = day < 0.6;
	moonSprite.material.opacity = clamp(1 - day * 1.6, 0, 1);
	stars.position.copy(camPos);
	stars.scale.setScalar(ks);
	starMat.opacity = clamp(1 - day * 2.5, 0, 1) * clamp(L._sky.StarCount / 3000, 0, 1.5);
	bloom.strength = 0.35 + L._bloom.Intensity * 0.9;
}

let lowGfx = false;
export function setLowGraphics(on) {
	lowGfx = on;
	renderer.setPixelRatio(on ? 1 : Math.min(window.devicePixelRatio, 1.5));
}

// ------------------------------------------------------------------ instances

const geoBox = new THREE.BoxGeometry(1, 1, 1);
const geoBall = new THREE.SphereGeometry(0.5, 20, 14);
const geoCyl = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
geoCyl.rotateZ(Math.PI / 2); // roblox cylinders run along X
const geoWedge = (() => {
	// roblox wedge: slope from top-back down to bottom-front (front = -Z)
	const g = new THREE.BufferGeometry();
	const v = [
		[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5],
	];
	const f = [
		[0, 2, 1], [0, 3, 2], // bottom
		[3, 5, 2], [3, 4, 5], // back
		[0, 1, 5], [0, 5, 4], // slope
		[0, 4, 3], // left
		[1, 2, 5], // right
	];
	const pos = [];
	for (const t of f) for (const i of t) pos.push(...v[i]);
	g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
	g.computeVertexNormals();
	return g;
})();

export const Enum = {
	Material: { Plastic: "Plastic", SmoothPlastic: "SmoothPlastic", Neon: "Neon", Glass: "Glass", Metal: "Metal", Slate: "Slate", ForceField: "ForceField", Wood: "Wood" },
	PartType: { Block: "Block", Ball: "Ball", Cylinder: "Cylinder" },
	EasingStyle: { Linear: "Linear", Quad: "Quad", Quint: "Quint", Back: "Back", Sine: "Sine", Cubic: "Cubic", Exponential: "Exponential", Elastic: "Elastic", Bounce: "Bounce", Quart: "Quart" },
	EasingDirection: { In: "In", Out: "Out", InOut: "InOut" },
	TextXAlignment: { Left: "left", Center: "center", Right: "right" },
	TextYAlignment: { Top: "top", Center: "center", Bottom: "bottom" },
	FillDirection: { Horizontal: "row", Vertical: "column" },
	SortOrder: { LayoutOrder: "LayoutOrder", Name: "Name" },
	AutomaticSize: { None: "None", X: "X", Y: "Y", XY: "XY" },
	ScrollingDirection: { X: "X", Y: "Y", XY: "XY" },
	TextTruncate: { None: "None", AtEnd: "AtEnd" },
	ScaleType: { Fit: "Fit", Stretch: "Stretch", Crop: "Crop" },
	ZIndexBehavior: { Sibling: "Sibling" },
	HorizontalAlignment: { Center: "center", Left: "flex-start", Right: "flex-end" },
	VerticalAlignment: { Center: "center", Top: "flex-start", Bottom: "flex-end" },
	ApplyStrokeMode: { Border: "Border", Contextual: "Contextual" },
};

const matCache = new Map();
function makeMaterial(color, material, transparency, reflect) {
	const neon = material === "Neon";
	const glass = material === "Glass";
	const ff = material === "ForceField";
	let m;
	const c = new THREE.Color().setRGB(color.R, color.G, color.B, THREE.SRGBColorSpace);
	if (neon) {
		m = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.6) });
	} else if (ff) {
		m = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.4), wireframe: false, blending: THREE.AdditiveBlending, depthWrite: false });
	} else {
		m = new THREE.MeshStandardMaterial({
			color: c,
			roughness: glass ? 0.05 : material === "Metal" ? 0.35 : material === "SmoothPlastic" ? 0.5 : 0.75,
			metalness: material === "Metal" ? 0.55 : glass ? 0.1 : 0,
		});
	}
	const t = clamp(transparency, 0, 1) + (ff ? 0.45 : 0);
	if (t > 0 || glass) {
		m.transparent = true;
		m.opacity = clamp(1 - t * (glass ? 0.95 : 1), 0, 1);
		if (glass) m.opacity = Math.min(m.opacity, 0.65);
		m.depthWrite = t < 0.5 && !glass;
	}
	return m;
}
function getMaterial(part) {
	const t = part._t();
	const key = part.Color.hex() + "|" + part.Material + "|" + Math.round(t * 50);
	if (part._uniqueMat) {
		if (!part._ownMat) part._ownMat = makeMaterial(part.Color, part.Material, t);
		return part._ownMat;
	}
	let m = matCache.get(key);
	if (!m) {
		m = makeMaterial(part.Color, part.Material, t);
		matCache.set(key, m);
	}
	return m;
}

let instCount = 0;
export class Instance {
	constructor(className) {
		this.ClassName = className;
		this.Name = className;
		this._parent = null;
		this._children = [];
		this._attr = {};
		this._id = ++instCount;
	}
	static new(className) { return makeInstance(className); }
	get Parent() { return this._parent; }
	set Parent(p) {
		if (p === this._parent) return;
		if (this._destroyed && p) return;
		const old = this._parent;
		if (old) {
			const i = old._children.indexOf(this);
			if (i >= 0) old._children.splice(i, 1);
			if (old._childRemoved) old._childRemoved(this);
		}
		this._parent = p;
		if (p) {
			p._children.push(this);
			if (p._childAdded) p._childAdded(this);
		}
		this._ancestryChanged();
	}
	_ancestryChanged() {
		this._onAncestry && this._onAncestry();
		for (const c of this._children) c._ancestryChanged();
	}
	IsA(c) {
		if (c === this.ClassName) return true;
		if (c === "BasePart") return this._isPart === true;
		if (c === "GuiObject" || c === "GuiButton") return this._isGui && (c === "GuiObject" || this._isButton);
		if (c === "Part") return this.ClassName === "Part";
		return false;
	}
	GetChildren() { return this._children.slice(); }
	GetDescendants() {
		const out = [];
		const walk = (n) => {
			for (const c of n._children) {
				out.push(c);
				walk(c);
			}
		};
		walk(this);
		return out;
	}
	FindFirstChild(name) { return this._children.find((c) => c.Name === name) || null; }
	FindFirstChildOfClass(cls) { return this._children.find((c) => c.ClassName === cls) || null; }
	FindFirstAncestorOfClass(cls) {
		let p = this._parent;
		while (p) {
			if (p.ClassName === cls) return p;
			p = p._parent;
		}
		return null;
	}
	IsDescendantOf(a) {
		let p = this._parent;
		while (p) {
			if (p === a) return true;
			p = p._parent;
		}
		return false;
	}
	ClearAllChildren() {
		for (const c of this._children.slice()) c.Destroy();
	}
	Destroy() {
		if (this._destroyed) return;
		for (const c of this._children.slice()) c.Destroy();
		this.Parent = null;
		this._destroyed = true;
		this._onDestroy && this._onDestroy();
	}
	SetAttribute(k, v) { this._attr[k] = v; }
	GetAttribute(k) { return this._attr[k]; }
}

// the 3d root everything renders under
export const workspace = new Instance("Workspace");
workspace._inWorld = true;
workspace.Gravity = 196.2;
workspace.CurrentCamera = camera;

function inWorkspace(inst) {
	let p = inst;
	while (p) {
		if (p === workspace) return true;
		p = p._parent;
	}
	return false;
}

// ---------------- spatial hash for overlap queries
const CELL = 64;
const grid = new Map();
function cellKey(x, z) { return x * 73856093 ^ z * 19349663; }
function aabbOf(part) {
	const s = part.Size, r = part.CFrame.r, p = part.CFrame.p;
	let hx, hy, hz;
	if (part.Shape === "Ball") {
		hx = hy = hz = Math.min(s.X, s.Y, s.Z) / 2;
	} else {
		hx = Math.abs(r[0]) * s.X / 2 + Math.abs(r[1]) * s.Y / 2 + Math.abs(r[2]) * s.Z / 2;
		hy = Math.abs(r[3]) * s.X / 2 + Math.abs(r[4]) * s.Y / 2 + Math.abs(r[5]) * s.Z / 2;
		hz = Math.abs(r[6]) * s.X / 2 + Math.abs(r[7]) * s.Y / 2 + Math.abs(r[8]) * s.Z / 2;
	}
	return [p.X - hx, p.Y - hy, p.Z - hz, p.X + hx, p.Y + hy, p.Z + hz];
}
function gridRemove(part) {
	if (!part._cells) return;
	for (const k of part._cells) {
		const set = grid.get(k);
		if (set) {
			set.delete(part);
			if (set.size === 0) grid.delete(k);
		}
	}
	part._cells = null;
}
function gridInsert(part) {
	gridRemove(part);
	const b = aabbOf(part);
	part._aabb = b;
	const x0 = Math.floor(b[0] / CELL), x1 = Math.floor(b[3] / CELL), z0 = Math.floor(b[2] / CELL), z1 = Math.floor(b[5] / CELL);
	part._cells = [];
	if ((x1 - x0 + 1) * (z1 - z0 + 1) > 400) {
		// huge parts go in one catch-all cell
		const k = "big";
		if (!grid.has(k)) grid.set(k, new Set());
		grid.get(k).add(part);
		part._cells.push(k);
		return;
	}
	for (let x = x0; x <= x1; x++) {
		for (let z = z0; z <= z1; z++) {
			const k = cellKey(x, z);
			let set = grid.get(k);
			if (!set) {
				set = new Set();
				grid.set(k, set);
			}
			set.add(part);
			part._cells.push(k);
		}
	}
}

const shadowOK = () => !lowGfx;

export class BasePart extends Instance {
	constructor(className, shape) {
		super(className);
		this._isPart = true;
		this._size = new Vector3(4, 1, 2);
		this._cf = new CFrame();
		this._color = RGB(163, 162, 165);
		this._mat = "Plastic";
		this._trans = 0;
		this._ltm = 0;
		this.Anchored = false;
		this.CanCollide = true;
		this._canQuery = true;
		this._cast = true;
		this.CanTouch = true;
		this.Massless = false;
		this.Reflectance = 0;
		this.CollisionGroup = "Default";
		this._shape = shape || "Block";
		this.AssemblyLinearVelocity = Vector3.zero;
		this.AssemblyAngularVelocity = Vector3.zero;
		this._welds = [];
		this.mesh = null;
	}
	_t() { return clamp(this._trans + this._ltm, 0, 1); }
	_ensureMesh() {
		if (this.mesh || this._noMesh) return;
		const g = this.ClassName === "WedgePart" ? geoWedge : this._shape === "Ball" ? geoBall : this._shape === "Cylinder" ? geoCyl : geoBox;
		this.mesh = new THREE.Mesh(g, getMaterial(this));
		this.mesh.castShadow = this._cast && shadowOK();
		this.mesh.receiveShadow = true;
		this.mesh.matrixAutoUpdate = false;
		this._syncMesh();
	}
	_syncMesh() {
		if (this._mergeRef) {
			writeMerged(this);
			return;
		}
		const m = this.mesh;
		if (!m) return;
		const r = this._cf.r, p = this._cf.p, s = this._size;
		let sx = s.X, sy = s.Y, sz = s.Z;
		if (this._shape === "Ball" && !this._ellipsoid) sx = sy = sz = Math.min(s.X, s.Y, s.Z);
		else if (this._shape === "Cylinder") {
			const d = Math.min(s.Y, s.Z);
			sy = sz = d;
		}
		const e = m.matrix.elements;
		e[0] = r[0] * sx; e[1] = r[3] * sx; e[2] = r[6] * sx; e[3] = 0;
		e[4] = r[1] * sy; e[5] = r[4] * sy; e[6] = r[7] * sy; e[7] = 0;
		e[8] = r[2] * sz; e[9] = r[5] * sz; e[10] = r[8] * sz; e[11] = 0;
		e[12] = p.X; e[13] = p.Y; e[14] = p.Z; e[15] = 1;
		m.matrixWorldNeedsUpdate = true;
	}
	_refreshMat() {
		if (this.mesh) {
			if (this._uniqueMat && this._ownMat) {
				const t = this._t();
				const glass = this._mat === "Glass";
				this._ownMat.transparent = t > 0 || glass;
				this._ownMat.opacity = clamp(1 - t, 0, 1) * (glass ? 0.65 : 1);
				this._ownMat.depthWrite = t < 0.5 && !glass;
				const c = new THREE.Color().setRGB(this._color.R, this._color.G, this._color.B, THREE.SRGBColorSpace);
				if (this._mat === "Neon") c.multiplyScalar(1.6);
				this._ownMat.color.copy(c);
				this.mesh.visible = t < 0.999;
			} else {
				this.mesh.material = getMaterial(this);
				this.mesh.visible = this._t() < 0.999;
			}
		}
	}
	_onAncestry() {
		const inW = inWorkspace(this);
		if (inW) {
			this._ensureMesh();
			if (this.mesh && !this.mesh.parent) scene.add(this.mesh);
			this._refreshMat();
			this._qroot = queryRoot(this);
			if (this._canQuery && this._qroot) gridInsert(this);
			else gridRemove(this);
			if (!this.Anchored) physicsSet.add(this);
		} else {
			if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
			gridRemove(this);
			this._qroot = null;
			physicsSet.delete(this);
		}
	}
	_onDestroy() {
		if (this.mesh) {
			if (this.mesh.parent) this.mesh.parent.remove(this.mesh);
			if (this._ownMat) this._ownMat.dispose();
			this.mesh = null;
		}
		if (this._mergeRef) {
			this._size = Vector3.zero;
			writeMerged(this);
			this._mergeRef = null;
		}
		gridRemove(this);
		physicsSet.delete(this);
	}
	get Size() { return this._size; }
	set Size(v) {
		this._size = v;
		this._syncMesh();
		if (this._cells) gridInsert(this);
	}
	get CFrame() { return this._cf; }
	set CFrame(cf) {
		this._cf = cf;
		this._syncMesh();
		if (this._cells) gridInsert(this);
		if (this._welds.length) for (const w of this._welds) w._follow();
	}
	get Position() { return this._cf.p; }
	set Position(v) { this.CFrame = new CFrame(v.X, v.Y, v.Z, this._cf.r); }
	get Orientation() { return Vector3.zero; }
	get Color() { return this._color; }
	set Color(c) {
		this._color = c;
		if (this._mergeRef) writeMerged(this);
		this._refreshMat();
	}
	get Material() { return this._mat; }
	set Material(m) {
		this._mat = m;
		this._refreshMat();
	}
	get Transparency() { return this._trans; }
	set Transparency(t) {
		this._trans = t;
		this._refreshMat();
	}
	get LocalTransparencyModifier() { return this._ltm; }
	set LocalTransparencyModifier(t) {
		this._ltm = t;
		this._refreshMat();
	}
	get Shape() { return this._shape; }
	set Shape(s) {
		this._shape = s;
		if (this.mesh) {
			this.mesh.geometry = s === "Ball" ? geoBall : s === "Cylinder" ? geoCyl : geoBox;
			this._syncMesh();
		}
	}
	get CanQuery() { return this._canQuery; }
	set CanQuery(v) {
		this._canQuery = v;
		if (!v) gridRemove(this);
		else if (this._qroot) gridInsert(this);
	}
	get CastShadow() { return this._cast; }
	set CastShadow(v) {
		this._cast = v;
		if (this.mesh) this.mesh.castShadow = v && shadowOK();
	}
	get Anchored() { return this._anchored; }
	set Anchored(v) {
		this._anchored = v;
		if (!v && this._qroot !== undefined && inWorkspace(this)) physicsSet.add(this);
		if (v) physicsSet.delete(this);
	}
	GetMass() { return this._size.X * this._size.Y * this._size.Z * 0.7; }
	makeEllipsoid() {
		this._shape = "Ball";
		this._ellipsoid = true;
		if (this.mesh) this.mesh.geometry = geoBall;
		this._syncMesh();
	}
}

export class Part extends BasePart {
	constructor() { super("Part"); }
}
export class WedgePart extends BasePart {
	constructor() { super("WedgePart"); }
}

// the folder a part lives under decides which queries can find it
const queryRoots = new Set();
export function markQueryRoot(folder) { queryRoots.add(folder); }
function queryRoot(inst) {
	let p = inst._parent;
	while (p) {
		if (queryRoots.has(p)) return p;
		p = p._parent;
	}
	return null;
}

export class Model extends Instance {
	constructor() {
		super("Model");
		this.WorldPivot = new CFrame();
		this.PrimaryPart = null;
	}
	GetPivot() { return this.PrimaryPart ? this.PrimaryPart.CFrame : this.WorldPivot; }
	PivotTo(cf) {
		const old = this.GetPivot();
		const delta = cf.mul(old.Inverse());
		for (const d of this.GetDescendants()) {
			if (d._isPart && !d._weldedTo) d.CFrame = delta.mul(d.CFrame);
		}
		if (!this.PrimaryPart) this.WorldPivot = cf;
	}
	TranslateBy(v) {
		for (const d of this.GetDescendants()) {
			if (d._isPart && !d._weldedTo) d.CFrame = d.CFrame.add(v);
		}
		this.WorldPivot = this.WorldPivot.add(v);
	}
	GetBoundingBox() {
		let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
		for (const d of this.GetDescendants()) {
			if (!d._isPart) continue;
			const b = aabbOf(d);
			for (let i = 0; i < 3; i++) {
				mn[i] = Math.min(mn[i], b[i]);
				mx[i] = Math.max(mx[i], b[i + 3]);
			}
		}
		return [new CFrame((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2), new Vector3(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2])];
	}
}

export class WeldConstraint extends Instance {
	constructor() {
		super("WeldConstraint");
		this._p0 = null;
		this._p1 = null;
	}
	get Part0() { return this._p0; }
	set Part0(p) {
		this._p0 = p;
		this._bind();
	}
	get Part1() { return this._p1; }
	set Part1(p) {
		this._p1 = p;
		this._bind();
	}
	_bind() {
		if (!this._p0 || !this._p1) return;
		this.rel = this._p0.CFrame.ToObjectSpace(this._p1.CFrame);
		if (!this._p0._welds.includes(this)) this._p0._welds.push(this);
		this._p1._weldedTo = this;
	}
	_follow() {
		if (!this._p1 || this._p1._destroyed || this._broken) return;
		this._p1.CFrame = this._p0.CFrame.mul(this.rel);
	}
	_onDestroy() {
		this._broken = true;
		if (this._p0) this._p0._welds = this._p0._welds.filter((w) => w !== this);
		if (this._p1 && this._p1._weldedTo === this) this._p1._weldedTo = null;
	}
}

export class Folder extends Instance {
	constructor() { super("Folder"); }
	_onAncestry() {
		if (!this._merged) return;
		if (inWorkspace(this)) {
			if (!this._merged.parent) scene.add(this._merged);
		} else if (this._merged.parent) this._merged.parent.remove(this._merged);
	}
	_onDestroy() {
		if (this._merged) {
			if (this._merged.parent) this._merged.parent.remove(this._merged);
			this._merged.geometry.dispose();
			this._merged = null;
		}
	}
}

// floor tiles: thousands of boxes as one mesh per chunk. the tiles stay real parts for queries
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const UB_POS = unitBox.attributes.position.array, UB_NRM = unitBox.attributes.normal.array, UB_IDX = unitBox.index.array;
const UB_N = UB_POS.length / 3;
const floorMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0 });
const tmpCol = new THREE.Color();
function writeMerged(part) {
	const ref = part._mergeRef;
	const g = ref.mesh.geometry;
	const pos = g.attributes.position.array, col = g.attributes.color.array;
	const o = ref.i * UB_N;
	const s = part._size, p = part._cf.p;
	tmpCol.setRGB(part._color.R, part._color.G, part._color.B, THREE.SRGBColorSpace);
	for (let v = 0; v < UB_N; v++) {
		const k = (o + v) * 3;
		pos[k] = UB_POS[v * 3] * s.X + p.X;
		pos[k + 1] = UB_POS[v * 3 + 1] * s.Y + p.Y;
		pos[k + 2] = UB_POS[v * 3 + 2] * s.Z + p.Z;
		col[k] = tmpCol.r;
		col[k + 1] = tmpCol.g;
		col[k + 2] = tmpCol.b;
	}
	g.attributes.position.needsUpdate = true;
	g.attributes.color.needsUpdate = true;
}
export function mergeFloor(folder, tiles) {
	const n = tiles.length;
	const g = new THREE.BufferGeometry();
	const pos = new Float32Array(n * UB_N * 3), nrm = new Float32Array(n * UB_N * 3), col = new Float32Array(n * UB_N * 3);
	const idx = new Uint32Array(n * UB_IDX.length);
	for (let i = 0; i < n; i++) {
		nrm.set(UB_NRM, i * UB_N * 3);
		for (let j = 0; j < UB_IDX.length; j++) idx[i * UB_IDX.length + j] = UB_IDX[j] + i * UB_N;
	}
	g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
	g.setAttribute("normal", new THREE.BufferAttribute(nrm, 3));
	g.setAttribute("color", new THREE.BufferAttribute(col, 3));
	g.setIndex(new THREE.BufferAttribute(idx, 1));
	const mesh = new THREE.Mesh(g, floorMat);
	mesh.receiveShadow = true;
	mesh.castShadow = false;
	tiles.forEach((t, i) => {
		t._mergeRef = { mesh, i };
		writeMerged(t);
	});
	g.computeBoundingSphere();
	folder._merged = mesh;
	folder._onAncestry();
}

// an attachment is just a point on a part, emitters under it spawn from there
export class Attachment extends Instance {
	constructor() {
		super("Attachment");
		this.Position = Vector3.zero;
	}
}

// a flat round glow that always faces the camera, used for the moon halo
const HARD_DISC = discTexture(false);
export class Glow extends Instance {
	constructor() {
		super("Glow");
		this.Size = 10;
		this.Color = WHITE3;
		this.Transparency = 0;
		this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: HARD_DISC, transparent: true, depthWrite: false, fog: false }));
	}
	_onAncestry() {
		if (this._parent && this._parent._isPart && inWorkspace(this)) {
			glows.add(this);
			scene.add(this.sprite);
		} else {
			glows.delete(this);
			if (this.sprite.parent) this.sprite.parent.remove(this.sprite);
		}
	}
	_onDestroy() {
		glows.delete(this);
		if (this.sprite.parent) this.sprite.parent.remove(this.sprite);
	}
}
const glows = new Set();
function updateGlows() {
	for (const g of glows) {
		const p = g._parent.CFrame.p;
		g.sprite.position.set(p.X, p.Y, p.Z);
		g.sprite.scale.set(g.Size, g.Size, 1);
		g.sprite.material.color.setRGB(g.Color.R, g.Color.G, g.Color.B, THREE.SRGBColorSpace);
		g.sprite.material.opacity = clamp(1 - g.Transparency, 0, 1);
	}
}

// roblox highlight: a see-through fill drawn on top of everything
export class Highlight extends Instance {
	constructor() {
		super("Highlight");
		this.FillColor = RGB(255, 0, 0);
		this.FillTransparency = 0.5;
		this.OutlineColor = WHITE3;
		this.OutlineTransparency = 0;
		this.over = new Map();
		this.mat = new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, depthWrite: false, fog: false });
	}
	_onAncestry() {
		if (this._parent && inWorkspace(this)) highlights.add(this);
		else {
			highlights.delete(this);
			this._clear();
		}
	}
	_clear() {
		for (const m of this.over.values()) if (m.parent) m.parent.remove(m);
		this.over.clear();
	}
	_onDestroy() {
		highlights.delete(this);
		this._clear();
		this.mat.dispose();
	}
}
const highlights = new Set();
function updateHighlights() {
	for (const h of highlights) {
		const a = h._parent;
		const parts = a._isPart ? [a, ...a.GetDescendants()] : a.GetDescendants();
		const live = new Set();
		h.mat.color.setRGB(h.FillColor.R, h.FillColor.G, h.FillColor.B, THREE.SRGBColorSpace);
		h.mat.opacity = clamp(1 - h.FillTransparency + (1 - h.OutlineTransparency) * 0.12, 0, 1);
		for (const p of parts) {
			if (!p._isPart || !p.mesh || !p.mesh.visible) continue;
			let o = h.over.get(p);
			if (!o) {
				o = new THREE.Mesh(p.mesh.geometry, h.mat);
				o.matrixAutoUpdate = false;
				o.renderOrder = 999;
				o.frustumCulled = false;
				h.over.set(p, o);
				scene.add(o);
			}
			o.geometry = p.mesh.geometry;
			o.matrix.copy(p.mesh.matrix);
			o.matrixWorldNeedsUpdate = true;
			live.add(p);
		}
		for (const [p, o] of h.over) {
			if (!live.has(p)) {
				if (o.parent) o.parent.remove(o);
				h.over.delete(p);
			}
		}
	}
}

// lights become soft additive glow sprites, real lights would be way too many
export class PointLight extends Instance {
	constructor(cls = "PointLight") {
		super(cls);
		this._color = WHITE3;
		this.Range = 8;
		this._br = 1;
		this.Enabled = true;
		this.Face = "Front";
		this.Angle = 90;
		this.sprite = null;
	}
	get Color() { return this._color; }
	set Color(c) {
		this._color = c;
		this._upd();
	}
	get Brightness() { return this._br; }
	set Brightness(b) {
		this._br = b;
		this._upd();
	}
	_upd() {
		if (!this.sprite) return;
		this.sprite.material.color.setRGB(this._color.R, this._color.G, this._color.B, THREE.SRGBColorSpace);
		this.sprite.material.opacity = clamp(this._br / 8, 0, 0.9) * 0.55;
		const s = this.Range * 0.9;
		this.sprite.scale.set(s, s, 1);
	}
	_onAncestry() {
		const p = this._parent;
		if (p && p._isPart && inWorkspace(this) && this.ClassName === "PointLight") {
			if (!this.sprite) {
				this.sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: SOFT_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
				this._upd();
			}
			glowSprites.add(this);
			scene.add(this.sprite);
		} else if (this.sprite) {
			glowSprites.delete(this);
			if (this.sprite.parent) this.sprite.parent.remove(this.sprite);
		}
	}
	_onDestroy() {
		glowSprites.delete(this);
		if (this.sprite && this.sprite.parent) this.sprite.parent.remove(this.sprite);
	}
}
const glowSprites = new Set();

// which 3d scene an instance draws into: the world, or a viewport frame's own little scene
function sceneOf(inst) {
	let p = inst;
	while (p) {
		if (p === workspace) return scene;
		if (p.ClassName === "ViewportFrame") return vpScene(p);
		p = p._parent;
	}
	return null;
}
function vpScene(vp) {
	if (!vp.scene3) {
		vp.scene3 = new THREE.Scene();
		vp.scene3.userData.vp = vp;
		vp.hemi = new THREE.HemisphereLight(0xffffff, 0x444455, 1.6);
		vp.scene3.add(vp.hemi);
		vp.dl = new THREE.DirectionalLight(0xffffff, 2.2);
		vp.scene3.add(vp.dl);
		vp.cam3 = new THREE.PerspectiveCamera(35, 1, 0.1, 2000);
	}
	return vp.scene3;
}
// in a showcase the plane stands still, so its particles get blown backwards like it's flying
function windOf(sc) {
	const vp = sc && sc.userData.vp;
	return vp && vp.p.Wind ? vp.p.Wind : null;
}

// ---------------- particles: a small sprite system
export class NumberSequence {
	constructor(a, b) {
		if (Array.isArray(a)) this.k = a.map((p) => [p.Time, p.Value]);
		else this.k = [[0, a], [1, b === undefined ? a : b]];
	}
	at(t) {
		const k = this.k;
		for (let i = 0; i < k.length - 1; i++) {
			if (t <= k[i + 1][0]) {
				const u = (t - k[i][0]) / Math.max(k[i + 1][0] - k[i][0], 1e-6);
				return lerp(k[i][1], k[i + 1][1], u);
			}
		}
		return k[k.length - 1][1];
	}
}
export const NumberSequenceKeypoint = { new: (t, v) => ({ Time: t, Value: v }) };
export class NumberRange {
	constructor(a, b) {
		this.Min = a;
		this.Max = b === undefined ? a : b;
	}
	pick() { return this.Min + Math.random() * (this.Max - this.Min); }
}
export class ColorSequence {
	constructor(a, b) {
		if (Array.isArray(a)) this.k = a.map((p) => [p.Time, p.Value]);
		else this.k = [[0, a], [1, b || a]];
	}
	at(t) {
		const k = this.k;
		for (let i = 0; i < k.length - 1; i++) {
			if (t <= k[i + 1][0]) {
				const u = (t - k[i][0]) / Math.max(k[i + 1][0] - k[i][0], 1e-6);
				return k[i][1].Lerp(k[i + 1][1], u);
			}
		}
		return k[k.length - 1][1];
	}
}
export const ColorSequenceKeypoint = { new: (t, v) => ({ Time: t, Value: v }) };

function sparkleTexture() {
	const c = document.createElement("canvas");
	c.width = c.height = 64;
	const g = c.getContext("2d");
	const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	gr.addColorStop(0, "rgba(255,255,255,1)");
	gr.addColorStop(0.25, "rgba(255,255,255,0.8)");
	gr.addColorStop(1, "rgba(255,255,255,0)");
	g.fillStyle = gr;
	g.fillRect(0, 0, 64, 64);
	g.fillStyle = "rgba(255,255,255,0.9)";
	g.fillRect(30, 2, 4, 60);
	g.fillRect(2, 30, 60, 4);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}
const SPARK_TEX = sparkleTexture();
const emitters = new Set();
const particles = [];
export class ParticleEmitter extends Instance {
	constructor() {
		super("ParticleEmitter");
		this.Texture = "";
		this.Color = new ColorSequence(WHITE3);
		this.LightEmission = 0;
		this.LightInfluence = 1;
		this.Size = new NumberSequence(1);
		this.Transparency = new NumberSequence(0);
		this.Lifetime = new NumberRange(1);
		this.Rate = 5;
		this.Speed = new NumberRange(5);
		this.SpreadAngle = new Vector2(0, 0);
		this.Rotation = new NumberRange(0);
		this.RotSpeed = new NumberRange(0);
		this.Acceleration = Vector3.zero;
		this.Drag = 0;
		this.LockedToPart = false;
		this.Enabled = true;
		this.EmissionDirection = "Top";
		this._acc = 0;
	}
	_host() {
		const h = this._parent;
		if (!h) return null;
		if (h._isPart) return [h, null];
		if (h.ClassName === "Attachment" && h._parent && h._parent._isPart) return [h._parent, h];
		return null;
	}
	_onAncestry() {
		this._scene = this._host() ? sceneOf(this) : null;
		if (this._scene) emitters.add(this);
		else emitters.delete(this);
	}
	_onDestroy() { emitters.delete(this); }
	Emit(n) {
		for (let i = 0; i < n; i++) spawnParticle(this);
	}
}
function spawnParticle(e) {
	if (particles.length > 900) return;
	const host = e._host();
	if (!host) return;
	const [part, att] = host;
	const spark = String(e.Texture).includes("sparkle") || String(e.Texture).includes("spark");
	const mat = new THREE.SpriteMaterial({ map: spark ? SPARK_TEX : SOFT_TEX, transparent: true, depthWrite: false, blending: e.LightEmission > 0.5 ? THREE.AdditiveBlending : THREE.NormalBlending, fog: true });
	const s = new THREE.Sprite(mat);
	const cf = part.CFrame;
	const dirLocal = e.EmissionDirection === "Back" ? new Vector3(0, 0, 1) : e.EmissionDirection === "Front" ? new Vector3(0, 0, -1) : e.EmissionDirection === "Bottom" ? new Vector3(0, -1, 0) : new Vector3(0, 1, 0);
	let dir = cf.VectorToWorldSpace(dirLocal);
	const sx = rad(e.SpreadAngle.X), sy = rad(e.SpreadAngle.Y);
	if (sx > 0 || sy > 0) {
		const rot = CFrame.Angles((Math.random() * 2 - 1) * sx, 0, (Math.random() * 2 - 1) * sy);
		dir = cf.Rotation.mul(rot).VectorToWorldSpace(dirLocal);
		if (sx >= Math.PI * 0.99) dir = new Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).Unit;
	}
	const sp = e.Speed.pick();
	const ps = part.Size;
	const off = att ? att.Position : new Vector3((Math.random() - 0.5) * ps.X, (Math.random() - 0.5) * ps.Y, (Math.random() - 0.5) * ps.Z);
	const p = {
		sprite: s,
		e,
		life: e.Lifetime.pick(),
		age: 0,
		local: e.LockedToPart ? off : null,
		pos: cf.pointToWorld(off),
		vel: dir.mul(sp),
		rot: rad(e.Rotation.pick()),
		rotSpeed: rad(e.RotSpeed.pick()),
		part,
		scene: e._scene || scene,
	};
	p.scene.add(s);
	particles.push(p);
}
function updateParticles(dt) {
	for (const e of emitters) {
		if (!e.Enabled || e.Rate <= 0) continue;
		if (lowGfx && e.Rate > 4) continue;
		e._acc += e.Rate * dt;
		while (e._acc >= 1) {
			e._acc -= 1;
			spawnParticle(e);
		}
	}
	for (let i = particles.length - 1; i >= 0; i--) {
		const p = particles[i];
		p.age += dt;
		const t = p.age / p.life;
		if (t >= 1 || (p.local && p.part._destroyed) || (p.scene !== scene && !p.scene.userData.vp.el.isConnected)) {
			p.scene.remove(p.sprite);
			p.sprite.material.dispose();
			particles.splice(i, 1);
			continue;
		}
		const e = p.e;
		p.vel = p.vel.add(e.Acceleration.mul(dt));
		if (e.Drag) p.vel = p.vel.mul(Math.max(0, 1 - e.Drag * dt));
		let wp;
		if (p.local) {
			p.local = p.local.add(p.vel.mul(dt));
			wp = p.part.CFrame.pointToWorld(p.local);
		} else {
			p.pos = p.pos.add(p.vel.mul(dt));
			const w = p.scene !== scene ? windOf(p.scene) : null;
			if (w) p.pos = p.pos.add(w.mul(dt));
			wp = p.pos;
		}
		p.sprite.position.set(wp.X, wp.Y, wp.Z);
		const size = e.Size.at(t);
		p.sprite.scale.set(size, size, 1);
		const c = e.Color.at(t);
		p.sprite.material.color.setRGB(c.R, c.G, c.B, THREE.SRGBColorSpace);
		p.sprite.material.opacity = clamp(1 - e.Transparency.at(t), 0, 1);
		p.rot += p.rotSpeed * dt;
		p.sprite.material.rotation = p.rot;
	}
}

// ---------------- trails: a ribbon behind a moving part
export class Trail extends Instance {
	constructor() {
		super("Trail");
		this.Lifetime = 0.5;
		this.Color = new ColorSequence(WHITE3);
		this.Transparency = new NumberSequence(0, 1);
		this.WidthScale = new NumberSequence(1);
		this.Width = 1;
		this.pts = [];
		this.Enabled = true;
		this.LightEmission = 0;
		this.FaceCamera = true;
		this.MinLength = 0;
	}
	_onAncestry() {
		const sc = this._parent ? sceneOf(this) : null;
		if (sc) {
			this._scene = sc;
			if (!this.mesh) {
				const g = new THREE.BufferGeometry();
				this.maxPts = this.MaxPoints || 40;
				g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.maxPts * 2 * 3), 3));
				g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(this.maxPts * 2 * 4), 4));
				const idx = [];
				for (let i = 0; i < this.maxPts - 1; i++) {
					const a = i * 2;
					idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
				}
				g.setIndex(idx);
				this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: this.LightEmission > 0.5 ? THREE.AdditiveBlending : THREE.NormalBlending }));
				this.mesh.frustumCulled = false;
				this.mesh.userData.keep = true;
			}
			if (this.mesh.parent !== sc) sc.add(this.mesh);
			trails.add(this);
		} else {
			trails.delete(this);
			if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
		}
	}
	_onDestroy() {
		trails.delete(this);
		if (this.mesh && this.mesh.parent) this.mesh.parent.remove(this.mesh);
	}
}
const trails = new Set();
function updateTrails() {
	const now = clock();
	const dt = frameDt;
	for (const tr of trails) {
		const part = tr._parent;
		if (!part || !part._isPart) continue;
		let cp = camera.CFrame.p;
		if (tr._scene && tr._scene !== scene) {
			const vp = tr._scene.userData.vp;
			const cam = vp.p.CurrentCamera;
			if (cam) cp = cam.CFrame.p;
			const w = windOf(tr._scene);
			if (w) for (const q of tr.pts) q.p = q.p.add(w.mul(dt));
		}
		if (tr.Enabled) {
			const np = tr.Offset ? part.CFrame.pointToWorld(tr.Offset) : part.CFrame.p;
			// a point on top of the last one would make a zero-length segment and break the whole strip
			if (!tr.pts.length || np.sub(tr.pts[0].p).Magnitude > 0.02) tr.pts.unshift({ p: np, t: now });
			else tr.pts[0].t = now;
		}
		while (tr.pts.length > tr.maxPts || (tr.pts.length && now - tr.pts[tr.pts.length - 1].t > tr.Lifetime)) tr.pts.pop();
		const pos = tr.mesh.geometry.attributes.position.array;
		const col = tr.mesh.geometry.attributes.color.array;
		pos.fill(0);
		col.fill(0);
		const n = tr.pts.length;
		for (let i = 0; i < n; i++) {
			const a = tr.pts[i];
			const b = tr.pts[Math.min(i + 1, n - 1)];
			let dir = i + 1 < n ? a.p.sub(b.p) : new Vector3(0, 0, 1);
			if (dir.Magnitude < 1e-4) dir = new Vector3(0, 0, 1);
			const toCam = cp.sub(a.p).Unit;
			let side = dir.Cross(toCam);
			side = side.Magnitude > 1e-6 ? side.Unit : new Vector3(1, 0, 0);
			const age = (now - a.t) / tr.Lifetime;
			const w = tr.Width * tr.WidthScale.at(age) / 2;
			side = side.mul(w);
			const l = a.p.add(side), r = a.p.sub(side);
			pos.set([l.X, l.Y, l.Z, r.X, r.Y, r.Z], i * 6);
			const c = tr.Color.at(age);
			const al = clamp(1 - tr.Transparency.at(age), 0, 1);
			col.set([c.R, c.G, c.B, al, c.R, c.G, c.B, al], i * 8);
		}
		tr.mesh.geometry.attributes.position.needsUpdate = true;
		tr.mesh.geometry.attributes.color.needsUpdate = true;
		tr.mesh.geometry.setDrawRange(0, Math.max(0, (n - 1) * 6));
	}
}

export function makeInstance(cls) {
	switch (cls) {
		case "Part": return new Part();
		case "WedgePart": return new WedgePart();
		case "Model": return new Model();
		case "Folder": return new Folder();
		case "WeldConstraint": return new WeldConstraint();
		case "PointLight": return new PointLight();
		case "SpotLight": return new PointLight("SpotLight");
		case "ParticleEmitter": return new ParticleEmitter();
		case "Trail": return new Trail();
		case "Attachment": return new Attachment();
		case "Glow": return new Glow();
		case "Highlight": return new Highlight();
		default:
			if (GUI_CLASSES[cls]) return new GuiObject(cls);
			return new Instance(cls);
	}
}

// ---------------- physics for loose parts: gravity, spin, bounce off the ground
const physicsSet = new Set();
export const physicsGround = { height: 2 };
function stepPhysics(dt) {
	const g = workspace.Gravity;
	for (const p of physicsSet) {
		if (p._anchored || p._destroyed || p._weldedTo) {
			physicsSet.delete(p);
			continue;
		}
		let v = p.AssemblyLinearVelocity;
		if (!p._sleep) {
			v = new Vector3(v.X, v.Y - g * dt, v.Z);
			let pos = p.CFrame.p.add(v.mul(dt));
			const half = Math.min(p.Size.Y, p.Size.X, p.Size.Z) / 2;
			const floorY = physicsGround.height;
			if (p.CanCollide !== false && pos.Y - half < floorY && g > 0) {
				pos = new Vector3(pos.X, floorY + half, pos.Z);
				v = new Vector3(v.X * 0.7, Math.abs(v.Y) * 0.25, v.Z * 0.7);
				p.AssemblyAngularVelocity = p.AssemblyAngularVelocity.mul(0.7);
				if (v.Magnitude < 3) p._sleep = true;
			}
			const w = p.AssemblyAngularVelocity;
			let rot = p.CFrame.Rotation;
			const wm = w.Magnitude;
			if (wm > 1e-3) {
				const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(w.X / wm, w.Y / wm, w.Z / wm), wm * dt);
				const nq = q.multiply(rot.quat());
				rot = CFrame.fromQuat(Vector3.zero, nq);
			}
			p.AssemblyLinearVelocity = v;
			p.CFrame = new CFrame(pos.X, pos.Y, pos.Z, rot.r);
			if (pos.Y < -500) p.Destroy();
		}
	}
}

// ---------------- queries
export class OverlapParams {
	constructor() {
		this.FilterType = "Include";
		this.FilterDescendantsInstances = [];
	}
	static new() { return new OverlapParams(); }
}
export const RaycastParams = OverlapParams;

function candidates(minX, minZ, maxX, maxZ) {
	const out = new Set();
	const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL), z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
	for (let x = x0; x <= x1; x++) {
		for (let z = z0; z <= z1; z++) {
			const s = grid.get(cellKey(x, z));
			if (s) for (const p of s) out.add(p);
		}
	}
	const big = grid.get("big");
	if (big) for (const p of big) out.add(p);
	return out;
}
function passes(part, params) {
	if (!part.CanQuery || part._destroyed) return false;
	const list = params.FilterDescendantsInstances || [];
	let inside = false;
	for (const f of list) {
		if (f === part || part.IsDescendantOf(f)) {
			inside = true;
			break;
		}
	}
	return params.FilterType === "Exclude" ? !inside : inside;
}
// oriented box vs oriented box, separating axis test
function obbOverlap(ca, ha, cb, hb) {
	const A = [ca.RightVector, ca.UpVector, ca.LookVector.neg()];
	const B = [cb.RightVector, cb.UpVector, cb.LookVector.neg()];
	const T = cb.p.sub(ca.p);
	const axes = [...A, ...B];
	for (const a of A) for (const b of B) {
		const c = a.Cross(b);
		if (c.Magnitude > 1e-6) axes.push(c.Unit);
	}
	const ha3 = [ha.X, ha.Y, ha.Z], hb3 = [hb.X, hb.Y, hb.Z];
	for (const L of axes) {
		let ra = 0, rb = 0;
		for (let i = 0; i < 3; i++) {
			ra += ha3[i] * Math.abs(A[i].Dot(L));
			rb += hb3[i] * Math.abs(B[i].Dot(L));
		}
		if (Math.abs(T.Dot(L)) > ra + rb) return false;
	}
	return true;
}
function partHalf(p) {
	if (p._shape === "Ball") {
		const r = Math.min(p.Size.X, p.Size.Y, p.Size.Z) / 2;
		return new Vector3(r, r, r);
	}
	return p.Size.div(2);
}
workspace.GetPartBoundsInBox = function (cf, size, params) {
	const h = size.div(2);
	const r = cf.r;
	const ex = Math.abs(r[0]) * h.X + Math.abs(r[1]) * h.Y + Math.abs(r[2]) * h.Z;
	const ey = Math.abs(r[3]) * h.X + Math.abs(r[4]) * h.Y + Math.abs(r[5]) * h.Z;
	const ez = Math.abs(r[6]) * h.X + Math.abs(r[7]) * h.Y + Math.abs(r[8]) * h.Z;
	const p = cf.p;
	const out = [];
	for (const part of candidates(p.X - ex, p.Z - ez, p.X + ex, p.Z + ez)) {
		const b = part._aabb;
		if (!b) continue;
		if (b[3] < p.X - ex || b[0] > p.X + ex || b[4] < p.Y - ey || b[1] > p.Y + ey || b[5] < p.Z - ez || b[2] > p.Z + ez) continue;
		if (!passes(part, params)) continue;
		if (obbOverlap(cf, h, part.CFrame, partHalf(part))) out.push(part);
	}
	return out;
};
workspace.GetPartBoundsInRadius = function (at, radius, params) {
	const out = [];
	for (const part of candidates(at.X - radius, at.Z - radius, at.X + radius, at.Z + radius)) {
		const b = part._aabb;
		if (!b) continue;
		const cx = clamp(at.X, b[0], b[3]), cy = clamp(at.Y, b[1], b[4]), cz = clamp(at.Z, b[2], b[5]);
		const dx = cx - at.X, dy = cy - at.Y, dz = cz - at.Z;
		if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
		if (!passes(part, params)) continue;
		out.push(part);
	}
	return out;
};
// ray vs part boxes (slab test in the part's own space)
workspace.Raycast = function (origin, dir, params) {
	const end = origin.add(dir);
	const minX = Math.min(origin.X, end.X), maxX = Math.max(origin.X, end.X), minZ = Math.min(origin.Z, end.Z), maxZ = Math.max(origin.Z, end.Z);
	let best = null, bestT = 1;
	for (const part of candidates(minX, minZ, maxX, maxZ)) {
		if (!part._aabb) continue;
		if (!passes(part, params)) continue;
		const inv = part.CFrame.Inverse();
		const o = inv.pointToWorld(origin);
		const d = inv.VectorToWorldSpace(dir);
		const h = partHalf(part);
		let t0 = 0, t1 = 1;
		const oo = [o.X, o.Y, o.Z], dd = [d.X, d.Y, d.Z], hh = [h.X, h.Y, h.Z];
		let ok = true;
		for (let i = 0; i < 3; i++) {
			if (Math.abs(dd[i]) < 1e-9) {
				if (oo[i] < -hh[i] || oo[i] > hh[i]) { ok = false; break; }
			} else {
				let a = (-hh[i] - oo[i]) / dd[i], b = (hh[i] - oo[i]) / dd[i];
				if (a > b) [a, b] = [b, a];
				t0 = Math.max(t0, a);
				t1 = Math.min(t1, b);
				if (t0 > t1) { ok = false; break; }
			}
		}
		if (ok && t0 < bestT) {
			bestT = t0;
			best = part;
		}
	}
	if (!best) return null;
	return { Instance: best, Position: origin.add(dir.mul(bestT)), Distance: dir.Magnitude * bestT };
};

// ------------------------------------------------------------------ tweens

const EASE = {
	Linear: (t) => t,
	Quad: (t) => t * t,
	Cubic: (t) => t * t * t,
	Quart: (t) => t * t * t * t,
	Quint: (t) => t * t * t * t * t,
	Sine: (t) => 1 - Math.cos((t * Math.PI) / 2),
	Exponential: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
	Back: (t) => 2.70158 * t * t * t - 1.70158 * t * t,
	Elastic: (t) => (t === 0 || t === 1 ? t : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * ((2 * Math.PI) / 3))),
	Bounce: (t) => 1 - bounceOut(1 - t),
};
function bounceOut(t) {
	const n1 = 7.5625, d1 = 2.75;
	if (t < 1 / d1) return n1 * t * t;
	if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
	if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
	return n1 * (t -= 2.625 / d1) * t + 0.984375;
}
function ease(style, dir, t) {
	const f = EASE[style] || EASE.Quad;
	if (dir === "In") return f(t);
	if (dir === "InOut") return t < 0.5 ? f(t * 2) / 2 : 1 - f((1 - t) * 2) / 2;
	return 1 - f(1 - t);
}
export class TweenInfo {
	constructor(time = 1, style = "Quad", dir = "Out") {
		this.Time = time;
		this.EasingStyle = style;
		this.EasingDirection = dir;
	}
	static new(t, s, d) { return new TweenInfo(t, s, d); }
}
const tweens = new Set();
function interp(a, b, t) {
	if (typeof a === "number") return a + (b - a) * t;
	if (a instanceof Vector3 || a instanceof Color3 || a instanceof UDim2 || a instanceof CFrame) return a.Lerp(b, t);
	return t < 1 ? a : b;
}
export const TweenService = {
	Create(obj, info, props) {
		const tw = {
			obj,
			info,
			props,
			from: {},
			t: 0,
			playing: false,
			Completed: new Signal(),
			Play() {
				// a new tween on the same property takes over
				for (const o of tweens) {
					if (o !== tw && o.obj === obj) {
						for (const k in props) delete o.props[k];
					}
				}
				for (const k in props) tw.from[k] = obj[k];
				if (obj._isPart && ("Transparency" in props || "Color" in props)) {
					obj._uniqueMat = true;
					obj._ownMat = null;
					obj._refreshMat();
				}
				tw.t = 0;
				tw.playing = true;
				tweens.add(tw);
				return tw;
			},
			Cancel() {
				tweens.delete(tw);
			},
		};
		return tw;
	},
};
function updateTweens(dt) {
	for (const tw of tweens) {
		if (tw.obj._destroyed) {
			tweens.delete(tw);
			continue;
		}
		tw.t += dt;
		const k = tw.info.Time <= 0 ? 1 : clamp(tw.t / tw.info.Time, 0, 1);
		const e = ease(tw.info.EasingStyle, tw.info.EasingDirection, k);
		for (const key in tw.props) {
			const a = tw.from[key];
			if (a === undefined) continue;
			tw.obj[key] = interp(a, tw.props[key], e);
		}
		if (k >= 1) {
			tweens.delete(tw);
			tw.Completed.Fire();
		}
	}
}

export const Debris = {
	AddItem(inst, t) { task.delay(t, () => inst.Destroy()); },
};

// ------------------------------------------------------------------ input

const keysDown = new Set();
const mouseDown = new Set();
export const UIS = {
	InputBegan: new Signal(),
	InputEnded: new Signal(),
	InputChanged: new Signal(),
	WindowFocusReleased: new Signal(),
	TouchEnabled: "ontouchstart" in window || navigator.maxTouchPoints > 0,
	KeyboardEnabled: !(("ontouchstart" in window || navigator.maxTouchPoints > 0) && !window.matchMedia("(pointer: fine)").matches),
	MouseEnabled: window.matchMedia("(pointer: fine)").matches,
	MouseBehavior: "Default",
	_focused: null,
	IsKeyDown(name) { return keysDown.has(name); },
	IsMouseButtonPressed(name) { return mouseDown.has(name); },
	GetFocusedTextBox() { return document.activeElement && document.activeElement.tagName === "INPUT" ? document.activeElement : null; },
	GetMouseDelta() { return new Vector2(0, 0); },
};
const CODE_NAMES = {
	ArrowLeft: "Left", ArrowRight: "Right", ArrowUp: "Up", ArrowDown: "Down",
	ShiftLeft: "LeftShift", ShiftRight: "RightShift", ControlLeft: "LeftControl", ControlRight: "RightControl", AltLeft: "LeftAlt", AltRight: "RightAlt",
	Space: "Space", Enter: "Return", NumpadEnter: "Return", Backspace: "Backspace", Escape: "Escape", Tab: "Tab",
	Minus: "Minus", Equal: "Equals", NumpadAdd: "KeypadPlus", NumpadSubtract: "KeypadMinus",
	Digit0: "Zero", Digit1: "One", Digit2: "Two", Digit3: "Three", Digit4: "Four", Digit5: "Five", Digit6: "Six", Digit7: "Seven", Digit8: "Eight", Digit9: "Nine",
};
function codeName(e) {
	if (CODE_NAMES[e.code]) return CODE_NAMES[e.code];
	if (e.code.startsWith("Key")) return e.code.slice(3);
	return e.code;
}
function isTyping() {
	const a = document.activeElement;
	return a && a.tagName === "INPUT";
}
window.addEventListener("keydown", (e) => {
	if (isTyping() && e.code !== "Escape") return;
	const n = codeName(e);
	if (["Space", "Tab", "Up", "Down", "Left", "Right", "Backspace"].includes(n)) e.preventDefault();
	if (e.repeat) return;
	keysDown.add(n);
	UIS.InputBegan.Fire({ UserInputType: "Keyboard", KeyCode: n }, false);
});
window.addEventListener("keyup", (e) => {
	const n = codeName(e);
	keysDown.delete(n);
	UIS.InputEnded.Fire({ UserInputType: "Keyboard", KeyCode: n }, false);
});
window.addEventListener("blur", () => {
	keysDown.clear();
	mouseDown.clear();
	UIS.WindowFocusReleased.Fire();
});
const MB = ["MouseButton1", "MouseButton3", "MouseButton2"];
window.addEventListener("mousedown", (e) => {
	const n = MB[e.button];
	if (!n) return;
	const overUi = !!(e.target && e.target.closest && e.target.closest(".gui-btn, input, .gui-scroll"));
	if (!overUi) mouseDown.add(n);
	UIS.InputBegan.Fire({ UserInputType: n, KeyCode: "Unknown", Position: new Vector3(e.clientX, e.clientY, 0) }, overUi);
});
window.addEventListener("mouseup", (e) => {
	const n = MB[e.button];
	if (!n) return;
	mouseDown.delete(n);
	UIS.InputEnded.Fire({ UserInputType: n, KeyCode: "Unknown" }, false);
});
window.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("wheel", (e) => {
	UIS.InputChanged.Fire({ UserInputType: "MouseWheel", Position: new Vector3(0, 0, e.deltaY < 0 ? 1 : -1) });
}, { passive: true });
window.addEventListener("mousemove", (e) => {
	UIS.InputChanged.Fire({ UserInputType: "MouseMovement", Position: new Vector3(e.clientX, e.clientY, 0) });
});

// ------------------------------------------------------------------ sound: small synthesized versions of roblox's default sounds

let actx = null;
function ac() {
	if (!actx) {
		try {
			actx = new (window.AudioContext || window.webkitAudioContext)();
		} catch (e) {
			actx = null;
		}
	}
	if (actx && actx.state === "suspended") actx.resume();
	return actx;
}
window.addEventListener("pointerdown", () => ac(), { once: true });
window.addEventListener("keydown", () => ac(), { once: true });
// sample based sound: one-shots and loops from /sfx, everything through a glue compressor
// everything was way too loud at full scale
const MASTER = 0.4;
const Audio = { buffers: {}, bus: null, vol: 1, last: {}, voices: 0 };
function bus() {
	const a = ac();
	if (!a) return null;
	if (!Audio.bus) {
		const comp = a.createDynamicsCompressor();
		comp.threshold.value = -16;
		comp.knee.value = 8;
		comp.ratio.value = 4;
		comp.attack.value = 0.004;
		comp.release.value = 0.25;
		const out = a.createGain();
		out.gain.value = Audio.vol * MASTER;
		comp.connect(out);
		out.connect(a.destination);
		Audio.bus = comp;
		Audio.out = out;
	}
	return Audio.bus;
}
export function setSfxVolume(v) {
	Audio.vol = v;
	if (Audio.out) Audio.out.gain.setTargetAtTime(v * MASTER, Audio.out.context.currentTime, 0.05);
}
export async function loadSounds(names, base) {
	let a;
	try {
		a = actx || new (window.AudioContext || window.webkitAudioContext)();
		actx = a;
	} catch (e) {
		return;
	}
	await Promise.all(names.map(async ([name, file]) => {
		try {
			const r = await fetch(base + file);
			const buf = await r.arrayBuffer();
			Audio.buffers[name] = await new Promise((res, rej) => a.decodeAudioData(buf, res, rej));
		} catch (e) {
			console.warn("sound failed", name, e);
		}
	}));
}
export function hasSound(name) { return !!Audio.buffers[name]; }
export function playSfx(name, pitch = 1, volume = 1, pan = 0) {
	const a = ac(), b = Audio.buffers[name];
	if (!a || !b || volume <= 0 || a.state !== "running") return;
	// the same sound right on top of itself just gets louder, and too many at once turns to mush
	const now = a.currentTime;
	if (now - (Audio.last[name] || -1) < 0.09 || Audio.voices >= 10) return;
	Audio.last[name] = now;
	Audio.voices++;
	const src = a.createBufferSource();
	src.buffer = b;
	src.playbackRate.value = pitch;
	const g = a.createGain();
	g.gain.value = volume;
	let node = src;
	node.connect(g);
	node = g;
	if (pan && a.createStereoPanner) {
		const p = a.createStereoPanner();
		p.pan.value = clamp(pan, -1, 1);
		node.connect(p);
		node = p;
	}
	node.connect(bus());
	src.onended = () => Audio.voices--;
	src.start();
}
// a looping layer you keep steering: volume, speed and a lowpass, all smoothed
export function loopSound(name) {
	const L = { name, src: null, g: null, f: null, vol: 0, rate: 1, cut: 20000 };
	L.set = (vol, rate = 1, cut = 20000, smooth = 0.12) => {
		const a = ac(), b = Audio.buffers[name];
		if (!a || !b || a.state !== "running") return;
		if (!L.src) {
			if (vol <= 0.001) return;
			L.src = a.createBufferSource();
			L.src.buffer = b;
			L.src.loop = true;
			L.f = a.createBiquadFilter();
			L.f.type = "lowpass";
			L.f.frequency.value = cut;
			L.g = a.createGain();
			L.g.gain.value = 0;
			L.src.connect(L.f);
			L.f.connect(L.g);
			L.g.connect(bus());
			L.src.start(0, Math.random() * b.duration);
		}
		const t = a.currentTime;
		L.g.gain.setTargetAtTime(vol, t, smooth);
		L.src.playbackRate.setTargetAtTime(rate, t, smooth);
		L.f.frequency.setTargetAtTime(cut, t, smooth);
		L.vol = vol;
	};
	return L;
}
// ------------------------------------------------------------------ gui: roblox-style frames on top of the dom

const GUI_CLASSES = {
	ScreenGui: 1, Frame: 1, TextLabel: 1, TextButton: 1, TextBox: 1, ImageLabel: 1, ImageButton: 1, CanvasGroup: 1, ScrollingFrame: 1, ViewportFrame: 1,
	UIListLayout: 1, UIGridLayout: 1, UIPadding: 1, UIScale: 1, UICorner: 1, UIStroke: 1, UIGradient: 1, UIAspectRatioConstraint: 1, BillboardGui: 1,
};
const MODIFIERS = { UIListLayout: 1, UIGridLayout: 1, UIPadding: 1, UIScale: 1, UICorner: 1, UIStroke: 1, UIGradient: 1, UIAspectRatioConstraint: 1 };
export const guiRoot = document.getElementById("gui");

export class GuiObject extends Instance {
	constructor(cls) {
		super(cls);
		this._isGui = true;
		this._isButton = cls === "TextButton" || cls === "ImageButton";
		this.p = {};
		const isMod = MODIFIERS[cls];
		this._mod = !!isMod;
		if (!isMod && cls !== "BillboardGui") {
			const tag = cls === "TextBox" ? "input" : cls === "TextButton" || cls === "ImageButton" ? "div" : "div";
			this.el = document.createElement(tag);
			this.el.className = "gui " + (this._isButton ? "gui-btn" : "") + (cls === "ScrollingFrame" ? " gui-scroll" : "");
			this.el._inst = this;
			if (cls === "TextLabel" || cls === "TextButton" || cls === "TextBox") {
				this.txt = cls === "TextBox" ? null : document.createElement("span");
				if (this.txt) {
					this.txt.className = "gui-text";
					this.el.appendChild(this.txt);
				}
			}
			if (cls === "ImageLabel" || cls === "ImageButton") {
				this.img = document.createElement("img");
				this.img.className = "gui-img";
				this.img.draggable = false;
				this.el.appendChild(this.img);
			}
			if (cls === "ScrollingFrame") {
				this.inner = document.createElement("div");
				this.inner.className = "gui-inner";
				this.el.appendChild(this.inner);
			}
			if (cls === "ViewportFrame") {
				this.canvas = document.createElement("canvas");
				this.canvas.className = "gui-vp";
				this.el.appendChild(this.canvas);
				viewports.add(this);
			}
		}
		// defaults
		const d = this.p;
		d.Size = UDim2.fromOffset(100, 100);
		d.Position = new UDim2();
		d.AnchorPoint = new Vector2(0, 0);
		d.BackgroundColor3 = RGB(255, 255, 255);
		d.BackgroundTransparency = cls === "ScrollingFrame" || cls === "ScreenGui" ? 1 : 0;
		d.BorderSizePixel = 0;
		d.Visible = true;
		d.ZIndex = 1;
		d.LayoutOrder = 0;
		d.Text = cls === "TextBox" ? "" : cls.startsWith("Text") ? "Label" : "";
		d.TextColor3 = RGB(0, 0, 0);
		d.TextSize = 14;
		d.TextTransparency = 0;
		d.TextStrokeTransparency = 1;
		d.TextStrokeColor3 = RGB(0, 0, 0);
		d.TextXAlignment = "center";
		d.TextYAlignment = "center";
		d.TextWrapped = false;
		d.TextScaled = false;
		d.GroupTransparency = 0;
		d.ImageTransparency = 0;
		d.ImageColor3 = WHITE3;
		d.Rotation = 0;
		d.AutomaticSize = "None";
		d.ClipsDescendants = false;
		d.Scale = 1;
		d.Transparency = 0;
		d.Thickness = 1;
		d.Color = WHITE3;
		d.Enabled = true;
		this.MouseButton1Click = new Signal();
		this.Activated = this.MouseButton1Click;
		this.MouseButton1Down = new Signal();
		this.MouseButton1Up = new Signal();
		this.MouseEnter = new Signal();
		this.MouseLeave = new Signal();
		this.FocusLost = new Signal();
		this.InputBegan = new Signal();
		this._changed = {};
		if (this.el) this._wireEvents();
		this._apply();
	}
	GetPropertyChangedSignal(k) {
		if (!this._changed[k]) this._changed[k] = new Signal();
		return this._changed[k];
	}
	_wireEvents() {
		const el = this.el;
		if (this._isButton) {
			el.addEventListener("pointerdown", (e) => {
				if (e.button !== 0) return;
				this.MouseButton1Down.Fire();
			});
			el.addEventListener("pointerup", (e) => {
				if (e.button !== 0) return;
				this.MouseButton1Up.Fire();
			});
			el.addEventListener("click", (e) => {
				e.stopPropagation();
				this.MouseButton1Click.Fire();
			});
			el.addEventListener("pointerenter", (e) => {
				if (e.pointerType === "mouse") this.MouseEnter.Fire();
			});
			el.addEventListener("pointerleave", (e) => {
				if (e.pointerType === "mouse") this.MouseLeave.Fire();
			});
		}
		if (this.ClassName === "TextBox") {
			el.addEventListener("blur", () => this.FocusLost.Fire(true));
			el.addEventListener("keydown", (e) => {
				if (e.key === "Enter") el.blur();
			});
		}
		el.addEventListener("pointerdown", (e) => {
			this.InputBegan.Fire({ UserInputType: e.pointerType === "touch" ? "Touch" : "MouseButton1", Position: new Vector3(e.clientX, e.clientY, 0), UserInputState: "Begin" });
		});
	}
	// property access
	get(k) { return this.p[k]; }
	set(k, v) {
		this.p[k] = v;
		if (this._changed[k]) this._changed[k].Fire();
		// text changes every frame on the hud, skip the full restyle for those
		if (k === "Text" && this.txt && !this.p.TextScaled && !this.p.RichText && !this._batch) {
			if (this.txt.textContent !== v) this.txt.textContent = v;
			return;
		}
		this._apply(k);
	}
	get AbsoluteSize() {
		if (!this.el) return new Vector2(0, 0);
		const r = this.el.getBoundingClientRect();
		const s = uiScale();
		return new Vector2(r.width / s, r.height / s);
	}
	get AbsolutePosition() {
		if (!this.el) return new Vector2(0, 0);
		const r = this.el.getBoundingClientRect();
		const s = uiScale();
		return new Vector2(r.left / s, r.top / s);
	}
	get CanvasPosition() { return this.el ? new Vector2(this.el.scrollLeft, this.el.scrollTop) : new Vector2(); }
	set CanvasPosition(v) {
		if (this.el) {
			this.el.scrollLeft = v.X;
			this.el.scrollTop = v.Y;
		}
	}
	CaptureFocus() { if (this.el) this.el.focus(); }
	ReleaseFocus() { if (this.el) this.el.blur(); }
	_container() { return this.inner || this.el; }
	_onAncestry() {
		if (this._mod) {
			if (this._parent && this._parent._isGui) this._parent._apply();
			return;
		}
		if (!this.el) return;
		const p = this._parent;
		const host = p ? (p === guiRootInst ? guiRoot : p._isGui && p.el ? p._container() : null) : null;
		if (host) {
			if (this.el.parentNode !== host) host.appendChild(this.el);
			this._apply();
		} else if (this.el.parentNode) {
			this.el.parentNode.removeChild(this.el);
		}
		if (p && p._isGui && p._layout) p._apply();
	}
	_childAdded(c) {
		if (c._mod) {
			this._apply();
			if (c.ClassName === "UIPadding") for (const k of this._children) if (k._isGui && !k._mod && k.el) k._apply();
		}
	}
	_childRemoved(c) {
		if (c._mod) this._apply();
	}
	_onDestroy() {
		if (this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el);
		viewports.delete(this);
	}
	_mods() {
		const out = {};
		for (const c of this._children) if (c._mod && c.p.Enabled !== false) out[c.ClassName] = c;
		return out;
	}
	_apply(changed) {
		if (this._batch) return;
		if (this._mod) {
			if (this._parent && this._parent._isGui && !this._parent._mod) this._parent._apply();
			return;
		}
		if (!this.el) return;
		const d = this.p, s = this.el.style;
		const mods = this._mods();
		const parent = this._parent;
		const pMods = parent && parent._isGui && !parent._mod ? parent._mods() : {};
		const inLayout = !!(pMods.UIListLayout || pMods.UIGridLayout);
		const pAuto = parent && parent.p && parent.p.AutomaticSize && parent.p.AutomaticSize !== "None" && !inLayout;
		const sz = d.Size;
		// roblox lays children out inside the parent's padding, css absolute children ignore it
		const pp = !inLayout && pMods.UIPadding ? pMods.UIPadding.p : null;
		const off = (x) => (x ? x.Offset || 0 : 0);
		const pl = pp ? off(pp.PaddingLeft) : 0, pr = pp ? off(pp.PaddingRight) : 0, pt = pp ? off(pp.PaddingTop) : 0, pb = pp ? off(pp.PaddingBottom) : 0;
		const autoX = d.AutomaticSize === "X" || d.AutomaticSize === "XY";
		const autoY = d.AutomaticSize === "Y" || d.AutomaticSize === "XY";
		s.width = autoX ? "auto" : pp ? `calc((100% - ${pl + pr}px) * ${sz.xs} + ${sz.xo}px)` : `calc(${sz.xs * 100}% + ${sz.xo}px)`;
		s.height = autoY ? "auto" : pp ? `calc((100% - ${pt + pb}px) * ${sz.ys} + ${sz.yo}px)` : `calc(${sz.ys * 100}% + ${sz.yo}px)`;
		// grid cells decide the size of their children, like roblox's UIGridLayout
		if (pMods.UIGridLayout) {
			s.width = "100%";
			s.height = "100%";
		}
		if (autoX) s.minWidth = `calc(${sz.xs * 100}% + ${sz.xo}px)`;
		if (autoY) s.minHeight = `calc(${sz.ys * 100}% + ${sz.yo}px)`;
		if (inLayout) {
			s.position = "relative";
			s.left = s.top = "auto";
			s.order = String(d.LayoutOrder);
			s.flexShrink = "0";
		} else if (pAuto) {
			// roblox grows an auto-sized parent around its children, in css that needs them in the flow
			s.position = "relative";
			s.left = `calc(${d.Position.xs * 100}% + ${d.Position.xo}px)`;
			s.top = `calc(${d.Position.ys * 100}% + ${d.Position.yo}px)`;
			s.flexShrink = "0";
		} else if (pp) {
			s.position = "absolute";
			s.left = `calc(${pl}px + (100% - ${pl + pr}px) * ${d.Position.xs} + ${d.Position.xo}px)`;
			s.top = `calc(${pt}px + (100% - ${pt + pb}px) * ${d.Position.ys} + ${d.Position.yo}px)`;
		} else {
			s.position = "absolute";
			s.left = `calc(${d.Position.xs * 100}% + ${d.Position.xo}px)`;
			s.top = `calc(${d.Position.ys * 100}% + ${d.Position.yo}px)`;
		}
		const ap = d.AnchorPoint;
		const sc = mods.UIScale ? mods.UIScale.p.Scale : 1;
		let tr = inLayout ? "" : `translate(${-ap.X * 100}%, ${-ap.Y * 100}%)`;
		if (sc !== 1) tr += ` scale(${sc})`;
		if (d.Rotation) tr += ` rotate(${d.Rotation}deg)`;
		s.transform = tr;
		s.transformOrigin = `${ap.X * 100}% ${ap.Y * 100}%`;
		s.zIndex = String(d.ZIndex);
		s.display = d.Visible ? "" : "none";
		const bgT = d.BackgroundTransparency;
		const grad = mods.UIGradient;
		if (bgT < 1) {
			if (grad && grad.p.Color && grad.p.Color.k) {
				const k = grad.p.Color.k;
				const stops = k.map(([t, c]) => `${c.R ? c.css ? "" : "" : ""}${mulColor(d.BackgroundColor3, c).css(1 - bgT)} ${t * 100}%`).join(",");
				s.background = `linear-gradient(${90 + (grad.p.Rotation || 0)}deg, ${stops})`;
			} else {
				s.background = d.BackgroundColor3.css(1 - bgT);
			}
		} else {
			s.background = "transparent";
		}
		// gradient transparency on the whole element
		if (grad && grad.p.Transparency && grad.p.Transparency.k) {
			const k = grad.p.Transparency.k;
			const stops = k.map(([t, v]) => `rgba(0,0,0,${1 - v}) ${t * 100}%`).join(",");
			const m = `linear-gradient(${90 + (grad.p.Rotation || 0)}deg, ${stops})`;
			s.webkitMaskImage = m;
			s.maskImage = m;
		} else {
			s.webkitMaskImage = "";
			s.maskImage = "";
		}
		const corner = mods.UICorner;
		if (corner) {
			const cr = corner.p.CornerRadius || { Scale: 0, Offset: 8 };
			s.borderRadius = cr.Scale >= 0.5 ? "50%" : cr.Scale > 0 ? `${cr.Scale * 100}%` : `${cr.Offset}px`;
		} else s.borderRadius = "";
		const stroke = mods.UIStroke;
		this._textStroke = null;
		if (stroke) {
			const c = stroke.p.Color || WHITE3;
			const th = stroke.p.Thickness === undefined ? 1 : stroke.p.Thickness;
			const tt = stroke.p.Transparency || 0;
			// on text elements roblox outlines the letters unless it's set to Border
			if ((this.txt || this.ClassName === "TextBox") && stroke.p.ApplyStrokeMode !== "Border") {
				s.boxShadow = "";
				this._textStroke = [th, c, tt];
			} else s.boxShadow = `0 0 0 ${th}px ${c.css(1 - tt)}`;
		} else s.boxShadow = "";
		if (this.ClassName === "CanvasGroup") s.opacity = String(1 - d.GroupTransparency);
		s.overflow = this.ClassName === "ScrollingFrame" ? "" : d.ClipsDescendants || this.ClassName === "CanvasGroup" ? "hidden" : "visible";
		const pad = mods.UIPadding;
		const host = this._container();
		if (pad) {
			const u = (x) => (x ? (x.Scale ? `${x.Scale * 100}%` : `${x.Offset}px`) : "0px");
			host.style.padding = `${u(pad.p.PaddingTop)} ${u(pad.p.PaddingRight)} ${u(pad.p.PaddingBottom)} ${u(pad.p.PaddingLeft)}`;
			host.style.boxSizing = "border-box";
		} else host.style.padding = "";
		// layouts
		const list = mods.UIListLayout, gridL = mods.UIGridLayout;
		this._layout = !!(list || gridL);
		if (list) {
			host.style.display = d.Visible ? "flex" : "none";
			host.style.flexDirection = list.p.FillDirection || "column";
			const padU = list.p.Padding;
			host.style.gap = padU ? (padU.Scale ? `${padU.Scale * 100}%` : `${padU.Offset}px`) : "0px";
			host.style.alignItems = list.p.HorizontalAlignment && (list.p.FillDirection || "column") === "column" ? list.p.HorizontalAlignment : list.p.VerticalAlignment && list.p.FillDirection === "row" ? list.p.VerticalAlignment : "flex-start";
			host.style.justifyContent = list.p.FillDirection === "row" && list.p.HorizontalAlignment ? list.p.HorizontalAlignment : list.p.VerticalAlignment && (list.p.FillDirection || "column") === "column" ? list.p.VerticalAlignment : "flex-start";
			host.style.flexWrap = "nowrap";
			if (this.inner) {
				if ((list.p.FillDirection || "column") === "row") {
					this.inner.style.width = "max-content";
					this.inner.style.height = "100%";
				} else {
					this.inner.style.width = "100%";
					this.inner.style.height = "auto";
				}
			}
		} else if (gridL) {
			host.style.display = d.Visible ? "grid" : "none";
			const cs = gridL.p.CellSize || UDim2.fromOffset(100, 100);
			const cp = gridL.p.CellPadding || UDim2.fromOffset(5, 5);
			host.style.gridTemplateColumns = `repeat(auto-fill, ${cs.xo}px)`;
			host.style.gridAutoRows = `${cs.yo}px`;
			host.style.gap = `${cp.yo}px ${cp.xo}px`;
			host.style.justifyContent = gridL.p.HorizontalAlignment || "start";
			if (this.inner) {
				this.inner.style.width = "100%";
				this.inner.style.height = "auto";
			}
		} else if (this.inner) {
			host.style.display = "block";
			this.inner.style.width = "100%";
			this.inner.style.height = "100%";
		}
		if (this.ClassName === "ScrollingFrame") {
			const dir = d.ScrollingDirection || "Y";
			s.overflowX = dir === "Y" ? "hidden" : "auto";
			s.overflowY = dir === "X" ? "hidden" : "auto";
			s.setProperty("--sb", (d.ScrollBarThickness === undefined ? 12 : d.ScrollBarThickness) + "px");
		}
		// children of a layout need re-layout when this changes
		if (this._layout) {
			for (const c of this._children) if (c._isGui && !c._mod && c.el) c._applyLite();
		}
		// text
		if (this.txt || this.ClassName === "TextBox") {
			const t = this.txt || this.el;
			const col = d.TextColor3;
			t.style.color = col.css(1 - d.TextTransparency);
			const st = d.TextStrokeTransparency;
			if (this._textStroke) {
				const [th, c, tt] = this._textStroke;
				t.style.webkitTextStroke = `${th * 2}px ${c.css((1 - tt) * (1 - d.TextTransparency))}`;
				t.style.paintOrder = "stroke fill";
				t.style.textShadow = "none";
			} else {
				t.style.webkitTextStroke = "";
				const sc = d.TextStrokeColor3.css((1 - st) * (1 - d.TextTransparency));
				t.style.textShadow = st < 1 ? `1px 0 0 ${sc}, -1px 0 0 ${sc}, 0 1px 0 ${sc}, 0 -1px 0 ${sc}, 1px 1px 0 ${sc}, -1px -1px 0 ${sc}, 1px -1px 0 ${sc}, -1px 1px 0 ${sc}` : "none";
			}
			t.style.fontSize = (d.TextScaled ? fitSize(this) : d.TextSize) + "px";
			if (this.ClassName === "TextBox") {
				if (this.el.value !== d.Text && document.activeElement !== this.el) this.el.value = d.Text;
				this.el.placeholder = d.PlaceholderText || "";
			} else {
				if (d.RichText) t.innerHTML = richText(d.Text);
				else if (t.textContent !== d.Text) t.textContent = d.Text;
			}
			const wrap = d.TextWrapped || autoY;
			t.style.whiteSpace = wrap ? "pre-wrap" : "pre";
			this.el.style.justifyContent = d.TextXAlignment === "left" ? "flex-start" : d.TextXAlignment === "right" ? "flex-end" : "center";
			this.el.style.alignItems = d.TextYAlignment === "top" ? "flex-start" : d.TextYAlignment === "bottom" ? "flex-end" : "center";
			t.style.textAlign = d.TextXAlignment;
			t.style.textOverflow = d.TextTruncate === "AtEnd" ? "ellipsis" : "clip";
			t.style.overflow = d.TextTruncate === "AtEnd" ? "hidden" : "visible";
			t.style.maxWidth = d.TextTruncate === "AtEnd" ? "100%" : "";
		}
		if (this.img) {
			const src = d.Image || "";
			if (this.img.getAttribute("src") !== src && src) this.img.setAttribute("src", src);
			this.img.style.display = src ? "" : "none";
			this.img.style.opacity = String(1 - d.ImageTransparency);
			this.img.style.objectFit = d.ScaleType === "Crop" ? "cover" : d.ScaleType === "Stretch" ? "fill" : "contain";
		}
	}
	_applyLite() { this._apply(); }
}
function mulColor(a, b) { return new Color3(a.R * b.R, a.G * b.G, a.B * b.B); }
function richText(s) {
	return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
const measure = document.createElement("canvas").getContext("2d");
function fitSize(g) {
	const w = g.el.clientWidth || 100, h = g.el.clientHeight || 20;
	let size = Math.floor(h * 0.9);
	measure.font = `${size}px Overpass`;
	const tw = measure.measureText(g.p.Text).width;
	if (tw > w) size = Math.floor((size * w) / tw);
	return Math.max(8, size);
}

// every roblox-y property goes through get/set so the dom stays in sync
const GUI_PROPS = [
	"Size", "Position", "AnchorPoint", "BackgroundColor3", "BackgroundTransparency", "BorderSizePixel", "Visible", "ZIndex", "LayoutOrder",
	"Text", "TextColor3", "TextSize", "TextTransparency", "TextStrokeTransparency", "TextStrokeColor3", "TextXAlignment", "TextYAlignment", "TextWrapped", "TextScaled", "TextTruncate", "RichText",
	"Font", "FontFace", "GroupTransparency", "Image", "ImageTransparency", "ImageColor3", "ScaleType", "Rotation", "AutomaticSize", "AutomaticCanvasSize", "CanvasSize", "ScrollBarThickness", "ScrollBarImageColor3", "ScrollingDirection",
	"ClipsDescendants", "Scale", "Transparency", "Thickness", "Color", "Enabled", "FillDirection", "Padding", "SortOrder", "HorizontalAlignment", "VerticalAlignment", "CellSize", "CellPadding",
	"PaddingTop", "PaddingBottom", "PaddingLeft", "PaddingRight", "CornerRadius", "ApplyStrokeMode", "PlaceholderText", "ClearTextOnFocus", "AutoButtonColor", "Modal", "Active", "Selectable",
	"IgnoreGuiInset", "ResetOnSpawn", "ZIndexBehavior", "ScreenInsets", "ClipToDeviceSafeArea", "DisplayOrder", "Ambient", "LightColor", "LightDirection", "CurrentCamera", "SizeConstraint", "AspectRatio", "LineHeight", "MaxVisibleGraphemes",
	"StudsOffset", "AlwaysOnTop", "MaxDistance", "LightInfluence", "Adornee", "ElasticBehavior", "VerticalScrollBarInset",
];
for (const k of GUI_PROPS) {
	Object.defineProperty(GuiObject.prototype, k, {
		configurable: true,
		get() { return this.p[k]; },
		set(v) {
			if (k === "Text" && this.ClassName === "TextBox") {
				this.p[k] = v;
				if (this.el) this.el.value = v;
				if (this._changed[k]) this._changed[k].Fire();
				return;
			}
			this.set(k, v);
		},
	});
}
// textbox text reads the live value
Object.defineProperty(GuiObject.prototype, "ContentText", { get() { return this.p.Text; } });
const tbProto = Object.getOwnPropertyDescriptor(GuiObject.prototype, "Text");
Object.defineProperty(GuiObject.prototype, "Text", {
	get() {
		if (this.ClassName === "TextBox" && this.el) return this.el.value;
		return this.p.Text;
	},
	set: tbProto.set,
});

// the one screen gui: a root instance mapped onto #gui
export const guiRootInst = new Instance("ScreenGui");
guiRootInst._isGui = true;
guiRootInst._container = () => guiRoot;
guiRootInst._apply = () => {};
guiRootInst._mods = () => ({});
guiRootInst.p = { Enabled: true };
Object.defineProperty(guiRootInst, "Enabled", {
	get() { return this.p.Enabled; },
	set(v) {
		this.p.Enabled = v;
		guiRoot.style.display = v ? "" : "none";
	},
});
let _uiScale = 1;
export function uiScale() { return _uiScale; }
export function setUiScale(s) { _uiScale = s; }

// viewport frames: a little renderer per frame for the skin showcase
const viewports = new Set();
let vpRenderer = null;
function renderViewports() {
	for (const vp of viewports) {
		if (!vp.el || !vp.el.isConnected || vp.el.offsetParent === null) continue;
		const w = vp.el.clientWidth, h = vp.el.clientHeight;
		if (w < 4 || h < 4) continue;
		if (!vpRenderer) {
			// preserveDrawingBuffer so copying it into each frame's canvas never grabs an empty buffer
			vpRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
			vpRenderer.outputColorSpace = THREE.SRGBColorSpace;
		}
		vpScene(vp);
		// mirror the parts that live inside this frame
		const parts = vp.GetDescendants().filter((d) => d._isPart);
		const live = new Set();
		for (const pt of parts) {
			if (!pt._vpMesh) {
				const g = pt._shape === "Ball" ? geoBall : pt._shape === "Cylinder" ? geoCyl : pt.ClassName === "WedgePart" ? geoWedge : geoBox;
				pt._vpMesh = new THREE.Mesh(g, makeMaterial(pt.Color, pt.Material, 0.001));
				pt._vpMesh.matrixAutoUpdate = false;
			}
			const m = pt._vpMesh;
			// colour and fade can change (tweens), keep the material in sync
			const t = pt._t();
			m.visible = t < 0.999;
			m.material.opacity = clamp(1 - t, 0, 1) * (pt._mat === "Glass" ? 0.65 : 1);
			m.material.depthWrite = t < 0.5;
			const c = m.material.color.setRGB(pt._color.R, pt._color.G, pt._color.B, THREE.SRGBColorSpace);
			if (pt._mat === "Neon") c.multiplyScalar(1.6);
			if (m.parent !== vp.scene3) vp.scene3.add(m);
			const r = pt.CFrame.r, p = pt.CFrame.p, s = pt.Size;
			let sx = s.X, sy = s.Y, sz = s.Z;
			if (pt._shape === "Ball" && !pt._ellipsoid) sx = sy = sz = Math.min(s.X, s.Y, s.Z);
			else if (pt._shape === "Cylinder") sy = sz = Math.min(s.Y, s.Z);
			const e = m.matrix.elements;
			e[0] = r[0] * sx; e[1] = r[3] * sx; e[2] = r[6] * sx; e[3] = 0;
			e[4] = r[1] * sy; e[5] = r[4] * sy; e[6] = r[7] * sy; e[7] = 0;
			e[8] = r[2] * sz; e[9] = r[5] * sz; e[10] = r[8] * sz; e[11] = 0;
			e[12] = p.X; e[13] = p.Y; e[14] = p.Z; e[15] = 1;
			m.matrixWorldNeedsUpdate = true;
			live.add(m);
		}
		for (const c of vp.scene3.children.slice()) if (c.isMesh && !c.userData.keep && !live.has(c)) vp.scene3.remove(c);
		const cam = vp.p.CurrentCamera;
		if (cam) {
			const cf = cam.CFrame;
			vp.cam3.position.set(cf.p.X, cf.p.Y, cf.p.Z);
			vp.cam3.quaternion.copy(cf.quat());
			vp.cam3.fov = cam.FieldOfView || 70;
		}
		vp.cam3.aspect = w / h;
		vp.cam3.updateProjectionMatrix();
		const ld = vp.p.LightDirection || new Vector3(-1, -1, -1);
		vp.dl.position.set(-ld.X * 10, -ld.Y * 10, -ld.Z * 10);
		const dpr = Math.min(window.devicePixelRatio, 2);
		if (vp.canvas.width !== Math.floor(w * dpr) || vp.canvas.height !== Math.floor(h * dpr)) {
			vp.canvas.width = Math.floor(w * dpr);
			vp.canvas.height = Math.floor(h * dpr);
		}
		vpRenderer.setSize(vp.canvas.width, vp.canvas.height, false);
		vpRenderer.setClearColor(0x000000, 0);
		vpRenderer.render(vp.scene3, vp.cam3);
		const g2 = vp.canvas.getContext("2d");
		g2.clearRect(0, 0, vp.canvas.width, vp.canvas.height);
		g2.drawImage(vpRenderer.domElement, 0, 0);
	}
}

// ------------------------------------------------------------------ the frame loop

let last = clock();
export const perf = { fps: 60 };
function frame() {
	requestAnimationFrame(frame);
	const now = clock();
	let dt = Math.min(now - last, 0.1);
	last = now;
	frameDt = dt;
	perf.fps = perf.fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
	runTimers();
	RunService.Heartbeat.Fire(dt);
	stepPhysics(dt);
	updateTweens(dt);
	RunService.RenderStepped.Fire(dt);
	// camera
	const cf = camera.CFrame;
	cam3.position.set(cf.p.X, cf.p.Y, cf.p.Z);
	cam3.quaternion.copy(cf.quat());
	if (cam3.fov !== camera.FieldOfView) {
		cam3.fov = camera.FieldOfView;
		cam3.updateProjectionMatrix();
	}
	const wantFar = Math.max(3000, Lighting.FogEnd * 1.2 + 500);
	if (cam3.far !== wantFar) {
		cam3.far = wantFar;
		cam3.updateProjectionMatrix();
	}
	for (const g of glowSprites) {
		const p = g._parent;
		if (!p || !p._isPart) continue;
		const pp = p.CFrame.p;
		g.sprite.position.set(pp.X, pp.Y, pp.Z);
		g.sprite.visible = g.Enabled !== false && g._br > 0.05;
	}
	updateParticles(dt);
	updateTrails();
	updateGlows();
	updateHighlights();
	updateLighting(cam3.position);
	composer.render();
	renderViewports();
}
export function start() {
	last = clock();
	requestAnimationFrame(frame);
}
