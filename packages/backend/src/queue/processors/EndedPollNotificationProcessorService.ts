/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DI } from '@/di-symbols.js';
import type { PollVotesRepository, NotesRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import { CacheService } from '@/core/CacheService.js';
import { NotificationService } from '@/core/NotificationService.js';
import { bindThis } from '@/decorators.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { EndedPollNotificationJobData } from '../types.js';

@Injectable()
export class EndedPollNotificationProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.pollVotesRepository)
		private pollVotesRepository: PollVotesRepository,

		private cacheService: CacheService,
		private notificationService: NotificationService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('ended-poll-notification');
	}

	@bindThis
	public async process(job: Bull.Job<EndedPollNotificationJobData>): Promise<void> {
		const note = await this.notesRepository.findOneBy({ id: job.data.noteId });
		if (note == null || !note.hasPoll) {
			return;
		}

		const voteUserIds = await this.pollVotesRepository.createQueryBuilder('vote')
			.select('DISTINCT vote.userId', 'userId')
			.where('vote.noteId = :noteId', { noteId: note.id })
			.andWhere('user.host IS NULL')
			// 投稿者は別途 userIds に含めるため、ここでは除外して二重通知を防ぐ
			.andWhere('vote.userId != :authorId', { authorId: note.userId })
			.innerJoin('vote.user', 'user')
			.getRawMany<{ userId: string }>()
			.then(votes => votes.map(v => v.userId));

		const userIds = [note.userId, ...voteUserIds];

		for (const userId of userIds) {
			const profile = await this.cacheService.userProfileCache.fetch(userId);
			if (profile.userHost === null) {
				this.notificationService.createNotification(userId, 'pollEnded', {
					noteId: note.id,
				});
			}
		}
	}
}
