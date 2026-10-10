import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Keep the original command working, using the current neural voice generator.
const script = fileURLToPath(new URL('./generate-story-neural-audio.py', import.meta.url));
const result = spawnSync(process.env.STORY_PYTHON || 'python3', [script], { stdio: 'inherit' });
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
