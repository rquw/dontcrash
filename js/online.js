// the online leaderboard: firebase realtime database over plain REST, anonymous sign-in so
// everyone can only write their own entry. paste your project's values in here (see README)
export const FIREBASE = {
	apiKey: "AIzaSyDbXhlHYOlbbTTU2xm7QfytbQXiT58uIDw",
	databaseURL: "https://dontcrash-7a1db-default-rtdb.europe-west1.firebasedatabase.app",
};

export const enabled = () => !!(FIREBASE.apiKey && FIREBASE.databaseURL);
const KEY = "dontcrash_auth_v1";
const base = () => FIREBASE.databaseURL.replace(/\/+$/, "");

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

async function post(url, body, form) {
	const r = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json" },
		body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
	});
	const j = await r.json();
	if (!r.ok) throw new Error((j.error && (j.error.message || j.error)) || "auth failed");
	return j;
}

// a valid id token, signing up or refreshing when needed
async function token() {
	if (auth && auth.idToken && auth.expires > Date.now() + 60000) return auth.idToken;
	if (auth && auth.refreshToken) {
		try {
			const j = await post(`https://securetoken.googleapis.com/v1/token?key=${FIREBASE.apiKey}`, { grant_type: "refresh_token", refresh_token: auth.refreshToken }, true);
			auth = { uid: j.user_id, idToken: j.id_token, refreshToken: j.refresh_token, expires: Date.now() + Number(j.expires_in) * 1000 };
			keep();
			return auth.idToken;
		} catch (e) {
			// fall through and sign up fresh
		}
	}
	const j = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE.apiKey}`, { returnSecureToken: true });
	auth = { uid: j.localId, idToken: j.idToken, refreshToken: j.refreshToken, expires: Date.now() + Number(j.expiresIn) * 1000 };
	keep();
	return auth.idToken;
}

export function myId() {
	return auth && auth.uid;
}

export async function push(profile) {
	if (!enabled()) return false;
	const t = await token();
	const r = await fetch(`${base()}/players/${auth.uid}.json?auth=${t}`, { method: "PUT", body: JSON.stringify(profile) });
	if (!r.ok) throw new Error("save failed " + r.status);
	return true;
}

export async function top(n = 100) {
	if (!enabled()) return [];
	const r = await fetch(`${base()}/players.json?orderBy=${encodeURIComponent('"best"')}&limitToLast=${n}`);
	if (!r.ok) throw new Error("load failed " + r.status);
	const j = (await r.json()) || {};
	return Object.entries(j)
		.map(([id, p]) => ({ id, ...p }))
		.filter((p) => p && typeof p.name === "string")
		.sort((a, b) => (b.best || 0) - (a.best || 0));
}

export async function player(id) {
	if (!enabled()) return null;
	const r = await fetch(`${base()}/players/${encodeURIComponent(id)}.json`);
	if (!r.ok) throw new Error("load failed " + r.status);
	return await r.json();
}
