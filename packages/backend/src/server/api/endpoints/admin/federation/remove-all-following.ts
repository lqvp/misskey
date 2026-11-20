/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { Endpoint } from '@/server/api/endpoint-base.js';
import type { FollowingsRepository, UsersRepository } from '@/models/_.js';
import { DI } from '@/di-symbols.js';
import { QueueService } from '@/core/QueueService.js';

export const meta = {
	tags: ['admin'],

	requireCredential: true,
	requireModerator: true,
	kind: 'write:admin:federation',
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		host: { type: 'string' },
	},
	required: ['host'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.notesRepository)
		private followingsRepository: FollowingsRepository,

		private queueService: QueueService,
	) {
		super(meta, paramDef, async (ps, me) => {
			// IDのみを取得してからチャンク処理する（ジョブ処理待ちの行を再取得して無限ループしないように）
			const followings = await this.followingsRepository.find({
				where: { followerHost: ps.host },
				select: { followerId: true, followeeId: true },
			});

			const CHUNK_SIZE = 100;
			for (let i = 0; i < followings.length; i += CHUNK_SIZE) {
				const chunk = followings.slice(i, i + CHUNK_SIZE);
				const pairs = [];
				for (const f of chunk) {
					// ユーザーが取得できなかったフォロー関係はスキップする（NotFoundで全体を失敗させない）
					const [from, to] = await Promise.all([
						this.usersRepository.findOneBy({ id: f.followerId }),
						this.usersRepository.findOneBy({ id: f.followeeId }),
					]);
					if (from != null && to != null) {
						pairs.push({ from: { id: from.id }, to: { id: to.id }, silent: true });
					}
				}

				if (pairs.length > 0) {
					await this.queueService.createUnfollowJob(pairs);
				}
			}
		});
	}
}
