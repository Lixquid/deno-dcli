// Text Template Transformer
//
// Performs transformations on text files that contain template variables.
// Variables take the form TODO_XXX_, where XXX is the name of the variable;
// the script will prompt the user for a value for each variable, and then
// substitute the value in all files.

// Note: join from std/path is not used due to the large increase in bundle
// size.

import { parse } from "https://deno.land/std@0.204.0/flags/mod.ts";

const args = parse(Deno.args, {
	collect: ["ignore"],
	boolean: ["help", "verbose", "dry-run"],
	default: {
		ignore: [".git", "node_modules"],
	},
});

if (args["help"]) {
	console.log(`t3: Text Template Transformer

Performs transformations on text files that contain template variables.

The tool scans the current directory and all subdirectories for files that
contain template variables of the form TODO_XXX_, where XXX is the name of the
variable. The first a variable is encountered, the tool will prompt the user
for a value. The value is then substituted for the variable in all files.

The number of underscores after TODO can be increased if the variable needs to
contain underscores. For example; TODO_X_, TODO__X__, and TODO___X___ are all
valid and equivalent.

Variable formats:
    TODO_XXX_           prompts the user for a value
    TODO_!XXX_          complex placeholder; skips the prompt and alerts the
                        user at the end of the run that the variable needs to
                        be replaced

Usage: deno run dcli.lix.cx/t3.ts [options]

Options:
    --help              Prints this help message.
    --ignore=<DIR>      Ignores the specified directory. Can be specified
                        multiple times. Defaults to ".git" and "node_modules".
    --verbose           Prints debugging information.
    --dry-run           Prints the files that would be modified, but does not
                        modify them.
`);
	Deno.exit(0);
}

const verbose = args["verbose"];
const ignoredDirs = new Set(args["ignore"]);

if (verbose) {
	console.log("Ignored directories:");
	console.log(ignoredDirs);
}

// Get a list of all files in the current directory and all subdirectories that
// are not in ignoredDirs.

const files = new Set<string>();
async function scanDir(dir: string) {
	for await (const entry of Deno.readDir(dir)) {
		if (entry.isDirectory) {
			if (!ignoredDirs.has(entry.name)) {
				await scanDir(`${dir}/${entry.name}`);
			}
		} else {
			files.add(`${dir}/${entry.name}`);
		}
	}
}
await scanDir(".");

if (args["verbose"]) {
	console.log("Files to process:");
	console.log(files);
}

// Get a list of all variables and placeholders in the files.

const variables = new Set<string>();
const placeholders = new Map<string, string[]>();
const todoRegex = /TODO(_+)(.*?)\1/g;

for await (const filename of files) {
	const fileText = await Deno.readTextFile(filename);
	const matches = Array.from(fileText.matchAll(todoRegex));
	if (matches.length === 0) {
		files.delete(filename);
	} else {
		for (const match of matches) {
			const t = match[2];
			if (t.startsWith("!")) {
				const n = t.slice(1);
				if (!placeholders.has(n)) {
					placeholders.set(n, []);
				}
				placeholders.get(n)!.push(filename);
			} else {
				variables.add(t);
			}
		}
	}
}

if (args["verbose"]) {
	console.log("Variables:");
	console.log(variables);
	console.log("Placeholders:");
	console.log(placeholders);
	console.log("Files with variables:");
	console.log(files);
}

// Query the user for values for all variables.

console.log(`Found ${variables.size} variable(s):`);
for (const v of variables) {
	console.log(`    ${v}`);
}
console.log("Enter values for each variable. Leave blank to skip.");
const values = new Map<string, string>();
for (const v of variables) {
	const value = prompt(`${v}:`);
	if (value) {
		values.set(v, value);
	}
}

// Perform the substitutions.

if (args["dry-run"]) {
	console.log("Replacing variables in the following files:");
}
for (const filename of files) {
	const fileText = await Deno.readTextFile(filename);
	const newText = fileText.replace(todoRegex, (original, __, t) => {
		if (t.startsWith("!")) {
			return original;
		}
		const value = values.get(t);
		if (value) {
			return value;
		}
		return original;
	});
	if (args["dry-run"]) {
		console.log(`    ${filename}`);
	} else {
		await Deno.writeTextFile(filename, newText);
	}
}

// Alert the user about placeholders if any were found.

if (placeholders.size > 0) {
	console.log("┏━━━━━━━━━━━━━━━━━━━━━━━━━┓");
	console.log("┃                         ┃");
	console.log("┃  PLACEHOLDERS DETECTED  ┃");
	console.log("┃                         ┃");
	console.log("┗━━━━━━━━━━━━━━━━━━━━━━━━━┛");
	console.log("");
	console.log("Please replace the following placeholders with real values:");
	for (const [placeholder, filenames] of placeholders) {
		console.log(`    ${placeholder}:`);
		for (const filename of filenames) {
			console.log(`        ${filename}`);
		}
	}
}
