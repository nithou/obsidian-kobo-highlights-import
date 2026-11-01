import { webUtils } from "electron";
import { readFileSync } from "fs";
import { App, Modal, normalizePath, Notice, TFile } from "obsidian";
import { sanitize } from "sanitize-filename-ts";
import SqlJs from "sql.js";
import { binary } from "src/binaries/sql-wasm";
import { HighlightService } from "src/database/Highlight";
import { Highlight } from "src/database/interfaces";
import { Repository } from "src/database/repository";
import { ImportContext } from "src/errors/ImportContext";
import { KoboHighlightsImporterSettings } from "src/settings/Settings";
import {
	extractPersonalNotes,
	mergeContent,
} from "src/sync/contentMerger";
import { applyTemplateTransformations } from "src/template/template";
import { getTemplateContents } from "src/template/templateContents";
import { applyVocabularyTemplate } from "src/template/vocabularyTemplate";

export class ExtractHighlightsModal extends Modal {
	goButtonEl!: HTMLButtonElement;
	inputFileEl!: HTMLInputElement;

	settings: KoboHighlightsImporterSettings;
	saveSettings: () => Promise<void>;

	fileBuffer: ArrayBuffer | null | undefined;

	constructor(
		app: App,
		settings: KoboHighlightsImporterSettings,
		saveSettings: () => Promise<void>,
	) {
		super(app);
		this.settings = settings;
		this.saveSettings = saveSettings;
	}

	private async fetchHighlights(): Promise<ImportContext> {
		const context = new ImportContext();

		if (!this.fileBuffer) {
			throw new Error("No SQLite database file selected");
		}

		const SQLEngine = await SqlJs({
			wasmBinary: binary.buffer,
		});

		let db;
		try {
			db = new SQLEngine.Database(new Uint8Array(this.fileBuffer));
		} catch (e) {
			throw new Error(
				"Could not read SQLite file — is this a valid KoboReader.sqlite?",
			);
		}

		const service: HighlightService = new HighlightService(
			new Repository(db),
		);

		const highlights = service.getAllHighlight(
			this.settings.sortByChapterProgress,
		);

		if (highlights.length === 0) {
			context.addWarning("No bookmarks found in database");
		}

		const unknownCount = highlights.filter(
			(h) => h.content.bookTitle === "Unknown Title",
		).length;
		if (unknownCount > 0) {
			context.addWarning(
				`${unknownCount} highlight${unknownCount !== 1 ? "s" : ""} skipped due to missing content`,
			);
		}

		// Group highlights by book title.
		const highlightsByBook = new Map<string, Highlight[]>();
		for (const h of highlights) {
			const bookTitle =
				h.content.bookTitle ||
				h.content.title ||
				service.unknownBookTitle;
			if (!highlightsByBook.has(bookTitle))
				highlightsByBook.set(bookTitle, []);
			highlightsByBook.get(bookTitle)!.push(h);
		}

		// Include books with no highlights when the setting is enabled.
		if (this.settings.importAllBooks) {
			const allBooks = service.getAllBooks();
			for (const [bookTitle] of allBooks) {
				if (!highlightsByBook.has(bookTitle)) {
					highlightsByBook.set(bookTitle, []);
				}
			}
		}

		await this.writeBooks(service, highlightsByBook, context);

		if (this.settings.importVocabulary) {
			await this.importVocabulary(service, context);
		}

		return context;
	}

	private async writeBooks(
		service: HighlightService,
		highlightsByBook: Map<string, Highlight[]>,
		context: ImportContext,
	) {
		const template = await getTemplateContents(
			this.app,
			this.settings.templatePath,
		);

		for (const [bookTitle, bookHighlights] of highlightsByBook) {
			const sanitizedBookName = sanitize(bookTitle);
			const fileName = normalizePath(
				`${this.settings.storageFolder}/${sanitizedBookName}.md`,
			);

			const chapters = service.buildChapterList(bookHighlights);
			const details = service.getBookDetailsFromBookTitle(bookTitle);

			const newContent = applyTemplateTransformations(
				template,
				chapters,
				details,
			);

			await this.writeFileNonDestructive(fileName, newContent);

			context.booksImported++;
			for (const [, bookmarks] of chapters) {
				context.highlightsImported += bookmarks.length;
			}
		}
	}

	private async importVocabulary(
		service: HighlightService,
		context: ImportContext,
	): Promise<void> {
		try {
			if (!service.hasVocabulary()) {
				context.addWarning(
					"WordList table not found — vocabulary import skipped",
				);
				return;
			}

			const words = service.getAllWords();
			if (words.length === 0) {
				context.addWarning("No words found in vocabulary");
				return;
			}

			const fileName = normalizePath(
				`${this.settings.storageFolder}/${sanitize(this.settings.vocabularyFilePath)}.md`,
			);

			const newContent = applyVocabularyTemplate(words);
			await this.writeFileNonDestructive(fileName, newContent);
			context.wordsImported = words.length;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			context.addWarning(`Vocabulary import failed: ${msg}`);
			console.error("Vocabulary import error:", e);
		}
	}

	private enableButton() {
		this.goButtonEl.disabled = false;
		this.goButtonEl.setAttr(
			"style",
			"background-color: green; color: black",
		);
	}

	private tryLoadStoredPath() {
		if (!this.settings.sqlitePath) return;

		try {
			const buf = readFileSync(this.settings.sqlitePath);
			this.fileBuffer = buf.buffer.slice(
				buf.byteOffset,
				buf.byteOffset + buf.byteLength,
			);
			this.enableButton();
			new Notice("Loaded KoboReader.sqlite from remembered path");
		} catch {
			new Notice(
				"Could not load sqlite file from remembered path — please select it manually",
			);
		}
	}

	private async writeFileNonDestructive(
		fileName: string,
		newContent: string,
	): Promise<void> {
		const existingFile =
			this.app.vault.getAbstractFileByPath(fileName);

		if (existingFile instanceof TFile) {
			const existingContent =
				await this.app.vault.read(existingFile);
			const personalNotes =
				extractPersonalNotes(existingContent);
			const merged = mergeContent(newContent, personalNotes);
			await this.app.vault.modify(existingFile, merged);
		} else {
			const merged = mergeContent(newContent, null);
			await this.app.vault.adapter.write(fileName, merged);
		}
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h2", { text: "Sqlite file location" });

		const description = contentEl.createEl("p");
		description.appendText("Please select your ");
		description.createEl("em", { text: "KoboReader.sqlite" });
		description.appendText(" file from a connected device");

		this.inputFileEl = contentEl.createEl("input");
		this.inputFileEl.type = "file";
		this.inputFileEl.accept = ".sqlite";
		this.inputFileEl.addEventListener("change", (ev) => {
			const file = (ev.target as HTMLInputElement)?.files?.[0];
			if (!file) {
				console.error("No file selected");
				return;
			}

			const filePath = webUtils.getPathForFile(file);
			if (filePath) {
				this.settings.sqlitePath = filePath;
				this.saveSettings();
			}

			const reader = new FileReader();
			reader.onload = () => {
				this.fileBuffer = reader.result as ArrayBuffer;
				this.enableButton();
				new Notice("Ready to extract!");
			};

			reader.onerror = (error) => {
				console.error("FileReader error:", error);
				new Notice("Error reading file");
			};

			reader.readAsArrayBuffer(file);
		});

		this.goButtonEl = contentEl.createEl("button", { text: "Extract" });
		this.goButtonEl.disabled = true;
		this.goButtonEl.setAttr("style", "background-color: red; color: white");
		this.goButtonEl.addEventListener("click", () => {
			new Notice("Extracting highlights...");
			this.fetchHighlights()
				.then((context) => {
					new Notice(context.toSummary());
					if (context.warnings.length > 0) {
						console.warn("Import warnings:", context.warnings);
					}
					this.close();
				})
				.catch((e) => {
					console.error(e);
					const msg =
						e instanceof Error ? e.message : "Unknown error";
					new Notice(msg);
				});
		});

		this.tryLoadStoredPath();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
