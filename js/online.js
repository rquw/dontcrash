// everything online: firebase realtime database over plain REST plus live streams, and accounts.
// you start as an anonymous player, making an account turns that same player into name + password
export const FIREBASE = {
	apiKey: "AIzaSyDbXhlHYOlbbTTU2xm7QfytbQXiT58uIDw",
	databaseURL: "https://dontcrash-7a1db-default-rtdb.europe-west1.firebasedatabase.app",
};

export const enabled = () => !!(FIREBASE.apiKey && FIREBASE.databaseURL);
const KEY = "dontcrash_auth_v1";
// ?emu runs against the local firebase emulators, only for testing
const EMU = typeof location !== "undefined" && /[?&]emu\b/.test(location.search);
const base = () => (EMU ? "http://127.0.0.1:9000" : FIREBASE.databaseURL.replace(/\/+$/, ""));
const NS = EMU ? "ns=dontcrash-7a1db-default-rtdb&" : "";
const ID = (EMU ? "http://127.0.0.1:9099/" : "https://") + "identitytoolkit.googleapis.com/v1/accounts:";
const TOKEN_URL = (EMU ? "http://127.0.0.1:9099/" : "https://") + "securetoken.googleapis.com/v1/token";
// firebase wants an email, so a name becomes name@dontcrash.game behind the scenes
const emailOf = (name) => name.trim().toLowerCase() + "@dontcrash.game";
// firebase wants 6+ characters, so the password gets padded behind the scenes and "a" works too
const padPw = (pw) => "dc:" + pw + ":dontcrash";

let auth = null;
try {
	auth = JSON.parse(localStorage.getItem(KEY) || "null");
} catch (e) {
	auth = null;
}
function keep() {
	try {
		localStorage.setItem(KEY, JSON.stringify(auth));
	} catch (e) {}
}

const NICE = {
	EMAIL_EXISTS: "that name is taken",
	INVALID_LOGIN_CREDENTIALS: "wrong name or password",
	EMAIL_NOT_FOUND: "wrong name or password",
	INVALID_PASSWORD: "wrong name or password",
	WEAK_PASSWORD: "password needs at least 6 characters",
	TOO_MANY_ATTEMPTS_TRY_LATER: "too many tries, wait a bit",
	OPERATION_NOT_ALLOWED: "accounts aren't switched on yet",
	USER_DISABLED: "this account is disabled",
};
async function post(url, body, form) {
	let r;
	try {
		r = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" },
			body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
		});
	} catch (e) {
		throw new Error("no connection");
	}
	const j = await r.json();
	if (!r.ok) {
		const code = String((j.error && (j.error.message || j.error)) || "failed").split(" ")[0].split(":")[0];
		throw new Error(NICE[code] || code.toLowerCase().replace(/_/g, " "));
	}
	return j;
}
function take(j, name) {
	auth = {
		uid: j.localId || j.user_id,
		idToken: j.idToken || j.id_token,
		refreshToken: j.refreshToken || j.refresh_token,
		expires: Date.now() + Number(j.expiresIn || j.expires_in || 3600) * 1000,
		name: name !== undefined ? name : auth && auth.name,
	};
	keep();
}

// a valid id token, signing up anonymously or refreshing when needed
export async function token() {
	if (auth && auth.idToken && auth.expires > Date.now() + 60000) return auth.idToken;
	if (auth && auth.refreshToken) {
		try {
			const j = await post(`${TOKEN_URL}?key=${FIREBASE.apiKey}`, { grant_type: "refresh_token", refresh_token: auth.refreshToken }, true);
			take(j);
			return auth.idToken;
		} catch (e) {
			// an account that can't refresh anymore has to log in again, an anonymous one just starts fresh
			if (auth.name && e.message !== "no connection") auth = null;
			if (e.message === "no connection") throw e;
		}
	}
	const j = await post(`${ID}signUp?key=${FIREBASE.apiKey}`, { returnSecureToken: true });
	take(j, null);
	return auth.idToken;
}

export function myId() {
	return auth && auth.uid;
}
// the account name when you're logged in, null while you're anonymous
export function account() {
	return auth && auth.name ? auth.name : null;
}

function checkName(name) {
	name = String(name || "").trim();
	if (name.length < 3 || name.length > 16) throw new Error("names are 3 to 16 characters");
	if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error("letters, numbers and _ only");
	return name;
}

// makes your current anonymous player a real account, so your spot on the leaderboard stays yours
export async function register(name, password) {
	name = checkName(name);
	if (!String(password || "").length) throw new Error("type a password");
	let t = await token();
	if (auth.name) {
		// already an account on this device: a new one starts from a fresh anonymous player
		auth = null;
		t = await token();
	}
	const j = await post(`${ID}signUp?key=${FIREBASE.apiKey}`, { idToken: t, email: emailOf(name), password: padPw(password), returnSecureToken: true });
	take(j, name);
	return auth.uid;
}

export async function login(name, password) {
	name = checkName(name);
	if (!String(password || "").length) throw new Error("type a password");
	let j;
	try {
		j = await post(`${ID}signInWithPassword?key=${FIREBASE.apiKey}`, { email: emailOf(name), password: padPw(password), returnSecureToken: true });
	} catch (e) {
		// accounts from the first version used the password as it was
		if (e.message !== "wrong name or password" || password.length < 6) throw e;
		j = await post(`${ID}signInWithPassword?key=${FIREBASE.apiKey}`, { email: emailOf(name), password, returnSecureToken: true });
	}
	take(j, name);
	return auth.uid;
}

export function logout() {
	auth = null;
	keep();
}

// the worker keeps everyone's real save. the game tells it what you did and gets back how things really stand
const WORKER = EMU ? "http://127.0.0.1:8787" : "https://dontcrash-pay.schwaiger-fabio0907.workers.dev";
export async function sync(payload) {
	const t = await token();
	let r;
	try {
		r = await fetch(WORKER + "/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token: t, ...payload }) });
	} catch (e) {
		throw new Error("no connection");
	}
	if (r.status === 401) throw new Error("login");
	if (!r.ok) throw new Error("sync failed " + r.status);
	return await r.json();
}

// removes the account for good: leaderboard entry, save and the login itself
export async function deleteAccount() {
	if (!auth || !auth.name) throw new Error("not logged in");
	const t = await token();
	await sync({ remove: true });
	await post(`${ID}delete?key=${FIREBASE.apiKey}`, { idToken: t });
	auth = null;
	keep();
}

// ---------------- plain database calls
async function req(method, path, body) {
	const t = await token();
	const r = await fetch(`${base()}/${path}.json?${NS}auth=${t}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
	if (!r.ok) throw new Error(method + " " + path + " failed " + r.status);
	return await r.json();
}
export const get = (path) => req("GET", path);
export const put = (path, v) => req("PUT", path, v);
export const patch = (path, v) => req("PATCH", path, v);
export const del = (path) => req("DELETE", path);
export const SERVER_TIME = { ".sv": "timestamp" };

// how far our clock is off from firebase's, so everyone counts down to the same moment
let offset = 0;
export const serverNow = () => Date.now() + offset;
export async function syncClock() {
	await token();
	const t0 = Date.now();
	const v = await put(`clock/${auth ? auth.uid : "x"}`, SERVER_TIME).catch(() => null);
	const t1 = Date.now();
	if (typeof v === "number") offset = v - (t0 + t1) / 2;
	return offset;
}

// a live copy of a path, calls back on every change. returns a function that stops it
export function listen(path, cb, query) {
	let es = null, stopped = false, mirror = null, retry = null, wait = 1500;
	const setAt = (p, v, merge) => {
		const keys = p.split("/").filter(Boolean);
		if (!keys.length) {
			if (merge && mirror && v) Object.assign(mirror, v);
			else mirror = v;
			return;
		}
		if (!mirror || typeof mirror !== "object") mirror = {};
		let o = mirror;
		for (let i = 0; i < keys.length - 1; i++) {
			if (!o[keys[i]] || typeof o[keys[i]] !== "object") o[keys[i]] = {};
			o = o[keys[i]];
		}
		const last = keys[keys.length - 1];
		if (merge && v && typeof v === "object") {
			if (!o[last] || typeof o[last] !== "object") o[last] = {};
			for (const k in v) {
				if (v[k] === null) delete o[last][k];
				else o[last][k] = v[k];
			}
		} else if (v === null) delete o[last];
		else o[last] = v;
	};
	const open = async () => {
		if (stopped) return;
		let t;
		try {
			t = await token();
		} catch (e) {
			retry = setTimeout(open, 3000);
			return;
		}
		if (stopped) return;
		es = new EventSource(`${base()}/${path}.json?${NS}${query ? query + "&" : ""}auth=${t}`);
		const on = (merge) => (e) => {
			let m;
			try {
				m = JSON.parse(e.data);
			} catch (err) {
				return;
			}
			if (!m) return;
			wait = 1500;
			setAt(m.path, m.data, merge);
			cb(mirror);
		};
		es.addEventListener("put", on(false));
		es.addEventListener("patch", on(true));
		const again = () => {
			if (es) es.close();
			es = null;
			// back off when it keeps failing, no point hammering a path we can't read
			if (!stopped) retry = setTimeout(open, wait);
			wait = Math.min(wait * 2, 30000);
		};
		es.addEventListener("auth_revoked", again);
		es.addEventListener("cancel", again);
		es.onerror = () => {
			if (es && es.readyState === 2) again();
		};
	};
	open();
	return () => {
		stopped = true;
		clearTimeout(retry);
		if (es) es.close();
	};
}

// ---------------- leaderboard + profiles
export async function push(profile) {
	if (!enabled()) return false;
	await token();
	await put(`players/${auth.uid}`, profile);
	return true;
}

export async function top(n = 100) {
	if (!enabled()) return [];
	const r = await fetch(`${base()}/players.json?${NS}orderBy=${encodeURIComponent('"best"')}&limitToLast=${n}`);
	if (!r.ok) throw new Error("load failed " + r.status);
	const j = (await r.json()) || {};
	return Object.entries(j)
		.map(([id, p]) => ({ id, ...p }))
		.filter((p) => p && typeof p.name === "string")
		.sort((a, b) => (b.best || 0) - (a.best || 0));
}

export async function player(id) {
	if (!enabled()) return null;
	const r = await fetch(`${base()}/players/${encodeURIComponent(id)}.json?${NS}`);
	if (!r.ok) throw new Error("load failed " + r.status);
	return await r.json();
}

// ---------------- your save follows your account
export async function loadSave() {
	if (!account()) return null;
	return await get(`saves/${auth.uid}`);
}
export async function storeSave(d) {
	if (!account()) return false;
	await put(`saves/${auth.uid}`, d);
	return true;
}
