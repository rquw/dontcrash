// DON'T CRASH! payment worker (cloudflare)
// stripe calls this after every payment, it checks the signature and puts the gems into firebase under grants/<player>.
// needs 3 variables in the worker settings:
//   STRIPE_WEBHOOK_SECRET  whsec_... from the stripe webhook
//   FIREBASE_SECRET        database secret from firebase (project settings > service accounts > database secrets)
//   FIREBASE_DB            https://dontcrash-7a1db-default-rtdb.europe-west1.firebasedatabase.app

// price in cents -> gems. has to match the payment links and GEM_PACKS in the game
const PACKS = { 299: 500, 499: 1000, 999: 2500 };

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
		if (s.payment_status !== "paid") return new Response("not paid yet");
		const uid = s.client_reference_id;
		const gems = PACKS[s.amount_total];
		if (!uid || !/^[A-Za-z0-9_-]{6,128}$/.test(uid) || !gems) return new Response("no player or unknown pack");

		const url = `${env.FIREBASE_DB.replace(/\/+$/, "")}/grants/${uid}/${s.id}.json?auth=${env.FIREBASE_SECRET}`;
		// stripe sometimes sends the same event twice, one payment only counts once
		const had = await (await fetch(url)).json();
		if (!had) {
			const r = await fetch(url, {
				method: "PUT",
				body: JSON.stringify({ gems, eur: s.amount_total / 100, at: { ".sv": "timestamp" } }),
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
