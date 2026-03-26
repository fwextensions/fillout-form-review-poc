// Form Review Engine
class FormReviewer {
    constructor() {
        this.feedbackItems = [];
        this.allWidgets = [];
        this.steps = {};
    }

    review(formJson) {
        this.feedbackItems = [];
        
        try {
            const form = typeof formJson === 'string' ? JSON.parse(formJson) : formJson;
            
            // Extract all widgets from all steps
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
        } catch (error) {
            this.addFeedback('critical', 'Invalid JSON', `Unable to parse form JSON: ${error.message}`);
            return this.feedbackItems;
        }
    }

    extractAllWidgets(form) {
        const widgets = [];
        const steps = form.template?.steps || {};
        
        Object.entries(steps).forEach(([stepId, step]) => {
            const stepWidgets = step.template?.widgets || {};
            Object.entries(stepWidgets).forEach(([widgetId, widget]) => {
                widgets.push({
                    ...widget,
                    stepId,
                    stepName: step.name,
                    widgetId
                });
            });
        });
        
        return widgets;
    }

    getLabel(widget) {
        return widget.template?.label?.logic?.value || 
               widget.template?.contents?.logic?.value || 
               widget.template?.title?.logic?.value ||
               widget.name || '';
    }

    stripHtml(html) {
        return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
    }

    addFeedback(severity, title, message, location = null, category = 'General') {
        this.feedbackItems.push({
            id: Date.now() + Math.random(),
            severity,
            title,
            message,
            location,
            category,
            helpful: null
        });
    }

    checkThemeAndVisual(form) {
        // Check if sf.gov theme is being used
        const theme = form.template?.theme;
        if (theme && theme.name && !theme.name.includes('SF.gov')) {
            this.addFeedback('critical', 'Not using sf.gov theme', 
                `Form uses "${theme.name}" theme. Switch to "SF.gov Theme (Use me!)" in form settings.`, 
                null,
                'Theme & Visual Design');
        }
        
        this.allWidgets.forEach((widget) => {
            const label = this.getLabel(widget);
            const cleanLabel = this.stripHtml(label);
            
            // Skip non-question widgets
            if (['Button', 'Divider'].includes(widget.type)) return;
            
            // Check for bold text in labels - but allow it in headings
            if ((label.includes('<strong>') || label.includes('<b>')) && 
                widget.type !== 'Text' && widget.type !== 'Paragraph') {
                if (cleanLabel.length > 0) {
                    const suggestion = cleanLabel.replace(/\*\*/g, '');
                    this.addFeedback('warning', 'Bold question text', 
                        `"${cleanLabel}" uses bold formatting. Remove bold to match sf.gov theme.`, 
                        `${widget.stepName} - ${widget.type}`,
                        'Theme & Visual Design');
                }
            }
            
            // Check for font color changes - but be specific about what's wrong
            if (label.includes('style="color:') || label.includes('style=\"color:')) {
                const colorMatch = label.match(/color:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                if (colorMatch && cleanLabel.length > 0) {
                    // Check if it's not the default black/dark color
                    const [_, r, g, b] = colorMatch;
                    if (!(r < 50 && g < 50 && b < 50)) {
                        this.addFeedback('warning', 'Custom font color', 
                            `"${cleanLabel}" uses custom color (rgb(${r}, ${g}, ${b})). Use default text colors from sf.gov theme.`, 
                            `${widget.stepName} - ${widget.type}`,
                            'Theme & Visual Design');
                    }
                }
            }
        });
    }

    checkPageStructure(form) {
        const formSteps = Object.values(this.steps).filter(s => s.type === 'form');
        const endingSteps = Object.values(this.steps).filter(s => s.type === 'ending');
        
        // Count total input widgets across all form steps
        const inputWidgets = this.allWidgets.filter(w => 
            !['Text', 'Paragraph', 'Divider', 'Button', 'Alert'].includes(w.type)
        );
        
        if (inputWidgets.length > 15 && formSteps.length <= 1) {
            this.addFeedback('warning', 'Long form without pages', 
                `Form has ${inputWidgets.length} input fields on a single page. Break into multiple pages (10-15 questions each) to reduce cognitive load and improve completion rates.`,
                null,
                'Page Structure');
        }

        if (formSteps.length > 1) {
            // Check for intro content on first page
            const firstStep = formSteps[0];
            const firstStepWidgets = Object.values(firstStep.template?.widgets || {});
            const hasIntroText = firstStepWidgets.some(w => 
                (w.type === 'Paragraph' || w.type === 'Text') && 
                this.getLabel(w).length > 100
            );
            
            if (!hasIntroText) {
                this.addFeedback('info', 'Add intro page', 
                    `Multi-page form should start with an intro page explaining: (1) Purpose of the form, (2) Required documents, (3) Estimated time to complete (e.g., "Takes about 10 minutes").`,
                    firstStep.name,
                    'Page Structure');
            }
            
            // Check for descriptive page names
            formSteps.forEach((step, index) => {
                if (!step.name || step.name.includes('Untitled') || step.name === 'Page' || /^Page \d+$/.test(step.name)) {
                    this.addFeedback('info', 'Generic page name', 
                        `Page ${index + 1} has generic name "${step.name}". Use descriptive names like "About you", "Contact information", "Income and household".`,
                        step.name,
                        'Page Structure');
                }
            });
        }

        // Check ending page for clear next steps
        if (endingSteps.length > 0) {
            const endingStep = endingSteps[0];
            const thankYouWidget = Object.values(endingStep.template?.widgets || {})
                .find(w => w.type === 'ThankYou');
            
            if (thankYouWidget) {
                const subtitle = thankYouWidget.template?.richSubtitleText?.logic?.value || '';
                const subtitleText = this.stripHtml(subtitle);
                
                // Check if it's just the default Fillout message
                if (subtitleText.includes('Made with Fillout')) {
                    this.addFeedback('warning', 'Default confirmation message', 
                        `Confirmation page uses default Fillout message. Replace with: (1) What happens next, (2) When to expect a response, (3) Who to contact with questions.`,
                        endingStep.name,
                        'Page Structure');
                } else if (subtitleText.length < 30) {
                    this.addFeedback('warning', 'Incomplete confirmation page', 
                        `Confirmation page message is very brief. Include: (1) What happens next, (2) Timeline for response, (3) Contact information for questions.`,
                        endingStep.name,
                        'Page Structure');
                } else {
                    // Check for specific elements with better patterns
                    const hasTimeline = /within|by|in \d+|days|weeks|business days|will contact|expect.*response/i.test(subtitleText);
                    const hasContactInfo = /@|phone|call|\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/i.test(subtitleText);
                    
                    const missingElements = [];
                    
                    if (!hasTimeline) {
                        missingElements.push('timeline for response (e.g., "within one week", "in 5 business days")');
                    }
                    
                    if (!hasContactInfo) {
                        missingElements.push('contact information (email address or phone number for questions)');
                    }
                    
                    if (missingElements.length > 0) {
                        this.addFeedback('info', 'Improve confirmation page', 
                            `Confirmation page could be clearer. Consider adding: ${missingElements.join('; ')}.`,
                            endingStep.name,
                            'Page Structure');
                    }
                }
            }
        }
    }

    checkHeadingsAndTypography(form) {
        const headingsByStep = {};
        
        this.allWidgets.forEach((widget) => {
            const label = this.getLabel(widget);
            const cleanLabel = this.stripHtml(label);
            
            if (!cleanLabel) return;
            
            // Check for all caps (excluding acronyms and short words)
            const words = cleanLabel.split(/\s+/);
            const allCapsWords = words.filter(word => 
                word.length > 3 && 
                word === word.toUpperCase() && 
                /^[A-Z]+$/.test(word) &&
                !['PDF', 'ID', 'URL', 'API', 'DOB', 'SSN', 'MOHCD', 'CHIPPS'].includes(word)
            );
            
            if (allCapsWords.length > 0) {
                const sentenceCaseVersion = allCapsWords.map(w => 
                    w.charAt(0) + w.slice(1).toLowerCase()
                ).join(', ');
                this.addFeedback('critical', 'All caps text', 
                    `"${cleanLabel}" uses all caps (${allCapsWords.join(', ')}). Use sentence case: "${sentenceCaseVersion}".`, 
                    `${widget.stepName} - ${widget.type}`,
                    'Headings & Typography');
            }

            // Collect heading information per step
            if (widget.type === 'Text' || widget.type === 'Paragraph') {
                if (!headingsByStep[widget.stepName]) {
                    headingsByStep[widget.stepName] = {
                        hasH1: false,
                        hasH2: false,
                        hasH3: false,
                        hasH4: false,
                        h1Count: 0
                    };
                }
                
                const stepHeadings = headingsByStep[widget.stepName];
                stepHeadings.hasH1 = stepHeadings.hasH1 || label.includes('<h1>');
                stepHeadings.hasH2 = stepHeadings.hasH2 || label.includes('<h2>');
                stepHeadings.hasH3 = stepHeadings.hasH3 || label.includes('<h3>');
                stepHeadings.hasH4 = stepHeadings.hasH4 || label.includes('<h4>');
                stepHeadings.h1Count += (label.match(/<h1>/g) || []).length;
            }
        });
        
        // Check heading hierarchy per page
        Object.entries(headingsByStep).forEach(([stepName, headings]) => {
            // Check for multiple h1s
            if (headings.h1Count > 1) {
                this.addFeedback('warning', 'Multiple h1 headings', 
                    `Page "${stepName}" has ${headings.h1Count} h1 headings. Use only one h1 per page.`, 
                    stepName,
                    'Headings & Typography');
            }
            
            // Check for missing h1
            if (!headings.hasH1 && (headings.hasH2 || headings.hasH3 || headings.hasH4)) {
                this.addFeedback('warning', 'Missing h1 heading', 
                    `Page "${stepName}" has subheadings but no h1. Add an h1 as the main page heading.`, 
                    stepName,
                    'Headings & Typography');
            }
            
            // Check for skipped heading levels
            if (headings.hasH3 && !headings.hasH2) {
                this.addFeedback('warning', 'Skipped heading level', 
                    `Page "${stepName}" uses h3 without h2. Use proper hierarchy: h1 → h2 → h3.`, 
                    stepName,
                    'Headings & Typography');
            }
            
            if (headings.hasH4 && !headings.hasH3) {
                this.addFeedback('warning', 'Skipped heading level', 
                    `Page "${stepName}" uses h4 without h3. Use proper hierarchy: h1 → h2 → h3 → h4.`, 
                    stepName,
                    'Headings & Typography');
            }
        });
    }

    checkLabelsAndLanguage(form) {
        this.allWidgets.forEach((widget) => {
            const label = this.getLabel(widget);
            const cleanLabel = this.stripHtml(label);
            
            if (!cleanLabel || ['Text', 'Paragraph', 'Button', 'Divider', 'Alert'].includes(widget.type)) return;
            
            // Check for verbose labels with specific suggestions
            const verbosePatterns = [
                { pattern: /^what is your (.+)\??$/i, suggestion: (match) => match[1].charAt(0).toUpperCase() + match[1].slice(1) },
                { pattern: /^please enter (?:your )?(.+)\??$/i, suggestion: (match) => match[1].charAt(0).toUpperCase() + match[1].slice(1) },
                { pattern: /^please provide (?:your )?(.+)\??$/i, suggestion: (match) => match[1].charAt(0).toUpperCase() + match[1].slice(1) },
                { pattern: /^please select (?:your )?(.+)\??$/i, suggestion: (match) => match[1].charAt(0).toUpperCase() + match[1].slice(1) },
                { pattern: /^your (.+)$/i, suggestion: (match) => match[1].charAt(0).toUpperCase() + match[1].slice(1) },
            ];
            
            for (const { pattern, suggestion } of verbosePatterns) {
                const match = cleanLabel.match(pattern);
                if (match) {
                    const betterLabel = suggestion(match);
                    this.addFeedback('warning', 'Verbose label', 
                        `"${cleanLabel}" is too wordy. Simplify to: "${betterLabel}"`, 
                        `${widget.stepName} - ${widget.type}`,
                        'Labels & Language');
                    break;
                }
            }

            // Check for acronyms with context (only flag likely acronyms, not real words in all caps)
            const acronyms = cleanLabel.match(/\b[A-Z]{2,}\b/g) || [];
            const allowedAcronyms = ['PDF', 'ID', 'URL', 'API', 'US', 'SF', 'DOB', 'SSN', 'HIV', 'MOHCD', 'BAN', 'OK'];
            
            // Filter to only likely acronyms: short (2-5 chars) or no vowels pattern
            const problematicAcronyms = acronyms.filter(acronym => {
                if (allowedAcronyms.includes(acronym)) return false;
                
                // If it's 2-5 characters, likely an acronym
                if (acronym.length >= 2 && acronym.length <= 5) {
                    // But exclude common short words
                    const commonWords = ['AM', 'PM', 'OR', 'AND', 'THE', 'FOR', 'NOT', 'BUT', 'CAN', 'MAY', 'YES', 'NO'];
                    if (commonWords.includes(acronym)) return false;
                    return true;
                }
                
                // If it's longer, only flag if it has very few vowels (likely acronym pattern)
                const vowelCount = (acronym.match(/[AEIOU]/g) || []).length;
                const consonantCount = acronym.length - vowelCount;
                // Flag if less than 30% vowels (e.g., "SFMTA" has 1 vowel in 5 letters = 20%)
                return vowelCount / acronym.length < 0.3 && consonantCount >= 3;
            });
            
            if (problematicAcronyms.length > 0) {
                const acronymList = problematicAcronyms.join(', ');
                this.addFeedback('warning', 'Unexplained acronym', 
                    `"${cleanLabel}" uses "${acronymList}". Write out the full term on first use, then use the acronym.`, 
                    `${widget.stepName} - ${widget.type}`,
                    'Labels & Language');
            }
            
            // Check reading level - flag overly complex language
            const wordCount = cleanLabel.split(/\s+/).length;
            const longWords = cleanLabel.split(/\s+/).filter(w => w.length > 12).length;
            if (wordCount > 20 && longWords > 3) {
                this.addFeedback('info', 'Complex language', 
                    `"${cleanLabel}" may be too complex. Aim for 5th-8th grade reading level. Break into simpler sentences or use simpler words.`, 
                    `${widget.stepName} - ${widget.type}`,
                    'Labels & Language');
            }
        });

        // Check for translation settings - check both locations
        const settings = form.settings || form.template?.settings || {};
        const translationsEnabled = settings.translationsEnabled;
        const availableTranslations = settings.availableTranslations || [];
        
        // Only flag if we can confirm translations are NOT enabled
        // (if settings object doesn't exist, translations might be configured in Fillout UI)
        if (settings && Object.keys(settings).length > 0) {
            if (!translationsEnabled) {
                this.addFeedback('warning', 'Translations not enabled', 
                    'Enable machine translation in form settings for: Traditional Chinese (zh-CHT), Spanish (es), Vietnamese (vi), Filipino (fil)',
                    null,
                    'Labels & Language');
            } else {
                // Check for required languages
                const requiredLanguages = {
                    'zh-CHT': 'Traditional Chinese',
                    'es': 'Spanish',
                    'vi': 'Vietnamese',
                    'fil': 'Filipino'
                };
                
                const missingLanguages = [];
                Object.entries(requiredLanguages).forEach(([code, name]) => {
                    if (!availableTranslations.includes(code)) {
                        missingLanguages.push(`${name} (${code})`);
                    }
                });
                
                if (missingLanguages.length > 0) {
                    this.addFeedback('warning', 'Missing required translations', 
                        `Add these languages to machine translation: ${missingLanguages.join(', ')}`,
                        null,
                        'Labels & Language');
                }
            }
        }
        // If no settings object exists, we can't determine translation status from the export
    }

    checkQuestionDesign(form) {
        this.allWidgets.forEach((widget) => {
            const label = this.getLabel(widget);
            const cleanLabel = this.stripHtml(label);
            
            if (!cleanLabel || ['Text', 'Paragraph', 'Button', 'Divider', 'Alert'].includes(widget.type)) return;
            
            // Check for double-barrelled questions with specific examples
            const questionMarks = (cleanLabel.match(/\?/g) || []).length;
            if (questionMarks > 1) {
                this.addFeedback('warning', 'Multiple questions', 
                    `"${cleanLabel}" asks multiple questions. Split into separate questions - one per field.`, 
                    `${widget.stepName} - ${widget.type}`,
                    'Question Design');
            }
            
            // Check for "and" in questions - be smarter about false positives
            if (cleanLabel.includes('?')) {
                const beforeQuestion = cleanLabel.substring(0, cleanLabel.indexOf('?'));
                const andCount = (beforeQuestion.toLowerCase().match(/ and /g) || []).length;
                
                // Only flag if there are multiple "and"s or specific patterns
                if (andCount > 1 || /will you .+ and .+\?/i.test(cleanLabel) || /do you .+ and .+\?/i.test(cleanLabel)) {
                    this.addFeedback('warning', 'Possible double-barrelled question', 
                        `"${cleanLabel}" may ask multiple things. Example: Instead of "Do you have children and will they need meals?", ask two questions: "Do you have children?" then "Will they need meals?"`, 
                        `${widget.stepName} - ${widget.type}`,
                        'Question Design');
                }
            }

            // Check for conditional logic usage - be more specific
            const hasConditionalLogic = widget.template?.showOrHideCondition?.logic?.and?.length > 0 ||
                                       widget.template?.showOrHideCondition?.logic?.or?.length > 0;
            
            if (!hasConditionalLogic) {
                if (/\(if applicable\)|\(if yes\)|\(optional\)/i.test(cleanLabel)) {
                    this.addFeedback('info', 'Consider conditional logic', 
                        `"${cleanLabel}" includes conditional text. Use conditional logic to show/hide this question based on previous answers instead of adding "(if applicable)".`, 
                        `${widget.stepName} - ${widget.type}`,
                        'Question Design');
                }
            }
            
            // Check question order - personal questions should come later
            const isPersonalQuestion = /social security|ssn|income|salary|medical|health condition|disability|criminal|arrest/i.test(cleanLabel);
            if (isPersonalQuestion && widget.position?.row < 5) {
                this.addFeedback('info', 'Personal question placement', 
                    `"${cleanLabel}" asks for sensitive information early in the form. Consider moving personal questions later to build trust first.`, 
                    `${widget.stepName} - ${widget.type}`,
                    'Question Design');
            }
        });
    }

    checkInputTypes(form) {
        this.allWidgets.forEach((widget) => {
            const label = this.getLabel(widget);
            const cleanLabel = this.stripHtml(label);
            
            // Check dropdown vs radio buttons with reasoning
            if (widget.type === 'Dropdown') {
                const options = widget.template?.options?.staticOptions || [];
                if (options.length <= 10 && options.length > 0) {
                    this.addFeedback('info', 'Consider radio buttons', 
                        `"${cleanLabel}" uses dropdown with ${options.length} options. Radio buttons are better for ≤10 options because users can see all choices at once without clicking.`, 
                        `${widget.stepName} - ${widget.type}`,
                        'Input Types');
                }
                
                // Check if dropdown is appropriate (user knows what to select)
                if (options.length > 50 && !widget.template?.placeholder?.logic?.value) {
                    this.addFeedback('info', 'Add search hint', 
                        `"${cleanLabel}" has ${options.length} options. Add placeholder text like "Start typing to search..." to help users.`, 
                        `${widget.stepName} - ${widget.type}`,
                        'Input Types');
                }
            }

            // Check for "Other" option with better logic
            if ((widget.type === 'MultipleChoice' || widget.type === 'Checkboxes')) {
                const isRequired = widget.template?.required?.logic === true;
                const options = widget.template?.options?.staticOptions || [];
                const hasOther = options.some(opt => 
                    /other|don't know|not sure|decline|not listed|none of the above|prefer not to answer/i.test(
                        this.stripHtml(opt.label?.logic?.value || '')
                    )
                );
                const showOtherChoice = widget.template?.showOtherChoice;
                
                if (isRequired && !hasOther && !showOtherChoice && options.length > 0) {
                    // Be smarter about when to suggest "Other"
                    const needsOther = options.length < 20 && !cleanLabel.toLowerCase().includes('yes') && !cleanLabel.toLowerCase().includes('no');
                    if (needsOther) {
                        this.addFeedback('info', 'Consider "Other" option', 
                            `Required question "${cleanLabel}" should offer "Other", "I don't know", or "Prefer not to answer" so users aren't forced to choose an inaccurate option.`, 
                            `${widget.stepName} - ${widget.type}`,
                            'Input Types');
                    }
                }
            }

            // Check for reCAPTCHA with explanation
            if (widget.type === 'Captcha') {
                this.addFeedback('critical', 'reCAPTCHA detected', 
                    'Remove reCAPTCHA. It creates accessibility barriers and is not allowed in sf.gov forms. Use alternative spam prevention methods.', 
                    `${widget.stepName} - ${widget.type}`,
                    'Input Types');
            }
            
            // Check for appropriate field types
            if (widget.type === 'ShortAnswer' || widget.type === 'LongAnswer') {
                if (/email/i.test(cleanLabel) && widget.type !== 'EmailInput') {
                    this.addFeedback('warning', 'Use email field type', 
                        `"${cleanLabel}" asks for email. Use EmailInput field type for better validation and mobile keyboard.`, 
                        `${widget.stepName} - ${widget.type}`,
                        'Input Types');
                }
                
                if (/phone|telephone/i.test(cleanLabel) && widget.type !== 'PhoneNumber') {
                    this.addFeedback('warning', 'Use phone field type', 
                        `"${cleanLabel}" asks for phone number. Use PhoneNumber field type for better validation and formatting.`, 
                        `${widget.stepName} - ${widget.type}`,
                        'Input Types');
                }
                
                if (/address|street/i.test(cleanLabel) && widget.type !== 'Address') {
                    this.addFeedback('warning', 'Use address field type', 
                        `"${cleanLabel}" asks for address. Use Address field type for structured data and autocomplete.`, 
                        `${widget.stepName} - ${widget.type}`,
                        'Input Types');
                }
            }
        });
    }

    checkHelpTextAndErrors(form) {
        this.allWidgets.forEach((widget) => {
            const label = this.getLabel(widget);
            const cleanLabel = this.stripHtml(label);
            const placeholder = widget.template?.placeholder?.logic?.value || '';
            
            // Check for help text in placeholder - be specific
            if (placeholder.length > 30 && !['MM/DD/YYYY', 'example@email.com'].includes(placeholder)) {
                this.addFeedback('warning', 'Help text in placeholder', 
                    `"${cleanLabel}" has help text in placeholder field. Move this to the caption field below the question where it's always visible.`, 
                    `${widget.stepName} - ${widget.type}`,
                    'Help Text & Errors');
            }

            // Check for generic error messages with specific suggestions
            const isRequired = widget.template?.required?.logic === true;
            const errorMessage = widget.template?.validationErrorMessage?.logic?.value || '';
            
            if (isRequired && (!errorMessage || errorMessage === 'This field is required')) {
                // Use the full question text for the error message suggestion
                const fieldLabel = cleanLabel;
                                 
                this.addFeedback('info', 'Generic error message', 
                    `"${cleanLabel}" uses generic error message. Write specific message like: "${fieldLabel} is required"`, 
                    `${widget.stepName} - ${widget.type}`,
                    'Help Text & Errors');
            }
            
            // Check for validation patterns without clear error messages
            if (widget.template?.validationPattern && widget.template.validationPattern !== 'none') {
                if (!errorMessage || errorMessage.length < 10) {
                    this.addFeedback('warning', 'Missing validation error message', 
                        `"${cleanLabel}" has validation but no clear error message. Explain what format is expected (e.g., "Enter a valid email address").`, 
                        `${widget.stepName} - ${widget.type}`,
                        'Help Text & Errors');
                }
            }

            // Check caption length and suggest paragraph field
            const caption = widget.template?.caption?.logic?.value || '';
            const captionText = this.stripHtml(caption);
            if (captionText.length > 250) {
                this.addFeedback('info', 'Long caption text', 
                    `Caption text is ${captionText.length} characters. If it runs longer than 2-3 lines, use a separate Paragraph field above the question for better readability.`, 
                    `${widget.stepName} - ${widget.type}`,
                    'Help Text & Errors');
            }
            
            // Check for help text that should be in caption
            if (cleanLabel.includes('(') && cleanLabel.includes(')')) {
                const parentheticalText = cleanLabel.match(/\(([^)]+)\)/);
                if (parentheticalText && parentheticalText[1].length > 20) {
                    this.addFeedback('info', 'Help text in label', 
                        `"${cleanLabel}" includes help text in parentheses. Move "${parentheticalText[1]}" to the caption field for better readability.`, 
                        `${widget.stepName} - ${widget.type}`,
                        'Help Text & Errors');
                }
            }
        });
    }
}

// UI Controller
class FormReviewUI {
    constructor() {
        this.reviewer = new FormReviewer();
        this.init();
    }

    init() {
        this.reviewBtn = document.getElementById('reviewBtn');
        this.formJsonInput = document.getElementById('formJson');
        this.resultsSection = document.getElementById('resultsSection');
        this.summaryDiv = document.getElementById('summary');
        this.feedbackDiv = document.getElementById('feedback');

        this.reviewBtn.addEventListener('click', () => this.handleReview());
    }

    handleReview() {
        const jsonText = this.formJsonInput.value.trim();
        
        if (!jsonText) {
            alert('Please paste form JSON');
            return;
        }

        const feedback = this.reviewer.review(jsonText);
        this.displayResults(feedback);
    }

    displayResults(feedback) {
        this.resultsSection.classList.remove('hidden');
        
        const critical = feedback.filter(f => f.severity === 'critical');
        const warnings = feedback.filter(f => f.severity === 'warning');
        const info = feedback.filter(f => f.severity === 'info');

        // Generate assessment message
        let assessment = '';
        let topFixes = '';
        
        if (critical.length === 0 && warnings.length === 0) {
            assessment = 'Great work! This form follows sf.gov standards well.';
        } else if (critical.length > 0) {
            assessment = 'This form has critical issues that must be fixed before publishing.';
            topFixes = this.generateTopFixes(critical);
        } else if (warnings.length > 5) {
            assessment = 'This form needs several improvements to meet sf.gov standards.';
            topFixes = this.generateTopFixes(warnings);
        } else if (warnings.length > 0) {
            assessment = 'This form is close to meeting standards with a few improvements needed.';
            topFixes = this.generateTopFixes(warnings);
        } else {
            assessment = 'This form meets standards. Consider the suggestions below to improve user experience.';
        }

        this.summaryDiv.innerHTML = `
            <div class="assessment-message">${assessment}</div>
            ${topFixes ? `
                <div class="top-fixes">
                    <strong>Top priorities:</strong> ${topFixes}
                </div>
            ` : ''}
            <div class="summary-stats">
                <div><span class="stat passed">${feedback.length - critical.length - warnings.length}</span> passed</div>
                <div><span class="stat critical">${critical.length}</span> critical</div>
                <div><span class="stat warning">${warnings.length}</span> warnings</div>
                <div><span class="stat info">${info.length}</span> suggestions</div>
            </div>
        `;

        // Group feedback by title (not category), then sort by severity
        const titleGroups = {};
        feedback.forEach(item => {
            if (!titleGroups[item.title]) {
                titleGroups[item.title] = [];
            }
            titleGroups[item.title].push(item);
        });

        // Sort title groups by severity
        const severityOrder = { 'critical': 0, 'warning': 1, 'info': 2 };
        const sortedTitles = Object.entries(titleGroups).sort((a, b) => {
            const severityA = severityOrder[a[1][0].severity];
            const severityB = severityOrder[b[1][0].severity];
            return severityA - severityB;
        });
        
        this.feedbackDiv.innerHTML = sortedTitles
            .map(([title, items]) => {
                return this.createGroupedFeedbackItems(title, items);
            }).join('');
        
        feedback.forEach(item => {
            const helpfulBtn = document.getElementById(`helpful-${item.id}`);
            const unhelpfulBtn = document.getElementById(`unhelpful-${item.id}`);
            if (helpfulBtn) {
                helpfulBtn.addEventListener('click', () => this.markFeedback(item.id, true));
            }
            if (unhelpfulBtn) {
                unhelpfulBtn.addEventListener('click', () => this.markFeedback(item.id, false));
            }
        });

        this.resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    generatePositiveFeedback(allFeedback) {
        const positives = [];
        
        // Check what's going well
        const categories = {};
        allFeedback.forEach(item => {
            if (!categories[item.category]) {
                categories[item.category] = 0;
            }
            categories[item.category]++;
        });
        
        const totalIssues = allFeedback.length;
        const criticalCount = allFeedback.filter(f => f.severity === 'critical').length;
        
        // Theme & Visual Design
        if (!categories['Theme & Visual Design'] || categories['Theme & Visual Design'] === 0) {
            positives.push({ text: 'using the sf.gov theme correctly', connector: 'is' });
        }
        
        // Headings & Typography
        if (!categories['Headings & Typography'] || categories['Headings & Typography'] <= 1) {
            positives.push({ text: 'good heading structure', connector: 'has' });
        }
        
        // Input Types
        if (!categories['Input Types'] || categories['Input Types'] === 0) {
            positives.push({ text: 'appropriate field types', connector: 'has' });
        }
        
        // No critical issues
        if (criticalCount === 0) {
            positives.push({ text: 'no critical accessibility issues', connector: 'has' });
        }
        
        // Overall good
        if (totalIssues <= 5) {
            positives.push({ text: 'following most best practices', connector: 'is' });
        }
        
        if (positives.length === 0) {
            return '';
        }
        
        if (positives.length === 1) {
            return `This form ${positives[0].connector} ${positives[0].text}.`;
        }
        
        if (positives.length === 2) {
            return `This form ${positives[0].connector} ${positives[0].text} and ${positives[1].connector === 'has' ? 'has' : 'there are'} ${positives[1].text}.`;
        }
        
        // For 3+ positives, use a simpler structure
        const intro = 'Nice work! This form ';
        const items = positives.slice(0, 3).map(p => p.text);
        return intro + 'has ' + items.slice(0, -1).join(', ') + ', and ' + items[items.length - 1] + '.';
    }

    generateTopFixes(issues) {
        // Group issues by category
        const byCategory = {};
        issues.forEach(item => {
            if (!byCategory[item.category]) {
                byCategory[item.category] = [];
            }
            byCategory[item.category].push(item.title);
        });

        // Create smart summaries for each category
        const summaries = [];
        
        Object.entries(byCategory).forEach(([category, titles]) => {
            const uniqueTitles = [...new Set(titles)];
            
            // Theme & Visual Design
            if (category === 'Theme & Visual Design') {
                const hasColor = uniqueTitles.some(t => t.includes('color'));
                const hasBold = uniqueTitles.some(t => t.includes('Bold'));
                if (hasColor && hasBold) {
                    summaries.push('keep fonts and colors within sf.gov theme');
                } else if (hasColor) {
                    summaries.push('use default text colors from sf.gov theme');
                } else if (hasBold) {
                    summaries.push('remove bold formatting from questions');
                }
            }
            
            // Headings & Typography
            else if (category === 'Headings & Typography') {
                const hasCaps = uniqueTitles.some(t => t.includes('caps'));
                const hasHeading = uniqueTitles.some(t => t.includes('heading'));
                if (hasCaps && hasHeading) {
                    summaries.push('fix text capitalization and heading structure');
                } else if (hasCaps) {
                    summaries.push('use sentence case instead of all caps');
                } else if (hasHeading) {
                    summaries.push('fix heading hierarchy (h1 → h2 → h3)');
                }
            }
            
            // Labels & Language
            else if (category === 'Labels & Language') {
                const hasVerbose = uniqueTitles.some(t => t.includes('Verbose'));
                const hasAcronym = uniqueTitles.some(t => t.includes('acronym'));
                const hasTranslation = uniqueTitles.some(t => t.includes('translation'));
                
                const parts = [];
                if (hasVerbose) parts.push('shorten labels');
                if (hasAcronym) parts.push('explain acronyms');
                if (hasTranslation) parts.push('enable translations');
                
                if (parts.length > 0) {
                    summaries.push(parts.join(', '));
                }
            }
            
            // Page Structure
            else if (category === 'Page Structure') {
                const hasPages = uniqueTitles.some(t => t.includes('page'));
                const hasConfirmation = uniqueTitles.some(t => t.includes('confirmation'));
                
                if (hasPages && hasConfirmation) {
                    summaries.push('improve page structure and confirmation message');
                } else if (hasPages) {
                    summaries.push('break long form into multiple pages');
                } else if (hasConfirmation) {
                    summaries.push('improve confirmation page with clear next steps');
                }
            }
            
            // Input Types
            else if (category === 'Input Types') {
                const hasCaptcha = uniqueTitles.some(t => t.includes('CAPTCHA'));
                const hasFieldType = uniqueTitles.some(t => t.includes('field type'));
                
                if (hasCaptcha) {
                    summaries.push('remove reCAPTCHA');
                } else if (hasFieldType) {
                    summaries.push('use appropriate field types (email, phone, address)');
                } else {
                    summaries.push('improve input field types');
                }
            }
            
            // Help Text & Errors
            else if (category === 'Help Text & Errors') {
                const hasPlaceholder = uniqueTitles.some(t => t.includes('placeholder'));
                const hasError = uniqueTitles.some(t => t.includes('error'));
                
                if (hasPlaceholder && hasError) {
                    summaries.push('fix help text placement and error messages');
                } else if (hasPlaceholder) {
                    summaries.push('move help text from placeholders to captions');
                } else if (hasError) {
                    summaries.push('write specific error messages');
                }
            }
            
            // Question Design
            else if (category === 'Question Design') {
                const hasDouble = uniqueTitles.some(t => t.includes('double') || t.includes('Multiple'));
                if (hasDouble) {
                    summaries.push('split double-barrelled questions');
                } else {
                    summaries.push('improve question design');
                }
            }
            
            // Fallback for other categories
            else if (uniqueTitles.length === 1) {
                summaries.push(uniqueTitles[0].toLowerCase());
            } else if (uniqueTitles.length === 2) {
                summaries.push(uniqueTitles.join(' and ').toLowerCase());
            }
        });

        return summaries.slice(0, 2).join('; ');
    }

    createGroupedFeedbackItems(title, items) {
        const severity = items[0].severity;
        const isCollapsible = items.length > 5;
        const collapseId = `collapse-${Date.now()}-${Math.random()}`;
        
        // Generate summary message
        let summaryMessage = '';
        if (isCollapsible) {
            if (title.includes('All caps')) {
                summaryMessage = `${items.length} instances of all caps text need to be changed to sentence case.`;
            } else if (title.includes('Verbose label')) {
                summaryMessage = `${items.length} labels are too wordy and should be shortened.`;
            } else if (title.includes('Generic error')) {
                summaryMessage = `${items.length} fields need specific error messages instead of generic ones.`;
            } else if (title.includes('Bold')) {
                summaryMessage = `${items.length} questions use bold formatting that should be removed.`;
            } else if (title.includes('Custom font color')) {
                summaryMessage = `${items.length} fields use custom colors instead of theme defaults.`;
            } else if (title.includes('acronym')) {
                summaryMessage = `${items.length} unexplained acronyms need to be written out.`;
            } else if (title.includes('Missing h1')) {
                summaryMessage = `${items.length} pages are missing h1 headings.`;
            } else {
                summaryMessage = `${items.length} instances found.`;
            }
        }
        
        return `
            <div class="feedback-group ${severity}">
                <div class="feedback-group-header">
                    <div class="feedback-title">${title}</div>
                    <span class="severity-badge ${severity}">${severity}</span>
                </div>
                ${isCollapsible ? `
                    <div class="collapse-summary">
                        ${summaryMessage}
                        <button class="collapse-toggle" onclick="
                            const items = document.getElementById('${collapseId}');
                            const btn = this;
                            items.classList.toggle('collapsed');
                            btn.textContent = items.classList.contains('collapsed') ? 'Show all' : 'Hide all';
                        ">
                            Show all
                        </button>
                    </div>
                ` : ''}
                <div class="feedback-group-items ${isCollapsible ? 'collapsed' : ''}" id="${collapseId}">
                    ${items.map(item => `
                        <div class="feedback-subitem ${item.helpful === true ? 'marked-helpful' : ''} ${item.helpful === false ? 'marked-unhelpful' : ''}">
                            <div class="feedback-message">
                                ${item.message}
                                ${item.location ? `<br><em class="location-text">Location: ${item.location}</em>` : ''}
                            </div>
                            <div class="feedback-actions-inline">
                                <button class="feedback-icon-btn ${item.helpful === true ? 'active-helpful' : ''}" 
                                        id="helpful-${item.id}" 
                                        title="Helpful">
                                    ✓
                                </button>
                                <button class="feedback-icon-btn ${item.helpful === false ? 'active-unhelpful' : ''}" 
                                        id="unhelpful-${item.id}"
                                        title="Not helpful">
                                    ✕
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    createFeedbackItem(item) {
        return `
            <div class="feedback-item ${item.severity}" data-id="${item.id}">
                <div class="feedback-header">
                    <div class="feedback-title">${item.title}</div>
                    <span class="severity-badge ${item.severity}">${item.severity}</span>
                </div>
                <div class="feedback-message">
                    ${item.message}
                    ${item.location ? `<br><em>Location: ${item.location}</em>` : ''}
                </div>
                <div class="feedback-actions">
                    <button class="feedback-btn ${item.helpful === true ? 'active-helpful' : ''}" 
                            id="helpful-${item.id}">
                        👍 Helpful
                    </button>
                    <button class="feedback-btn ${item.helpful === false ? 'active-unhelpful' : ''}" 
                            id="unhelpful-${item.id}">
                        👎 Not helpful
                    </button>
                </div>
            </div>
        `;
    }

    markFeedback(itemId, isHelpful) {
        const item = this.reviewer.feedbackItems.find(f => f.id === itemId);
        if (item) {
            item.helpful = item.helpful === isHelpful ? null : isHelpful;
            this.displayResults(this.reviewer.feedbackItems);
            
            console.log('Feedback marked:', {
                itemId,
                title: item.title,
                helpful: item.helpful
            });
        }
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    new FormReviewUI();
});
