import { TAbstractFile, TFile } from "obsidian";
import { TextInputSuggest } from "./Suggest";

export class FileSuggestor extends TextInputSuggest<TFile> {
	getSuggestions(inputStr: string): TFile[] {
		const abstractFiles = this.app.vault.getAllLoadedFiles();
		const lowerCaseInputStr = inputStr.toLowerCase();

		return abstractFiles.filter(
			(file: TAbstractFile): file is TFile =>
				file instanceof TFile &&
				file.extension === "md" &&
				file.path.toLowerCase().contains(lowerCaseInputStr),
		);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	protected getSuggestionValue(file: TFile): string {
		return file.path;
	}
}
