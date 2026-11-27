import * as chai from "chai";
import { existsSync, readFileSync } from "fs";
import SqlJs, { Database } from "sql.js";
import { binary } from "../binaries/sql-wasm";
import {
	createEmptyFixtureDatabase,
	createFixtureDatabase,
	FIXTURE_BOOK_AUTHOR,
	FIXTURE_BOOK_TITLE,
} from "./fixtures/koboFixture";
import { Repository } from "./repository";

/* eslint-disable @typescript-eslint/no-unused-expressions */

describe("Repository", function () {
	let db: Database;
	let repo: Repository;

	before(async function () {
		db = await createFixtureDatabase();
		repo = new Repository(db);
	});

	after(function () {
		db.close();
	});

	it("getAllBookmark returns every bookmark that has text", function () {
		const bookmarks = repo.getAllBookmark();
		chai.expect(bookmarks).to.have.length(3);
		chai.expect(bookmarks.map((b) => b.bookmarkId)).to.not.include(
			"bookmark-without-text",
		);
	});

	it("getAllBookmark exposes color and chapter progress", function () {
		const bookmarks = repo.getAllBookmark();
		const first = bookmarks.find((b) => b.bookmarkId === "bookmark-1");
		const second = bookmarks.find((b) => b.bookmarkId === "bookmark-2");

		chai.expect(first?.color).to.equal("2");
		chai.expect(first?.chapterProgress).to.be.closeTo(0.15, 0.0001);
		chai.expect(second?.color).to.be.undefined;
		chai.expect(second?.note).to.equal("A personal note");
	});

	it("getAllBookmark sorts by chapter progress when asked", function () {
		const bookmarks = repo.getAllBookmark(true);
		const progresses = bookmarks.map((b) => b.chapterProgress ?? 0);

		chai.expect(progresses).to.deep.equal(
			[...progresses].sort((a, b) => a - b),
		);
	});

	it("getBookmarkById null", function () {
		chai.expect(repo.getBookmarkById("")).is.null;
	});

	it("getBookmarkById not null", function () {
		const bookmark = repo.getBookmarkById("bookmark-2");

		chai.expect(bookmark).is.not.null;
		chai.expect(bookmark?.text).to.equal("Second highlight");
		chai.expect(bookmark?.chapterProgress).to.be.closeTo(0.55, 0.0001);
	});

	it("getAllBookmark tolerates a database without a Color column", async function () {
		const legacyDb = await createEmptyFixtureDatabase();
		legacyDb.run(`
			INSERT INTO Bookmark (BookmarkID, Text, ContentID, DateCreated, ChapterProgress)
			VALUES ('legacy-1', 'Legacy highlight', 'content-id', '2024-01-01T00:00:00Z', 0.1);
		`);
		const legacyRepo = new Repository(legacyDb);

		const bookmarks = legacyRepo.getAllBookmark();

		chai.expect(bookmarks).to.have.length(1);
		chai.expect(bookmarks[0].color).to.be.undefined;

		legacyDb.close();
	});

	it("getAllContent returns rows", function () {
		chai.expect(repo.getAllContent()).length.above(0);
	});

	it("getContentByContentId", function () {
		const content = repo.getAllContent(1);
		chai.expect(repo.getContentByContentId(content.pop()?.contentId ?? ""))
			.not.null;
	});

	it("getContentByContentId no results", function () {
		chai.expect(repo.getContentByContentId("")).null;
	});

	it("getAllContentByBookTitle", function () {
		const contents = repo.getAllContentByBookTitle(FIXTURE_BOOK_TITLE);

		chai.expect(contents.length).to.equal(3);
		chai.expect(contents[0].volumeIndex).to.equal(1);
	});

	it("getBookDetailsByBookTitle returns details for a book", function () {
		const details = repo.getBookDetailsByBookTitle(FIXTURE_BOOK_TITLE);

		chai.expect(details).not.null;
		chai.expect(details?.title).to.equal(FIXTURE_BOOK_TITLE);
		chai.expect(details?.author).to.equal(FIXTURE_BOOK_AUTHOR);
		chai.expect(details?.percentRead).to.equal(72);
		chai.expect(details?.series).to.equal("The Expanse");
	});

	it("getBookDetailsByBookTitle returns null for an unknown book", function () {
		chai.expect(repo.getBookDetailsByBookTitle("Nope")).to.be.null;
	});

	it("getBookDetailsByBookTitle prefers the book row over a chapter with the same title", async function () {
		const titleDb = await createEmptyFixtureDatabase();
		titleDb.run(`
			CREATE TABLE content2 AS SELECT * FROM content;
		`);
		titleDb.run(`
			ALTER TABLE content ADD COLUMN Description TEXT;
			ALTER TABLE content ADD COLUMN Publisher TEXT;
			ALTER TABLE content ADD COLUMN DateLastRead TEXT;
			ALTER TABLE content ADD COLUMN ReadStatus INTEGER;
			ALTER TABLE content ADD COLUMN ___PercentRead INTEGER;
			ALTER TABLE content ADD COLUMN ISBN TEXT;
			ALTER TABLE content ADD COLUMN Series TEXT;
			ALTER TABLE content ADD COLUMN SeriesNumber TEXT;
			ALTER TABLE content ADD COLUMN TimeSpentReading INTEGER;
			INSERT INTO content (ContentID, ContentType, Title, Attribution)
			VALUES
				('book.epub!!OEBPS/title.xhtml-1', 899, 'Same Title', NULL),
				('file:///book.epub', 6, 'Same Title', 'Real Author');
		`);
		const titleRepo = new Repository(titleDb);

		const details = titleRepo.getBookDetailsByBookTitle("Same Title");

		chai.expect(details?.author).to.equal("Real Author");

		titleDb.close();
	});

	it("getAllBookDetails returns one entry per book with valid data", async function () {
		const details = repo.getAllBookDetails();

		chai.expect(details).to.have.length(2);
		chai.expect(details.map((b) => b.title)).to.deep.equal([
			"A Custom Article",
			FIXTURE_BOOK_TITLE,
		]);
		for (const book of details) {
			chai.expect(book.title).to.be.a("string").and.not.empty;
			chai.expect(book.author).to.be.a("string").and.not.empty;
		}
	});

	it("getAllBookDetails prefers the book row when a chapter shares its title", async function () {
		const dupDb = await createEmptyFixtureDatabase();
		dupDb.run(`
			ALTER TABLE content ADD COLUMN Description TEXT;
			ALTER TABLE content ADD COLUMN Publisher TEXT;
			ALTER TABLE content ADD COLUMN DateLastRead TEXT;
			ALTER TABLE content ADD COLUMN ReadStatus INTEGER;
			ALTER TABLE content ADD COLUMN ___PercentRead INTEGER;
			ALTER TABLE content ADD COLUMN ISBN TEXT;
			ALTER TABLE content ADD COLUMN Series TEXT;
			ALTER TABLE content ADD COLUMN SeriesNumber TEXT;
			ALTER TABLE content ADD COLUMN TimeSpentReading INTEGER;
			INSERT INTO content (ContentID, ContentType, Title, Attribution)
			VALUES
				('chapter.xhtml', 899, 'Same Title', NULL),
				('book.epub', 6, 'Same Title', 'Real Author');
		`);

		const books = new Repository(dupDb).getAllBookDetails();

		chai.expect(books).to.have.length(1);
		chai.expect(books[0].author).to.equal("Real Author");

		dupDb.close();
	});

	describe("WordList", function () {
		it("hasWordListTable returns false when table absent", async function () {
			const SQLEngine = await SqlJs({ wasmBinary: binary.buffer });
			const emptyDb = new SQLEngine.Database();
			const emptyRepo = new Repository(emptyDb);

			chai.expect(emptyRepo.hasWordListTable()).to.be.false;
			chai.expect(emptyRepo.getAllWords()).to.have.length(0);

			emptyDb.close();
		});

		it("getAllWords returns words from WordList table", function () {
			chai.expect(repo.hasWordListTable()).to.be.true;

			const words = repo.getAllWords();
			chai.expect(words).to.have.length(3);
			chai.expect(words[0].text).to.equal("Wanderlust");
			chai.expect(words[0].dictSuffix).to.equal("-de");
			chai.expect(words[0].dateCreated).to.be.instanceOf(Date);
		});

		it("getAllWords handles missing optional columns", async function () {
			const SQLEngine = await SqlJs({ wasmBinary: binary.buffer });
			const wordDb = new SQLEngine.Database();
			const wordRepo = new Repository(wordDb);

			wordDb.run(`
				CREATE TABLE WordList (Text TEXT);
				INSERT INTO WordList (Text) VALUES ('hello'), ('world');
			`);

			const words = wordRepo.getAllWords();
			chai.expect(words).to.have.length(2);
			chai.expect(words[0].dictSuffix).to.be.undefined;
			chai.expect(words[0].dateCreated).to.be.undefined;

			wordDb.close();
		});
	});
});

/**
 * Optional suite: runs only when a decrypted `KoboReader.sqlite` is present
 * (local development against real device data, see README).
 */
describe("Repository against a real KoboReader.sqlite", function () {
	const path = "KoboReader.sqlite";

	before(function () {
		if (!existsSync(path)) {
			this.skip();
		}
	});

	it("reads real bookmarks and book details", async function () {
		const SQLEngine = await SqlJs({ wasmBinary: binary.buffer });
		const db = new SQLEngine.Database(readFileSync(path));
		const repo = new Repository(db);

		chai.expect(repo.getAllBookmark().length).to.be.above(0);
		chai.expect(repo.getAllBookDetails().length).to.be.above(0);

		db.close();
	});
});
