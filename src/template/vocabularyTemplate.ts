import { Eta } from "eta";
import { Word } from "../database/interfaces";

const eta = new Eta({ autoEscape: false, autoTrim: false });

const defaultVocabularyTemplate = `
---
title: "Kobo Vocabulary"
date_updated: "<%= it.dateUpdated %>"
---

# Kobo Vocabulary

<%= it.words.length %> words

<% it.words.forEach((word) => { -%>
- **<%= word.text %>**<% if (word.dictSuffix) { %> (<%= word.dictSuffix.replace(/^-/, '') %>)<% } %><% if (word.dateCreated) { %> — _<%= word.dateCreated.toISOString().split('T')[0] %>_<% } %>
<% }) %>

## Personal Notes
`;

/**
 * Most recent lookup date across the words. It derives from the data on
 * purpose: a "now" timestamp would make the rendered file differ on every run
 * and defeat the unchanged-file detection, rewriting the vocabulary note (and
 * bumping it into Obsidian Sync) for nothing.
 */
function latestWordDate(words: Word[]): Date | undefined {
	let latest: Date | undefined;

	for (const word of words) {
		if (!word.dateCreated) {
			continue;
		}
		if (!latest || word.dateCreated.getTime() > latest.getTime()) {
			latest = word.dateCreated;
		}
	}

	return latest;
}

export function applyVocabularyTemplate(words: Word[]): string {
	const dateUpdated = latestWordDate(words);
	const rendered = eta.renderString(defaultVocabularyTemplate, {
		words,
		dateUpdated: dateUpdated ? dateUpdated.toISOString() : "",
	});

	if (rendered === null) {
		throw new Error("Vocabulary template rendering failed");
	}

	return rendered.trim();
}
