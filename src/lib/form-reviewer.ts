/* eslint-disable @typescript-eslint/no-explicit-any */

export interface FeedbackItem {
  id: number;
  severity: "critical" | "warning" | "info";
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
      this.addFeedback("critical", "Invalid JSON", `Unable to parse form JSON: ${error.message}`);
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
