/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import sanitizeHtml from 'sanitize-html';

const allowedTags = ['svg', 'path', 'g', 'rect', 'circle', 'title', 'defs', 'use'];

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
	});
}
