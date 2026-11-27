import { webUtils } from "electron";
import { readFileSync } from "fs";
import { App, Modal, Notice, TFile } from "obsidian";
import SqlJs, { Database } from "sql.js";
import { binary } from "src/binaries/sql-wasm";
import { HighlightService } from "src/database/Highlight";
import { BookDetails, Bookmark, Highlight } from "src/database/interfaces";
import { Repository } from "src/database/repository";
import { KoboHighlightsImporterSettings } from "src/settings/Settings";
import {
	applyTemplateTransformations,
	defaultAppendTemplate,
} from "src/template/template";
import { getTemplateContents } from "src/template/templateContents";
import { BookPickerModal } from "./BookPickerModal";

function normalizeIsbn(isbn: unknown): string {
	return String(isbn ?? "")
		.replace(/[^0-9Xx]/g, "")
		.toUpperCase();
}

function normalizeText(text: string): string {
	return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function bookTitleOf(highlight: Highlight): string {
	return highlight.content.bookTitle || highlight.content.title || "";
}

/**
 * Appends the highlights of a single Kobo book to the active note, without
 * touching what the note already contains (issue #243: "Add highlights to
 * existing file").
 */
export class AppendHighlightsModal extends Modal {
	private readonly settings: KoboHighlightsImporterSettings;
	private readonly saveSettings: () => Promise<void>;
	private readonly targetFile: TFile;

	private fileBuffer: ArrayBuffer | null = null;
	private db: Database | null = null;
	private service: HighlightService | null = null;
	private book: BookDetails | null = null;

	private inputFileEl!: HTMLInputElement;
	private statusEl!: HTMLElement;
	private appendButtonEl!: HTMLButtonElement;

	constructor(
		app: App,
		settings: KoboHighlightsImporterSettings,
		saveSettings: () => Promise<void>,
		targetFile: TFile,
	) {
		super(app);
		this.settings = settings;
		this.saveSettings = saveSettings;
		this.targetFile = targetFile;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h2", { text: "Append Kobo highlights" });

		const description = contentEl.createEl("p");
		description.appendText("Append highlights to ");
		description.createEl("strong", { text: this.targetFile.basename });
		description.appendText(
			". Select your KoboReader.sqlite file if it is not remembered yet.",
		);

		this.inputFileEl = contentEl.createEl("input");
		this.inputFileEl.type = "file";
		this.inputFileEl.accept = ".sqlite";
		this.inputFileEl.addEventListener("change", () => {
			const file = this.inputFileEl.files?.[0];
			if (!file) {
				return;
			}

			const filePath = webUtils.getPathForFile(file);
			if (filePath) {
				this.settings.sqlitePath = filePath;
				void this.saveSettings();
			}

			const reader = new FileReader();
			reader.onload = () => {
				this.fileBuffer = reader.result as ArrayBuffer;
				void this.loadDatabase();
			};
			reader.onerror = () => new Notice("Error reading file");
			reader.readAsArrayBuffer(file);
		});

		this.statusEl = contentEl.createEl("p", {
			text: "Choose your KoboReader.sqlite file to continue.",
		});

		this.appendButtonEl = contentEl.createEl("button", { text: "Append" });
		this.appendButtonEl.disabled = true;
		this.appendButtonEl.addEventListener("click", () => {
			void this.append();
		});

		this.tryLoadRememberedPath();
	}

	onClose() {
		this.contentEl.empty();
		this.db?.close();
		this.db = null;
	}

	private tryLoadRememberedPath() {
		if (!this.settings.sqlitePath) {
			return;
		}

		try {
			const buf = readFileSync(this.settings.sqlitePath);
			this.fileBuffer = buf.buffer.slice(
				buf.byteOffset,
				buf.byteOffset + buf.byteLength,
			);
			void this.loadDatabase();
		} catch {
			this.statusEl.setText(
				"Remembered KoboReader.sqlite could not be read — please select it manually.",
			);
		}
	}

	private async loadDatabase(): Promise<void> {
		if (!this.fileBuffer) {
			return;
		}

		this.statusEl.setText("Reading Kobo database...");

		try {
			const SQLEngine = await SqlJs({ wasmBinary: binary.buffer });
			this.db?.close();
			this.db = new SQLEngine.Database(new Uint8Array(this.fileBuffer));
			this.service = new HighlightService(new Repository(this.db));
		} catch (e) {
			console.error("Failed to open SQLite database:", e);
			this.statusEl.setText(
				"Could not read SQLite file — is this a valid KoboReader.sqlite?",
			);
			return;
		}

		await this.resolveBook();
	}

	private async resolveBook(): Promise<void> {
		if (!this.service) {
			return;
		}

		const books = [...this.service.getAllBooks().values()];
		if (books.length === 0) {
			this.statusEl.setText("No book found in the Kobo database.");
			return;
		}

		const frontmatter =
			this.app.metadataCache.getFileCache(this.targetFile)?.frontmatter ??
			{};
		const isbn = normalizeIsbn(frontmatter.isbn);

		let match: BookDetails | undefined;

		if (isbn.length > 0) {
			match = books.find((b) => normalizeIsbn(b.isbn) === isbn);
		}

		if (!match) {
			const candidates = [
				String(frontmatter.title ?? ""),
				this.targetFile.basename,
			]
				.map((candidate) => candidate.trim().toLowerCase())
				.filter((candidate) => candidate.length > 0);

			match = books.find((book) =>
				candidates.includes(book.title.trim().toLowerCase()),
			);

			if (!match) {
				match = books.find((book) => {
					const title = book.title.trim().toLowerCase();
					return candidates.some(
						(candidate) =>
							title.length > 3 &&
							(candidate.includes(title) ||
								title.includes(candidate)),
					);
				});
			}
		}

		if (match) {
			this.setBook(match);
			return;
		}

		this.statusEl.setText(
			"No matching book found — pick it manually in the next dialog.",
		);
		new BookPickerModal(
			this.app,
			books,
			(book) => this.setBook(book),
			this.targetFile.basename,
		).open();
	}

	private setBook(book: BookDetails): void {
		this.book = book;

		const count = this.highlightsForBook().length;
		this.statusEl.setText(
			count > 0
				? `${book.title} — ${book.author}: ${count} highlight${count !== 1 ? "s" : ""} to append.`
				: `${book.title} — ${book.author} has no highlights in this database.`,
		);
		this.appendButtonEl.disabled = count === 0;
	}

	private highlightsForBook(): Highlight[] {
		if (!this.service || !this.book) {
			return [];
		}

		const title = this.book.title.trim().toLowerCase();
		return this.service
			.getAllHighlight(this.settings.sortByChapterProgress)
			.filter(
				(highlight) =>
					bookTitleOf(highlight).trim().toLowerCase() === title,
			);
	}

	private async append(): Promise<void> {
		if (!this.service || !this.book) {
			return;
		}

		const existingContent = await this.app.vault.read(this.targetFile);
		const haystack = normalizeText(existingContent);

		const chapters: [string, Bookmark[]][] = [];
		let appended = 0;
		let skipped = 0;

		for (const [chapterName, bookmarks] of this.service.buildChapterList(
			this.highlightsForBook(),
		)) {
			const fresh = bookmarks.filter((bookmark) => {
				const needle = normalizeText(bookmark.text);
				if (needle.length > 0 && haystack.includes(needle)) {
					skipped++;
					return false;
				}
				return true;
			});

			if (fresh.length > 0) {
				chapters.push([chapterName, fresh]);
				appended += fresh.length;
			}
		}

		if (appended === 0) {
			new Notice(
				`Nothing to append: all ${skipped} highlight${skipped !== 1 ? "s are" : " is"} already in this note.`,
			);
			this.close();
			return;
		}

		try {
			const template = await getTemplateContents(
				this.app,
				this.settings.appendTemplatePath,
				defaultAppendTemplate,
			);
			const rendered = applyTemplateTransformations(
				template,
				chapters,
				this.book,
			);

			await this.app.vault.process(
				this.targetFile,
				(data) => `${data.trimEnd()}\n\n${rendered.trim()}\n`,
			);

			new Notice(
				`Appended ${appended} highlight${appended !== 1 ? "s" : ""}${
					skipped > 0 ? ` (${skipped} already present)` : ""
				}.`,
			);
			this.close();
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			console.error("Append failed:", e);
			new Notice(`Append failed: ${msg}`);
		}
	}
}
