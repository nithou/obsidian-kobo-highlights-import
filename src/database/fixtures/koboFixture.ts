import SqlJs, { Database } from "sql.js";
import { binary } from "../../binaries/sql-wasm";

const BOOK_CONTENT_ID =
	"file:///mnt/onboard/Corey, James S.A_/Nemesis Games - James S.A. Corey.epub";
const CHAPTER_ONE_ID = `${BOOK_CONTENT_ID}#(1)OEBPS/Text/ch01.html`;
const CHAPTER_TWO_ID = `${BOOK_CONTENT_ID}#(2)OEBPS/Text/ch02.html`;
const CHAPTER_TEN_ID = `${BOOK_CONTENT_ID}#(3)OEBPS/Text/ch10.html`;

export const FIXTURE_BOOK_TITLE = "Nemesis Games";
export const FIXTURE_BOOK_AUTHOR = "James S.A. Corey";
export const FIXTURE_BOOK_ISBN = "9780316217606";

/**
 * In-memory database that mimics the Kobo `KoboReader.sqlite` schema closely
 * enough for Repository/HighlightService code paths.
 *
 * Tests must not depend on a real, SOPS-encrypted device dump: keeping them
 * hermetic is what lets continuous integration run without any secret.
 */
export async function createFixtureDatabase(): Promise<Database> {
	const SQLEngine = await SqlJs({ wasmBinary: binary.buffer });
	const db = new SQLEngine.Database();

	db.run(`
		CREATE TABLE content (
			ContentID TEXT,
			ContentType INTEGER,
			MimeType TEXT,
			BookID TEXT,
			BookTitle TEXT,
			ImageId TEXT,
			Title TEXT,
			Attribution TEXT,
			Description TEXT,
			Publisher TEXT,
			DateCreated TEXT,
			DateLastRead TEXT,
			ReadStatus INTEGER,
			___PercentRead INTEGER,
			ISBN TEXT,
			Series TEXT,
			SeriesNumber TEXT,
			TimeSpentReading INTEGER,
			VolumeIndex INTEGER,
			ChapterIDBookmarked TEXT
		);

		CREATE TABLE Bookmark (
			BookmarkID TEXT,
			Text TEXT,
			ContentID TEXT,
			annotation TEXT,
			DateCreated TEXT,
			ChapterProgress REAL,
			Color INTEGER
		);

		CREATE TABLE WordList (
			Text TEXT,
			VolumeId TEXT,
			DictSuffix TEXT,
			DateCreated TEXT
		);
	`);

	db.run(
		`INSERT INTO content
			(ContentID, ContentType, Title, Attribution, Description, Publisher,
			 DateLastRead, ReadStatus, ___PercentRead, ISBN, Series, SeriesNumber,
			 TimeSpentReading, BookTitle, VolumeIndex, ChapterIDBookmarked)
		 VALUES
			('${BOOK_CONTENT_ID}', 6, '${FIXTURE_BOOK_TITLE}', '${FIXTURE_BOOK_AUTHOR}',
			 'A book.', 'Orbit', '2024-05-01T10:00:00Z', 1, 72,
			 '${FIXTURE_BOOK_ISBN}', 'The Expanse', '5', 123456,
			 NULL, NULL, NULL),
			('${CHAPTER_ONE_ID}', 899, 'Chapter One', NULL,
			 NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
			 '${FIXTURE_BOOK_TITLE}', 1, 'true'),
			('${CHAPTER_TWO_ID}', 899, 'Chapter Two', NULL,
			 NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
			 '${FIXTURE_BOOK_TITLE}', 2, 'true'),
			('${CHAPTER_TEN_ID}', 899, 'Chapter Ten', NULL,
			 NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
			 '${FIXTURE_BOOK_TITLE}', 3, 'true'),
			('file:///mnt/onboard/custom-article.html', 899, 'A Custom Article',
			 'A Journalist', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
			 NULL, NULL, 'true');`,
	);

	db.run(
		`INSERT INTO Bookmark
			(BookmarkID, Text, ContentID, annotation, DateCreated, ChapterProgress, Color)
		 VALUES
			('bookmark-1', 'First highlight', '${CHAPTER_ONE_ID}', NULL,
			 '2024-05-02T08:00:00Z', 0.15, 2),
			('bookmark-2', 'Second highlight', '${CHAPTER_TWO_ID}', 'A personal note',
			 '2024-05-03T08:00:00Z', 0.55, NULL),
			('bookmark-3', 'Third highlight', '${CHAPTER_TEN_ID}', '',
			 '2024-05-04T08:00:00Z', 0.9, 3),
			('bookmark-without-text', NULL, '${CHAPTER_ONE_ID}', NULL,
			 '2024-05-05T08:00:00Z', 0.2, NULL);`,
	);

	db.run(
		`INSERT INTO WordList (Text, VolumeId, DictSuffix, DateCreated)
		 VALUES
			('ephemeral', '${BOOK_CONTENT_ID}', '-en', '2024-01-15T10:00:00Z'),
			('ubiquitous', '${BOOK_CONTENT_ID}', '-en-fr', '2024-02-20T14:30:00Z'),
			('Wanderlust', '${BOOK_CONTENT_ID}', '-de', '2024-03-01T09:00:00Z');`,
	);

	return db;
}

/** Creates an empty database with the same schema as a Kobo device. */
export async function createEmptyFixtureDatabase(): Promise<Database> {
	const SQLEngine = await SqlJs({ wasmBinary: binary.buffer });
	const db = new SQLEngine.Database();
	db.run(`
		CREATE TABLE content (
			ContentID TEXT,
			ContentType INTEGER,
			Title TEXT,
			Attribution TEXT,
			BookTitle TEXT,
			VolumeIndex INTEGER,
			ChapterIDBookmarked TEXT
		);
		CREATE TABLE Bookmark (
			BookmarkID TEXT,
			Text TEXT,
			ContentID TEXT,
			annotation TEXT,
			DateCreated TEXT,
			ChapterProgress REAL
		);
	`);
	return db;
}
