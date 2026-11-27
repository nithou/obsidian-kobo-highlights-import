// Inspired by https://github.com/liamcain/obsidian-periodic-notes/blob/04965a1e03932d804f6dd42c2e5dba0ede010d79/src/utils.ts

import { App, normalizePath, Notice, TFile } from "obsidian";
import { defaultTemplate } from "./template";

export async function getTemplateContents(
	app: App,
	templatePath: string | undefined,
	fallback: string = defaultTemplate,
): Promise<string> {
	const normalizedTemplatePath = normalizePath(templatePath ?? "");

	if (normalizedTemplatePath === "/" || normalizedTemplatePath === "") {
		return fallback;
	}

	const templateFile: TFile | null = app.metadataCache.getFirstLinkpathDest(
		normalizedTemplatePath,
		"",
	);

	if (!templateFile) {
		new Notice(
			`Template "${normalizedTemplatePath}" not found — using the built-in template`,
		);
		return fallback;
	}

	try {
		return await app.vault.cachedRead(templateFile);
	} catch (err) {
		console.error(
			`Failed to read the kobo highlight exporter template '${normalizedTemplatePath}'`,
			err,
		);
		new Notice("Failed to read the kobo highlight exporter template");

		return fallback;
	}
}
