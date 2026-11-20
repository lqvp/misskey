/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import sanitizeHtml from 'sanitize-html';

const allowedTags = ['svg', 'path', 'g', 'rect', 'circle', 'title', 'defs', 'use', 'image'];

const allowedAttributes: sanitizeHtml.Attributes = {
	'*': [
		'id',
		'class',
		'style',
		'viewBox',
		'xmlns',
		'width',
		'height',
		'x',
		'y',
		'dx',
		'dy',
		'd',
		'fill',
		'fill-rule',
		'clip-rule',
		'stroke',
		'stroke-width',
		'rx',
		'ry',
		'cx',
		'cy',
		'r',
		'transform',
		'opacity',
		'shape-rendering',
		// QRページのロゴ画像用
		'href',
		'xlink:href',
		'preserveAspectRatio',
	],
};

/**
 * ライブラリが生成したSVG文字列をサニタイズして返す。
 * v-html に直接渡すため、イベントハンドラ属性等を除去する。
 */
export function sanitizeSvg(svg: string): string {
	return sanitizeHtml(svg, {
		allowedTags,
		allowedAttributes,
		// デフォルトだと属性名・タグ名が小文字化され、viewBox / preserveAspectRatio が
		// 許可リスト（キャメルケース）と照合できずに除去されてしまうため無効化する
		parser: {
			lowerCaseAttributeNames: false,
			lowerCaseTags: false,
		},
	});
}
