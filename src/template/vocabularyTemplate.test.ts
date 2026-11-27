import { expect } from "chai";
import { Word } from "../database/interfaces";
import { applyVocabularyTemplate } from "./vocabularyTemplate";

const words: Word[] = [
	{
		text: "Wanderlust",
		dictSuffix: "-de",
		dateCreated: new Date("2024-03-01T09:00:00Z"),
	},
	{
		text: "ephemeral",
		dictSuffix: "-en",
		dateCreated: new Date("2024-01-15T10:00:00Z"),
	},
];

describe("vocabularyTemplate", function () {
	it("renders one bullet per word", function () {
		const rendered = applyVocabularyTemplate(words);

		expect(rendered).to.contain("- **Wanderlust** (de)");
		expect(rendered).to.contain("- **ephemeral** (en)");
		expect(rendered).to.contain("2 words");
	});

	it("is deterministic across calls", function () {
		expect(applyVocabularyTemplate(words)).to.equal(
			applyVocabularyTemplate(words),
		);
	});

	it("uses the most recent word date, not the current time", function () {
		const rendered = applyVocabularyTemplate(words);

		expect(rendered).to.contain('date_updated: "2024-03-01T09:00:00.000Z"');
	});

	it("changes when a newer word is added", function () {
		const before = applyVocabularyTemplate(words);
		const after = applyVocabularyTemplate([
			...words,
			{
				text: "serendipity",
				dateCreated: new Date("2024-09-01T00:00:00Z"),
			},
		]);

		expect(after).not.to.equal(before);
		expect(after).to.contain('date_updated: "2024-09-01T00:00:00.000Z"');
	});
});
