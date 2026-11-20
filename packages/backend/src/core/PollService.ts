/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DI } from '@/di-symbols.js';
import { isDuplicateKeyValueError } from '@/misc/is-duplicate-key-value-error.js';
import type { NotesRepository, UsersRepository, PollsRepository, PollVotesRepository, MiUser } from '@/models/_.js';
import type { MiNote } from '@/models/Note.js';
import { RelayService } from '@/core/RelayService.js';
import { IdService } from '@/core/IdService.js';
import { GlobalEventService } from '@/core/GlobalEventService.js';
import { ApRendererService } from '@/core/activitypub/ApRendererService.js';
import { UserEntityService } from '@/core/entities/UserEntityService.js';
import { ApDeliverManagerService } from '@/core/activitypub/ApDeliverManagerService.js';
import { bindThis } from '@/decorators.js';
import { UserBlockingService } from '@/core/UserBlockingService.js';

@Injectable()
export class PollService {
	constructor(
		@Inject(DI.db)
		private db: DataSource,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.notesRepository)
		private notesRepository: NotesRepository,

		@Inject(DI.pollsRepository)
		private pollsRepository: PollsRepository,

		@Inject(DI.pollVotesRepository)
		private pollVotesRepository: PollVotesRepository,

		private userEntityService: UserEntityService,
		private idService: IdService,
		private relayService: RelayService,
		private globalEventService: GlobalEventService,
		private userBlockingService: UserBlockingService,
		private apRendererService: ApRendererService,
		private apDeliverManagerService: ApDeliverManagerService,
	) {
	}

	@bindThis
	public async vote(user: MiUser, note: MiNote, choice: number) {
		const poll = await this.pollsRepository.findOneBy({ noteId: note.id });

		if (poll == null) throw new Error('poll not found');

		// Check whether is valid choice
		if (poll.choices[choice] == null) throw new Error('invalid choice param');

		// Check blocking
		if (note.userId !== user.id) {
			const blocked = await this.userBlockingService.checkBlocked(note.userId, user.id);
			if (blocked) {
				throw new Error('blocked');
			}
		}

		// if already voted
		const exist = await this.pollVotesRepository.findBy({
			noteId: note.id,
			userId: user.id,
		});

		if (poll.multiple) {
			if (exist.some(x => x.choice === choice)) {
				throw new Error('already voted');
			}
		} else if (exist.length !== 0) {
			throw new Error('already voted');
		}

		const insertedVoteId = this.idService.gen();
		// 投票の追加と票数の更新はセットでトランザクションに載せ、
		// 片方だけ適用された状態でプロセスが落ちないようにする
		await this.db.transaction(async () => {
			try {
				await this.pollVotesRepository.insert({
					id: insertedVoteId,
					noteId: note.id,
					userId: user.id,
					choice: choice,
				});
			} catch (err) {
				// (userId, noteId, choice) のユニーク制約違反＝並行リクエストで同じ投票が先に確定した場合
				if (isDuplicateKeyValueError(err)) throw new Error('already voted');
				throw err;
			}

			if (!poll.multiple) {
				// 単一選択には (userId, noteId) のユニーク制約が無いため、
				// 並行して別の選択肢の投票が確定していた場合はこちらの投票を取り消す
				const other = await this.pollVotesRepository.findOneBy({
					noteId: note.id,
					userId: user.id,
				});
				if (other != null && other.id !== insertedVoteId) {
					await this.pollVotesRepository.delete({ id: insertedVoteId });
					throw new Error('already voted');
				}
			}

			// Increment votes count
			const index = choice + 1; // In SQL, array index is 1 based
			await this.pollsRepository.query('UPDATE poll SET votes[$1] = votes[$1] + 1 WHERE "noteId" = $2', [index, poll.noteId]);
		});

		this.globalEventService.publishNoteStream(note, 'pollVoted', {
			choice: choice,
			userId: user.id,
		});
	}

	@bindThis
	public async deliverQuestionUpdate(noteId: MiNote['id']) {
		const note = await this.notesRepository.findOneBy({ id: noteId });
		if (note == null) throw new Error('note not found');

		if (note.localOnly) return;

		const user = await this.usersRepository.findOneBy({ id: note.userId });
		if (user == null) throw new Error('note not found');

		if (this.userEntityService.isLocalUser(user)) {
			const content = this.apRendererService.addContext(this.apRendererService.renderUpdate(await this.apRendererService.renderNote(note, false), user));
			this.apDeliverManagerService.deliverToFollowers(user, content);
			this.relayService.deliverToRelays(user, content);
		}
	}
}
