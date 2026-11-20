/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import type { NotesRepository } from '@/models/_.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { QueryService } from '@/core/QueryService.js';
import { DI } from '@/di-symbols.js';
import { GetterService } from '@/server/api/GetterService.js';
import { ApiError } from '../../error.js';

export const meta = {
	tags: ['users'],

	requireCredential: false,

	description: 'Get a list of other users that the specified user frequently replies to.',

	res: {
		type: 'array',
		optional: false, nullable: false,
		items: {
			type: 'object',
			optional: false, nullable: false,
			properties: {
				user: {
					type: 'object',
					optional: false, nullable: false,
					ref: 'UserDetailed',
				},
				weight: {
					type: 'number',
					optional: false, nullable: false,
				},
			},
		},
	},

	errors: {
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: 'e6965129-7b2a-40a4-bae2-cd84cd434822',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		userId: { type: 'string', format: 'misskey:id' },
		limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
	},
	required: ['userId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		private userEntityService: UserEntityService,
		private queryService: QueryService,
		private getterService: GetterService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// Lookup user
			const user = await this.getterService.getUser(ps.userId).catch(err => {
				if (err.id === '15348ddd-432d-49c2-8a5a-8069753becff') throw new ApiError(meta.errors.noSuchUser);
				throw err;
			});

			// 直近のリプライ先をサブクエリとして取得し、DB内で集計する
			const recentRepliesQuery = this.notesRepository.createQueryBuilder('note')
				.select('note.replyId', 'replyId')
				.where('note.userId = :userId', { userId: user.id })
				.andWhere('note.replyId IS NOT NULL')
				.orderBy('note.id', 'DESC')
				.limit(1000);

			// 対象ユーザー自身がリクエストしている場合、generateVisibilityQuery の
			// `note.userId = :meId` に必ず一致して常に真になるので、条件ごと省略する
			const isSelf = me != null && me.id === user.id;
			if (!isSelf) {
				this.queryService.generateVisibilityQuery(recentRepliesQuery, me);
			}

			const replyTargetCountsQuery = this.notesRepository.createQueryBuilder('note')
				.select('note.userId', 'userId')
				.addSelect('COUNT(*)', 'count')
				.where(`note.id IN (${recentRepliesQuery.getQuery()})`);
			replyTargetCountsQuery.setParameters(recentRepliesQuery.getParameters());

			this.queryService.generateVisibilityQuery(replyTargetCountsQuery, me);

			const replyTargetCounts = await replyTargetCountsQuery
				.groupBy('note.userId')
				.orderBy('count', 'DESC')
				.getRawMany();

			// 投稿が少なかったら中断
			if (replyTargetCounts.length === 0) {
				return [];
			}

			const counts = new Map<string, number>(replyTargetCounts.map(x => [x.userId, Number(x.count)]));

			// Calc peak
			const peak = Math.max(...counts.values());

			// Sort replies by frequency
			const topRepliedUserIds = [...counts.entries()]
				.sort((a, b) => b[1] - a[1])
				.slice(0, ps.limit)
				.map(([userId]) => userId);

			// Make replies object (includes weights)
			const _userMap = await this.userEntityService.packMany(topRepliedUserIds, me, { schema: 'UserDetailed' })
				.then(users => new Map(users.map(u => [u.id, u])));
			return await Promise.all(topRepliedUserIds.map(async (userId) => ({
				user: _userMap.get(userId) ?? (await this.userEntityService.pack(userId, me, { schema: 'UserDetailed' })),
				weight: counts.get(userId)! / peak,
			})));
		});
	}
}
