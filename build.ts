import { join } from "https://deno.land/std@0.204.0/path/mod.ts";
import { bundle } from "https://deno.land/x/emit/mod.ts";

// Create the dist folder if it doesn't exist, or clean it if it does

try {
    await Deno.remove("dist", { recursive: true });
} catch {
    /* ignore failure */
}
await Deno.mkdir("dist");

// For each file in the src folder, transpile it using deno_emit into dist,
// and store a record of its filename, name and description.

const scripts: {
    filename: string;
    name: string;
    description: string;
}[] = [];

for await (const entry of Deno.readDir("src")) {
    if (entry.isFile && entry.name.endsWith(".ts")) {
        console.log("Transpiling", entry.name);
        const { code } = await bundle(join("src", entry.name));
        const filename = entry.name.replace(".ts", "");
        await Deno.writeTextFile(join("dist", filename), code);

        const srcCodeLines = (
            await Deno.readTextFile(join("src", entry.name))
        ).split("\n");
        // Name is the first line of the file, minus the "// " prefix
        const name = srcCodeLines[0].slice(3).trim();
        // Description is the third line of the file onwards until the first
        // non-comment line, with the "// " prefix removed from each line.
        const descriptionLines = [];
        for (let i = 2; i < srcCodeLines.length; i++) {
            const line = srcCodeLines[i];
            if (line.startsWith("// ")) {
                descriptionLines.push(line.slice(3));
            } else {
                break;
            }
        }

        scripts.push({
            filename,
            name,
            description: descriptionLines.join("\n").trim(),
        });
    }
}

// Create an index.html file in dist that lists all the scripts.

// language=HTML
const html = `<!DOCTYPE html>
<html>
    <head>
        <title>Deno CLI Scripts</title>
        <style>
            body {
                font-family: sans-serif;
                background: #333;
                color: #eee;
            }
            a {
                color: #fff;
            }
            body > ul {
                margin-top: 3em;
                margin-bottom: 3em;
            }
            body > ul > li {
                margin-bottom: 1em;
            }
            code {
                background: #111;
                padding: .1em .3em;
            }
        </style>
    </head>
    <body>
        <h1>Deno CLI Scripts</h1>
        <p>A collection of scripts for the CLI, using Deno.</p>
        <p>
            Run these scripts using <code>deno run
            https://dcli.lix.cx/&lt;script-name&gt;</code>. All scripts accept
            the <code>--help</code> flag.
        </p>
        <ul>
            ${scripts
                .map(
                    ({ filename, name, description }) =>
                        `<li>
                            <a href="${filename}"><code>${filename}</code> - ${name}</a>
                            <ul>
                                <li>${description}</li>
                            </ul>
                        </li>`
                )
                .join("\n")}
        </ul>
    </body>
</html>
`;

await Deno.writeTextFile("dist/index.html", html);
