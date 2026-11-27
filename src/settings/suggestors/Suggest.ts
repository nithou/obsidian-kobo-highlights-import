import { AbstractInputSuggest, App } from "obsidian";

/**
 * Thin wrapper over Obsidian's built-in `AbstractInputSuggest`.
 *
 * This used to be a copy of Liam Cain's `Suggest` from obsidian-periodic-notes,
 * which appended its dropdown to the main window and therefore rendered it
 * invisibly when settings were open in a pop-out window (issue #550).
 * `AbstractInputSuggest` handles window context, keymap scope and positioning
 * itself, so subclasses only describe the values.
 */
export abstract class TextInputSuggest<T> extends AbstractInputSuggest<T> {
	protected readonly inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
		this.inputEl.addEventListener("focus", () => this.open());
	}

	abstract getSuggestions(_inputStr: string): T[];

	abstract renderSuggestion(_value: T, _el: HTMLElement): void;

	protected abstract getSuggestionValue(_value: T): string;

	/**
	 * The base implementation only sets the input value. Settings fields react
	 * to the `input` event, so it has to be dispatched explicitly.
	 */
	selectSuggestion(value: T): void {
		this.setValue(this.getSuggestionValue(value));
		this.inputEl.trigger("input");
		this.close();
	}
}
