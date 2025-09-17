<!-- Debug page to verify control data -->
<script lang="ts">
	import { appState } from '$lib/websocket';

	let debugOutput = '';

	$: if ($appState.controls && $appState.controls.length > 0) {
		debugOutput = `
Controls loaded: ${$appState.controls.length}
First control: ${JSON.stringify($appState.controls[0], null, 2)}
Available fields in first control: ${Object.keys($appState.controls[0] || {}).join(', ')}
Test-results field value: ${($appState.controls[0] as any)?.['test-results'] || 'NOT FOUND'}
Schema fields: ${$appState.fieldSchema?.fields ? Object.keys($appState.fieldSchema.fields).join(', ') : 'No schema'}
`;
	}
</script>

<div class="p-8">
	<h1 class="text-2xl font-bold mb-4">Debug Control Data</h1>
	<pre class="whitespace-pre-wrap bg-gray-100 p-4 rounded">{debugOutput}</pre>

	<div class="mt-8">
		<h2 class="text-xl font-bold mb-2">All Controls:</h2>
		{#each $appState.controls || [] as control, i}
			<div class="mb-4 p-4 border rounded">
				<strong>Control {i + 1}: {control.id}</strong>
				<div class="mt-2">
					<strong>Available keys:</strong>
					{Object.keys(control).join(', ')}
				</div>
				<div class="mt-2">
					<strong>test-results:</strong>
					{(control as any)['test-results'] || 'NOT FOUND'}
				</div>
			</div>
		{/each}
	</div>
</div>
