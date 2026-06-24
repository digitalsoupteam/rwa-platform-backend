export function camelToSnakeCase(str: string): string {
	return str
		.replace(/([A-Z])/g, '_$1')
		.toLowerCase()
		.replace(/^_/, '');
}

export function getAllMethods(
	prototype: any,
	deep: number = 0,
	privateEnabled: boolean = false,
	exclude: string[] = []
): string[] {
	const methods = new Set<string>();
	let currentPrototype = prototype;
	let currentDepth = 0;

	while (currentPrototype && currentPrototype !== Object.prototype) {
		if (deep !== -1 && currentDepth > deep) {
			break;
		}

		Object.getOwnPropertyNames(currentPrototype).forEach(name => {
			if (name === 'constructor') return;
			if (!privateEnabled && name.startsWith('_')) return;
			if (exclude.includes(name)) return;

			const descriptor = Object.getOwnPropertyDescriptor(currentPrototype, name);
			if (descriptor && typeof descriptor.value === 'function') {
				methods.add(name);
			}
		});

		currentPrototype = Object.getPrototypeOf(currentPrototype);
		currentDepth++;
	}

	return Array.from(methods);
}
