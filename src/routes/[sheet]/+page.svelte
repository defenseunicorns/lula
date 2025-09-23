<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- SPDX-FileCopyrightText: 2023-Present The Lula Authors -->

<script lang="ts">
	import { page } from '$app/stores';
	import { ControlsList } from '$components/controls';
	import { appState, wsClient } from '$lib/websocket';
	import { onMount } from 'svelte';

	// Get the sheet parameter from the URL
	$: sheetParam = $page.params.sheet as string;

	onMount(() => {
		// If the sheet from URL doesn't match current app state, switch to it
		if (sheetParam && $appState.currentPath) {
			// Extract just the directory name from the full path for comparison
			const pathParts = $appState.currentPath.split('/');
			const currentDirName = pathParts[pathParts.length - 1];

			if (currentDirName !== decodeURIComponent(sheetParam)) {
				wsClient.switchControlSet(decodeURIComponent(sheetParam));
			}
		} else if (sheetParam && !$appState.currentPath) {
			// No current path, switch to the requested sheet
			wsClient.switchControlSet(decodeURIComponent(sheetParam));
		}
	});
</script>

<!-- Show the controls list for this specific sheet -->
<div class="flex gap-6 h-full overflow-hidden">
	<!-- Controls List takes the full width -->
	<div class="flex-1 overflow-hidden">
		<ControlsList />
	</div>
</div>
