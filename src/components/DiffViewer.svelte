<script lang="ts">
  export let diff: string;
  export let fileName: string = '';
  export let language: string = 'yaml';
  
  interface DiffLine {
    type: 'context' | 'addition' | 'deletion' | 'header' | 'hunk';
    content: string;
    oldLineNumber?: number;
    newLineNumber?: number;
  }
  
  function parseDiff(diffText: string): DiffLine[] {
    const lines = diffText.split('\n');
    const parsedLines: DiffLine[] = [];
    let oldLineNumber = 1;
    let newLineNumber = 1;
    
    for (const line of lines) {
      if (line.startsWith('@@')) {
        // Hunk header - extract line numbers
        const match = line.match(/@@\s-(\d+)(?:,\d+)?\s\+(\d+)(?:,\d+)?\s@@/);
        if (match) {
          oldLineNumber = parseInt(match[1]);
          newLineNumber = parseInt(match[2]);
        }
        parsedLines.push({ type: 'hunk', content: line });
      } else if (line.startsWith('+++') || line.startsWith('---')) {
        parsedLines.push({ type: 'header', content: line });
      } else if (line.startsWith('+')) {
        parsedLines.push({
          type: 'addition',
          content: line.slice(1),
          newLineNumber: newLineNumber++
        });
      } else if (line.startsWith('-')) {
        parsedLines.push({
          type: 'deletion', 
          content: line.slice(1),
          oldLineNumber: oldLineNumber++
        });
      } else if (line.startsWith(' ') || line === '') {
        parsedLines.push({
          type: 'context',
          content: line.slice(1),
          oldLineNumber: oldLineNumber++,
          newLineNumber: newLineNumber++
        });
      } else {
        // Handle other lines as context
        parsedLines.push({ type: 'context', content: line });
      }
    }
    
    return parsedLines;
  }
  
  function highlightYaml(content: string): string {
    // Simple YAML syntax highlighting
    return content
      .replace(/^(\s*)([a-zA-Z_][a-zA-Z0-9_-]*)\s*:/gm, '$1<span class="text-blue-600 dark:text-blue-400 font-medium">$2</span>:')
      .replace(/:\s*("[^"]*")/g, ': <span class="text-green-600 dark:text-green-400">$1</span>')
      .replace(/:\s*(\d+)/g, ': <span class="text-purple-600 dark:text-purple-400">$1</span>')
      .replace(/:\s*(true|false|null)/g, ': <span class="text-orange-600 dark:text-orange-400">$1</span>')
      .replace(/^\s*-\s/gm, '<span class="text-gray-500 dark:text-gray-400">-</span> ')
      .replace(/#.*$/gm, '<span class="text-gray-500 dark:text-gray-400 italic">$&</span>');
  }
  
  $: parsedDiff = parseDiff(diff);
</script>

<div class="diff-viewer border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
  {#if fileName}
    <div class="bg-gray-50 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
      <div class="flex items-center space-x-2">
        <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300 font-mono">{fileName}</span>
      </div>
    </div>
  {/if}
  
  <div class="diff-content max-h-96 overflow-y-auto">
    {#each parsedDiff as line}
      <div class="diff-line flex {
        line.type === 'addition' ? 'bg-green-50 dark:bg-green-900/20' :
        line.type === 'deletion' ? 'bg-red-50 dark:bg-red-900/20' :
        line.type === 'hunk' ? 'bg-gray-100 dark:bg-gray-700' :
        line.type === 'header' ? 'bg-gray-100 dark:bg-gray-700' :
        'bg-white dark:bg-gray-800'
      }">
        <!-- Line numbers -->
        <div class="line-numbers flex text-xs text-gray-400 dark:text-gray-500 font-mono select-none border-r border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-750">
          <div class="w-8 px-2 py-1 text-right">
            {line.type !== 'addition' && line.oldLineNumber ? line.oldLineNumber : ''}
          </div>
          <div class="w-8 px-2 py-1 text-right">
            {line.type !== 'deletion' && line.newLineNumber ? line.newLineNumber : ''}
          </div>
        </div>
        
        <!-- Change indicator -->
        <div class="change-indicator w-6 flex items-center justify-center text-sm font-mono {
          line.type === 'addition' ? 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20' :
          line.type === 'deletion' ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20' :
          'text-gray-400 dark:text-gray-500'
        }">
          {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ''}
        </div>
        
        <!-- Content -->
        <div class="content flex-1 px-2 py-1 font-mono text-sm leading-relaxed whitespace-pre-wrap {
          line.type === 'hunk' ? 'text-gray-600 dark:text-gray-400 font-medium' :
          line.type === 'header' ? 'text-gray-500 dark:text-gray-400' :
          'text-gray-900 dark:text-gray-100'
        }">
          {#if language === 'yaml' && (line.type === 'context' || line.type === 'addition' || line.type === 'deletion')}
            {@html highlightYaml(line.content)}
          {:else}
            {line.content}
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .diff-viewer {
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
  }
  
  .diff-line:hover {
    background-color: rgba(59, 130, 246, 0.05);
  }
  
  .diff-line.bg-green-50:hover {
    background-color: rgba(34, 197, 94, 0.1);
  }
  
  .diff-line.bg-red-50:hover {
    background-color: rgba(239, 68, 68, 0.1);
  }
  
  :global(.dark) .diff-line:hover {
    background-color: rgba(59, 130, 246, 0.1);
  }
  
</style>