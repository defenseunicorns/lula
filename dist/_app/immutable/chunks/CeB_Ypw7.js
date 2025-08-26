import {
	h as l,
	d as u,
	e as m,
	E as p,
	g as _,
	i as h,
	j as v,
	k as b,
	l as g,
	p as E
} from './BnKEWqYI.js';
function x(i, s, d) {
	l && u();
	var r = i,
		a,
		n,
		e = null,
		t = null;
	function f() {
		(n && (E(n), (n = null)),
			e && (e.lastChild.remove(), r.before(e), (e = null)),
			(n = t),
			(t = null));
	}
	(m(() => {
		if (a !== (a = s())) {
			var c = b();
			if (a) {
				var o = r;
				(c && ((e = document.createDocumentFragment()), e.append((o = _()))),
					(t = h(() => d(o, a))));
			}
			c ? v.add_callback(f) : f();
		}
	}, p),
		l && (r = g));
}
export { x as c };
