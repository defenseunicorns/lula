<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	interface Props {
		status: string;
		type?: 'control' | 'mapping' | 'compliance';
		size?: 'sm' | 'md' | 'lg';
	}

	let { status, type = 'control', size = 'sm' }: Props = $props();

	const getStatusColor = (status: string, type: string) => {
		if (!status) {
			return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
		}

		if (type === 'mapping') {
			switch (status.toLowerCase()) {
				case 'implemented':
					return 'bg-green-500 text-white';
				case 'verified':
					return 'bg-blue-500 text-white';
				case 'planned':
					return 'bg-yellow-500 text-white';
				default:
					return 'bg-gray-600 text-white';
			}
		}

		if (type === 'compliance') {
			switch (status.toLowerCase()) {
				case 'compliant':
					return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
				case 'non-compliant':
					return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
				case 'not assessed':
					return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
				default:
					return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
			}
		}

		// Default control status colors
		switch (status.toLowerCase()) {
			case 'implemented':
				return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
			case 'planned':
				return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
			case 'not implemented':
				return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
			default:
				return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
		}
	};

	const getSizeClass = (size: string) => {
		switch (size) {
			case 'sm':
				return 'px-2.5 py-0.5 text-xs';
			case 'md':
				return 'px-3 py-1 text-sm';
			case 'lg':
				return 'px-4 py-2 text-base';
			default:
				return 'px-2.5 py-0.5 text-xs';
		}
	};
</script>

<span
	class="inline-flex items-center rounded-lg font-medium shadow-sm {getStatusColor(
		status,
		type
	)} {getSizeClass(size)}"
	title={`${type} status: ${status}`}
>
	{status}
</span>
