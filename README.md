# Obsidian Kobo Highlight Importer

This plugin imports highlights and vocabulary from Kobo e-readers into your Obsidian vault.

> **This is a maintained fork of
> [OGKevin/obsidian-kobo-highlights-import](https://github.com/OGKevin/obsidian-kobo-highlights-import).**
> It adds non-destructive sync, vocabulary import, appending to an existing note, a template
> shorthand syntax and a few bug fixes that are not in the upstream releases yet.

- [Obsidian Kobo Highlight Importer](#obsidian-kobo-highlight-importer)
    - [Installation](#installation)
    - [How to use](#how-to-use)
    - [Appending highlights to an existing note](#appending-highlights-to-an-existing-note)
    - [Non-destructive sync](#non-destructive-sync)
    - [Vocabulary import (My Words)](#vocabulary-import-my-words)
    - [Templating](#templating)
        - [Simple syntax](#simple-syntax)
        - [Eta syntax](#eta-syntax)
        - [Variables](#variables)
    - [Settings](#settings)
    - [Helping Screenshots](#helping-screenshots)
    - [Contributing](#contributing)

## Installation

The plugin is not published to the Obsidian community store, so install it manually or with
[BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Download `main.js`, `manifest.json` and `styles.css` from the
   [latest release](https://github.com/nithou/obsidian-kobo-highlights-import/releases/latest)
2. Put them in `<your vault>/.obsidian/plugins/obsidian-kobo-highlights-importer-plugin/`
3. Reload Obsidian and enable **Kobo Highlights Importer** in _Settings → Community plugins_

With BRAT, add `nithou/obsidian-kobo-highlights-import` as a beta plugin.

Requires Obsidian 1.4.10 or newer and the desktop app (the plugin reads a SQLite file from disk).

## How to use

Once installed, the steps to import your highlights directly into the vault are:

1. Connect your Kobo device to PC using a proper USB cable
2. Check if it has mounted automatically, or mount it manually (e.g. open the root folder of your Kobo using a file
   manager)
3. Open the import window using the plugin button
4. Locate _KoboReader.sqlite_ in the _.kobo_ folder (this folder is hidden, so if you don't see it you should enable
   hidden files view from system configs)
5. Click Extract

The plugin remembers the path to your `KoboReader.sqlite` file between sessions. On subsequent imports, it will
auto-load the file without needing to re-select it. You can clear the remembered path in settings.

## Appending highlights to an existing note

If you write your own note for a book and only want the highlights appended to it, use the
**Append highlights to current note** command (`Ctrl/Cmd+P` → _Append highlights to current note_).

The plugin matches the active note to a Kobo book using, in order:

1. the `isbn` field of the note frontmatter
2. the `title` frontmatter field, then the file name
3. a fuzzy book picker, pre-filled with the note name

Only the highlights are appended — nothing in the existing note is rewritten — and highlights that
are already present in the note are skipped, so running the command twice is safe. The appended
block is rendered with the _Append template path_ setting (a highlights-only template by default).

## Non-destructive sync

When you re-import highlights, the plugin preserves any personal content you've added to your book notes. Each generated file includes a `## Personal Notes` section — everything under this heading is kept intact across re-imports. By default, this section is placed after the title heading, before Description and Highlights, but you can position it anywhere in your custom template.

The plugin regenerates all other sections (frontmatter, description, highlights) from the Kobo database, so your highlights are always up to date while your personal notes remain untouched. Your own level-2 headings inside `## Personal Notes` are preserved as well: only the headings the template itself regenerates end the section.

Notes that were **not** created by this plugin are never overwritten. If a note with the same name already exists and does not look like a generated note, its whole body is kept under `## Personal Notes` and a warning tells you which file was affected.

## Vocabulary import (My Words)

The plugin can import words you've looked up on your Kobo device (the "My Words" feature). Enable this in settings with the **Import vocabulary** toggle.

All vocabulary words are saved to a single file (default: `Kobo Vocabulary.md`) in your destination folder. The file includes each word with its dictionary language and the date it was looked up. Like book notes, the vocabulary file supports non-destructive sync with a Personal Notes section.

## Templating

You can customize the output format using templates. The plugin supports two syntax styles that can be mixed freely.

### Simple syntax

Use `{{Variable}}` shorthand for common fields:

```
---
title: "{{Title}}"
author: "{{Author}}"
date_created: "{{DateLastRead}}"
isbn: {{ISBN}}
readStatus: {{ReadStatus}}
---

# {{Title}} - {{Author}}

## Description

{{Description}}

## Highlights

{{highlights}}
```

Available shorthand variables:

| Shorthand              | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `{{Title}}`            | Book title                                                    |
| `{{Author}}`           | Book author                                                   |
| `{{Description}}`      | Book description                                              |
| `{{DateLastRead}}`     | Last read date (ISO format)                                   |
| `{{ISBN}}`             | ISBN number                                                   |
| `{{ReadStatus}}`       | Read status label (Unknown, Unopened, Reading, Read)          |
| `{{Publisher}}`        | Publisher name                                                |
| `{{Series}}`           | Series name                                                   |
| `{{SeriesNumber}}`     | Number in series                                              |
| `{{PercentRead}}`      | Reading progress percentage                                   |
| `{{TimeSpentReading}}` | Time spent reading (seconds)                                  |
| `{{highlights}}`       | Full highlights section with chapters, text, notes, and dates |

### Eta syntax

For full control, use [Eta.js](https://eta.js.org/) template syntax. All template data is available under `it.*`:

```eta
---
title: "<%= it.bookDetails.title %>"
author: <%= it.bookDetails.author %>
---

# <%= it.bookDetails.title %>

<% it.chapters.forEach(([chapterName, highlights]) => { -%>
## <%= chapterName.trim() %>

<% highlights.forEach((highlight) => { -%>
<%= highlight.text %>

<% if (highlight.note) { -%>
**Note:** <%= highlight.note %>

<% } -%>
<% if (highlight.dateCreated) { -%>
*Created: <%= highlight.dateCreated.toISOString() %>*

<% } -%>
<% }) -%>
<% }) %>
```

You can mix both syntaxes in the same template. See the [Eta.js template syntax documentation](https://eta.js.org/docs/intro/template-syntax) for the full Eta reference.

### Variables

The following variables are available in Eta templates:

| Variable      | Type / Structure                     | Description                                                                                                                                                                                                                                                                                                                             |
| ------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bookDetails` | Object                               | Book metadata: `title`, `author`, `publisher`, `dateLastRead`, `readStatus`, `percentRead`, `isbn`, `series`, `seriesNumber`, `timeSpentReading`, `description`                                                                                                                                                                         |
| `chapters`    | Array of `[chapterName, highlights]` | Each `highlights` is an array of bookmarks for that chapter                                                                                                                                                                                                                                                                             |
| `ReadStatus`  | Enum mapping                         | Maps read status values to their string labels                                                                                                                                                                                                                                                                                          |
| `highlight`   | Object                               | Each highlight/bookmark: `bookmarkId`, `text`, `contentId`, `note` (optional annotation), `dateCreated` ([Date](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)), `color` (optional: 0=yellow, 1=red, 2=blue, 3=green), `chapterProgress` (optional: 0-1 progress inside the bookmarked chapter) |

#### Date formatting examples

```eta
<!-- YYYY-MM-DD format -->
*Created: <%= h.dateCreated.getFullYear() %>-<%= String(h.dateCreated.getMonth() + 1).padStart(2, '0') %>-<%= String(h.dateCreated.getDate()).padStart(2, '0') %>*

<!-- Localized date -->
*Created: <%= h.dateCreated.toLocaleDateString() %>*

<!-- Localized date and time -->
*Created: <%= h.dateCreated.toLocaleString() %>*
```

#### Template example using Obsidian callouts to display color of highlights

```eta
---
title: "<%= it.bookDetails.title %>"
author: <%= it.bookDetails.author %>
---

# <%= it.bookDetails.title %>

## Description

<%= it.bookDetails.description?.replace(/<[^>]*>/g, '') ?? '' %>

## Highlights

<% it.chapters.forEach(([chapterName, highlights]) => { -%>
### <%= chapterName.trim() %>

<% highlights.forEach((highlight) => { const calloutMap = {'1': 'failure', '2': 'info', '3': 'success'}; const calloutType = calloutMap[highlight.color] ?? 'quote'; const calloutText = highlight.text.split('\n').map(line => '> ' + line).join('\n'); -%>
> [!<%= calloutType %>]
<%= calloutText %>

<% if (highlight.note) { -%>
**Note:** <%= highlight.note %>

<% } -%>
<% }) -%>
<% }) %>
```

## Settings

| Setting                      | Description                                                   | Default              |
| ---------------------------- | ------------------------------------------------------------- | -------------------- |
| **Destination folder**       | Where to save imported highlights                             | _(vault root)_       |
| **Kobo SQLite path**         | Remembered path to KoboReader.sqlite (auto-saved, read-only)  | _(not set)_          |
| **Template Path**            | Path to a custom template file in your vault                  | _(default template)_ |
| **Append template path**     | Template used by _Append highlights to current note_          | _(built-in)_         |
| **Sort by chapter progress** | Sort highlights by position in book instead of creation date  | Off                  |
| **Import all books**         | Import metadata for all books, not just those with highlights | Off                  |
| **Import vocabulary**        | Import looked-up words from Kobo's My Words feature           | Off                  |
| **Vocabulary file name**     | Name of the vocabulary file (without .md extension)           | Kobo Vocabulary      |

## Helping Screenshots

![](./README_assets/step1.png)
![](./README_assets/step2.png)
![](./README_assets/step3.png)
![](./README_assets/step4.png)

## Contributing

Please feel free to test, send feedback using Issues and open Pull Requests to improve the process.

### Development

```bash
npm install
npm test          # hermetic unit tests, no Kobo device needed
npm run lint
npm run build     # produces main.js
```

Tests build an in-memory Kobo database fixture, so no device dump or SOPS key is required. To run the
optional suite against real data, drop a decrypted `KoboReader.sqlite` at the repository root.
