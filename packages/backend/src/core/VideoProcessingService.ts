/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { Inject, Injectable } from '@nestjs/common';
import FFmpeg from 'fluent-ffmpeg';
import { DI } from '@/di-symbols.js';
import type { Config } from '@/config.js';
import { ImageProcessingService } from '@/core/ImageProcessingService.js';
import type { IImage } from '@/core/ImageProcessingService.js';
import { createTempDir } from '@/misc/create-temp.js';
import { bindThis } from '@/decorators.js';
import { appendQuery, query } from '@/misc/prelude/url.js';

@Injectable()
export class VideoProcessingService {
	constructor(
		@Inject(DI.config)
		private config: Config,

		private imageProcessingService: ImageProcessingService,
	) {
	}

	@bindThis
	public async generateVideoThumbnail(source: string): Promise<IImage> {
		const VIDEO_THUMBNAIL_TIMEOUT_MS = 120 * 1000;

		const [dir, cleanup] = await createTempDir();

		try {
			await new Promise((res, rej) => {
				// 壊れた動画や劣悪な環境でffmpegが完了しないままワーカーを占有するのを防ぐため、タイムアウトを設ける
				const command = FFmpeg({
					source,
				});

				const timer = setTimeout(() => {
					// ffmpegが完了しないまま残り続けるのを防ぐため、タイムアウト時にプロセスをkillする
					command.kill('SIGKILL');
					rej(new Error(`ffmpeg timed out after ${VIDEO_THUMBNAIL_TIMEOUT_MS}ms`));
				}, VIDEO_THUMBNAIL_TIMEOUT_MS);

				command
					.on('end', () => {
						clearTimeout(timer);
						res(undefined);
					})
					.on('error', (err: Error) => {
						clearTimeout(timer);
						rej(err);
					})
					.screenshot({
						folder: dir,
						filename: 'out.png',	// must have .png extension
						count: 1,
						timestamps: ['5%'],
					});
			});

			return await this.imageProcessingService.convertToWebp(`${dir}/out.png`, 498, 422);
		} finally {
			cleanup();
		}
	}

	@bindThis
	public getExternalVideoThumbnailUrl(url: string): string | null {
		if (this.config.videoThumbnailGenerator == null) return null;

		return appendQuery(
			`${this.config.videoThumbnailGenerator}/thumbnail.webp`,
			query({
				thumbnail: '1',
				url,
			}),
		);
	}
}

