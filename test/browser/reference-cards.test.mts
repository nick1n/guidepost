import { runBrowser } from "./support/harness.mts";

const template = 'document.querySelector("select[aria-describedby=template-help]")';
const title = "document.querySelector('input[maxlength=\"90\"]')";
const dialog = 'document.querySelector("dialog[open]")';

await runBrowser(
  { name: "reference-card-templates", diagnostics: "document.body.innerText" },
  async ({ base, send, evaluate, waitFor, viewport, key, frames, settle, saveScreenshot, assert }) => {
    await viewport(1280);
    await send("Page.navigate", { url: new URL("/test/reference-cards/", base).href });
    await waitFor("document.querySelector('header button')?.disabled === false");
    assert(
      await evaluate(`${title}.value === "Analyze"
        && document.querySelector("textarea").value.includes("reveal the top [deck-ai] card")
        && [...document.querySelectorAll("main select")].some(select => select.value === "Ability")`),
      "The editor opens with the Analyze ability",
    );
    assert(
      await evaluate(`(() => {
        const root = document.documentElement;
        const density = root.dataset.density;
        root.dataset.density = "comfortable";
        const minimum = parseFloat(getComputedStyle(root).getPropertyValue("--size-control"));
        const controls = document.querySelectorAll("main summary, main .toggle, main select, main button");
        const fits = [...controls].every(control => control.getBoundingClientRect().height >= minimum);
        root.dataset.density = density;
        return fits;
      })()`),
      "Editor disclosure, checkbox rows, selects, and buttons meet the global density minimum",
    );
    await evaluate(`${template}.focus()`);
    await evaluate("document.fonts.ready.then(() => null)");
    await settle("main");
    await saveScreenshot("desktop.png");
    await viewport(390, 844);
    await frames();
    await saveScreenshot("mobile.png");
    await viewport(1280);

    await key("ArrowDown", "ArrowDown", 40);
    assert(await evaluate(`${title}.value === "Glass Mask"`), "The first down arrow applies the first template");
    await key("ArrowDown", "ArrowDown", 40);
    assert(
      await evaluate(`${template}.value === "devils-melody" && ${title}.value === "Devil's Melody"`),
      "The second down arrow advances to the next template",
    );
    const melodyContent = await evaluate<string>('document.querySelector("textarea").value');
    assert(
      await evaluate(`(() => {
        const footer = [...document.querySelectorAll("label")].find(label => label.textContent.trim() === "Footer text");
        return footer.querySelector("textarea").value === "- At the start of each round -"
          && !document.querySelector("header button").disabled;
      })()`),
      "Devil’s Melody includes its timing footer and fits the card",
    );
    await key("ArrowUp", "ArrowUp", 38);
    assert(
      await evaluate(`${template}.value === "glass-mask" && ${title}.value === "Glass Mask"`),
      "Up arrow returns to the previous template",
    );

    await evaluate(`${title}.value = "My title"; ${title}.dispatchEvent(new Event("input", { bubbles: true }))`);
    await key("ArrowDown", "ArrowDown", 40);
    assert(await evaluate(`Boolean(${dialog}) && ${title}.value === "My title"`), "Selecting a template with edits opens confirmation");
    await saveScreenshot("confirmation.png");
    await key("Escape");
    assert(
      await evaluate(
        `!${dialog} && ${template}.value === "glass-mask" && ${title}.value === "My title" && document.activeElement === ${template}`,
      ),
      "Escape cancels and returns focus and selection to the previous template",
    );
    await settle("dialog");
    await key("ArrowDown", "ArrowDown", 40);
    await evaluate(`[...${dialog}.querySelectorAll("button")].find(button => button.textContent === "Keep my edits").click()`);
    assert(
      await evaluate(
        `${template}.value === "devils-melody" && ${title}.value === "My title" && document.querySelector("textarea").value === ${JSON.stringify(melodyContent)}`,
      ),
      "Keeping edits applies the newly selected template to untouched fields",
    );
    await settle("dialog");
    await key("ArrowDown", "ArrowDown", 40);
    await evaluate(`[...${dialog}.querySelectorAll("button")].find(button => button.textContent === "Replace all fields").click()`);
    assert(
      await evaluate(`${template}.value === "analyze" && ${title}.value === "Analyze"`),
      "Replacing all fields applies the selected template",
    );
    await settle("dialog");
    for (const side of [
      {
        id: "knocked-down-survivors",
        subtitle: "(During Survivors' Turn)",
        bodyStart: "If you were in the middle of your attack",
        footerStart: "Discard and stand",
      },
      {
        id: "knocked-down-monster",
        subtitle: "(During Monster's Turn)",
        bodyStart: "Turn your miniature on its side.",
        footerStart: "Flip over",
      },
    ]) {
      await evaluate(`
        ${template}.value = ${JSON.stringify(side.id)};
        ${template}.dispatchEvent(new Event("change", { bubbles: true }));
      `);
      const fields = await evaluate<{
        title: string;
        subtitle: string;
        body: string;
        footer: string;
        outline: boolean;
        canSave: boolean;
      }>(`(() => {
        const field = (name, tag = "input") => [...document.querySelectorAll("label")].find(label => label.textContent.trim() === name).querySelector(tag);
        return { title: field("Title").value, subtitle: field("Subtitle").value, body: document.querySelector("textarea").value,
          footer: field("Footer text", "textarea").value, outline: field("Outline main text").checked, canSave: !document.querySelector("header button").disabled };
      })()`);
      assert(
        fields.title === "Knocked Down" &&
          fields.subtitle === side.subtitle &&
          fields.body.startsWith(side.bodyStart) &&
          fields.footer.startsWith(side.footerStart) &&
          fields.canSave,
        `The Knocked Down template ${side.subtitle} loads its own copy and fits the card`,
      );
      assert(fields.outline, `The Knocked Down template ${side.subtitle} enables Outline main text`);
    }
    await saveScreenshot("knocked-down-desktop.png");
    await viewport(390, 844);
    await frames();
    await saveScreenshot("knocked-down-mobile.png");

    await evaluate(`${template}.value = "armored-fist"; ${template}.dispatchEvent(new Event("change", { bubbles: true }))`);
    await frames();
    assert(
      await evaluate(`(() => {
        const footer = [...document.querySelectorAll("label")].find(label => label.textContent.trim() === "Footer text");
        return ${title}.value === "Armored Fist"
          && document.querySelector("textarea").value.startsWith("Requires Fist & Tooth Proficiency\\n---\\n")
          && footer.querySelector("textarea").value === "- When You Attack -"
          && !document.querySelector("header button").disabled;
      })()`),
      "The Armored Fist template loads its requirement, divider, and footer",
    );
    await saveScreenshot("armored-fist-mobile.png");
    await viewport(1280);
    await frames();
    await saveScreenshot("armored-fist-desktop.png");
    const sections = await evaluate<number[]>(`(() => {
      const width = 528;
      const height = 333;
      const pixels = document.querySelector("canvas").getContext("2d").getImageData(72, 209, width, height).data;
      const dividers = [];
      const ink = [];
      for (let y = 0; y < height; y++) {
        const start = y * width * 4;
        const edge = pixels[start];
        if (edge < pixels[0] && pixels[start - width * 4] === pixels[0]) dividers.push(y + 1);
        if (pixels.subarray(start, start + width * 4).some((value, index) => index % 4 === 0 && value < 128)) {
          ink.push(y + 0.5);
        }
      }
      return dividers.slice(1).map((bottom, index) => {
        const top = dividers[index];
        const rows = ink.filter(y => y > top && y < bottom);
        return (rows[0] + rows.at(-1) - top - bottom) / 2;
      });
    })()`);
    assert(
      sections.length === 2 && sections.every((offset) => Math.abs(offset) <= 1.5),
      `Both Armored Fist text sections are centered between dividers (offsets in px: ${sections.join(", ")})`,
    );

    await evaluate(`${template}.value = "broken-rib"; ${template}.dispatchEvent(new Event("change", { bubbles: true }))`);
    await frames();
    await saveScreenshot("broken-rib-desktop.png");
    await viewport(390, 844);
    await frames();
    await saveScreenshot("broken-rib-mobile.png");
    assert(
      await evaluate(`(() => {
        const size = [...document.querySelectorAll("label")]
          .find(label => label.firstChild.textContent.trim() === "Main text size").querySelector("select");
        return ${title}.value === "Broken Rib" && size.value === "Large" && !document.querySelector("header button").disabled;
      })()`),
      "The Broken Rib template loads at Large and fits the card",
    );
  },
);

await runBrowser(
  { name: "reference-card-footer", diagnostics: "document.body.innerText" },
  async ({ base, send, evaluate, waitFor, viewport, frames, key, saveScreenshot, assert }) => {
    await viewport(1280);
    await send("Page.navigate", { url: new URL("/test/reference-cards/", base).href });
    await waitFor("document.querySelector('header button')?.disabled === false");
    await evaluate(`
      window.cardCanvas = document.querySelector("canvas");
      window.ctx = cardCanvas.getContext("2d");
      window.footerLines = [];
      window.headerLines = [];
      window.field = (name, tag) => [...document.querySelectorAll("label")]
        .find(label => [...label.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim() === name))
        .querySelector(tag);
      window.setFooter = text => {
        const textarea = field("Footer text", "textarea");
        textarea.value = text;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      };
      window.setSelect = (name, value) => {
        const select = field(name, "select");
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      };
      window.saveCardPng = () => {
        let url;
        const click = HTMLAnchorElement.prototype.click;
        try {
          HTMLAnchorElement.prototype.click = function() { url = this.href; };
          document.querySelector("header button").click();
        } finally {
          HTMLAnchorElement.prototype.click = click;
        }
        return url;
      };
      window.pngMatchesPreview = async (url) => {
        if (!url) return false;
        const image = new Image();
        image.src = url;
        await image.decode();
        const copy = document.createElement("canvas");
        copy.width = copy.height = 672;
        const exported = copy.getContext("2d");
        exported.drawImage(image, 0, 0);
        const preview = ctx.getImageData(0, 0, 672, 672).data;
        return image.width === 672 && image.height === 672
          && exported.getImageData(0, 0, 672, 672).data.every((value, index) => value === preview[index]);
      };
      const clearRect = ctx.clearRect;
      ctx.clearRect = function(...args) {
        footerLines.length = 0;
        headerLines.length = 0;
        clearRect.call(this, ...args);
      };
      const fillText = ctx.fillText;
      ctx.fillText = function(text, x, y, ...args) {
        if (y < 209) headerLines.push({ text, x, y, align: this.textAlign });
        if (this.font.startsWith("37px") && this.font.includes("Card Silverado Medium")) {
          footerLines.push({ text, x, y, width: this.measureText(text).width, align: this.textAlign });
        }
        fillText.call(this, text, x, y, ...args);
      };
      window.footerTop = () => {
        const edge = ctx.getImageData(0, 209, 1, 463).data;
        return 209 + edge.findIndex((value, index) => index % 4 === 0 && value < 120) / 4;
      };
      window.bottomEdge = () => ctx.getImageData(0, 671, 672, 1).data;
      window.edgeRules = field("Add dividers above and below the content", "input");
      if (!edgeRules.checked) edgeRules.click();
    `);
    await frames();
    await saveScreenshot("outer-dividers-on.png");
    await evaluate("window.withDividers = ctx.getImageData(0, 0, 672, 672).data; edgeRules.click()");
    await frames();
    await saveScreenshot("outer-dividers-off.png");
    const changedRows = await evaluate<number[]>(`(() => {
      const pixels = ctx.getImageData(0, 0, 672, 672).data;
      const stride = 672 * 4;
      const rows = [];
      for (let y = 0; y < 672; y++) {
        const start = y * stride;
        if (pixels.subarray(start, start + stride).some((value, index) => value !== withDividers[start + index])) rows.push(y);
      }
      return rows;
    })()`);
    assert(
      changedRows.length === 4 && changedRows[1] === changedRows[0] + 1 && changedRows[3] === changedRows[2] + 1,
      `Hiding the outer dividers changes only their four pixel rows (changed: ${changedRows.length})`,
    );
    await evaluate('setFooter("After your turn")');
    assert(
      await evaluate("footerTop() === 542 && footerLines.length === 1 && footerLines[0].y === 587"),
      "A short footer keeps its original height and text position",
    );
    const longFooter = "After the last survivor finishes their attack, move one space and recover a token.";
    await evaluate(`window.shortExport = saveCardPng(); window.originalEdge = bottomEdge(); setFooter(${JSON.stringify(longFooter)})`);
    await saveScreenshot("desktop.png");
    await viewport(390, 844);
    await frames();
    await saveScreenshot("mobile.png");
    assert(
      await evaluate(`footerLines.length > 1 && footerLines.map(line => line.text).join(" ") === ${JSON.stringify(longFooter)}
        && footerLines.every(line => line.x === 336 && line.width <= 528)`),
      "A long footer wraps at word boundaries at the original font size",
    );
    assert(
      await evaluate("footerTop() < 542 && footerLines[0].y > footerTop() && footerLines.at(-1).y === 587"),
      "The footer grows upward to fit all lines and keeps the bottom padding",
    );
    assert(
      await evaluate("bottomEdge().every((value, index) => value === originalEdge[index])"),
      "The expanded footer retains the original bottom edge of the artwork",
    );
    assert(
      await evaluate(`(() => {
        const url = saveCardPng();
        return url !== shortExport && pngMatchesPreview(url);
      })()`),
      "The 672 px PNG tracks edits and matches the preview",
    );
    await evaluate(`
      setFooter("After your turn");
      window.bodyPixels = () => ctx.getImageData(0, 209, 672, 333).data;
    `);
    for (const background of ["Paper", "Disorder (Light)"]) {
      await evaluate(`setSelect("Main content background", ${JSON.stringify(background)})`);
      await evaluate('window.shownBody = bodyPixels(); setFooter("  \\n  ")');
      assert(
        await evaluate('footerLines.length === 0 && field("Footer text", "textarea").value.trim() === ""'),
        `A blank footer field hides the footer on ${background}`,
      );
      assert(
        await evaluate("bodyPixels().every((value, index) => value === shownBody[index])"),
        `Clearing a single-line footer preserves the main text and ${background} background positions`,
      );
      await evaluate('setFooter("After your turn")');
    }
    await evaluate(`setFooter(${JSON.stringify(longFooter)})`);
    await evaluate('window.balancedFirstWidth = footerLines[0].width; setSelect("Text alignment", "center")');
    assert(
      await evaluate('footerLines[0].width > balancedFirstWidth && footerLines.every(line => line.align === "center")'),
      "Centered fits more words in the first line than Balanced for uneven wraps",
    );
    await evaluate('window.centeredLastWidth = footerLines.at(-1).width; setSelect("Text alignment", "pretty")');
    assert(
      await evaluate(
        'footerLines.at(-1).width > centeredLastWidth && footerLines.every(line => line.align === "center" && line.width <= 528)',
      ),
      "Pretty gives the short final footer line more room",
    );
    await evaluate('setSelect("Text alignment", "left")');
    assert(
      await evaluate('footerLines.length > 1 && footerLines.every(line => line.align === "left" && line.x === 72)'),
      "Left aligns both wrapped footer lines to the same inset",
    );
    await evaluate(`setFooter("W".repeat(90))`);
    assert(
      await evaluate(`footerLines.map(line => line.text).join("") === "W".repeat(90) && footerLines.every(line => line.width <= 528)`),
      "An unbroken footer also wraps within the card margins",
    );
    await evaluate(`setFooter("Monster's turn. Survivors' turn.")`);
    assert(
      await evaluate(`footerLines.map(line => line.text).join(" ") === "Monster’s turn. Survivors’ turn."
        && field("Footer text", "textarea").value === "Monster's turn. Survivors' turn."`),
      "Footer rendering uses the tighter apostrophe glyph and preserves the editable text",
    );
    await evaluate(`
      const titleField = field("Title", "input");
      titleField.value = "Devil's Melody";
      titleField.dispatchEvent(new Event("input", { bubbles: true }));
    `);
    assert(
      await evaluate(`headerLines[0].text === "Devil’s Melody" && field("Title", "input").value === "Devil's Melody"`),
      "Title rendering uses the tighter apostrophe glyph and preserves the editable text",
    );
    assert(
      await evaluate("headerLines.length === 2 && headerLines[0].x === 181 && headerLines[1].x === 182"),
      "A ribbon keeps the title and subtitle beside it",
    );
    await evaluate('setSelect("Ribbon banner", "None")');
    await frames();
    await saveScreenshot("ribbonless-left-mobile.png");
    await viewport(1280);
    await frames();
    await saveScreenshot("ribbonless-left-desktop.png");
    assert(
      await evaluate('headerLines.length === 2 && headerLines.every(line => line.align === "left" && line.x === 68)'),
      "Left aligns both ribbonless header lines to the same inset",
    );
    assert(await evaluate("pngMatchesPreview(saveCardPng())"), "The PNG includes the left-aligned ribbonless header");
    for (const alignment of ["balanced", "center", "pretty"]) {
      await evaluate(`setSelect("Text alignment", "${alignment}")`);
      assert(
        await evaluate('headerLines.length === 2 && headerLines.every(line => line.align === "center" && line.x === 336)'),
        `The ribbonless header stays centered with ${alignment} text`,
      );
    }
    await evaluate('setSelect("Main content background", "Paper"); setFooter("FirstSecond")');
    await evaluate(`
      const footerField = field("Footer text", "textarea");
      footerField.focus();
      footerField.setSelectionRange(5, 5);
    `);
    await key("Enter");
    assert(
      await evaluate(`footerTop() === 499 && footerLines.map(line => line.text).join("\\n") === "First\\nSecond"`),
      "Enter inserts a line break and grows the footer",
    );
    assert(await evaluate("pngMatchesPreview(saveCardPng())"), "The PNG preserves the footer’s manual line break");
    await evaluate('setFooter(Array(12).fill("X").join("\\n"))');
    assert(
      await evaluate(`document.querySelector("header button").disabled
        && document.querySelector(".status").textContent.includes("Shorten the footer text")`),
      "A footer with more lines than fit on the card shows a footer-specific error",
    );
    await evaluate('setFooter("")');
    assert(
      await evaluate('footerLines.length === 0 && !document.querySelector("header button").disabled'),
      "Clearing an oversized footer hides it and restores PNG export",
    );
    const cardTypes = await evaluate<string[]>('[...field("Card type", "select").options].map(option => option.value)');
    for (const [ribbon, alignment, titleX, subtitleX] of [
      ["Watcher", "balanced", 181, 182],
      ["None", "balanced", 336, 336],
      ["None", "left", 68, 68],
    ] as const) {
      for (const type of cardTypes) {
        await evaluate(`setSelect("Card type", ${JSON.stringify(type)})`);
        await evaluate(`setSelect("Ribbon banner", "${ribbon}"); setSelect("Text alignment", "${alignment}")`);
        assert(
          await evaluate(`headerLines.length === 2 && headerLines[0].x === ${titleX} && headerLines[0].y === 138
            && headerLines[1].x === ${subtitleX} && headerLines[1].y === 171`),
          `${type} uses the standard header positions with ${ribbon} and ${alignment} alignment`,
        );
      }
    }
  },
);
