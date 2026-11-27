import { TAbstractFile, TFolder } from "obsidian";
import { TextInputSuggest } from "./Suggest";

export class FolderSuggestor extends TextInputSuggest<TFolder> {
	getSuggestions(inputStr: string): TFolder[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const lowerCaseInputStr = inputStr.toLowerCase();

		return abstractFiles.filter(
			(folder: TAbstractFile): folder is TFolder =>
				folder instanceof TFolder &&
				folder.path.toLowerCase().contains(lowerCaseInputStr),
		);
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	protected getSuggestionValue(folder: TFolder): string {
		return folder.path;
	}
}
