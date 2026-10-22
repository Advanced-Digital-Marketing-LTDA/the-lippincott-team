import { legacyRedirects } from './legacy-redirect-data.mjs';

const destinations = new Map(legacyRedirects);

/** Query-preserving handler shared by exact legacy URL routes. */
export const ALL = ({ url, redirect }) => {
	const withoutTrailingSlash = url.pathname.endsWith('/')
		? url.pathname.slice(0, -1)
		: url.pathname;
	const destination = destinations.get(url.pathname)
		?? destinations.get(withoutTrailingSlash)
		?? destinations.get(`${withoutTrailingSlash}/`);

	if (!destination) return new Response(null, { status: 404 });
	return redirect(`${destination}${url.search}`, 301);
};
