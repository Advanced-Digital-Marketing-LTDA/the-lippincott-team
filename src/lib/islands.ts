/**
 * Island registry — single source of truth for every editable region the
 * bridge can refresh. Each entry maps a URL slug under `/tina-island/...`
 * to a fetcher + component + wrapper. Adding a new editable region = adding
 * one entry here; the dynamic `[name].ts` route picks it up automatically.
 */
import type { IslandRegistry } from '@tinacms/astro/experimental';
import type { QueryResult } from '@tinacms/astro/data';

import type { BlogQuery, CommunityQuery, ConfigQuery, PageQuery, StandaloneQuery, TeamQuery } from '../../tina/__generated__/types';
import type { CmsBlog, CmsCommunity, CmsConfig, CmsPage, CmsStandalone, CmsTeam } from './data';
import PageBody from '../components/islands/PageBody.astro';
import BlogBody from '../components/islands/BlogBody.astro';
import TeamBody from '../components/islands/TeamBody.astro';
import CommunityBody from '../components/islands/CommunityBody.astro';
import StandaloneBody from '../components/standalone/StandaloneBody.astro';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import { getBlog, getCommunity, getConfig, getPage, getStandalone, getTeamMember } from './data';

export const islands: IslandRegistry = {
	page: {
		fetch: (_request, params) => getPage(params.get('slug') ?? 'home'),
		component: PageBody,
		// Base.astro already provides the page's main landmark. Keep the
		// editable island wrapper neutral to avoid nesting main landmarks.
		wrapper: { tag: 'div' },
		propsFromData: (data) => ({
			data: (data as QueryResult<PageQuery>).data?.page as CmsPage | undefined,
		}),
	},
	blog: {
		fetch: (_request, params) => getBlog(params.get('slug') ?? ''),
		component: BlogBody,
		wrapper: { tag: 'article' },
		propsFromData: (data) => ({
			data: (data as QueryResult<BlogQuery>).data?.blog as CmsBlog | undefined,
		}),
	},
	team: {
		fetch: (_request, params) => getTeamMember(params.get('slug') ?? ''),
		component: TeamBody,
		wrapper: { tag: 'article' },
		propsFromData: (data) => ({
			data: (data as QueryResult<TeamQuery>).data?.team as CmsTeam | undefined,
		}),
	},
	community: {
		fetch: (_request, params) => getCommunity(params.get('path') ?? ''),
		component: CommunityBody,
		wrapper: { tag: 'article' },
		propsFromData: (data) => ({
			data: (data as QueryResult<CommunityQuery>).data?.community as CmsCommunity | undefined,
		}),
	},
	standalone: {
		fetch: (_request, params) => getStandalone(params.get('slug') ?? ''),
		component: StandaloneBody,
		wrapper: { tag: 'div' },
		propsFromData: (data) => ({
			data: (data as QueryResult<StandaloneQuery>).data?.standalone as CmsStandalone | undefined,
		}),
	},
	global: {
		fetch: () => getConfig(),
		component: Header,
		wrapper: { tag: 'div' },
		propsFromData: (data) => ({
			config: (data as QueryResult<ConfigQuery>).data?.config as CmsConfig | undefined,
		}),
	},
	'global-footer': {
		fetch: () => getConfig(),
		component: Footer,
		wrapper: { tag: 'div' },
		propsFromData: (data) => ({
			config: (data as QueryResult<ConfigQuery>).data?.config as CmsConfig | undefined,
		}),
	},
};
