/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { EmojisRepository } from '@/models/_.js';
import type { MiEmoji } from '@/models/Emoji.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import { EmojiEntityService } from '@/core/entities/EmojiEntityService.js';
import { sqlLikeEscape } from '@/misc/sql-like-escape.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requiredRolePolicy: 'canManageCustomEmojis',
	kind: 'read:admin:emoji',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			ref: 'EmojiDetailed',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		query: { type: 'string', nullable: true, default: null },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
		sinceId: { type: 'string', format: 'misskey:id' },
		untilId: { type: 'string', format: 'misskey:id' },
		sinceDate: { type: 'integer' },
		untilDate: { type: 'integer' },
	},
	required: [],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.emojisRepository)
		private emojisRepository: EmojisRepository,

		private emojiEntityService: EmojiEntityService,
		private queryService: QueryService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const q = this.queryService.makePaginationQuery(this.emojisRepository.createQueryBuilder('emoji'), ps.sinceId, ps.untilId, ps.sinceDate, ps.untilDate)
				.andWhere('emoji.host IS NULL');

			let emojis: MiEmoji[];

			if (ps.query) {
				const queryarry = ps.query.match(/\:([a-z0-9_]*)\:/g);

				if (queryarry) {
					// ":name:" 形式のクエリの場合は、名前のリストとして扱う
					emojis = await q
						.andWhere('emoji.name IN (:...names)', { names: queryarry.map(x => x.slice(1, -1)) })
						.limit(ps.limit)
						.getMany();
				} else {
					const query = ps.query;
					q.andWhere(new Brackets(qb => {
						qb
							.where('emoji.name ILIKE :q', { q: `%${ sqlLikeEscape(query) }%` })
							.orWhere('emoji.aliases::text ILIKE :q', { q: `%${ sqlLikeEscape(query) }%` })
							.orWhere('emoji.category ILIKE :q', { q: `%${ sqlLikeEscape(query) }%` });
					}));
					emojis = await q.limit(ps.limit).getMany();
				}
			} else {
				emojis = await q.limit(ps.limit).getMany();
			}

			return this.emojiEntityService.packDetailedMany(emojis);
		});
	}
}
