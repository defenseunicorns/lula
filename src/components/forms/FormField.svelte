<script lang="ts">
	interface Props {
		id: string;
		label: string;
		type?: 'text' | 'textarea' | 'select';
		value: string;
		options?: string[];
		rows?: number;
		placeholder?: string;
		required?: boolean;
		error?: string;
		onChange?: () => void;
	}

	let { 
		id, 
		label, 
		type = 'text', 
		value = $bindable(),
		options = [],
		rows = 4,
		placeholder,
		required = false,
		error,
		onChange
	}: Props = $props();

	const baseInputClass = "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500";
	const errorClass = error ? "border-red-500 focus:ring-red-500" : "";
</script>

<div class="space-y-1">
	<label 
		for={id} 
		class="block text-sm font-medium text-gray-700 dark:text-gray-300"
	>
		{label}{#if required}<span class="text-red-500 ml-1">*</span>{/if}
	</label>
	
	{#if type === 'textarea'}
		<textarea
			{id}
			bind:value
			{rows}
			{placeholder}
			class="{baseInputClass} {errorClass} resize-vertical"
		></textarea>
	{:else if type === 'select' && options.length > 0}
		<select
			{id}
			bind:value
			class="{baseInputClass} {errorClass}"
		>
			{#each options as option}
				<option value={option}>{option}</option>
			{/each}
		</select>
	{:else}
		<input
			{id}
			bind:value
			type="text"
			{placeholder}
			class="{baseInputClass} {errorClass}"
		/>
	{/if}
	
	{#if error}
		<p class="text-sm text-red-600 dark:text-red-400">
			{error}
		</p>
	{/if}
</div>