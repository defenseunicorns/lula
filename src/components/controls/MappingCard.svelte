<script lang="ts">
	import { StatusBadge } from '../ui';

	interface Mapping {
		uuid: string;
		justification: string;
		status: 'planned' | 'implemented' | 'verified';
		control_id?: string;
		[key: string]: any;
	}

	interface Props {
		mapping: Mapping;
		onEdit?: (mapping: Mapping) => void;
		onDelete?: (uuid: string) => void;
		showActions?: boolean;
	}

	let { mapping, onEdit, onDelete, showActions = false }: Props = $props();

	function handleCopyUuid() {
		navigator.clipboard.writeText(`@mapControl ${mapping.uuid}`);
	}

	function handleEdit() {
		onEdit?.(mapping);
	}

	function handleDelete() {
		if (confirm('Are you sure you want to delete this mapping?')) {
			onDelete?.(mapping.uuid);
		}
	}
</script>

<div class="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
	<!-- Header -->
	<div class="bg-gray-100 dark:bg-gray-900 rounded-t-xl px-6 py-4 border-b border-gray-200 dark:border-gray-700">
		<div class="flex justify-between items-start">
			<span class="inline-flex items-center px-3 py-1 rounded-lg text-xs font-mono font-medium bg-gray-900 dark:bg-gray-900 text-gray-100 dark:text-gray-200 shadow-sm">
				@mapControl {mapping.uuid}
			</span>
			<div class="flex items-center space-x-2">
				<button
					onclick={handleCopyUuid}
					class="inline-flex items-center px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 shadow-sm hover:shadow"
					title="Copy UUID to clipboard"
				>
					Copy UUID
				</button>
				{#if showActions}
					<button
						onclick={handleEdit}
						class="inline-flex items-center px-3 py-2 text-xs font-medium text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all duration-200 shadow-sm hover:shadow"
						title="Edit mapping"
					>
						Edit
					</button>
					<button
						onclick={handleDelete}
						class="inline-flex items-center px-3 py-2 text-xs font-medium text-red-600 dark:text-red-300 hover:text-red-800 dark:hover:text-red-100 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-all duration-200 shadow-sm hover:shadow"
						title="Delete mapping"
					>
						Delete
					</button>
				{/if}
			</div>
		</div>
	</div>

	<!-- Content -->
	<div class="px-6 py-4">
		<p class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
			{mapping.justification}
		</p>
		<div class="flex items-center justify-start">
			<StatusBadge status={mapping.status} type="mapping" />
		</div>
	</div>
</div>
