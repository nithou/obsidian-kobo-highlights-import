import { expect } from "chai";
import { ImportContext } from "./ImportContext";

describe("ImportContext", function () {
	it("summarises a first import", function () {
		const context = new ImportContext();
		context.booksImported = 2;
		context.highlightsImported = 7;

		expect(context.toSummary()).to.equal(
			"Imported 2 books (7 highlights).",
		);
	});

	it("uses singular labels", function () {
		const context = new ImportContext();
		context.booksImported = 1;
		context.highlightsImported = 1;
		context.wordsImported = 1;

		expect(context.toSummary()).to.equal(
			"Imported 1 book (1 highlight), 1 vocabulary word.",
		);
	});

	it("reports unchanged books on a second import", function () {
		const context = new ImportContext();
		context.booksUnchanged = 12;

		expect(context.toSummary()).to.equal("12 books unchanged.");
	});

	it("reports a mix of written and unchanged books", function () {
		const context = new ImportContext();
		context.booksImported = 1;
		context.highlightsImported = 3;
		context.booksUnchanged = 11;

		expect(context.toSummary()).to.equal(
			"Imported 1 book (3 highlights), 11 books unchanged.",
		);
	});

	it("reports unchanged vocabulary", function () {
		const context = new ImportContext();
		context.booksUnchanged = 4;
		context.wordsUnchanged = 9;

		expect(context.toSummary()).to.equal(
			"4 books unchanged, vocabulary unchanged.",
		);
	});

	it("falls back to a neutral message and appends warnings", function () {
		const context = new ImportContext();
		context.addWarning("no bookmarks");

		expect(context.toSummary()).to.equal(
			"No content imported. 1 warning: no bookmarks",
		);
	});
});
