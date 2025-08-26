import { startServer } from '..';

export interface ServeOptions {
	dir: string;
	port: number;
}

export class ServeCommand {
	async run(options: ServeOptions): Promise<void> {
		await startServer(options.dir, options.port);
	}
}
