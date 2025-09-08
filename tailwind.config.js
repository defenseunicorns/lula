// Copyright 2025 Defense Unicorns
// SPDX-License-Identifier: LicenseRef-Defense-Unicorns-Commercial
import flowbitePlugin from 'flowbite/plugin';

const TAILWIND_SIZE_OPTIONS = [16, 20, 24, 28, 32, 36, 40, 44, 48];

/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		fontFamily: {
			body: [
				'Montserrat',
				'ui-sans-serif',
				'system-ui',
				'-apple-system',
				'system-ui',
				'Segoe UI',
				'Roboto',
				'Helvetica Neue',
				'Arial',
				'Noto Sans',
				'sans-serif',
				'Apple Color Emoji',
				'Segoe UI Emoji',
				'Segoe UI Symbol',
				'Noto Color Emoji'
			],
			sans: [
				'Montserrat',
				'ui-sans-serif',
				'system-ui',
				'-apple-system',
				'system-ui',
				'Segoe UI',
				'Roboto',
				'Helvetica Neue',
				'Arial',
				'Noto Sans',
				'sans-serif',
				'Apple Color Emoji',
				'Segoe UI Emoji',
				'Segoe UI Symbol',
				'Noto Color Emoji'
			]
		}
	},

	variants: {},

	plugins: [flowbitePlugin],

	/* This safelist includes classes which are dynamic as the css procesor won't find the written class name */
	safelist: [
		...TAILWIND_SIZE_OPTIONS.map((item) => `h-${item}`),
		'min-w-[400px]',
		'min-w-[700px]',
		'min-w-[800px]',
		'min-w-[850px]',
		'min-w-[900px]',
		'min-w-[1024px]',
		'min-w-[1100px]',
		'min-w-[1150px]',
		'min-w-[1200px]',
		'min-w-[1250px]',
		'min-w-[1300px]',
		'min-w-[1450px]',
		'min-w-[1500px]',
		'min-w-[1600px]',
		'min-w-[1650px]',
		'min-w-[1750px]',
		'min-w-[1865px]',
		'min-w-[2000px]',
		'min-w-[2200px]',
		'dark:text-red-200',
		'dark:bg-red-900',
		'dark:text-yellow-100',
		'dark:bg-yellow-600',
		'dark:text-orange-200',
		'dark:bg-orange-800',
		'dark:text-blue-200'
	]
};
