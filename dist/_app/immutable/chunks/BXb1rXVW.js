import {
	t as d,
	v as g,
	u as c,
	x as m,
	y as i,
	z as b,
	A as p,
	B as v,
	C as y,
	D as h
} from './BnKEWqYI.js';
function x(n = !1) {
	const s = d,
		e = s.l.u;
	if (!e) return;
	let f = () => v(s.s);
	if (n) {
		let a = 0,
			t = {};
		const _ = y(() => {
			let l = !1;
			const r = s.s;
			for (const o in r) r[o] !== t[o] && ((t[o] = r[o]), (l = !0));
			return (l && a++, a);
		});
		f = () => p(_);
	}
	(e.b.length &&
		g(() => {
			(u(s, f), i(e.b));
		}),
		c(() => {
			const a = m(() => e.m.map(b));
			return () => {
				for (const t of a) typeof t == 'function' && t();
			};
		}),
		e.a.length &&
			c(() => {
				(u(s, f), i(e.a));
			}));
}
function u(n, s) {
	if (n.l.s) for (const e of n.l.s) p(e);
	s();
}
h();
export { x as i };
