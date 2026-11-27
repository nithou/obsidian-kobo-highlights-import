/* eslint-disable @typescript-eslint/no-unused-expressions */
import { expect } from "chai";
import {
	extractPersonalNotes,
	looksPluginGenerated,
	managedHeadingsAfterPlaceholder,
	mergeContent,
	mergeImport,
} from "./contentMerger";

const DEFAULT_NEW_CONTENT = `---
title: "Book"
readStatus: 1
---

# Book

## Personal Notes

## Description

A book.

## Highlights

text`;

describe("contentMerger", function () {
	describe("extractPersonalNotes", function () {
		it("returns null when heading is absent", function () {
			const content = `# Book Title\n\n## Highlights\n\nSome text`;
			expect(extractPersonalNotes(content)).to.equal(null);
		});

		it("extracts content from heading to EOF when last section", function () {
			const content = `# Book\n\n## Highlights\n\ntext\n\n## Personal Notes\n\nMy thoughts.`;
			const result = extractPersonalNotes(content);
			expect(result).to.equal("## Personal Notes\n\nMy thoughts.");
		});

		it("extracts content from heading to next ## heading", function () {
			const content = `# Book\n\n## Personal Notes\n\nMy thoughts.\n\n## Description\n\nA book.`;
			const result = extractPersonalNotes(content);
			expect(result).to.equal("## Personal Notes\n\nMy thoughts.");
		});

		it("handles subheadings inside personal notes", function () {
			const content = `# Book\n\n## Personal Notes\n\n### Sub-thought\n\nDetails.\n\n### Another\n\nMore.\n\n## Highlights`;
			const result = extractPersonalNotes(content);
			expect(result).to.contain("### Sub-thought");
			expect(result).to.contain("### Another");
			expect(result).not.to.contain("## Highlights");
		});

		it("keeps user level-2 subsections when managed headings are known", function () {
			const content = `# Book\n\n## Personal Notes\n\n## Quotes I love\n\nSomething.\n\n## Description\n\nA book.`;
			const result = extractPersonalNotes(content, [
				"## Personal Notes",
				"## Description",
				"## Highlights",
			]);

			expect(result).to.contain("## Quotes I love");
			expect(result).to.contain("Something.");
			expect(result).not.to.contain("## Description");
		});

		it("does not truncate at an unknown heading", function () {
			const content = `## Personal Notes\n\nIntro.\n\n## My own section\n\nKeep me.\n\n## Description\n\nBook.`;
			const result = extractPersonalNotes(content, ["## Description"]);

			expect(result).to.contain("## My own section");
			expect(result).to.contain("Keep me.");
			expect(result).not.to.contain("## Description");
		});

		it("handles empty personal notes section", function () {
			const content = `# Book\n\n## Personal Notes\n\n## Description\n\nA book.`;
			const result = extractPersonalNotes(content);
			expect(result).to.equal("## Personal Notes");
		});

		it("uses last occurrence if heading appears multiple times", function () {
			const content = `## Personal Notes\n\nFirst one\n\n## Highlights\n\n## Personal Notes\n\nSecond one\n\n## Description`;
			const result = extractPersonalNotes(content);
			expect(result).to.equal("## Personal Notes\n\nSecond one");
		});
	});

	describe("managedHeadingsAfterPlaceholder", function () {
		it("returns headings rendered after the placeholder", function () {
			expect(
				managedHeadingsAfterPlaceholder(DEFAULT_NEW_CONTENT),
			).to.deep.equal([
				"## Personal Notes",
				"## Description",
				"## Highlights",
			]);
		});

		it("returns an empty list when the template has no placeholder", function () {
			expect(
				managedHeadingsAfterPlaceholder("# Book\n\n## Highlights"),
			).to.deep.equal([]);
		});
	});

	describe("mergeContent", function () {
		it("appends empty section when personalNotes is null and no placeholder", function () {
			const result = mergeContent("# Book\n\n## Highlights", null);
			expect(result).to.contain("# Book");
			expect(result).to.contain("## Highlights");
			expect(result).to.contain("## Personal Notes\n");
		});

		it("preserves personal notes in middle of document", function () {
			const newContent =
				"# Book\n\n## Personal Notes\n\n## Description\n\nA book.\n\n## Highlights\n\ntext";
			const personalNotes =
				"## Personal Notes\n\nMy thoughts on this book.";
			const result = mergeContent(newContent, personalNotes);
			expect(result).to.contain("My thoughts on this book.");
			expect(result).to.contain("## Description");
			expect(result).to.contain("## Highlights");
			const notesIdx = result.indexOf("## Personal Notes");
			const descIdx = result.indexOf("## Description");
			expect(notesIdx).to.be.lessThan(descIdx);
		});

		it("replaces placeholder with preserved notes keeping surrounding content", function () {
			const newContent =
				"# Book\n\n## Personal Notes\n\n## Highlights\n\ntext";
			const personalNotes =
				"## Personal Notes\n\nUser's preserved content.";
			const result = mergeContent(newContent, personalNotes);
			const count = (result.match(/## Personal Notes/g) || []).length;
			expect(count).to.equal(1);
			expect(result).to.contain("User's preserved content.");
			expect(result).to.contain("## Highlights");
		});

		it("strips template placeholder when no existing notes", function () {
			const newContent =
				"# Book\n\n## Personal Notes\n\n## Highlights\n\ntext";
			const result = mergeContent(newContent, null);
			const count = (result.match(/## Personal Notes/g) || []).length;
			expect(count).to.equal(1);
			expect(result).to.contain("## Highlights");
		});
	});

	describe("looksPluginGenerated", function () {
		it("detects the Personal Notes section", function () {
			expect(looksPluginGenerated("## Personal Notes\n\nhi")).to.be.true;
		});

		it("detects generated frontmatter", function () {
			expect(looksPluginGenerated("---\nreadStatus: 1\n---\n\n# Book")).to
				.be.true;
		});

		it("does not flag a hand-written note", function () {
			expect(looksPluginGenerated("# My note\n\nJust thoughts.")).to.be
				.false;
		});
	});

	describe("mergeImport", function () {
		it("creates a new note without preserving anything", function () {
			const result = mergeImport(DEFAULT_NEW_CONTENT, null);

			expect(result.preservedForeignContent).to.be.false;
			expect(result.content).to.contain("## Personal Notes");
		});

		it("keeps personal notes from a generated note", function () {
			const existing = `---\ntitle: "Book"\nreadStatus: 1\n---\n\n# Book\n\n## Personal Notes\n\n## Quotes\n\nKeep this.\n\n## Description\n\nOld.\n\n## Highlights\n\nold text`;
			const result = mergeImport(DEFAULT_NEW_CONTENT, existing);

			expect(result.preservedForeignContent).to.be.false;
			expect(result.content).to.contain("Keep this.");
			expect(result.content).not.to.contain("old text");
		});

		it("never destroys a hand-written note", function () {
			const existing = `# Book\n\nMy own review of this book.\n\n## Themes\n\nMemory.`;
			const result = mergeImport(DEFAULT_NEW_CONTENT, existing);

			expect(result.preservedForeignContent).to.be.true;
			expect(result.content).to.contain("My own review of this book.");
			expect(result.content).to.contain("## Themes");
			expect(result.content).to.contain("Memory.");
		});

		it("regenerates a legacy generated note that has no Personal Notes section", function () {
			const existing = `---\ntitle: "Book"\nreadStatus: 1\n---\n\n# Book\n\n## Highlights\n\nlegacy text`;

			expect(looksPluginGenerated(existing)).to.be.true;
			const result = mergeImport(DEFAULT_NEW_CONTENT, existing);

			expect(result.preservedForeignContent).to.be.false;
			expect(result.content).not.to.contain("legacy text");
		});
	});
});
