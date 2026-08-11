/**
 * Deterministic, template-based content generator (V1 default).
 *
 * Produces a full weekly series (teaser / training / case study) for one topic,
 * plus CTA, hashtags and an infographic brief for each post. Runs with NO API
 * key. An AI-backed generator can later replace this behind IContentGenerator.
 *
 * Voice: professional, human, practical, Arabic-first with natural English
 * technical terms.
 */

import {
  ContentSlot,
  GeneratedPost,
  GeneratedSeries,
  InfographicBrief,
  PostType,
  Topic,
} from '../types';
import { IContentGenerator } from './content-generator.interface';
import { DefaultInfographicPromptBuilder } from '../infographic/prompt.builder';
import { hashtagsForTopic } from './styles/writing-style';
import { KnowledgeService, KnowledgeContext } from '../knowledge/knowledge.service';

const promptBuilder = new DefaultInfographicPromptBuilder();
const knowledge = new KnowledgeService();

/**
 * A short grounding line drawn from the real-experience corpus, so posts don't
 * read as generic. Returns '' when nothing relevant is found.
 */
function groundingLine(ctx: KnowledgeContext, type: PostType): string {
  if (type === 'training' && ctx.lesson) {
    return `\n\nمن واقع الخبرة العملية: ${ctx.lesson.lesson}`;
  }
  if (type === 'case_study' && ctx.achievement) {
    return `\n\nملاحظة من تجربة سابقة: ${ctx.achievement.statement}`;
  }
  if (type === 'teaser' && ctx.experience) {
    return '';
  }
  return '';
}

/** CTA lines by post type (Arabic). */
const CTA: Record<PostType, string> = {
  teaser: 'شاركني في التعليقات: هل واجهت هذا الموقف من قبل؟ وكيف تعاملت معه؟',
  training:
    'إذا كان هذا المحتوى مفيدًا، احفظ المنشور وشاركه مع فريقك في Application Support.',
  case_study:
    'ما القرار الذي كنت ستتخذه في هذا السيناريو؟ اكتب رأيك في التعليقات لنتناقش.',
};

function teaserBody(topic: string): string {
  return [
    `كثير من فرق الـ IT تتعامل مع «${topic}» كأنه تفصيل تقني بسيط،`,
    `بينما هو في الواقع أحد أهم الأسباب التي تفصل بين فريق يطفئ الحرائق يوميًا`,
    `وفريق آخر يعمل بهدوء وثقة.`,
    ``,
    `السؤال الذي يستحق التوقف عنده:`,
    `هل نتعامل مع الأعراض؟ أم مع السبب الحقيقي؟`,
    ``,
    `في تجربتي العملية، الفرق بينهما لا يظهر في يوم واحد،`,
    `لكنه يظهر بوضوح في نهاية كل ربع سنة — في الأرقام، وفي رضا المستخدمين.`,
    ``,
    `هذا الأسبوع سنفكك الموضوع خطوة بخطوة.`,
  ].join('\n');
}

function trainingBody(topic: string): string {
  return [
    `موضوع اليوم: ${topic}.`,
    ``,
    `دعنا نبسّطه بعيدًا عن التعقيد النظري:`,
    ``,
    `• المفهوم: ما الذي نتحدث عنه فعليًا، وأين يبدأ وأين ينتهي.`,
    `• الهدف: ما القيمة التي يضيفها للأعمال (Business Value)، وليس فقط للـ IT.`,
    `• التطبيق: كيف يبدو تنفيذه الصحيح على أرض الواقع.`,
    `• الخطأ الشائع: أكثر نقطة يقع فيها الفرق دون أن ينتبهوا.`,
    ``,
    `القاعدة العملية التي أعتمد عليها:`,
    `الأدوات (Tools) لا تحل المشكلة وحدها — العملية الواضحة (Process) والمسؤولية المحددة (Ownership) هي الأساس.`,
    ``,
    `الإنفوجرافيك المرفق يلخّص الفكرة في صورة واحدة يمكنك مشاركتها مع فريقك.`,
  ].join('\n');
}

function caseStudyBody(topic: string): string {
  return [
    `سيناريو واقعي — ${topic}:`,
    ``,
    `تطبيق حسّاس يخدم عملية تشغيلية يومية بدأ يُظهر بطئًا متكررًا كل صباح`,
    `في ساعة الذروة. الفريق يعيد تشغيل الخدمة، فتعود الأمور «طبيعية» لبضع ساعات،`,
    `ثم تتكرر المشكلة في اليوم التالي.`,
    ``,
    `المستخدمون بدأوا يفقدون الثقة، والإدارة تسأل: «لماذا لم تُحل بعد؟»`,
    ``,
    `أمامك مساران:`,
    `1) الاستمرار في المعالجة السريعة لإبقاء الخدمة تعمل (حل مؤقت).`,
    `2) فتح تحقيق أعمق للوصول إلى السبب الجذري (Root Cause) وإغلاقه نهائيًا.`,
    ``,
    `كل مسار له تكلفة: الأول يوفر الوقت الآن، والثاني يوفر الاستقرار لاحقًا.`,
  ].join('\n');
}

const BODY_BUILDERS: Record<PostType, (topic: string) => string> = {
  teaser: teaserBody,
  training: trainingBody,
  case_study: caseStudyBody,
};

function briefFor(type: PostType, topic: string): InfographicBrief {
  switch (type) {
    case 'training':
      return {
        title: topic,
        keyPoints: [
          'المفهوم: التعريف والحدود',
          'الهدف: القيمة للأعمال (Business Value)',
          'التطبيق العملي الصحيح',
          'الخطأ الشائع الذي يجب تجنبه',
        ],
        takeaway: 'العملية الواضحة والمسؤولية المحددة قبل الأدوات',
      };
    case 'case_study':
      return {
        title: `سيناريو: ${topic}`,
        keyPoints: [
          'المشكلة تتكرر رغم المعالجة السريعة',
          'حل مؤقت مقابل حل جذري (Root Cause)',
          'التكلفة على المستخدم وعلى الأعمال',
          'ما القرار الأنسب؟',
        ],
        takeaway: 'عالج السبب لا العرض',
      };
    case 'teaser':
    default:
      return {
        title: topic,
        keyPoints: [
          'عرض (Symptom) أم سبب (Cause)؟',
          'أثر يظهر في نهاية الربع',
          'انطباع المستخدم وثقته',
        ],
        takeaway: 'الفرق يظهر في الأرقام لا في يوم واحد',
      };
  }
}

export class TemplateContentGenerator implements IContentGenerator {
  readonly name = 'template';

  generateSeries(topic: Topic, slots: ContentSlot[]): GeneratedSeries {
    const ctx = knowledge.forTopic(topic.slug || topic.title);
    const posts: GeneratedPost[] = slots.map((slot) =>
      this.buildPost(topic.title, slot, ctx),
    );
    return { topicId: topic.id, topic: topic.title, posts };
  }

  private buildPost(
    topic: string,
    slot: ContentSlot,
    ctx: KnowledgeContext,
  ): GeneratedPost {
    const type = slot.type;
    const body = `${BODY_BUILDERS[type](topic)}${groundingLine(ctx, type)}\n\n${CTA[type]}`;
    const brief = briefFor(type, topic);
    const infographicPrompt = promptBuilder.build(topic, brief);
    const typeLabel: Record<PostType, string> = {
      teaser: 'Teaser',
      training: 'Training',
      case_study: 'Case Study',
    };

    return {
      type,
      day: slot.day,
      title: `${topic} — ${typeLabel[type]} (${slot.day})`,
      body,
      hashtags: hashtagsForTopic(topic),
      infographicPrompt,
    };
  }
}
