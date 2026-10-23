// BlogPosting JSON-LD for blog posts. Kept free of Astro/Tina imports so the
// unit test can compile it with plain tsc (see blog-schema.test.ts).

export interface BlogAuthor {
	name?: string | null;
	_sys?: { filename?: string | null } | null;
}

export interface BlogPostingInput {
	title?: string | null;
	description?: string | null;
	pubDate?: string | null;
	updatedDate?: string | null;
	filename: string;
	/** Absolute hero image URL, already resolved through mediaUrl. */
	imageUrl?: string | null;
	author?: BlogAuthor | null;
	/** Absolute site origin used for page and author URLs. */
	siteUrl: string;
	/** Astro.site href; when set, publisher references the homepage `#team` node. */
	canonicalSite?: string | null;
	publisherName?: string | null;
}

// Byline + author box: the post's `author` reference wins; posts that never
// set it fall back to the default author (Amy's team doc, the live site's
// historical byline). A failed fallback lookup yields no author.
export async function resolveBlogAuthor<T extends BlogAuthor>(
	authorRef: unknown,
	loadDefault: () => Promise<T | null>,
): Promise<T | null> {
	if (authorRef && typeof authorRef === 'object') return authorRef as T;
	return loadDefault().catch(() => null);
}

// Author matches the visible byline; publisher references the homepage
// RealEstateAgent node by @id.
export function buildBlogPostingJsonLd(input: BlogPostingInput) {
	const { author } = input;
	const authorSlug = author?._sys?.filename;
	// || not ??: Tina returns "" for an editor-cleared optional date.
	const modifiedDate = input.updatedDate || input.pubDate;
	return {
		'@context': 'https://schema.org',
		'@type': 'BlogPosting',
		headline: input.title,
		...(input.description ? { description: input.description } : {}),
		...(input.pubDate ? { datePublished: new Date(input.pubDate).toISOString() } : {}),
		...(modifiedDate ? { dateModified: new Date(modifiedDate).toISOString() } : {}),
		...(input.imageUrl ? { image: input.imageUrl } : {}),
		mainEntityOfPage: new URL(`/blog/${input.filename}/`, input.siteUrl).href,
		...(author?.name
			? {
					author: {
						'@type': 'Person',
						name: author.name,
						...(authorSlug ? { url: new URL(`/about/${authorSlug}/`, input.siteUrl).href } : {}),
					},
				}
			: {}),
		publisher: {
			'@type': 'RealEstateAgent',
			...(input.canonicalSite ? { '@id': `${input.canonicalSite}#team` } : {}),
			...(input.publisherName ? { name: input.publisherName } : {}),
		},
	};
}

// Escapes `<` so post text such as "</script>" cannot close the inline tag.
export function serializeJsonLd(value: unknown): string {
	return JSON.stringify(value).replace(/</g, '\\u003c');
}
