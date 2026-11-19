/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import * as fs from 'node:fs';
import { FILE_TYPE_BROWSERSAFE } from '@/const.js';
import { contentDisposition } from '@/misc/content-disposition.js';
import type { IImageStreamable } from '@/core/ImageProcessingService.js';
import type { FastifyReply } from 'fastify';

export type RangeStream = {
	stream: fs.ReadStream;
	start: number;
	end: number;
	chunksize: number;
};

/**
 * Range リクエストに対応したストリームを作成する
 */
export function createRangeStream(rangeHeader: string, size: number, path: string): RangeStream | null {
	const parts = rangeHeader.replace(/bytes=/, '').split('-');
	if (parts.length > 2) return null;
	const start = parseInt(parts[0], 10);
	let end = parts[1] ? parseInt(parts[1], 10) : size - 1;
	// 不正な値（NaN・負数・逆転）やファイル末尾超過はレンジ外として扱う
	if (Number.isNaN(start) || Number.isNaN(end)) return null;
	if (start < 0 || end < 0 || start > end || start >= size) return null;
	if (end > size) {
		end = size - 1;
	}
	const chunksize = end - start + 1;

	return {
		stream: fs.createReadStream(path, { start, end }),
		start,
		end,
		chunksize,
	};
}

/**
 * ストリームにcleanupハンドラを設定する
 * ストリームでない場合は即座にcleanupを実行する
 */
export function attachStreamCleanup(data: IImageStreamable['data'], cleanup: () => void): void {
	if ('pipe' in data && typeof data.pipe === 'function') {
		data.on('end', cleanup);
		data.on('close', cleanup);
	} else {
		cleanup();
	}
}

/**
 * MIME タイプがブラウザセーフかどうかに応じて Content-Type を返す
 */
export function getSafeContentType(mime: string): string {
	return FILE_TYPE_BROWSERSAFE.includes(mime) ? mime : 'application/octet-stream';
}

/**
 * Range リクエストを処理してストリームを返す
 * Range ヘッダーがない場合は通常のストリームを返す
 * Accept-Ranges / Content-Length ヘッダーもここで設定する
 */
export function handleRangeRequest(
	reply: FastifyReply,
	rangeHeader: string | undefined,
	size: number,
	path: string,
): fs.ReadStream {
	reply.header('Accept-Ranges', 'bytes');
	if (rangeHeader && size > 0) {
		const range = createRangeStream(rangeHeader, size, path);
		// 不正なRangeヘッダーはレンジ未対応としてレスポンスする
		if (range != null) {
			const { stream, start, end, chunksize } = range;
			reply.header('Content-Range', `bytes ${start}-${end}/${size}`);
			reply.header('Content-Length', chunksize);
			reply.code(206);
			return stream;
		}
	}
	reply.header('Content-Length', size);
	return fs.createReadStream(path);
}

export type FileResponseOptions = {
	mime: string;
	filename: string;
	cacheControl?: string;
};

/**
 * ファイルレスポンス用の共通ヘッダーを設定する
 */
export function setFileResponseHeaders(
	reply: FastifyReply,
	options: FileResponseOptions,
): void {
	reply.header('Content-Type', getSafeContentType(options.mime));
	reply.header('Cache-Control', options.cacheControl ?? 'max-age=31536000, immutable');
	reply.header('Content-Disposition', contentDisposition('inline', options.filename));
}

/**
 * cleanup が必要なファイルかどうかを判定する型ガード
 */
export function needsCleanup<T extends { kind?: string; cleanup?: () => void }>(file: T): file is T & { cleanup: () => void } {
	return 'cleanup' in file && typeof file.cleanup === 'function';
}
