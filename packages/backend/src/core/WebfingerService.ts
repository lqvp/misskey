/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { URL } from 'node:url';
import { Injectable } from '@nestjs/common';
import { query as urlQuery } from '@/misc/prelude/url.js';
import { HttpRequestService } from '@/core/HttpRequestService.js';
import { bindThis } from '@/decorators.js';

export type ILink = {
	href: string;
	rel?: string;
};

export type IWebFinger = {
	links: ILink[];
	subject: string;
};

const urlRegex = /^https?:\/\//;
const mRegex = /^([^@]+)@(.*)/;

@Injectable()
export class WebfingerService {
	constructor(
		private httpRequestService: HttpRequestService,
	) {
	}

	@bindThis
	public async webfinger(query: string): Promise<IWebFinger> {
		const url = this.genUrl(query);

		const finger = await this.httpRequestService.getJson<IWebFinger>(url, 'application/jrd+json, application/json');

		// RFC 7033 では subject は要求したリソースと一致することが求められる。
		// 悪意あるサーバーが要求と異なるリソースの情報を返すケースを拒否する
		// なお acct 形式のクエリは acct: プレフィックス付きで要求されるため、期待値にもそれを反映する
		const expectedResource = query.match(mRegex) ? `acct:${query}` : query;
		if (finger.subject.toLowerCase() !== expectedResource.toLowerCase()) {
			throw new Error(`Unexpected subject: ${finger.subject}`);
		}

		return finger;
	}

	@bindThis
	private genUrl(query: string): string {
		if (query.match(urlRegex)) {
			const u = new URL(query);
			return `${u.protocol}//${u.hostname}/.well-known/webfinger?` + urlQuery({ resource: query });
		}

		const m = query.match(mRegex);
		if (m) {
			const hostname = m[2];
			const useHttp = process.env.MISSKEY_WEBFINGER_USE_HTTP && process.env.MISSKEY_WEBFINGER_USE_HTTP.toLowerCase() === 'true';
			return `http${useHttp ? '' : 's'}://${hostname}/.well-known/webfinger?${urlQuery({ resource: `acct:${query}` })}`;
		}

		throw new Error(`Invalid query (${query})`);
	}
}
