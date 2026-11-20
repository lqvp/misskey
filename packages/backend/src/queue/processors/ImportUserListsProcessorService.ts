/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { IsNull } from 'typeorm';
import { DI } from '@/di-symbols.js';
import type { UsersRepository, DriveFilesRepository, UserListMembershipsRepository, UserListsRepository } from '@/models/_.js';
import type Logger from '@/logger.js';
import * as Acct from '@/misc/acct.js';
import { RemoteUserResolveService } from '@/core/RemoteUserResolveService.js';
import { DownloadService } from '@/core/DownloadService.js';
import { UserListService } from '@/core/UserListService.js';
import { IdService } from '@/core/IdService.js';
import { UtilityService } from '@/core/UtilityService.js';
import { bindThis } from '@/decorators.js';
import { QueueLoggerService } from '../QueueLoggerService.js';
import type * as Bull from 'bullmq';
import type { DbUserImportJobData } from '../types.js';

@Injectable()
export class ImportUserListsProcessorService {
	private logger: Logger;

	constructor(
		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		@Inject(DI.driveFilesRepository)
		private driveFilesRepository: DriveFilesRepository,

		@Inject(DI.userListsRepository)
		private userListsRepository: UserListsRepository,

		@Inject(DI.userListMembershipsRepository)
		private userListMembershipsRepository: UserListMembershipsRepository,

		private utilityService: UtilityService,
		private idService: IdService,
		private userListService: UserListService,
		private remoteUserResolveService: RemoteUserResolveService,
		private downloadService: DownloadService,
		private queueLoggerService: QueueLoggerService,
	) {
		this.logger = this.queueLoggerService.logger.createSubLogger('import-user-lists');
	}

	@bindThis
	public async process(job: Bull.Job<DbUserImportJobData>): Promise<void> {
		this.logger.info(`Importing user lists of ${job.data.user.id} ...`);

		const user = await this.usersRepository.findOneBy({ id: job.data.user.id });
		if (user == null) {
			return;
		}

		const file = await this.driveFilesRepository.findOneBy({
			id: job.data.fileId,
		});
		if (file == null) {
			return;
		}

		const csv = await this.downloadService.downloadTextFile(file.url);

		let linenum = 0;

		for (const line of csv.trim().split('\n')) {
			linenum++;

			try {
				const { name: listName, rest } = parseListName(line);
				const parts = rest.split(',');
				const { username, host } = Acct.parse(parts[0].trim());
				let withReplies = false;

				for (const keyValue of parts.slice(2)) {
					const [key, value] = keyValue.split('=');
					switch (key) {
						case 'withReplies':
							withReplies = value === 'true';
							break;
					}
				}

				let list = await this.userListsRepository.findOneBy({
					userId: user.id,
					name: listName,
				});

				if (list == null) {
					list = await this.userListsRepository.insertOne({
						id: this.idService.gen(),
						userId: user.id,
						name: listName,
					});
				}

				let target = this.utilityService.isSelfHost(host!) ? await this.usersRepository.findOneBy({
					host: IsNull(),
					usernameLower: username.toLowerCase(),
				}) : await this.usersRepository.findOneBy({
					host: this.utilityService.toPuny(host!),
					usernameLower: username.toLowerCase(),
				});

				if (target == null) {
					target = await this.remoteUserResolveService.resolveUser(username, host);
				}

				if (await this.userListMembershipsRepository.findOneBy({ userListId: list!.id, userId: target.id }) != null) continue;

				await this.userListService.addMember(target, list, user, {
					withReplies: withReplies,
				});
			} catch (e) {
				this.logger.warn(`Error in line:${linenum} ${e}`);
			}
		}

		this.logger.succ('Imported');
	}
}

/**
 * エクスポート時にクォート・エスケープされた可能性のある先頭フィールド（リスト名）と、残りの部分を解析する。
 */
export function parseListName(line: string): { name: string, rest: string } {
	let raw: string;
	if (line.startsWith("'") && /^[=+\-@\t\r]/.test(line.slice(1, 2))) {
		// 数式インジェクション対策で前置されたシングルクォートを外す
		raw = line.slice(1);
	} else {
		raw = line;
	}
	if (raw.startsWith('"')) {
		// RFC4180 の引用符付きフィールドとして解析する（"" はエスケープされた引用符を表す）
		let end = -1;
		for (let i = 1; i < raw.length; i++) {
			if (raw[i] === '"') {
				if (raw[i + 1] === '"') {
					// "" は閉じクォートではなくエスケープされた引用符なので読み飛ばす
					i++;
				} else {
					end = i;
					break;
				}
			}
		}
		if (end > 0) {
			const name = raw.slice(1, end).replaceAll('""', '"');
			// 残りは閉じクォートの次のカンマから
			return { name, rest: raw.slice(end + 2) };
		}
	}
	const commaIndex = raw.indexOf(',');
	return { name: commaIndex > 0 ? raw.slice(0, commaIndex) : raw, rest: commaIndex > 0 ? raw.slice(commaIndex + 1) : '' };
}
