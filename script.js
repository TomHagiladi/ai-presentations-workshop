/* ==========================================================
   אתר מלווה לסדנת מצגות - גרסה גנרית - סקריפט ראשי
   - ראוטר לפי hash (#/, #/outline, #/canvas, #/images, #/notebook)
   - מרנדר כל מסלול מתוך content.js
   - פרומפטים ניתנים לעריכה (textarea) + כפתור העתקה שקורא את הערך החי
   - מסלול ChatGPT: צעדים מקובצים ל-3 חלקים מודגשים בצבע (stepGroups)
   - מסנן רעיונות לפי "סוג השימוש" (ציר יחיד)
   - הודעות Toast
   ========================================================== */

(function () {
  "use strict";

  // -------- עוזרי DOM --------
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));
  const escapeHTML = (str) =>
    String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  // -------- Toast --------
  let toastTimer;
  function showToast(message) {
    const toast = $("#toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  // -------- כפתור העתקה (קורא את ה-textarea הסמוך בזמן הלחיצה) --------
  function copyButton(label) {
    return `
      <button type="button" class="prompt-box__copy" aria-label="העתק את הפרומפט">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16 1H4a2 2 0 00-2 2v14h2V3h12V1zm3 4H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2zm0 16H8V7h11v14z" fill="currentColor"/>
        </svg>
        <span>${escapeHTML(label || "העתק")}</span>
      </button>`;
  }

  // -------- שדה פרומפט ניתן לעריכה (textarea) + כפתור העתקה --------
  function promptField(text, opts) {
    opts = opts || {};
    const isIdea = opts.variant === "idea";
    const wrapClass = isIdea ? "idea__prompt-box" : "prompt-box";
    const labelClass = isIdea ? "idea__prompt-label" : "prompt-box__label";
    const textClass = isIdea ? "idea__prompt-text" : "prompt-box__text";
    const label =
      opts.label ||
      (isIdea ? "פרומפט לדוגמה - ניתן לעריכה" : "פרומפט לדוגמה - אפשר לערוך לפני ההעתקה");
    const lines = (String(text).match(/\n/g) || []).length + 1;
    const rows = Math.min(Math.max(lines, isIdea ? 4 : 3), isIdea ? 8 : 20);
    return `
      <div class="${wrapClass}">
        <div class="${labelClass}">
          <span>${escapeHTML(label)}</span>
          <span class="prompt-editable-hint" aria-hidden="true">✎ ניתן לעריכה</span>
        </div>
        <textarea class="${textClass}" rows="${rows}" spellcheck="false"
          aria-label="${escapeHTML(label)} - שדה טקסט הניתן לעריכה לפני העתקה">${escapeHTML(text)}</textarea>
        ${copyButton()}
      </div>`;
  }

  // -------- רינדור צעד בודד --------
  function stepLI(step) {
    const promptHTML = step.prompt
      ? promptField(step.prompt, { variant: "step", label: step.promptLabel })
      : "";
    const prompt2HTML = step.prompt2
      ? promptField(step.prompt2, { variant: "step", label: step.prompt2Label })
      : "";
    const scorecardHTML = step.scorecard ? scorecardWidget(step.scorecard) : "";
    const tipHTML = step.tip ? `<div class="tip">${step.tip}</div>` : "";
    return `
      <li class="step">
        <div class="step__num" aria-hidden="true"></div>
        <div class="step__body">
          <h3 class="step__title">${escapeHTML(step.title)}</h3>
          <div class="step__text">${step.text}</div>
          ${promptHTML}
          ${prompt2HTML}
          ${scorecardHTML}
          ${tipHTML}
        </div>
      </li>`;
  }

  // -------- טבלת השוואה בין מודלים (ניקוד 1-5 לכל קריטריון) --------
  // נשמרת בדפדפן של המשתתף/ת בלבד (localStorage), כדי שרענון לא ימחק את הניקוד.
  function scorecardWidget(card) {
    const models = card.models || [];
    const criteria = card.criteria || [];
    const options = ['<option value="">-</option>']
      .concat([1, 2, 3, 4, 5].map((n) => `<option value="${n}">${n}</option>`))
      .join("");
    const head = models
      .map((m) => `<th scope="col" lang="en" dir="ltr">${escapeHTML(m)}</th>`)
      .join("");
    const rows = criteria
      .map((c, ci) => {
        const cells = models
          .map(
            (m, mi) => `
            <td>
              <select class="scorecard__select" data-c="${ci}" data-m="${mi}"
                aria-label="${escapeHTML(c.title)} - ניקוד ל-${escapeHTML(m)}">${options}</select>
            </td>`
          )
          .join("");
        return `
          <tr>
            <th scope="row">
              <span class="scorecard__crit">${escapeHTML(c.title)}</span>
              ${c.hint ? `<span class="scorecard__hint">${escapeHTML(c.hint)}</span>` : ""}
            </th>
            ${cells}
          </tr>`;
      })
      .join("");
    const totals = models
      .map((m, mi) => `<td class="scorecard__total" data-total="${mi}">0</td>`)
      .join("");
    return `
      <div class="scorecard" data-scorecard data-models="${escapeHTML(JSON.stringify(models))}">
        <div class="scorecard__scroll" tabindex="0" role="region" aria-label="טבלת השוואה בין המודלים">
          <table class="scorecard__table">
            <caption class="sr-only">${escapeHTML(card.caption || "ניקוד המצגות של שלושת המודלים")}</caption>
            <thead><tr><th scope="col">מה בודקים</th>${head}</tr></thead>
            <tbody>${rows}</tbody>
            <tfoot><tr><th scope="row">סה״כ</th>${totals}</tr></tfoot>
          </table>
        </div>
        <div class="scorecard__footer">
          <p class="scorecard__verdict" aria-live="polite">${escapeHTML(card.emptyVerdict || "דרגו כל מצגת מ-1 עד 5 - והמנצח יופיע כאן.")}</p>
          <button type="button" class="scorecard__reset">איפוס הטבלה</button>
        </div>
      </div>`;
  }

  const SCORE_KEY = "ai-presentations-workshop:scorecard";

  function bindScorecard(root) {
    const selects = $$(".scorecard__select", root);
    if (!selects.length) return;
    const models = JSON.parse(root.dataset.models || "[]");

    // שחזור ניקוד שמור (אם הדפדפן מאפשר)
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SCORE_KEY) || "{}"); } catch (e) { saved = {}; }
    selects.forEach((s) => {
      const key = `${s.dataset.c}-${s.dataset.m}`;
      if (saved[key]) s.value = saved[key];
    });

    function update() {
      const totals = models.map(() => 0);
      const state = {};
      let filled = 0;
      selects.forEach((s) => {
        if (s.value) {
          totals[+s.dataset.m] += +s.value;
          state[`${s.dataset.c}-${s.dataset.m}`] = s.value;
          filled++;
        }
      });
      totals.forEach((t, i) => {
        const cell = root.querySelector(`[data-total="${i}"]`);
        if (cell) cell.textContent = t;
      });
      try { localStorage.setItem(SCORE_KEY, JSON.stringify(state)); } catch (e) { /* פרטי/חסום - לא נורא */ }

      const verdict = $(".scorecard__verdict", root);
      $$(".scorecard__total", root).forEach((c) => c.classList.remove("is-winner"));
      if (!filled) {
        verdict.textContent = "דרגו כל מצגת מ-1 עד 5 - והמנצח יופיע כאן.";
        return;
      }
      const best = Math.max(...totals);
      const winners = models.filter((m, i) => totals[i] === best);
      winners.forEach((m) => {
        const cell = root.querySelector(`[data-total="${models.indexOf(m)}"]`);
        if (cell) cell.classList.add("is-winner");
      });
      const done = filled === selects.length;
      const prefix = done ? "המנצח שלכם" : "כרגע מוביל";
      verdict.textContent =
        winners.length === 1
          ? `${prefix}: ${winners[0]} (${best} נקודות)`
          : `תיקו בין ${winners.join(" ו-")} (${best} נקודות כל אחד)`;
    }

    selects.forEach((s) => s.addEventListener("change", update));
    const reset = $(".scorecard__reset", root);
    if (reset) {
      reset.addEventListener("click", () => {
        selects.forEach((s) => (s.value = ""));
        update();
        showToast("הטבלה אופסה.");
      });
    }
    update();
  }

  // -------- רינדור צעדים: מקובצים (stepGroups) או שטוחים (steps) --------
  function renderStepsHTML(data) {
    if (Array.isArray(data.stepGroups) && data.stepGroups.length) {
      let offset = 0;
      const groups = data.stepGroups
        .map((g) => {
          const steps = g.steps || [];
          const inner = steps.map(stepLI).join("");
          const noteHTML = g.note
            ? `<p class="steps-group__note">${g.note}</p>`
            : "";
          const html = `
            <section class="steps-group steps-group--${g.accent || "setup"}" aria-label="${escapeHTML(g.label || "")}">
              <header class="steps-group__head">
                <span class="steps-group__label">${escapeHTML(g.label || "")}</span>
                ${noteHTML}
              </header>
              <ol class="steps" style="counter-reset: steps ${offset}">${inner}</ol>
            </section>`;
          offset += steps.length;
          return html;
        })
        .join("");
      return `<div class="steps-grouped">${groups}</div>`;
    }
    const steps = data.steps || [];
    return steps.length ? `<ol class="steps">${steps.map(stepLI).join("")}</ol>` : "";
  }

  // -------- רינדור מסלול --------
  function renderTrack(routeKey, data) {
    const section = document.querySelector(`.route[data-route="/${routeKey}"]`);
    if (!section || !data || section.dataset.rendered === "true") return;

    const metaPills = (data.meta || [])
      .map(
        (m) =>
          `<span class="meta-pill ${m.accent ? "meta-pill--accent" : ""}">${escapeHTML(m.text)}</span>`
      )
      .join("");

    const facts = ((data.intro && data.intro.facts) || [])
      .map(
        (f) => `
        <div class="fact">
          <div class="fact__label">${escapeHTML(f.label)}</div>
          <div class="fact__value">${escapeHTML(f.value)}</div>
        </div>`
      )
      .join("");

    const introParagraphs = ((data.intro && data.intro.paragraphs) || [])
      .map((p) => `<p>${p}</p>`)
      .join("");

    const stepsHTML = renderStepsHTML(data);
    const hasSteps = (data.steps && data.steps.length) || (data.stepGroups && data.stepGroups.length);

    // ----- רעיונות + מסנן "סוג השימוש" (ציר יחיד) -----
    const ideas = data.ideas || [];
    const useCases = [...new Set(ideas.map((i) => i.useCase).filter(Boolean))];
    const showFilters = useCases.length > 1;

    const filtersHTML = showFilters
      ? `
      <div class="filters" role="group" aria-label="סינון לפי סוג השימוש">
        <span class="filters__label">סוג השימוש:</span>
        <button class="filter-chip is-active" data-value="all" type="button">הכול</button>
        ${useCases
          .map(
            (u) =>
              `<button class="filter-chip" data-value="${escapeHTML(u)}" type="button">${escapeHTML(u)}</button>`
          )
          .join("")}
      </div>`
      : "";

    const ideasHTML = ideas
      .map((idea) => {
        const tag = idea.useCase
          ? `<div class="idea__tags"><span class="idea__tag idea__tag--use">${escapeHTML(idea.useCase)}</span></div>`
          : "";
        return `
        <article class="idea" data-usecase="${escapeHTML(idea.useCase || "")}">
          ${tag}
          <h3 class="idea__title">${escapeHTML(idea.title)}</h3>
          <p class="idea__desc">${escapeHTML(idea.desc)}</p>
          ${promptField(idea.prompt, { variant: "idea", label: idea.promptLabel })}
        </article>`;
      })
      .join("");

    const sources = data.sources || [];
    const sourcesHTML = sources
      .map(
        (src) => `
        <a class="source-link" href="${src.url}" target="_blank" rel="noopener">
          <span>${escapeHTML(src.title)}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3z M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7z" fill="currentColor"/>
          </svg>
        </a>`
      )
      .join("");

    const moeBlock =
      data.moeNote && typeof MOE_GEMINI_NOTE !== "undefined"
        ? `
        <details class="moe-note">
          <summary class="moe-note__summary">
            <span class="moe-note__icon" aria-hidden="true">🔑</span>
            <span>
              <strong>${escapeHTML(MOE_GEMINI_NOTE.title)}</strong>
              <span class="moe-note__sub">${escapeHTML(MOE_GEMINI_NOTE.summary)}</span>
            </span>
            <span class="moe-note__chev" aria-hidden="true">▾</span>
          </summary>
          <div class="moe-note__body">${MOE_GEMINI_NOTE.body}</div>
        </details>`
        : "";

    // ----- הרכבת מקטעים עם מספור דינמי -----
    const blocks = [];
    blocks.push({
      title: data.introTitle || "מה זה בכלל?",
      id: `intro-${routeKey}`,
      body: `<div class="prose">${introParagraphs}</div>${facts ? `<div class="facts-grid">${facts}</div>` : ""}`,
    });
    if (hasSteps) {
      blocks.push({
        title: data.stepsTitle || "צעד אחר צעד - מתחילים",
        id: `steps-${routeKey}`,
        body: stepsHTML,
      });
    }
    if (ideas.length) {
      blocks.push({
        title: data.ideasTitle || "רעיונות ופרומפטים מוכנים",
        id: `ideas-${routeKey}`,
        body: `${filtersHTML}<div class="ideas">${ideasHTML}<div class="no-results" hidden>אין פריטים שמתאימים לסינון. נסו לבחור הכול.</div></div>`,
      });
    }
    if (sources.length) {
      blocks.push({
        title: data.sourcesTitle || "מקורות והעמקה",
        id: `sources-${routeKey}`,
        body: `<div class="sources">${sourcesHTML}</div>`,
      });
    }

    const blocksHTML = blocks
      .map(
        (b, i) => `
      <section class="section-block" aria-labelledby="${b.id}">
        <header class="section-head">
          <span class="section-head__num">${String(i + 1).padStart(2, "0")}</span>
          <h2 class="section-head__title" id="${b.id}">${escapeHTML(b.title)}</h2>
        </header>
        ${b.body}
      </section>`
      )
      .join("");

    section.innerHTML = `
      <header class="track-header">
        <a href="#/" class="track-back">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>חזרה לבחירת מסלול</span>
        </a>
        <div class="track-eyebrow">${escapeHTML(data.eyebrow || "")}</div>
        <h1 class="track-title">
          ${escapeHTML(data.title)}
          <span class="track-title__sub">${escapeHTML(data.subtitle || "")}</span>
        </h1>
        <div class="track-meta">${metaPills}</div>
      </header>

      ${moeBlock}

      ${blocksHTML}

      <div class="track-footer">
        <h3 class="track-footer__title">${escapeHTML(data.footerTitle || "סיימתם? יופי. רוצים לחקור עוד?")}</h3>
        <p class="track-footer__sub">${escapeHTML(data.footerSub || "חזרו לבחור מסלול אחר. כל מסלול עצמאי לחלוטין.")}</p>
        <a href="#/" class="track-footer__cta">
          <span>חזרה לבחירת מסלול</span>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </a>
      </div>
    `;

    section.dataset.rendered = "true";
    bindTrackInteractions(section);
  }

  // -------- אינטראקציות לכל מסלול (אחרי רינדור) --------
  function bindTrackInteractions(section) {
    // התאמת גובה בזמן הקלדה (הגדילה הראשונית נעשית ב-growAllPrompts אחרי שהמסלול מוצג)
    $$(".prompt-box__text", section).forEach((ta) => {
      ta.addEventListener("input", () => autoGrow(ta));
    });

    // כפתורי העתקה - קוראים את הערך החי (אחרי עריכה) מה-textarea הסמוך
    $$(".prompt-box__copy", section).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const box = btn.closest(".prompt-box, .idea__prompt-box");
        const field = box ? box.querySelector(".prompt-box__text, .idea__prompt-text") : null;
        const text = field ? field.value : "";
        try {
          await navigator.clipboard.writeText(text);
          btn.classList.add("is-copied");
          const labelEl = btn.querySelector("span");
          const original = labelEl.textContent;
          labelEl.textContent = "הועתק!";
          showToast("הטקסט הועתק. עכשיו הדביקו אותו בכלי.");
          setTimeout(() => {
            btn.classList.remove("is-copied");
            labelEl.textContent = original;
          }, 1800);
        } catch (err) {
          // גיבוי: בחירת הטקסט בשדה כדי שאפשר יהיה להעתיק ידנית
          if (field && field.select) field.select();
          showToast("לא הצלחתי להעתיק אוטומטית. הטקסט מסומן - העתיקו עם Ctrl+C.");
        }
      });
    });

    // טבלת השוואה (אם יש במסלול)
    $$("[data-scorecard]", section).forEach(bindScorecard);

    // מסנן ציר יחיד
    const state = { useCase: "all" };
    $$(".filter-chip", section).forEach((chip) => {
      chip.addEventListener("click", () => {
        chip.parentElement
          .querySelectorAll(".filter-chip")
          .forEach((c) => c.classList.remove("is-active"));
        chip.classList.add("is-active");
        state.useCase = chip.dataset.value;
        applyFilters(section, state);
      });
    });
  }

  // התאמת גובה textarea לתוכן
  function autoGrow(ta) {
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight + 2, 640) + "px";
  }
  // גדילת כל תיבות הפרומפט הגלויות (רק גלויות - בתיבה מוסתרת scrollHeight=0)
  function growAllPrompts() {
    $$(".prompt-box__text").forEach((ta) => {
      if (ta.offsetParent !== null) autoGrow(ta);
    });
  }

  function applyFilters(section, state) {
    const ideas = $$(".idea", section);
    let visibleCount = 0;
    ideas.forEach((idea) => {
      const match = state.useCase === "all" || idea.dataset.usecase === state.useCase;
      idea.style.display = match ? "" : "none";
      if (match) visibleCount++;
    });
    const noResults = $(".no-results", section);
    if (noResults) noResults.hidden = visibleCount > 0;
  }

  // -------- ראוטר --------
  const ROUTES = ["outline", "canvas", "images", "notebook", "html"];

  function renderRoute() {
    let route = (location.hash || "#/").replace(/^#/, "");
    if (!route || route === "/") route = "/";

    // רינדור עצל בכניסה ראשונה
    ROUTES.forEach((key) => {
      if (route === "/" + key && typeof TRACKS !== "undefined") {
        renderTrack(key, TRACKS[key]);
      }
    });

    // הצגה/הסתרה
    $$(".route").forEach((el) => {
      const isMatch = el.dataset.route === route;
      el.hidden = !isMatch;
      el.classList.toggle("is-visible", isMatch);
    });

    // גדילת תיבות הפרומפט של המסלול שהוצג (כעת הן גלויות ו-scrollHeight תקין)
    requestAnimationFrame(growAllPrompts);

    // ניווט פעיל
    $$(".nav-link").forEach((link) => {
      const active = link.dataset.route === route;
      link.classList.toggle("is-active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    // גלילה למעלה (רק במעבר, לא בטעינה ראשונה)
    if (window.__appBooted) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // כותרת המסמך
    const titleMap = {
      "/": "סדנת מצגות עם AI",
      "/outline": "מסמך המתווה · סדנת מצגות",
      "/canvas": "Gemini Canvas · סדנת מצגות",
      "/images": "ChatGPT Images · סדנת מצגות",
      "/notebook": "Gemini Notebook · סדנת מצגות",
      "/html": "מצגת HTML · סדנת מצגות",
    };
    document.title = titleMap[route] || titleMap["/"];
  }

  // -------- Boot --------
  window.addEventListener("hashchange", renderRoute);
  document.addEventListener("DOMContentLoaded", () => {
    renderRoute();
    window.__appBooted = true;
  });
  // גדילה מחדש אחרי טעינת הגופנים (משנים גובה טקסט) ובשינוי רוחב החלון
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(growAllPrompts);
  }
  let rzTimer;
  window.addEventListener("resize", () => {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(growAllPrompts, 120);
  });
})();
