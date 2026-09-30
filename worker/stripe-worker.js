// DON'T CRASH! payment worker (cloudflare)
// stripe calls this after every payment, it checks the signature and puts the gems into firebase under grants/<player>.
// needs 3 variables in the worker settings:
//   STRIPE_WEBHOOK_SECRET  whsec_... from the stripe webhook
//   FIREBASE_SECRET        database secret from firebase (project settings > service accounts > database secrets)
//   FIREBASE_DB            https://dontcrash-7a1db-default-rtdb.europe-west1.firebasedatabase.app

// what every pack costs (in cents) and gives. has to match the payment links and PACKS in the game
const PACKS = {
	special: { amt: 999, gems: 1000, coins: 50000, revives: 10, keys: 15, skin: "Royal" },
	gems500: { amt: 299, gems: 500 },
	gems1000: { amt: 499, gems: 1000 },
	gems2500: { amt: 999, gems: 2500 },
	phoenix: { amt: 199, skin: "Phoenix" },
	galaxy: { amt: 199, skin: "Galaxy" },
	razor: { amt: 199, skin: "Razor" },
};

export default {
	async fetch(req, env) {
		if (req.method !== "POST") return new Response("dont crash payments");
		const body = await req.text();
		if (!(await verify(body, req.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET))) {
			return new Response("bad signature", { status: 400 });
		}
		const ev = JSON.parse(body);
		if (ev.type !== "checkout.session.completed" && ev.type !== "checkout.session.async_payment_succeeded") return new Response("ignored");

		const s = ev.data.object;
		// a 100% coupon comes through as "no_payment_required"
		if (s.payment_status !== "paid" && s.payment_status !== "no_payment_required") return new Response("not paid yet");
		// the game sends "<player>__<pack>", the price before any coupon has to match the pack so nobody gets the big one for 1,99
		const [uid, packId] = String(s.client_reference_id || "").split("__");
		const pack = PACKS[packId];
		if (!uid || !/^[A-Za-z0-9-]{6,128}$/.test(uid) || !pack || pack.amt !== (s.amount_subtotal ?? s.amount_total)) return new Response("no player or wrong pack");

		const url = `${env.FIREBASE_DB.replace(/\/+$/, "")}/grants/${uid}/${s.id}.json?auth=${env.FIREBASE_SECRET}`;
		// stripe sometimes sends the same event twice, one payment only counts once
		const read = await fetch(url);
		// a wrong secret shouldn't silently eat a payment: fail, and stripe tries again later
		if (!read.ok) return new Response("database read failed", { status: 500 });
		const had = await read.json();
		if (!had) {
			const r = await fetch(url, {
				method: "PUT",
				body: JSON.stringify({ ...pack, amt: undefined, pack: packId, eur: s.amount_total / 100, at: { ".sv": "timestamp" } }),
			});
			if (!r.ok) return new Response("database failed", { status: 500 });
		}
		return new Response("ok");
	},
};

async function verify(body, header, secret) {
	if (!header || !secret) return false;
	let t = null;
	const sigs = [];
	for (const part of header.split(",")) {
		const [k, v] = part.split("=");
		if (k === "t") t = v;
		if (k === "v1") sigs.push(v);
	}
	if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
	const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
	const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(t + "." + body));
	const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
	return sigs.includes(hex);
}
