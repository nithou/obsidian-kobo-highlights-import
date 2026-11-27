import { App, FuzzySuggestModal } from "obsidian";
import { BookDetails } from "src/database/interfaces";

/**
 * Book picker shown when the active note cannot be matched to a Kobo book by
 * ISBN, title or filename.
 */
export class BookPickerModal extends FuzzySuggestModal<BookDetails> {
	private readonly books: BookDetails[];
	private readonly onChoose: (_book: BookDetails) => void;
	private readonly preselected: string;

	constructor(
		app: App,
		books: BookDetails[],
		onChoose: (_book: BookDetails) => void,
		preselected = "",
	) {
		super(app);
		this.books = books;
		this.onChoose = onChoose;
		this.preselected = preselected;

		this.setPlaceholder("Select the book these highlights belong to");
		if (preselected.length > 0) {
			this.inputEl.value = preselected;
			this.inputEl.dispatchEvent(new Event("input"));
		}
	}

	getItems(): BookDetails[] {
		return this.books;
	}

	getItemText(book: BookDetails): string {
		return `${book.title} — ${book.author}`;
	}

	onChooseItem(book: BookDetails): void {
		this.onChoose(book);
	}
}
