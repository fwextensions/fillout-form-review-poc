/* eslint-disable @typescript-eslint/no-explicit-any */

export interface FeedbackItem {
  id: number;
  severity: "required" | "recommended" | "consider";
  title: string;
  message: string;
  location: string | null;
  category: string;
  helpful: boolean | null;
}

interface Widget {
  type: string;
  name?: string;
  template?: any;
  position?: any;
  stepId: string;
  stepName: string;
  widgetId: string;
}

export class FormReviewer {
  feedbackItems: FeedbackItem[] = [];
  allWidgets: Widget[] = [];
  steps: Record<string, any> = {};

  review(formJson: any): FeedbackItem[] {
    this.feedbackItems = [];

    try {
      const form = typeof formJson === "string" ? JSON.parse(formJson) : formJson;
      this.allWidgets = this.extractAllWidgets(form);
      this.steps = form.template?.steps || {};

      this.checkThemeAndVisual(form);
      this.checkPageStructure(form);
      this.checkHeadingsAndTypography(form);
      this.checkLabelsAndLanguage(form);
      this.checkQuestionDesign(form);
      this.checkInputTypes(form);
      this.checkHelpTextAndErrors(form);

      return this.feedbackItems;
    } catch (error: any) {
      this.addFeedback("required", "Invalid JSON", `Unable to parse form JSON: ${error.message}`);
      return this.feedbackItems;
    }
  }

  private extractAllWidgets(form: any): Widget[] {
    const widgets: Widget[] = [];
    const steps = form.template?.steps || {};
    Object.entries(steps).forEach(([stepId, step]: [string, any]) => {
      const stepWidgets = step.template?.widgets || {};
      Object.entries(stepWidgets).forEach(([widgetId, widget]: [string, any]) => {
        widgets.push({ ...widget, stepId, stepName: step.name, widgetId });
      });
    });
    return widgets;
  }

  private getLabel(widget: Widget): string {
    return (
      widget.template?.label?.logic?.value ||
      widget.template?.contents?.logic?.value ||
      widget.template?.title?.logic?.value ||
      widget.name ||
      ""
    );
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
  }

  private static readonly COMMON_WORDS = new Set([
    "about", "above", "accept", "account", "action", "activity", "actually", "add",
    "address", "after", "again", "against", "age", "agency", "agree", "agreement",
    "ahead", "allow", "almost", "along", "already", "also", "always", "amount",
    "and", "annual", "another", "answer", "any", "anyone", "anything", "apply",
    "application", "appointment", "area", "around", "ask", "assistance", "available",
    "back", "based", "because", "become", "been", "before", "begin", "below",
    "benefit", "benefits", "best", "between", "birth", "both", "building", "business",
    "call", "came", "case", "center", "change", "check", "child", "children", "choice",
    "choose", "city", "claim", "clear", "close", "code", "come", "comment", "community",
    "company", "complete", "condition", "confirm", "confirmation", "connect", "contact",
    "continue", "control", "copy", "cost", "could", "country", "county", "course",
    "court", "create", "current", "customer", "daily", "data", "date", "days",
    "deadline", "decision", "department", "describe", "description", "detail", "details",
    "different", "digital", "direct", "disability", "document", "documents", "does",
    "done", "down", "during", "each", "education", "either", "eligibility", "eligible",
    "email", "emergency", "employee", "employment", "end", "english", "enough", "enter",
    "entry", "error", "even", "event", "events", "every", "everyone", "everything",
    "example", "experience", "explain", "family", "federal", "feedback", "field",
    "file", "fill", "final", "financial", "find", "first", "follow", "following",
    "food", "form", "format", "found", "free", "from", "full", "fund", "funding",
    "general", "give", "given", "good", "government", "grant", "great", "group",
    "guide", "half", "hand", "happen", "have", "health", "hear", "help", "here",
    "high", "history", "hold", "home", "hospital", "hour", "hours", "house",
    "household", "housing", "however", "human", "important", "include", "income",
    "individual", "information", "initial", "input", "insurance", "interest",
    "into", "issue", "item", "items", "just", "keep", "kind", "know", "language",
    "last", "late", "later", "least", "leave", "legal", "less", "letter", "level",
    "license", "life", "like", "line", "list", "live", "living", "local", "location",
    "long", "look", "made", "mail", "main", "major", "make", "many", "material",
    "materials", "matter", "medical", "meet", "meeting", "member", "message",
    "method", "middle", "might", "military", "minor", "minute", "missing", "money",
    "month", "monthly", "more", "most", "move", "much", "must", "name", "national",
    "nature", "near", "need", "never", "new", "next", "none", "note", "notice",
    "number", "office", "official", "often", "once", "only", "open", "option",
    "options", "order", "organization", "original", "other", "otherwise", "over",
    "overview", "owner", "page", "paid", "part", "participant", "particular",
    "party", "past", "payment", "people", "percent", "period", "permit", "person",
    "personal", "phone", "place", "plan", "please", "point", "policy", "position",
    "possible", "post", "power", "present", "previous", "primary", "print", "prior",
    "private", "problem", "process", "program", "project", "property", "provide",
    "provider", "public", "purpose", "question", "questions", "race", "rate", "read",
    "reason", "receive", "record", "reference", "regarding", "register", "registration",
    "related", "release", "remaining", "remove", "renewal", "rent", "report",
    "request", "require", "required", "requirement", "resident", "resource",
    "resources", "response", "result", "return", "review", "right", "role", "room",
    "rule", "safe", "safety", "same", "save", "schedule", "school", "search",
    "section", "security", "select", "send", "senior", "service", "services",
    "session", "several", "shall", "share", "short", "should", "show", "sign",
    "signature", "similar", "simple", "since", "single", "site", "situation", "size",
    "small", "social", "some", "someone", "something", "source", "space", "special",
    "specific", "staff", "standard", "start", "state", "statement", "status", "stay",
    "step", "still", "stop", "street", "student", "subject", "submit", "such",
    "summary", "support", "sure", "system", "take", "team", "tell", "term", "test",
    "text", "than", "thank", "that", "their", "them", "then", "there", "these",
    "they", "thing", "think", "this", "those", "through", "time", "title", "today",
    "together", "total", "training", "transfer", "travel", "true", "turn", "type",
    "under", "understand", "unit", "until", "update", "upon", "upload", "used",
    "user", "using", "valid", "value", "verify", "very", "view", "visit", "wage",
    "wait", "want", "water", "week", "weekly", "welcome", "well", "were", "what",
    "when", "where", "which", "while", "will", "with", "within", "without", "word",
    "work", "worker", "would", "write", "written", "year", "years", "your", "youth",
    "zone",
  ]);

  private isCommonWord(word: string): boolean {
    return FormReviewer.COMMON_WORDS.has(word.toLowerCase());
  }

  private addFeedback(
    severity: FeedbackItem["severity"],
    title: string,
    message: string,
    location: string | null = null,
    category = "General"
  ) {
    this.feedbackItems.push({
      id: Date.now() + Math.random(),
      severity,
      title,
      message,
      location,
      category,
      helpful: null,
    });
  }

  private checkThemeAndVisual(form: any) {
    const theme = form.template?.theme;
    if (theme && theme.name && !theme.name.includes("SF.gov")) {
      this.addFeedback(
        "required",
        "Not using sf.gov theme",
        `Form uses "${theme.name}" theme. Switch to "SF.gov Theme (Use me!)" in form settings.`,
        null,
        "Theme & Visual Design"
      );
    }

    this.allWidgets.forEach((widget) => {
      const label = this.getLabel(widget);
      const cleanLabel = this.stripHtml(label);
      if (["Button", "Divider"].includes(widget.type)) return;

      if (
        (label.includes("<strong>") || label.includes("<b>")) &&
        widget.type !== "Text" &&
        widget.type !== "Paragraph"
      ) {
        if (cleanLabel.length > 0) {
          this.addFeedback(
            "recommended",
            "Bold question text",
            `"${cleanLabel}" uses bold formatting. Remove bold to match sf.gov theme.`,
            `${widget.stepName} - ${widget.type}`,
            "Theme & Visual Design"
          );
        }
      }

      if (label.includes('style="color:') || label.includes('style=\\"color:')) {
        const colorMatch = label.match(/color:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (colorMatch && cleanLabel.length > 0) {
          const [, r, g, b] = colorMatch;
          if (!(Number(r) < 50 && Number(g) < 50 && Number(b) < 50)) {
            this.addFeedback(
              "required",
              "Custom font color",
              `"${cleanLabel}" uses custom color (rgb(${r}, ${g}, ${b})). Use default text colors from sf.gov theme.`,
              `${widget.stepName} - ${widget.type}`,
              "Theme & Visual Design"
            );
          }
        }
      }
    });
  }

  private checkPageStructure(form: any) {
    const formSteps = Object.values(this.steps).filter((s: any) => s.type === "form");
    const endingSteps = Object.values(this.steps).filter((s: any) => s.type === "ending");

    const inputWidgets = this.allWidgets.filter(
      (w) => !["Text", "Paragraph", "Divider", "Button", "Alert"].includes(w.type)
    );

    if (inputWidgets.length > 15 && formSteps.length <= 1) {
      this.addFeedback(
        "recommended",
        "Long form without pages",
        `Form has ${inputWidgets.length} input fields on a single page. Break into multiple pages (10-15 questions each) to reduce cognitive load and improve completion rates.`,
        null,
        "Page Structure"
      );
    }

    if (formSteps.length > 1) {
      // Use the template's firstStep to find the actual first page
      const firstStepId = form.template?.firstStep;
      const firstStep: any = firstStepId ? this.steps[firstStepId] : formSteps[0];
      const firstStepWidgets = Object.values(firstStep?.template?.widgets || {}) as any[];
      const hasIntroText = firstStepWidgets.some(
        (w) => (w.type === "Paragraph" || w.type === "Text") && this.getLabel(w).length > 100
      );

      if (!hasIntroText) {
        this.addFeedback(
          "required",
          "Add intro page",
          `Multi-page form should start with an intro page explaining: (1) Purpose of the form, (2) Required documents, (3) Estimated time to complete (e.g., "Takes about 10 minutes").`,
          firstStep.name,
          "Page Structure"
        );
      }

      formSteps.forEach((step: any, index: number) => {
        if (!step.name || step.name.includes("Untitled") || step.name === "Page" || /^Page \d+$/.test(step.name)) {
          this.addFeedback(
            "consider",
            "Generic page name",
            `Page ${index + 1} has generic name "${step.name}". Use descriptive names like "About you", "Contact information", "Income and household".`,
            step.name,
            "Page Structure"
          );
        }
      });

      // Check for a review page before submission
      const stepNames = formSteps.map((s: any) => (s.name || "").toLowerCase());
      const hasReviewPage = stepNames.some((name: string) =>
        /review|summary|confirm|verify/.test(name)
      );
      if (!hasReviewPage) {
        this.addFeedback(
          "recommended",
          "Missing review page",
          `Multi-page form should include a review page before submission so users can verify their answers.`,
          null,
          "Page Structure"
        );
      }
    }

    if (endingSteps.length > 0) {
      const endingStep: any = endingSteps[0];
      const thankYouWidget = (Object.values(endingStep.template?.widgets || {}) as any[]).find(
        (w) => w.type === "ThankYou"
      );

      if (thankYouWidget) {
        const subtitle = thankYouWidget.template?.richSubtitleText?.logic?.value || "";
        const subtitleText = this.stripHtml(subtitle);

        if (subtitleText.includes("Made with Fillout")) {
          this.addFeedback(
            "required",
            "Default confirmation message",
            `Confirmation page uses default Fillout message. Replace with: (1) What happens next, (2) When to expect a response, (3) Who to contact with questions.`,
            endingStep.name,
            "Page Structure"
          );
        } else if (subtitleText.length < 30) {
          this.addFeedback(
            "required",
            "Incomplete confirmation page",
            `Confirmation page message is very brief. Include: (1) What happens next, (2) Timeline for response, (3) Contact information for questions.`,
            endingStep.name,
            "Page Structure"
          );
        } else {
          const hasTimeline = /within|by|in \d+|days|weeks|business days|will contact|expect.*response/i.test(subtitleText);
          const hasContactInfo = /@|phone|call|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/i.test(subtitleText);
          const missingElements: string[] = [];
          if (!hasTimeline) missingElements.push('timeline for response (e.g., "within one week", "in 5 business days")');
          if (!hasContactInfo) missingElements.push("contact information (email address or phone number for questions)");
          if (missingElements.length > 0) {
            this.addFeedback(
              "required",
              "Improve confirmation page",
              `Confirmation page could be clearer. Consider adding: ${missingElements.join("; ")}.`,
              endingStep.name,
              "Page Structure"
            );
          }
        }
      }
    }
  }

  private checkHeadingsAndTypography(_form: any) {
    const headingsByStep: Record<string, any> = {};

    this.allWidgets.forEach((widget) => {
      const label = this.getLabel(widget);
      const cleanLabel = this.stripHtml(label);
      if (!cleanLabel) return;

      const words = cleanLabel.split(/\s+/);
      const allCapsWords = words.filter(
        (word) =>
          word.length > 3 &&
          word === word.toUpperCase() &&
          /^[A-Z]+$/.test(word) &&
          this.isCommonWord(word)
      );

      if (allCapsWords.length > 0) {
        const sentenceCaseVersion = allCapsWords
          .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
          .join(", ");
        this.addFeedback(
        "required",
        "All caps text",
          `"${cleanLabel}" uses all caps (${allCapsWords.join(", ")}). Use sentence case: "${sentenceCaseVersion}".`,
          `${widget.stepName} - ${widget.type}`,
          "Headings & Typography"
        );
      }

      if (widget.type === "Text" || widget.type === "Paragraph") {
        if (!headingsByStep[widget.stepName]) {
          headingsByStep[widget.stepName] = { hasH1: false, hasH2: false, hasH3: false, hasH4: false, h1Count: 0 };
        }
        const sh = headingsByStep[widget.stepName];
        sh.hasH1 = sh.hasH1 || label.includes("<h1>");
        sh.hasH2 = sh.hasH2 || label.includes("<h2>");
        sh.hasH3 = sh.hasH3 || label.includes("<h3>");
        sh.hasH4 = sh.hasH4 || label.includes("<h4>");
        sh.h1Count += (label.match(/<h1>/g) || []).length;
      }
    });

    Object.entries(headingsByStep).forEach(([stepName, h]) => {
      if (h.h1Count > 1)
        this.addFeedback("recommended", "Multiple h1 headings", `Page "${stepName}" has ${h.h1Count} h1 headings. Use only one h1 per page.`, stepName, "Headings & Typography");
      if (!h.hasH1 && (h.hasH2 || h.hasH3 || h.hasH4))
        this.addFeedback("recommended", "Missing h1 heading", `Page "${stepName}" has subheadings but no h1. Add an h1 as the main page heading.`, stepName, "Headings & Typography");
      if (h.hasH3 && !h.hasH2)
        this.addFeedback("recommended", "Skipped heading level", `Page "${stepName}" uses h3 without h2. Use proper hierarchy: h1 → h2 → h3.`, stepName, "Headings & Typography");
      if (h.hasH4 && !h.hasH3)
        this.addFeedback("recommended", "Skipped heading level", `Page "${stepName}" uses h4 without h3. Use proper hierarchy: h1 → h2 → h3 → h4.`, stepName, "Headings & Typography");
    });
  }

  private checkLabelsAndLanguage(form: any) {
    this.allWidgets.forEach((widget) => {
      const label = this.getLabel(widget);
      const cleanLabel = this.stripHtml(label);
      if (!cleanLabel || ["Text", "Paragraph", "Button", "Divider", "Alert"].includes(widget.type)) return;

      const verbosePatterns = [
        { pattern: /^what is your (.+)\??$/i, suggestion: (m: RegExpMatchArray) => m[1].charAt(0).toUpperCase() + m[1].slice(1) },
        { pattern: /^please enter (?:your )?(.+)\??$/i, suggestion: (m: RegExpMatchArray) => m[1].charAt(0).toUpperCase() + m[1].slice(1) },
        { pattern: /^please provide (?:your )?(.+)\??$/i, suggestion: (m: RegExpMatchArray) => m[1].charAt(0).toUpperCase() + m[1].slice(1) },
        { pattern: /^please select (?:your )?(.+)\??$/i, suggestion: (m: RegExpMatchArray) => m[1].charAt(0).toUpperCase() + m[1].slice(1) },
        { pattern: /^your (.+)$/i, suggestion: (m: RegExpMatchArray) => m[1].charAt(0).toUpperCase() + m[1].slice(1) },
      ];

      for (const { pattern, suggestion } of verbosePatterns) {
        const match = cleanLabel.match(pattern);
        if (match) {
          this.addFeedback("recommended", "Verbose label", `"${cleanLabel}" is too wordy. Simplify to: "${suggestion(match)}"`, `${widget.stepName} - ${widget.type}`, "Labels & Language");
          break;
        }
      }

      const acronyms = cleanLabel.match(/\b[A-Z]{2,}\b/g) || [];
      const allowedAcronyms = ["PDF", "ID", "URL", "API", "US", "SF", "DOB", "SSN", "HIV", "MOHCD", "BAN", "OK"];
      const problematicAcronyms = acronyms.filter((acronym) => {
        if (allowedAcronyms.includes(acronym)) return false;
        if (acronym.length >= 2 && acronym.length <= 5) {
          const commonWords = ["AM", "PM", "OR", "AND", "THE", "FOR", "NOT", "BUT", "CAN", "MAY", "YES", "NO"];
          if (commonWords.includes(acronym)) return false;
          return true;
        }
        const vowelCount = (acronym.match(/[AEIOU]/g) || []).length;
        return vowelCount / acronym.length < 0.3 && acronym.length - vowelCount >= 3;
      });

      if (problematicAcronyms.length > 0) {
        // Filter out acronyms that are being explained in the same label, e.g. "Department of Police Accountability (DPA)"
        const unexplainedAcronyms = problematicAcronyms.filter((acronym) => {
          const pattern = new RegExp(`\\(${acronym}\\)`, "i");
          return !pattern.test(cleanLabel);
        });

        if (unexplainedAcronyms.length > 0) {
          this.addFeedback("recommended", "Unexplained acronym", `"${cleanLabel}" uses "${unexplainedAcronyms.join(", ")}". Write out the full term on first use, then use the acronym.`, `${widget.stepName} - ${widget.type}`, "Labels & Language");
        }
      }

      const wordCount = cleanLabel.split(/\s+/).length;
      const longWords = cleanLabel.split(/\s+/).filter((w) => w.length > 12).length;
      if (wordCount > 20 && longWords > 3) {
        this.addFeedback("consider", "Complex language", `"${cleanLabel}" may be too complex. Aim for 5th-8th grade reading level.`, `${widget.stepName} - ${widget.type}`, "Labels & Language");
      }
    });

    const settings = form.settings || form.template?.settings || {};
    const translationsEnabled = settings.translationsEnabled;
    const availableTranslations = settings.availableTranslations || [];

    if (settings && Object.keys(settings).length > 0) {
      if (!translationsEnabled) {
        this.addFeedback("required", "Translations not enabled", "Enable machine translation in form settings for: Traditional Chinese (zh-CHT), Spanish (es), Vietnamese (vi), Filipino (fil)", null, "Labels & Language");
      } else {
        const requiredLanguages: Record<string, string> = { "zh-CHT": "Traditional Chinese", es: "Spanish", vi: "Vietnamese", fil: "Filipino" };
        const missingLanguages: string[] = [];
        Object.entries(requiredLanguages).forEach(([code, name]) => {
          if (!availableTranslations.includes(code)) missingLanguages.push(`${name} (${code})`);
        });
        if (missingLanguages.length > 0) {
          this.addFeedback("required", "Missing required translations", `Add these languages to machine translation: ${missingLanguages.join(", ")}`, null, "Labels & Language");
        }
      }
    }
  }

  private checkQuestionDesign(_form: any) {
    this.allWidgets.forEach((widget) => {
      const label = this.getLabel(widget);
      const cleanLabel = this.stripHtml(label);
      if (!cleanLabel || ["Text", "Paragraph", "Button", "Divider", "Alert"].includes(widget.type)) return;

      const questionMarks = (cleanLabel.match(/\?/g) || []).length;
      if (questionMarks > 1) {
        this.addFeedback("required", "Multiple questions", `"${cleanLabel}" asks multiple questions. Split into separate questions - one per field.`, `${widget.stepName} - ${widget.type}`, "Question Design");
      }

      if (cleanLabel.includes("?")) {
        const beforeQuestion = cleanLabel.substring(0, cleanLabel.indexOf("?"));
        const andCount = (beforeQuestion.toLowerCase().match(/ and /g) || []).length;
        if (andCount > 1 || /will you .+ and .+\?/i.test(cleanLabel) || /do you .+ and .+\?/i.test(cleanLabel)) {
          this.addFeedback("required", "Possible double-barrelled question", `"${cleanLabel}" may ask multiple things. Split into separate questions.`, `${widget.stepName} - ${widget.type}`, "Question Design");
        }
      }

      const hasConditionalLogic =
        widget.template?.showOrHideCondition?.logic?.and?.length > 0 ||
        widget.template?.showOrHideCondition?.logic?.or?.length > 0;

      if (!hasConditionalLogic) {
        if (/\(if applicable\)|\(if yes\)|\(optional\)/i.test(cleanLabel)) {
          this.addFeedback("consider", "Consider conditional logic", `"${cleanLabel}" includes conditional text. Use conditional logic to show/hide this question based on previous answers.`, `${widget.stepName} - ${widget.type}`, "Question Design");
        }
      }

      const isPersonalQuestion = /social security|ssn|income|salary|medical|health condition|disability|criminal|arrest/i.test(cleanLabel);
      if (isPersonalQuestion && widget.position?.row < 5) {
        this.addFeedback("consider", "Personal question placement", `"${cleanLabel}" asks for sensitive information early in the form. Consider moving personal questions later.`, `${widget.stepName} - ${widget.type}`, "Question Design");
      }
    });
  }

  private checkInputTypes(_form: any) {
    this.allWidgets.forEach((widget) => {
      const label = this.getLabel(widget);
      const cleanLabel = this.stripHtml(label);

      if (widget.type === "Dropdown") {
        const options = widget.template?.options?.staticOptions || [];
        if (options.length <= 10 && options.length > 0) {
          this.addFeedback("recommended", "Consider radio buttons", `"${cleanLabel}" uses dropdown with ${options.length} options. Radio buttons are better for ≤10 options.`, `${widget.stepName} - ${widget.type}`, "Input Types");
        }
        if (options.length > 50 && !widget.template?.placeholder?.logic?.value) {
          this.addFeedback("consider", "Add search hint", `"${cleanLabel}" has ${options.length} options. Add placeholder text like "Start typing to search...".`, `${widget.stepName} - ${widget.type}`, "Input Types");
        }
      }

      if (widget.type === "MultipleChoice" || widget.type === "Checkboxes") {
        const isRequired = widget.template?.required?.logic === true;
        const options = widget.template?.options?.staticOptions || [];
        const hasOther = options.some((opt: any) =>
          /other|don't know|not sure|decline|not listed|none of the above|prefer not to answer/i.test(this.stripHtml(opt.label?.logic?.value || ""))
        );
        const showOtherChoice = widget.template?.showOtherChoice;
        if (isRequired && !hasOther && !showOtherChoice && options.length > 0) {
          const needsOther = options.length < 20 && !cleanLabel.toLowerCase().includes("yes") && !cleanLabel.toLowerCase().includes("no");
          if (needsOther) {
            this.addFeedback("recommended", 'Consider "Other" option', `Required question "${cleanLabel}" should offer "Other", "I don't know", or "Prefer not to answer".`, `${widget.stepName} - ${widget.type}`, "Input Types");
          }
        }
      }

      if (widget.type === "Captcha") {
        this.addFeedback("required", "reCAPTCHA detected", "Remove reCAPTCHA. It creates accessibility barriers and is not allowed in sf.gov forms.", `${widget.stepName} - ${widget.type}`, "Input Types");
      }

      if (widget.type === "ShortAnswer" || widget.type === "LongAnswer") {
        if (/email/i.test(cleanLabel)) this.addFeedback("recommended", "Use email field type", `"${cleanLabel}" asks for email. Use EmailInput field type for better validation and mobile keyboard.`, `${widget.stepName} - ${widget.type}`, "Input Types");
        if (/phone|telephone/i.test(cleanLabel)) this.addFeedback("recommended", "Use phone field type", `"${cleanLabel}" asks for phone number. Use PhoneNumber field type.`, `${widget.stepName} - ${widget.type}`, "Input Types");
        if (/address|street/i.test(cleanLabel)) this.addFeedback("recommended", "Use address field type", `"${cleanLabel}" asks for address. Use Address field type for structured data and autocomplete.`, `${widget.stepName} - ${widget.type}`, "Input Types");
      }
    });
  }

  private checkHelpTextAndErrors(_form: any) {
    this.allWidgets.forEach((widget) => {
      const label = this.getLabel(widget);
      const cleanLabel = this.stripHtml(label);
      const placeholder = widget.template?.placeholder?.logic?.value || "";

      if (placeholder.length > 30 && !["MM/DD/YYYY", "example@email.com"].includes(placeholder)) {
        this.addFeedback("required", "Help text in placeholder", `"${cleanLabel}" has help text in placeholder field. Move this to the caption field below the question.`, `${widget.stepName} - ${widget.type}`, "Help Text & Errors");
      }

      const isRequired = widget.template?.required?.logic === true;
      const errorMessage = widget.template?.validationErrorMessage?.logic?.value || "";

      if (isRequired && (!errorMessage || errorMessage === "This field is required")) {
        this.addFeedback("consider", "Generic error message", `"${cleanLabel}" uses generic error message. Write a specific message like: "${cleanLabel} is required"`, `${widget.stepName} - ${widget.type}`, "Help Text & Errors");
      }

      if (widget.template?.validationPattern && widget.template.validationPattern !== "none") {
        if (!errorMessage || errorMessage.length < 10) {
          this.addFeedback("consider", "Missing validation error message", `"${cleanLabel}" has validation but no clear error message. Explain what format is expected.`, `${widget.stepName} - ${widget.type}`, "Help Text & Errors");
        }
      }

      const caption = widget.template?.caption?.logic?.value || "";
      const captionText = this.stripHtml(caption);
      if (captionText.length > 250) {
        this.addFeedback("consider", "Long caption text", `Caption text is ${captionText.length} characters. Use a separate Paragraph field above the question for better readability.`, `${widget.stepName} - ${widget.type}`, "Help Text & Errors");
      }

      if (cleanLabel.includes("(") && cleanLabel.includes(")")) {
        const parentheticalText = cleanLabel.match(/\(([^)]+)\)/);
        if (parentheticalText && parentheticalText[1].length > 20) {
          this.addFeedback("consider", "Help text in label", `"${cleanLabel}" includes help text in parentheses. Move "${parentheticalText[1]}" to the caption field.`, `${widget.stepName} - ${widget.type}`, "Help Text & Errors");
        }
      }
    });
  }
}
