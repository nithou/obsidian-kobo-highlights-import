/* eslint-disable @typescript-eslint/no-unused-expressions */
import { expect } from "chai";
import { Database } from "sql.js";
import { HighlightService } from "../database/Highlight";
import { Repository } from "../database/repository";
import { Highlight } from "../database/interfaces";
import { createFixtureDatabase } from "../database/fixtures/koboFixture";
import { isContentEquivalent, mergeImport } from "./contentMerger";
import {
	applyTemplateTransformations,
	defaultAppendTemplate,
	defaultTemplate,
} from "../template/template";

/**
 * End-to-end coverage of the import pipeline (minus Obsidian's vault): read a
 * Kobo database, group highlights per book, render the template and merge the
 * result into an existing note.
 */
describe("import pipeline", function () {
	let db: Database;
	let service: HighlightService;

	before(async function () {
		db = await createFixtureDatabase();
		service = new HighlightService(new Repository(db));
	});

	after(function () {
		db.close();
	});

	function renderBook(): string {
		const highlights: Highlight[] = service
			.getAllHighlight(true)
			.filter(
				(h) => (h.content.bookTitle ?? "").trim() === "Nemesis Games",
			);

		expect(highlights).to.have.length(3);

		return applyTemplateTransformations(
			defaultTemplate,
			service.buildChapterList(highlights),
			service.getBookDetailsFromBookTitle("Nemesis Games"),
		);
	}

	it("renders chapters in reading order", function () {
		const rendered = renderBook();
		const one = rendered.indexOf("## Chapter One");
		const two = rendered.indexOf("## Chapter Two");
		const ten = rendered.indexOf("## Chapter Ten");

		expect(one).to.be.greaterThan(-1);
		expect(two).to.be.greaterThan(one);
		expect(ten).to.be.greaterThan(two);
	});

	it("keeps personal notes across re-imports", function () {
		const first = mergeImport(renderBook(), null);
		const withNotes = first.content.replace(
			"## Personal Notes",
			"## Personal Notes\n\nMy own thought about this book.",
		);

		const second = mergeImport(renderBook(), withNotes);

		expect(second.preservedForeignContent).to.be.false;
		expect(second.content).to.contain("My own thought about this book.");
		expect(second.content).to.contain("First highlight");
		expect(second.content.match(/First highlight/g)).to.have.length(1);
	});

	it("keeps a user level-2 subheading inside personal notes", function () {
		const first = mergeImport(renderBook(), null);
		const withNotes = first.content.replace(
			"## Personal Notes",
			"## Personal Notes\n\n## Quotes I like\n\nKeep me.\n\n### Detail\n\nAlso keep.",
		);

		const second = mergeImport(renderBook(), withNotes);

		expect(second.content).to.contain("## Quotes I like");
		expect(second.content).to.contain("Keep me.");
		expect(second.content).to.contain("Also keep.");
	});

	it("renders the append template without frontmatter", function () {
		const rendered = applyTemplateTransformations(
			defaultAppendTemplate,
			[
				[
					"Chapter One",
					[
						{
							bookmarkId: "1",
							text: "Appended highlight",
							contentId: "content",
							dateCreated: new Date("2024-01-01T00:00:00Z"),
						},
					],
				],
			],
			{ title: "Book", author: "Author" },
		);

		expect(rendered.startsWith("## Kobo Highlights")).to.be.true;
		expect(rendered).to.contain("Appended highlight");
		expect(rendered).not.to.contain("---");
	});

	it("produces an identical note when nothing changed on the device", function () {
		const first = mergeImport(renderBook(), null).content;
		const second = mergeImport(renderBook(), first).content;

		expect(isContentEquivalent(first, second)).to.be.true;
	});

	it("detects a highlight added on the device", async function () {
		const otherDb = await createFixtureDatabase();
		const otherService = new HighlightService(new Repository(otherDb));

		const render = () =>
			applyTemplateTransformations(
				defaultTemplate,
				otherService.buildChapterList(
					otherService
						.getAllHighlight(true)
						.filter(
							(h) =>
								(h.content.bookTitle ?? "").trim() ===
								"Nemesis Games",
						),
				),
				otherService.getBookDetailsFromBookTitle("Nemesis Games"),
			);

		const before = mergeImport(render(), null).content;

		const chapterTwo = otherDb.exec(
			"select ContentID from content where Title = 'Chapter Two';",
		)[0].values[0][0] as string;

		otherDb.run(
			`INSERT INTO Bookmark
				(BookmarkID, Text, ContentID, annotation, DateCreated, ChapterProgress, Color)
			 VALUES ('bookmark-new', 'A brand new highlight', '${chapterTwo}',
				NULL, '2024-09-01T00:00:00Z', 0.7, 2);`,
		);

		const after = mergeImport(render(), before).content;

		expect(isContentEquivalent(before, after)).to.be.false;
		expect(after).to.contain("A brand new highlight");
		expect(after.match(/First highlight/g)).to.have.length(1);

		otherDb.close();
	});
});
