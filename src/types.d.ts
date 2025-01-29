declare namespace NodeJS {
	interface Module {
		load(this: NodeModule, filename: string): unknown;
	}

	namespace Module {
		function _resolveFilename(request: string, caller: NodeModule): string;
	}
}
