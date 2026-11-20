/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import type { UserListsRepository, UserListMembershipsRepository, BlockingsRepository, UsersRepository } from '@/models/_.js';
import { IdService } from '@/core/IdService.js';
import type { MiUserList } from '@/models/UserList.js';
import { Endpoint } from '@/server/api/endpoint-base.js';
import { UserListEntityService } from '@/core/entities/UserListEntityService.js';
import { DI } from '@/di-symbols.js';
import { ApiError } from '@/server/api/error.js';
import { RoleService } from '@/core/RoleService.js';
import { UserListService } from '@/core/UserListService.js';

export const meta = {
	requireCredential: true,
	prohibitMoved: true,
	kind: 'write:account',
	res: {
		type: 'object',
		optional: false, nullable: false,
		ref: 'UserList',
	},

	errors: {
		tooManyUserLists: {
			message: 'You cannot create user list any more.',
			code: 'TOO_MANY_USERLISTS',
			id: 'e9c105b2-c595-47de-97fb-7f7c2c33e92f',
		},
		noSuchList: {
			message: 'No such list.',
			code: 'NO_SUCH_LIST',
			id: '9292f798-6175-4f7d-93f4-b6742279667d',
		},
		noSuchUser: {
			message: 'No such user.',
			code: 'NO_SUCH_USER',
			id: '13c457db-a8cb-4d88-b70a-211ceeeabb5f',
		},

		alreadyAdded: {
			message: 'That user has already been added to that list.',
			code: 'ALREADY_ADDED',
			id: 'c3ad6fdb-692b-47ee-a455-7bd12c7af615',
		},

		youHaveBeenBlocked: {
			message: 'You cannot push this user because you have been blocked by this user.',
			code: 'YOU_HAVE_BEEN_BLOCKED',
			id: 'a2497f2a-2389-439c-8626-5298540530f4',
		},

		tooManyUsers: {
			message: 'You can not push users any more.',
			code: 'TOO_MANY_USERS',
			id: '1845ea77-38d1-426e-8e4e-8b83b24f5bd7',
		},
	},
} as const;

export const paramDef = {
	type: 'object',
	properties: {
		name: { type: 'string', minLength: 1, maxLength: 100 },
		listId: { type: 'string', format: 'misskey:id' },
	},
	required: ['name', 'listId'],
} as const;

@Injectable()
export default class extends Endpoint<typeof meta, typeof paramDef> { // eslint-disable-line import/no-default-export
	constructor(
		@Inject(DI.userListsRepository)
		private userListsRepository: UserListsRepository,

		@Inject(DI.userListMembershipsRepository)
		private userListMembershipsRepository: UserListMembershipsRepository,

		@Inject(DI.blockingsRepository)
		private blockingsRepository: BlockingsRepository,

		@Inject(DI.usersRepository)
		private usersRepository: UsersRepository,

		private userListService: UserListService,
		private userListEntityService: UserListEntityService,
		private idService: IdService,
		private roleService: RoleService,
	) {
		super(meta, paramDef, async (ps, me) => {
			const listExist = await this.userListsRepository.exists({
				where: {
					id: ps.listId,
					isPublic: true,
				},
			});
			if (!listExist) throw new ApiError(meta.errors.noSuchList);
			const currentCount = await this.userListsRepository.countBy({
				userId: me.id,
			});
			if (currentCount >= (await this.roleService.getUserPolicies(me.id)).userListLimit) {
				throw new ApiError(meta.errors.tooManyUserLists);
			}

			const userList = await this.userListsRepository.insertOne({
				id: this.idService.gen(),
				userId: me.id,
				name: ps.name,
			} as MiUserList);

			const users = (await this.userListMembershipsRepository.findBy({
				userListId: ps.listId,
			})).map(x => x.userId);

			// N+1回避のため、ループ前に一括で取得・判定しておく
			const userMap = new Map(
				(users.length > 0
					? await this.usersRepository.findBy({ id: In(users) })
					: []
				).map(u => [u.id, u]),
			);

			const otherUserIds = users.filter(id => id !== me.id);
			const blockedUserIds = new Set(
				otherUserIds.length > 0
					? (await this.blockingsRepository.findBy({
						blockerId: In(otherUserIds),
						blockeeId: me.id,
					})).map(x => x.blockerId)
					: [],
			);

			const existingUserIds = new Set(
				(users.length > 0
					? await this.userListMembershipsRepository.findBy({
						userListId: userList.id,
						userId: In(users),
					})
					: []
				).map(x => x.userId),
			);

			for (const user of users) {
				const currentUser = userMap.get(user);
				if (currentUser == null) throw new ApiError(meta.errors.noSuchUser);

				if (currentUser.id !== me.id && blockedUserIds.has(currentUser.id)) {
					throw new ApiError(meta.errors.youHaveBeenBlocked);
				}

				if (existingUserIds.has(currentUser.id)) {
					throw new ApiError(meta.errors.alreadyAdded);
				}

				try {
					await this.userListService.addMember(currentUser, userList, me);
				} catch (err) {
					if (err instanceof UserListService.TooManyUsersError) {
						throw new ApiError(meta.errors.tooManyUsers);
					}
					throw err;
				}
			}
			return await this.userListEntityService.pack(userList);
		});
	}
}

