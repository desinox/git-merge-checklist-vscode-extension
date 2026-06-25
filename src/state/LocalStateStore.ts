import type { Memento } from "vscode";
import type { FilterState } from "../messages";
import type { StateStore } from "./StateStore";

const MERGED_KEY = "gitChecklist.mergedHashes";
const FILTERS_KEY = "gitChecklist.filters";

/** Stores state in the VS Code workspace Memento. */
export class LocalStateStore implements StateStore {
	constructor(private readonly memento: Memento) {}

	async getMergedHashes(): Promise<string[]> {
		return this.memento.get<string[]>(MERGED_KEY, []);
	}

	async isMerged(hash: string): Promise<boolean> {
		const hashes = await this.getMergedHashes();
		return hashes.includes(hash);
	}

	async setMerged(hash: string, merged: boolean): Promise<void> {
		const current = new Set(await this.getMergedHashes());
		if (merged) {
			current.add(hash);
		} else {
			current.delete(hash);
		}
		await this.memento.update(MERGED_KEY, [...current]);
	}

	async getFilters(): Promise<FilterState | undefined> {
		return this.memento.get<FilterState>(FILTERS_KEY);
	}

	async setFilters(filters: FilterState): Promise<void> {
		await this.memento.update(FILTERS_KEY, filters);
	}
}
